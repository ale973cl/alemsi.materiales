import {createHash} from "crypto";
import TokenSurveyForm from "./TokenSurveyForm";
import {createPublicTokenAdminClient} from "@/lib/supabase/public-token-admin";

function hash(token:string){return createHash("sha256").update(token).digest("hex")}
function message(title:string,text?:string){return <main style={{maxWidth:760,margin:"40px auto",padding:20,fontFamily:"Arial,sans-serif"}}><h1>{title}</h1>{text&&<p>{text}</p>}</main>}

export default async function Page({params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  let supabase;
  try{supabase=createPublicTokenAdminClient()}catch(e){console.error("[conteo-token] configuración privada no disponible",e);return message("Conteo temporalmente no disponible","Intenta nuevamente o solicita apoyo a ALEMSI.")}
  const tokenHash=hash(token);
  const {data:m,error:membershipError}=await supabase.from("campaign_installations").select("campaign_id,installation_id,status,survey_token_expires_at,survey_token_used_at,installations(name,region,contract_id,contracts(name,clients(legal_name)))").eq("survey_token_hash",tokenHash).maybeSingle();
  if(membershipError){console.error("[conteo-token] error consultando acceso",membershipError);return message("Conteo temporalmente no disponible","Intenta nuevamente o solicita apoyo a ALEMSI.")}
  if(!m||m.survey_token_used_at||m.status==="Completada"||!m.survey_token_expires_at||new Date(m.survey_token_expires_at).getTime()<Date.now())return message("Link no disponible","El enlace expiró, ya fue utilizado o fue reemplazado. Solicita uno nuevo a ALEMSI.");
  const inst:any=Array.isArray((m as any).installations)?(m as any).installations[0]:(m as any).installations;
  if(!inst?.contract_id)return message("Conteo temporalmente no disponible","No fue posible identificar la instalación asignada.");
  const {data:campaign,error:campaignError}=await supabase.from("campaigns").select("status,label").eq("id",m.campaign_id).single();
  if(campaignError){console.error("[conteo-token] error consultando campaña",campaignError);return message("Conteo temporalmente no disponible","Intenta nuevamente o solicita apoyo a ALEMSI.")}
  if(!campaign||campaign.status!=="Abierta")return message("Campaña cerrada");
  const {data:raw,error:materialsError}=await supabase.from("contract_materials").select("material_id,installation_id,authorized_qty,materials(name,presentation,unit)").eq("contract_id",inst.contract_id).eq("authorized",true).or(`installation_id.is.null,installation_id.eq.${m.installation_id}`);
  if(materialsError){console.error("[conteo-token] error consultando materiales",materialsError);return message("Conteo temporalmente no disponible","No fue posible cargar los materiales de esta instalación.")}
  const by=new Map<string,any>();for(const item of raw||[]){if(!by.has(item.material_id)||item.installation_id===m.installation_id)by.set(item.material_id,item)}
  const materials=[...by.values()].map((x:any)=>{const mat=Array.isArray(x.materials)?x.materials[0]:x.materials;return{material_id:x.material_id,name:mat?.name||"Material",presentation:mat?.presentation||null,unit:mat?.unit||null,authorized_qty:Number(x.authorized_qty||0)}});
  const contract:any=Array.isArray(inst.contracts)?inst.contracts[0]:inst.contracts;const client:any=Array.isArray(contract?.clients)?contract.clients[0]:contract?.clients;
  return <main style={{maxWidth:820,margin:"0 auto",padding:24,fontFamily:"Arial,sans-serif",color:"#12314a"}}><header style={{marginBottom:22,borderBottom:"2px solid #0b6f69",paddingBottom:14}}><p style={{margin:0,color:"#0b6f69",fontWeight:700}}>ALEMSI MATERIALES</p><h1 style={{margin:"6px 0"}}>Conteo de materiales</h1><p style={{margin:0}}><b>{client?.legal_name||"Cliente"}</b> · {contract?.name||"Contrato"} · {inst.name||"Instalación"}</p><p style={{margin:"8px 0 0",fontSize:13,color:"#607684"}}>Este acceso corresponde únicamente a esta instalación.</p></header>{materials.length?<TokenSurveyForm token={token} materials={materials} installation={inst.name||"Instalación"}/>:<p>No hay materiales autorizados para esta instalación.</p>}</main>
}
