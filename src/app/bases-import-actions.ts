"use server";
import {createClient} from "@/lib/supabase/server";
import {revalidatePath} from "next/cache";

type Material={codigo?:string;nombre?:string;cantidad_total?:number|null;unidad?:string;periodicidad?:string;especificacion?:string;pagina_fuente?:string};
type Site={nombre?:string;region?:string;comuna?:string;direccion?:string;superficie_m2?:number|null;contacto?:string;correo_entrega?:string;telefono?:string};
export type BasesFicha={
 version?:string;
 cliente?:{razon_social?:string;rut?:string;telefono?:string;correo?:string;direccion?:string;comuna?:string;region?:string};
 contrato?:{nombre?:string;codigo?:string;referencia_facturacion?:string;region?:string;comunas?:string[];fecha_inicio?:string;fecha_termino?:string;periodicidad?:string;presupuesto_neto_clp?:number|null;alcance?:string;requisitos?:string[]};
 instalaciones?:Site[];materiales_contrato?:Material[];
 observaciones?:string[];datos_no_encontrados?:string[];fuentes?:unknown[];
};
const clean=(x:unknown)=>typeof x==="string"?x.trim():"";
const norm=(x:unknown)=>clean(x).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es-CL").replace(/\s+/g," ");
const rut=(x:unknown)=>clean(x).toUpperCase().replace(/[^0-9K]/g,"");
const PERIODS=["Mensual","Bimensual","Trimestral","Cuatrimestral","Semestral","Personalizada"];
async function context(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)throw new Error("Sesión no válida");
 const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
 if(!profile?.active||!["Admin Total","Gerencia","Admin"].includes(profile.role))throw new Error("Sin permiso de administración");
 return{supabase,user,profile};
}
async function validate(supabase:any,f:BasesFicha){
 const errors:string[]=[],warnings:string[]=[];
 if(!f||f.version!=="alemsi-simple-2")errors.push("Usa ficha ALEMSI Simple versión 2");
 if(!clean(f?.cliente?.razon_social))errors.push("Falta razón social del cliente");
 if(!rut(f?.cliente?.rut))errors.push("Falta RUT del cliente");
 if(!clean(f?.contrato?.nombre))errors.push("Falta nombre del contrato");
 if(!clean(f?.contrato?.codigo))errors.push("Falta código de contrato; complétalo para identificar cada contrato");
 if(!clean(f?.contrato?.region))warnings.push("Falta región o cobertura del contrato");
 if(f?.contrato?.presupuesto_neto_clp!=null&&(!Number.isFinite(f.contrato.presupuesto_neto_clp)||f.contrato.presupuesto_neto_clp<0))errors.push("Presupuesto neto inválido");
 if(f?.contrato?.presupuesto_neto_clp==null)warnings.push("No se indicó presupuesto neto de materiales (no se estimará)");
 if(f?.contrato?.periodicidad&&!PERIODS.includes(f.contrato.periodicidad))warnings.push("Periodicidad no estándar: revisar antes de campañas");
 const sites=Array.isArray(f?.instalaciones)?f.instalaciones:[];
 if(sites.length>300)errors.push("Demasiadas instalaciones en una ficha");
 if(!sites.length)warnings.push("Sin instalaciones identificadas: crea las instalaciones posteriormente");
 const seen=new Set<string>();
 sites.forEach((s,i)=>{
  if(!clean(s.nombre))errors.push("Instalación "+(i+1)+": nombre requerido");
  for(const field of ["region","comuna","direccion"] as const)if(!clean(s[field]))errors.push("Instalación "+(i+1)+": falta "+field);
  if(s.superficie_m2!=null&&(!Number.isFinite(s.superficie_m2)||s.superficie_m2<0))errors.push("Instalación "+(i+1)+": superficie inválida");
  const key=norm(s.nombre)+"|"+norm(s.direccion);
  if(seen.has(key))errors.push("Instalación "+(i+1)+": duplicada");seen.add(key);
 });
 const materials=Array.isArray(f?.materiales_contrato)?f.materiales_contrato:[];
 if(materials.length>500)errors.push("Demasiados materiales");
 materials.forEach((m,i)=>{
  if(!clean(m.codigo)&&!clean(m.nombre))errors.push("Material "+(i+1)+": falta código/nombre");
  if(m.cantidad_total!=null&&(!Number.isFinite(m.cantidad_total)||m.cantidad_total<0))errors.push("Material "+(i+1)+": cantidad inválida");
 });
 if(materials.length)warnings.push("Los materiales se conservarán como listado contractual. No se asignarán a instalaciones ni crearán movimientos de inventario");
 (f?.datos_no_encontrados||[]).forEach(x=>warnings.push("Dato pendiente: "+String(x)));
 const {data:clients,error:clientError}=await supabase.from("clients").select("id,rut,legal_name,active");
 if(clientError)throw new Error(clientError.message);
 const existing=(clients||[]).find((c:any)=>rut(c.rut)&&rut(c.rut)===rut(f?.cliente?.rut));
 if(existing&&!existing.active)errors.push("Cliente inactivo: reactivar antes de importar");
 if(!existing&&(clients||[]).some((c:any)=>!rut(c.rut)&&norm(c.legal_name)===norm(f?.cliente?.razon_social)))warnings.push("Existe cliente con razón social similar y sin RUT; revisar para evitar duplicación");
 if(existing){
  const {data:contracts,error}=await supabase.from("contracts").select("name,code").eq("client_id",existing.id);
  if(error)throw new Error(error.message);
  if((contracts||[]).some((k:any)=>norm(k.code)===norm(f?.contrato?.codigo)||norm(k.name)===norm(f?.contrato?.nombre)))errors.push("Ya existe contrato de igual nombre o código para el mismo cliente");
 }
 return{errors,warnings,existingClientId:existing?.id||null,summary:{cliente:clean(f?.cliente?.razon_social),rut:clean(f?.cliente?.rut),contrato:clean(f?.contrato?.nombre),codigo:clean(f?.contrato?.codigo),instalaciones:sites.length,materiales:materials.length}};
}
export async function previewBasesFicha(f:BasesFicha){
 const {supabase}=await context();return validate(supabase,f);
}
export async function createFromBasesFicha(f:BasesFicha){
 const {supabase,user,profile}=await context();const v=await validate(supabase,f);
 if(v.errors.length)throw new Error(v.errors.join(" · "));
 const c=f.cliente!,k=f.contrato!;
 let clientId:string=v.existingClientId||"";let createdClientId="";let contractId="";const siteIds:string[]=[];
 try{
  if(!clientId){
   const {data,error}=await supabase.from("clients").insert({legal_name:clean(c.razon_social),rut:clean(c.rut),central_email:clean(c.correo)||null,central_phone:clean(c.telefono)||null,address:clean(c.direccion)||null,tender_data:{commune:clean(c.comuna),region:clean(c.region)},active:true}).select("id").single();
   if(error||!data)throw new Error(error?.message||"No se pudo crear cliente");
   clientId=data.id;createdClientId=data.id;
  }
  // Las cantidades contractuales son antecedentes y NUNCA se reparten de forma automática.
  const rules={region:clean(k.region),comunas:k.comunas||[],referencia_facturacion:clean(k.referencia_facturacion),periodicidad:clean(k.periodicidad),alcance:clean(k.alcance),requisitos:k.requisitos||[],materiales_contrato:f.materiales_contrato||[],observaciones:f.observaciones||[],datos_no_encontrados:f.datos_no_encontrados||[],fuentes:f.fuentes||[],origen:"ficha-ia-bases-v2",materiales_sin_distribuir:true,presupuesto_materiales_informado:k.presupuesto_neto_clp!=null};
  const {data:contract,error:contractError}=await supabase.from("contracts").insert({client_id:clientId,name:clean(k.nombre),code:clean(k.codigo),start_date:clean(k.fecha_inicio)||null,end_date:clean(k.fecha_termino)||null,net_budget:k.presupuesto_neto_clp??0,rules,active:true}).select("id").single();
  if(contractError||!contract)throw new Error(contractError?.message||"No se pudo crear contrato");
  contractId=contract.id;
  for(const site of f.instalaciones||[]){
   const {data,error}=await supabase.from("installations").insert({contract_id:contractId,name:clean(site.nombre),region:clean(site.region),commune:clean(site.comuna),address:clean(site.direccion),surface_m2:site.superficie_m2??null,active:true}).select("id").single();
   if(error||!data)throw new Error(error?.message||"No se pudo crear instalación "+clean(site.nombre));
   siteIds.push(data.id);
  }
  await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Clientes",action:"Importar ficha IA de bases",entity_table:"contracts",entity_id:contractId,new_data:{cliente:clientId,contrato:contractId,instalaciones:siteIds.length,materiales_sin_distribuir:(f.materiales_contrato||[]).length}});
  revalidatePath("/");
  return{ok:true,clientId,contractId,installations:siteIds.length,materialsPending:(f.materiales_contrato||[]).length};
 }catch(error){
  // Compensación de inserciones nuevas. No modificar clientes que existían previamente.
  if(siteIds.length)await supabase.from("installations").delete().in("id",siteIds);
  if(contractId)await supabase.from("contracts").delete().eq("id",contractId);
  if(createdClientId)await supabase.from("clients").delete().eq("id",createdClientId);
  throw error;
 }
}
