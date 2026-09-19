"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {saveMaterialProfileConfig} from "@/app/material-profile-actions";

export type MaterialProfileImportTarget={
  kind:"contract"|"installation";contract_id:string;installation_id:string|null;
  client:string;rut:string;contract:string;contract_code:string;installation:string|null;label:string;
};
export type MaterialProfileImportRow={
  selected?:string;authorized_qty?:string;period_type?:string;material_id?:string;
  family?:string;supplier_code?:string;material?:string;presentation?:string;unit?:string;
};
const clean=(v:unknown)=>String(v??"").trim();
const norm=(v:unknown)=>clean(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es-CL").replace(/[^a-z0-9]+/g," ").trim();
const normRut=(v:unknown)=>clean(v).toUpperCase().replace(/[^0-9K]/g,"");
const selected=(v:unknown)=>["x","1","si","sí","s","yes","true"].includes(norm(v));
const PERIODS=new Set(["Mensual","Bimensual","Trimestral","Cuatrimestral","Semestral"]);

async function ctx(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)throw new Error("Sesión no válida");
 const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
 if(!profile?.active||!["Admin Total","Gerencia","Admin"].includes(profile.role))throw new Error("No autorizado para configurar materiales");
 return{supabase,user,profile};
}

export async function findMaterialProfileImportTargets(query:string){
 const {supabase}=await ctx();const q=clean(query);if(q.length<2)return[];
 const [{data:clients,error:ce},{data:contracts,error:co},{data:installations,error:ie}]=await Promise.all([
  supabase.from("clients").select("id,legal_name,rut,active").eq("active",true),
  supabase.from("contracts").select("id,client_id,name,code,active").eq("active",true),
  supabase.from("installations").select("id,contract_id,name,region,city,commune,active").eq("active",true)
 ]);
 if(ce||co||ie)throw new Error(ce?.message||co?.message||ie?.message||"No fue posible buscar");
 const clientById=new Map((clients||[]).map((x:any)=>[x.id,x]));
 const contractById=new Map((contracts||[]).map((x:any)=>[x.id,x]));
 const nq=norm(q),rq=normRut(q),out:MaterialProfileImportTarget[]=[];
 for(const c of contracts||[]){
  const cl:any=clientById.get(c.client_id);if(!cl)continue;
  const match=[cl.legal_name,cl.rut,c.name,c.code].some(v=>norm(v).includes(nq))||(rq.length>=4&&normRut(cl.rut).includes(rq));
  if(match)out.push({kind:"contract",contract_id:c.id,installation_id:null,client:cl.legal_name,rut:cl.rut||"",contract:c.name,contract_code:c.code||"",installation:null,label:`${cl.legal_name} · ${c.name} · Contrato completo`});
 }
 for(const i of installations||[]){
  const c:any=contractById.get(i.contract_id),cl:any=c?clientById.get(c.client_id):null;if(!c||!cl)continue;
  const match=[cl.legal_name,cl.rut,c.name,c.code,i.name,i.region,i.city,i.commune].some(v=>norm(v).includes(nq))||(rq.length>=4&&normRut(cl.rut).includes(rq));
  if(match)out.push({kind:"installation",contract_id:c.id,installation_id:i.id,client:cl.legal_name,rut:cl.rut||"",contract:c.name,contract_code:c.code||"",installation:i.name,label:`${cl.legal_name} · ${c.name} · ${i.name}`});
 }
 return out.slice(0,30);
}

async function validateTarget(supabase:any,target:MaterialProfileImportTarget){
 const {data:contract}=await supabase.from("contracts").select("id,client_id,name,code,active,clients(id,legal_name,rut,active)").eq("id",target.contract_id).eq("active",true).single();
 if(!contract)throw new Error("Contrato no válido o inactivo");
 let installation:any=null;
 if(target.kind==="installation"){
  if(!target.installation_id)throw new Error("Instalación obligatoria");
  const r=await supabase.from("installations").select("id,name,contract_id,active").eq("id",target.installation_id).eq("contract_id",target.contract_id).eq("active",true).single();
  if(r.error||!r.data)throw new Error("La instalación no pertenece al contrato");installation=r.data;
 }
 return{contract,installation};
}

