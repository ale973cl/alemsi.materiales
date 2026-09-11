"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

const parseCsvLine=(line:string,delimiter:string)=>{const values:string[]=[];let value="",quoted=false;for(let i=0;i<line.length;i++){const char=line[i];if(char==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(char===delimiter&&!quoted){values.push(value.trim());value=""}else value+=char}values.push(value.trim());return values};
const text=(v:unknown)=>String(v??"").trim();
const norm=(v:unknown)=>text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es-CL").replace(/\s+/g," ");
const normRut=(v:unknown)=>text(v).toUpperCase().replace(/[^0-9K]/g,"");
const parseMoney=(v:string)=>{const raw=v.trim();if(!raw)return null;const normalized=raw.replace(/\$/g,"").replace(/\s/g,"").replace(/\.(?=\d{3}(?:\D|$))/g,"").replace(",",".");const n=Number(normalized);return Number.isFinite(n)&&n>=0?n:NaN};

async function context(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("Sesión no válida");
  const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
  if(!profile?.active||!["Admin Total","Gerencia","Admin"].includes(profile.role))throw new Error("No autorizado para actualizar el maestro");
  return {supabase,user,profile};
}

export async function importMaterialMasterCsv(formData:FormData){
  const {supabase,user,profile}=await context();
  const file=formData.get("file");
  if(!(file instanceof File)||!file.size)throw new Error("Selecciona un archivo CSV");
  if(file.size>4_000_000)throw new Error("El CSV supera el máximo de 4 MB");
  const content=(await file.text()).replace(/^\uFEFF/,"");
  const lines=content.split(/\r?\n/).filter(line=>line.trim());
  if(lines.length<2)throw new Error("El CSV no contiene productos");
  const delimiter=lines[0].includes(";")?";":",";
  const headers=parseCsvLine(lines[0],delimiter).map(v=>norm(v).replace(/ /g,"_"));
  const required=["material_id","familia","producto","presentacion","unidad","proveedor_primario_rut","proveedor_primario","codigo_proveedor_primario","proveedor_secundario_rut","proveedor_secundario","codigo_proveedor_secundario","proveedor_tercero_rut","proveedor_tercero","codigo_proveedor_tercero","valor_neto"];
  if(required.some(h=>!headers.includes(h)))throw new Error("Usa el archivo descargado desde ‘Descargar maestro completo’. Faltan columnas del formato actual.");
  const get=(values:string[],key:string)=>text(values[headers.indexOf(key)]||"");

  const [{data:materials,error:materialsError},{data:suppliers,error:suppliersError},{data:links,error:linksError}]=await Promise.all([
    supabase.from("materials").select("id,family,name,presentation,unit,current_net_price,active").eq("active",true),
    supabase.from("suppliers").select("id,legal_name,fantasy_name,rut,active").eq("active",true),
    supabase.from("supplier_materials").select("id,material_id,supplier_id,priority,supplier_code,net_price,effective_from,active").eq("active",true)
  ]);
  if(materialsError||suppliersError||linksError)throw new Error(materialsError?.message||suppliersError?.message||linksError?.message||"No fue posible validar el maestro");

  const materialById=new Map((materials||[]).map((m:any)=>[m.id,m]));
  const signature=(family:string,name:string,presentation:string,unit:string)=>[norm(family),norm(name),norm(presentation),norm(unit)].join("|");
  const signatures=new Map((materials||[]).map((m:any)=>[signature(m.family||"",m.name||"",m.presentation||"",m.unit||""),m.id]));
  const supplierByRut=new Map((suppliers||[]).filter((s:any)=>s.rut).map((s:any)=>[normRut(s.rut),s]));
  const supplierByName=new Map<string,any>();
  for(const s of suppliers||[]){for(const n of [s.fantasy_name,s.legal_name])if(text(n))supplierByName.set(norm(n),s);}
  const activeLinksByMaterial=new Map<string,any[]>();
  for(const link of links||[]){const arr=activeLinksByMaterial.get(link.material_id)||[];arr.push(link);activeLinksByMaterial.set(link.material_id,arr);}

  const parsed=lines.slice(1).map((line,index)=>({row:index+2,values:parseCsvLine(line,delimiter)}));
  const errors:string[]=[];
  const operations:any[]=[];
  for(const entry of parsed){
    const v=entry.values,id=get(v,"material_id"),family=get(v,"familia"),name=get(v,"producto"),presentation=get(v,"presentacion"),unit=get(v,"unidad"),priceRaw=get(v,"valor_neto");
    if(!id&&!name)continue;
    let existing:any=null;
    if(id){existing=materialById.get(id);if(!existing){errors.push(`Fila ${entry.row}: material_id no existe`);continue;}}
    else{
      if(!name){errors.push(`Fila ${entry.row}: producto obligatorio para un material nuevo`);continue;}
      const sig=signature(family,name,presentation,unit);
      if(signatures.has(sig)){errors.push(`Fila ${entry.row}: posible duplicado de un material existente; conserva su material_id`);continue;}
    }
    const price=parseMoney(priceRaw);
    if(Number.isNaN(price)){errors.push(`Fila ${entry.row}: valor_neto no válido`);continue;}
    const currentLinks=existing?(activeLinksByMaterial.get(existing.id)||[]):[];
    const providerChanges:any[]=[];
    for(const priority of [1,2,3]){
      const label=priority===1?"primario":priority===2?"secundario":"tercero";
      const rut=get(v,`proveedor_${label}_rut`),providerName=get(v,`proveedor_${label}`),code=get(v,`codigo_proveedor_${label}`);
      if(!rut&&!providerName&&!code)continue;
      let supplier:any=null;
      if(rut)supplier=supplierByRut.get(normRut(rut));
      if(!supplier&&providerName)supplier=supplierByName.get(norm(providerName));
      if(!supplier&&code){const current=currentLinks.find((x:any)=>Number(x.priority)===priority);if(current)supplier=(suppliers||[]).find((s:any)=>s.id===current.supplier_id);}
      if(!supplier){errors.push(`Fila ${entry.row}: proveedor ${label} no reconocido por RUT o nombre`);continue;}
      providerChanges.push({priority,supplier_id:supplier.id,supplier_code:code||null});
    }
    operations.push({row:entry.row,id,existing,family,name,presentation,unit,price,providerChanges});
  }
  if(errors.length)throw new Error(`Archivo en revisión. ${errors.slice(0,8).join(" · ")}${errors.length>8?` · y ${errors.length-8} observaciones más`:""}`);
  if(!operations.length)throw new Error("No se encontraron filas válidas para procesar");

  let updated=0,created=0,providerUpdates=0;
  for(const op of operations){
    let materialId=op.id;
    if(op.existing){
      const patch:any={updated_at:new Date().toISOString()};
      if(op.family)patch.family=op.family;
      if(op.name)patch.name=op.name;
      if(op.presentation)patch.presentation=op.presentation;
      if(op.unit)patch.unit=op.unit;
      if(op.price!==null)patch.current_net_price=op.price;
      const {error}=await supabase.from("materials").update(patch).eq("id",materialId);if(error)throw error;updated++;
    }else{
      const {data:newMaterial,error}=await supabase.from("materials").insert({family:op.family||null,name:op.name,presentation:op.presentation||null,unit:op.unit||null,current_net_price:op.price??0,active:true,price_source_note:`Alta por CSV: ${file.name}`}).select("id").single();
      if(error)throw error;materialId=newMaterial.id;created++;
    }
    if(op.providerChanges.length){
      const existingLinks=activeLinksByMaterial.get(materialId)||[];
      for(const change of op.providerChanges){
        const current=existingLinks.find((x:any)=>Number(x.priority)===change.priority);
        if(current&&current.supplier_id===change.supplier_id){
          const {error}=await supabase.from("supplier_materials").update({supplier_code:change.supplier_code??current.supplier_code,active:true}).eq("id",current.id);if(error)throw error;
        }else{
          if(current){const {error}=await supabase.from("supplier_materials").update({active:false}).eq("id",current.id);if(error)throw error;}
          const today=new Date().toISOString().slice(0,10);
          const {error}=await supabase.from("supplier_materials").upsert({supplier_id:change.supplier_id,material_id:materialId,priority:change.priority,supplier_code:change.supplier_code,net_price:null,effective_from:today,active:true},{onConflict:"supplier_id,material_id,effective_from"});if(error)throw error;
        }
        if(change.priority===1){await supabase.from("materials").update({supplier_code:change.supplier_code}).eq("id",materialId);}
        providerUpdates++;
      }
    }
  }
  await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Maestro de materiales",action:"Actualizar maestro por CSV",entity_table:"materials",new_data:{file:file.name,updated,created,provider_updates:providerUpdates},observation:"material_id válido actualiza la ficha existente; filas sin ID crean material nuevo; celdas vacías no sobrescriben campos existentes."});
  revalidatePath("/");
  return {ok:true,message:`CSV procesado: ${updated} actualizados · ${created} nuevos · ${providerUpdates} asociaciones de proveedor.`};
}
