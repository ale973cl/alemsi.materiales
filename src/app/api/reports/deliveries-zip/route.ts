import JSZip from "jszip";
import {createClient} from "@/lib/supabase/server";
import {generarGuiaPdf} from "@/lib/dispatch-pdf";
import {formatInternalGuideNumber} from "@/lib/guide-number";

export const runtime="nodejs";
const safe=(v:unknown)=>String(v||"guia").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,90)||"guia";
const fmt=(v:string)=>new Intl.DateTimeFormat("es-CL",{timeZone:"America/Santiago",dateStyle:"short",timeStyle:"short"}).format(new Date(v));
const relation=(v:any)=>Array.isArray(v)?v[0]:v;

export async function GET(request:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return new Response("Sesión no válida",{status:401});
 const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();if(!profile?.active||!["Admin Total","Gerencia","Admin","Finanzas","Bodega"].includes(profile.role))return new Response("No autorizado",{status:403});
 const url=new URL(request.url),month=url.searchParams.get("month")||"",clientId=url.searchParams.get("client_id")||"",installationId=url.searchParams.get("installation_id")||"",campaignId=url.searchParams.get("campaign_id")||"",campaignName=url.searchParams.get("campaign_name")||"",format=url.searchParams.get("format")||"zip",selectedIds=[...new Set((url.searchParams.get("dispatch_ids")||"").split(",").map(x=>x.trim()).filter(Boolean))];
 if(month&&!/^\d{4}-\d{2}$/.test(month))return new Response("Periodo inválido",{status:400});
 const range=month?(()=>{const [year,mon]=month.split("-").map(Number);if(mon<1||mon>12)return null;const start=new Date(Date.UTC(year,mon-1,1,3)).toISOString(),next=new Date(Date.UTC(year,mon,1,3)).toISOString();return{start,next};})():null;
 if(month&&!range)return new Response("Periodo inválido",{status:400});
 if(format==="list"){
  const matches:any[]=[];
  for(let page=0;page<25;page++){
   let query=supabase.from("dispatches").select("id,internal_number,guide_number,delivered_at,observations,installation_id,installations(id,name,contracts(id,name,clients(id,legal_name)))")
    .not("recipient_signature","is",null).order("delivered_at",{ascending:false}).range(page*1000,(page+1)*1000-1);
   if(range)query=query.gte("delivered_at",range.start).lt("delivered_at",range.next);
   if(installationId)query=query.eq("installation_id",installationId);
   if(campaignId)query=query.ilike("observations",`%CAMPAÑA:${campaignId}%`);
   const {data,error}=await query;
   if(error)return Response.json({error:error.message},{status:500});
   for(const d of data||[]){
    const i=relation(d.installations),c=relation(i?.contracts),cl=relation(c?.clients);
    if(clientId&&cl?.id!==clientId)continue;
    matches.push({id:d.id,number:formatInternalGuideNumber(d.internal_number||d.guide_number||d.id),delivered_at:d.delivered_at,installation:i?.name||"Instalación",contract:c?.name||"Contrato",client:cl?.legal_name||"Cliente",campaign_id:String(d.observations||"").match(/CAMPAÑA:([a-f0-9-]{36})/i)?.[1]||null});
   }
   if((data||[]).length<1000)break;
  }
  return Response.json({guides:matches,total:matches.length},{headers:{"Cache-Control":"no-store"}});
 }
 if(selectedIds.length>250)return new Response("Selecciona como máximo 250 guías por ZIP",{status:400});
 const all:any[]=[];
 for(let page=0;page<25;page++){
  let query=supabase.from("dispatches").select("id,internal_number,guide_number,status,observations,recipient_name,recipient_email,recipient_rut,recipient_role,recipient_signature,delivered_by,delivered_at,installation_id,installations(id,name,address,commune,city,region,contracts(id,name,clients(id,legal_name,rut))),dispatch_lines(id,required_qty,delivered_qty,materials(name,family,supplier_code,presentation,unit))").not("recipient_signature","is",null).order("delivered_at",{ascending:true}).range(page*1000,(page+1)*1000-1);
  // Una selección explícita siempre gana sobre el mes para no excluir guías antiguas.
  if(range&&!selectedIds.length)query=query.gte("delivered_at",range.start).lt("delivered_at",range.next);
  if(installationId)query=query.eq("installation_id",installationId);
  if(campaignId)query=query.ilike("observations",`%CAMPAÑA:${campaignId}%`);
  if(selectedIds.length)query=query.in("id",selectedIds);
  const {data,error}=await query;
  if(error)return new Response(error.message,{status:500});
  all.push(...(data||[]));
  if((data||[]).length<1000)break;
 }
 const data=all;

 const rows=(data||[]).filter((d:any)=>{if(!clientId||selectedIds.length)return true;const c=relation(relation(d.installations)?.contracts)?.clients;return String(relation(c)?.id||"")===clientId;});
 if(!rows.length)return new Response("No hay guías firmadas para los filtros seleccionados",{status:404});if(format==="pdf"&&rows.length!==1)return new Response("Selecciona una sola guía para descargar PDF",{status:400});
 const campaignIds=[...new Set(rows.map((d:any)=>String(d.observations||"").match(/CAMPAÑA:([a-f0-9-]{36})/i)?.[1]).filter(Boolean))] as string[];
 const {data:campaignRecords}=campaignIds.length?await supabase.from("campaigns").select("id,label").in("id",campaignIds):{data:[] as any[]};
 const campaignFolders=new Map((campaignRecords||[]).map((c:any)=>{
  let name=String(c.label||"");try{const v=JSON.parse(name);name=String(v.name||v.deliveryPeriod||c.id)}catch{}
  return[c.id,safe(name)];
 }));
 const folderFor=(d:any)=>{
  const id=String(d.observations||"").match(/CAMPAÑA:([a-f0-9-]{36})/i)?.[1];
  return campaignFolders.get(id)||safe(id||"Sin-campana");
 };
 const delivererIds=[...new Set(rows.map((d:any)=>d.delivered_by).filter(Boolean))],{data:profiles}=delivererIds.length?await supabase.from("user_profiles").select("id,full_name,email").in("id",delivererIds):{data:[] as any[]},names=new Map((profiles||[]).map((p:any)=>[p.id,p.full_name||p.email||p.id])),zip=new JSZip(),manifest=["guia;fecha;cliente;contrato;instalacion;receptor;correo;responsable_entrega"];let singlePdf:Buffer|undefined,singleName="";
 for(const d of rows as any[]){const i=relation(d.installations),c=relation(i?.contracts),cl=relation(c?.clients),displayNumber=formatInternalGuideNumber(d.internal_number||d.guide_number||d.id),name=`${safe(displayNumber)}-${safe(i?.name)}.pdf`,pdf=await generarGuiaPdf({guideNumber:displayNumber,internalNumber:displayNumber,client:cl?.legal_name||"—",clientRut:cl?.rut,contract:c?.name||"—",installation:i?.name||"—",address:[i?.address,i?.commune,i?.city,i?.region].filter(Boolean).join(" · "),observations:d.observations,responsible:String(names.get(d.delivered_by)||"—"),recipientName:d.recipient_name,recipientRut:d.recipient_rut,recipientRole:d.recipient_role,recipientEmail:d.recipient_email,deliveredAt:d.delivered_at,signature:d.recipient_signature,lines:(d.dispatch_lines||[]).map((l:any)=>({code:l.materials?.supplier_code,product:l.materials?.name||"Material",family:l.materials?.family,presentation:l.materials?.presentation,unit:l.materials?.unit,quantity:Number(l.delivered_qty||l.required_qty||0)}))});if(format==="pdf"){singlePdf=pdf;singleName=name}else{zip.file(`${folderFor(d)}/${name}`,pdf);manifest.push([d.internal_number||d.guide_number||"",d.delivered_at?fmt(d.delivered_at):"",cl?.legal_name||"",c?.name||"",i?.name||"",d.recipient_name||"",d.recipient_email||"",names.get(d.delivered_by)||""].map(v=>`"${String(v).replaceAll('"','""')}"`).join(";"));}}
 if(format==="pdf")return new Response(singlePdf?new Uint8Array(singlePdf):null,{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${singleName}"`,"Cache-Control":"no-store"}});
 zip.file("indice-entregas.csv",manifest.join("\n"));const bytes=await zip.generateAsync({type:"uint8array",compression:"DEFLATE",compressionOptions:{level:6}}),firstInstallation=relation((rows[0] as any).installations),firstContract=relation(firstInstallation?.contracts),firstClient=relation(firstContract?.clients),fileName=`ALEMSI_Guias_${safe(firstClient?.legal_name||"clientes")}_${safe(campaignName||campaignId||"campanas")}_${safe(month||"historico")}.zip`;
 return new Response(Buffer.from(bytes),{headers:{"Content-Type":"application/zip","Content-Disposition":`attachment; filename="${fileName}"`,"Cache-Control":"no-store"}});
}