export async function previewMaterialProfileImport(target:MaterialProfileImportTarget,rows:MaterialProfileImportRow[]){
 const {supabase}=await ctx();await validateTarget(supabase,target);
 if(!Array.isArray(rows)||!rows.length)throw new Error("El archivo no contiene materiales");
 const [{data:materials,error:me},{data:catalog,error:ca},{data:assignments,error:ae}]=await Promise.all([
  supabase.from("materials").select("id,family,name,presentation,unit,supplier_code,active").eq("active",true),
  supabase.from("client_materials").select("material_id,authorized").eq("client_id",(await supabase.from("contracts").select("client_id").eq("id",target.contract_id).single()).data?.client_id),
  target.installation_id
   ?supabase.from("contract_materials").select("material_id,installation_id,authorized,authorized_qty").eq("contract_id",target.contract_id).or(`installation_id.is.null,installation_id.eq.${target.installation_id}`)
   :supabase.from("contract_materials").select("material_id,installation_id,authorized,authorized_qty").eq("contract_id",target.contract_id).is("installation_id",null)
 ]);
 if(me||ca||ae)throw new Error(me?.message||ca?.message||ae?.message||"No fue posible validar materiales");
 const byId=new Map((materials||[]).map((m:any)=>[m.id,m])),catalogConfigured=(catalog||[]).length>0,allowed=new Set((catalog||[]).filter((x:any)=>x.authorized).map((x:any)=>x.material_id));
 const general=new Map((assignments||[]).filter((x:any)=>!x.installation_id).map((x:any)=>[x.material_id,x]));
 const specific=new Map((assignments||[]).filter((x:any)=>x.installation_id===target.installation_id).map((x:any)=>[x.material_id,x]));
 const seen=new Set<string>();let ready=0,update=0,unchanged=0,review=0,duplicates=0;
 const details=rows.map((row,index)=>{
  const id=clean(row.material_id),m:any=byId.get(id);
  if(!id||!m){review++;return{index:index+2,material:clean(row.material)||"—",status:"REVISAR",reason:"material_id inexistente o material inactivo"};}
  if(seen.has(id)){duplicates++;return{index:index+2,material:m.name,status:"DUPLICADO",reason:"Material repetido dentro del archivo"};}seen.add(id);
  if(catalogConfigured&&!allowed.has(id)){review++;return{index:index+2,material:m.name,status:"REVISAR",reason:"Material fuera del catálogo autorizado del cliente"};}
  const wants=selected(row.selected),qty=Number(String(row.authorized_qty??"").replace(",","."));
  if(wants&&(!Number.isFinite(qty)||qty<=0)){review++;return{index:index+2,material:m.name,status:"REVISAR",reason:"Marca X requiere un máximo autorizado mayor que 0"};}
  const period=clean(row.period_type);if(period&&!PERIODS.has(period)){review++;return{index:index+2,material:m.name,status:"REVISAR",reason:"Periodicidad no reconocida"};}
  const current:any=target.installation_id?(specific.get(id)||general.get(id)):general.get(id);
  const currentAssigned=Boolean(current?.authorized),currentQty=Number(current?.authorized_qty||0);
  if(wants===currentAssigned&&(!wants||currentQty===qty)){unchanged++;return{index:index+2,material:m.name,status:"SIN CAMBIOS",reason:wants?`Máximo actual: ${qty}`:"No asignado"};}
  if(current){update++;return{index:index+2,material:m.name,status:"ACTUALIZAR",reason:wants?`${currentAssigned?"Máximo":"Asignar"}: ${currentQty} → ${qty}`:"Quitar del perfil"};}
  if(wants){ready++;return{index:index+2,material:m.name,status:"LISTO",reason:`Asignar · máximo ${qty}${period?` · ${period}`:""}`};}
  unchanged++;return{index:index+2,material:m.name,status:"SIN CAMBIOS",reason:"No asignado"};
 });
 return{ok:true,total:rows.length,ready,update,unchanged,review,duplicates,details};
}

export async function confirmMaterialProfileImport(target:MaterialProfileImportTarget,rows:MaterialProfileImportRow[]){
 const {supabase,user,profile}=await ctx();await validateTarget(supabase,target);
 const preview=await previewMaterialProfileImport(target,rows);
 if(preview.review||preview.duplicates)throw new Error("La carga tiene filas REVISAR o DUPLICADO. Corrige el archivo antes de confirmar.");
 let changed=0,skipped=0;
 for(const row of rows){
  const wants=selected(row.selected),qty=wants?Number(String(row.authorized_qty??"").replace(",",".")):0,period=clean(row.period_type)||null;
  const detail=preview.details.find((d:any)=>d.index===rows.indexOf(row)+2);
  if(detail?.status==="SIN CAMBIOS"){skipped++;continue;}
  await saveMaterialProfileConfig({
   contract_id:target.contract_id,installation_id:target.installation_id,material_id:clean(row.material_id),
   assigned:wants,authorized_qty:qty,historical_reference_qty:undefined,period_type:period,notes:"Carga masiva de materiales autorizados",
   override_reason:"Carga masiva confirmada desde plantilla de materiales"
  });changed++;
 }
 await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Perfil de materiales",action:"Carga masiva de materiales",entity_table:"contract_materials",entity_id:target.installation_id||target.contract_id,new_data:{target,changed,skipped,total:rows.length},observation:"Plantilla validada y confirmada antes de guardar; sin generación de histórico."});
 revalidatePath("/");
 return{ok:true,changed,skipped,total:rows.length};
}
