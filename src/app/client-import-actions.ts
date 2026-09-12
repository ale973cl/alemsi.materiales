"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

type ClientCsvRow={name?:string;email?:string;rut?:string;activity?:string;phone?:string;commune?:string;address?:string};
type PreviewDetail={index:number;name:string;rut:string;status:"NUEVO"|"ACTUALIZAR"|"SIN CAMBIOS"|"REVISAR"|"DUPLICADO CSV";reason?:string;changes?:Record<string,string>};

async function clientContext(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)throw new Error("Sesión no válida");
 const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
 if(!profile?.active||!["Admin Total","Gerencia"].includes(profile.role))throw new Error("No autorizado para administrar clientes");
 return{supabase,user,profile};
}

const clean=(v:unknown)=>String(v??"").trim();
const normalizeRut=(v:unknown)=>clean(v).toUpperCase().replace(/[^0-9K]/g,"");
const same=(a:unknown,b:unknown)=>clean(a).toLocaleLowerCase("es-CL")===clean(b).toLocaleLowerCase("es-CL");

function incomingTender(row:ClientCsvRow,current:any){
 const tender={...(current?.tender_data||{})};
 if(clean(row.activity))tender.business_activity=clean(row.activity);
 if(clean(row.commune))tender.commune=clean(row.commune);
 return tender;
}

export async function previewClientsCsvRows(rows:ClientCsvRow[]){
 const {supabase}=await clientContext();
 if(!Array.isArray(rows)||!rows.length)throw new Error("El CSV no contiene registros");
 const {data:existing,error}=await supabase.from("clients").select("id,legal_name,rut,central_email,central_phone,address,tender_data,active");
 if(error)throw error;
 const byRut=new Map((existing||[]).filter((c:any)=>normalizeRut(c.rut)).map((c:any)=>[normalizeRut(c.rut),c]));
 const seen=new Set<string>();
 const details:PreviewDetail[]=[];
 let created=0,updated=0,unchanged=0,review=0,duplicates=0;
 rows.forEach((raw,index)=>{
  const rut=normalizeRut(raw.rut),name=clean(raw.name);
  if(!rut||!name){review++;details.push({index,name:name||"Sin nombre",rut:clean(raw.rut),status:"REVISAR",reason:"Nombre o RUT faltante"});return;}
  if(seen.has(rut)){duplicates++;details.push({index,name,rut:clean(raw.rut),status:"DUPLICADO CSV",reason:"El RUT aparece más de una vez en el archivo"});return;}
  seen.add(rut);
  const current:any=byRut.get(rut);
  if(!current){created++;details.push({index,name,rut:clean(raw.rut),status:"NUEVO"});return;}
  const incomingAddress=clean(raw.address),oldAddress=clean(current.address);
  if(incomingAddress&&oldAddress&&!same(incomingAddress,oldAddress)){review++;details.push({index,name,rut:clean(raw.rut),status:"REVISAR",reason:"Mismo RUT con dirección diferente; revisar antes de cambiar la dirección legal"});return;}
  const changes:Record<string,string>={};
  if(name&&!same(current.legal_name,name))changes.legal_name=name;
  if(clean(raw.email)&&!same(current.central_email,raw.email))changes.central_email=clean(raw.email);
  if(clean(raw.phone)&&!same(current.central_phone,raw.phone))changes.central_phone=clean(raw.phone);
  if(incomingAddress&&!same(current.address,incomingAddress))changes.address=incomingAddress;
  const activity=clean(raw.activity),commune=clean(raw.commune),tender=current.tender_data||{};
  if(activity&&!same(tender.business_activity,activity))changes.business_activity=activity;
  if(commune&&!same(tender.commune,commune))changes.commune=commune;
  if(Object.keys(changes).length){updated++;details.push({index,name,rut:clean(raw.rut),status:"ACTUALIZAR",changes});}
  else{unchanged++;details.push({index,name,rut:clean(raw.rut),status:"SIN CAMBIOS"});}
 });
 return{ok:true,total:rows.length,created,updated,unchanged,review,duplicates,details};
}

export async function confirmClientsCsvRows(rows:ClientCsvRow[]){
 const {supabase,user,profile}=await clientContext();
 if(!Array.isArray(rows)||!rows.length)throw new Error("No hay registros para confirmar");
 const preview=await previewClientsCsvRows(rows);
 const allowed=new Set(preview.details.filter(d=>d.status==="NUEVO"||d.status==="ACTUALIZAR").map(d=>d.index));
 const {data:existing,error}=await supabase.from("clients").select("*");
 if(error)throw error;
 const byRut=new Map((existing||[]).filter((c:any)=>normalizeRut(c.rut)).map((c:any)=>[normalizeRut(c.rut),c]));
 let created=0,updated=0;
 for(const [index,row] of rows.entries()){
  if(!allowed.has(index))continue;
  const rut=normalizeRut(row.rut),name=clean(row.name),current:any=byRut.get(rut);
  if(!current){
   const payload:any={legal_name:name,rut:clean(row.rut),active:true,tender_data:incomingTender(row,null),updated_at:new Date().toISOString()};
   if(clean(row.email))payload.central_email=clean(row.email);
   if(clean(row.phone))payload.central_phone=clean(row.phone);
   if(clean(row.address))payload.address=clean(row.address);
   const ins=await supabase.from("clients").insert(payload).select("*").single();
   if(ins.error)throw ins.error;
   created++;byRut.set(rut,ins.data);
   await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Clientes",action:"Importar cliente CSV",entity_table:"clients",entity_id:ins.data.id,new_data:ins.data});
   continue;
  }
  const patch:any={};
  if(name&&!same(current.legal_name,name))patch.legal_name=name;
  if(clean(row.email)&&!same(current.central_email,row.email))patch.central_email=clean(row.email);
  if(clean(row.phone)&&!same(current.central_phone,row.phone))patch.central_phone=clean(row.phone);
  if(clean(row.address)&&!clean(current.address))patch.address=clean(row.address);
  const nextTender=incomingTender(row,current);
  if(JSON.stringify(nextTender)!==JSON.stringify(current.tender_data||{}))patch.tender_data=nextTender;
  if(!Object.keys(patch).length)continue;
  patch.updated_at=new Date().toISOString();
  const up=await supabase.from("clients").update(patch).eq("id",current.id).select("*").single();
  if(up.error)throw up.error;
  updated++;
  await supabase.from("activity_log").insert({actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Clientes",action:"Actualizar cliente CSV",entity_table:"clients",entity_id:current.id,old_data:current,new_data:up.data});
 }
 revalidatePath("/");
 return{ok:true,created,updated,skipped:rows.length-created-updated,total:rows.length};
}
