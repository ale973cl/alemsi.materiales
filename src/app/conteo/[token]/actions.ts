"use server";
import {createHash} from "crypto";
import {createClient as createAdminClient} from "@supabase/supabase-js";

function db(){if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.SUPABASE_SECRET_KEY)throw new Error("Configuración privada incompleta");return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}})}
function tokenHash(token:string){return createHash("sha256").update(token).digest("hex")}

export async function submitSurveyToken(formData:FormData){
  const token=String(formData.get("token")||"");const submitted=JSON.parse(String(formData.get("lines")||"[]")) as {material_id:string;physical_remainder:number}[];
  if(!token)throw new Error("Link inválido");const supabase=db();const hash=tokenHash(token);
  const {data:membership,error}=await supabase.from("campaign_installations").select("campaign_id,installation_id,status,survey_token_expires_at,survey_token_used_at,installations(contract_id,name)").eq("survey_token_hash",hash).maybeSingle();
  if(error||!membership)throw new Error("El link no es válido o fue reemplazado");
  if(membership.survey_token_used_at||membership.status==="Completada")throw new Error("Este link ya fue utilizado");
  if(!membership.survey_token_expires_at||new Date(membership.survey_token_expires_at).getTime()<Date.now())throw new Error("El link expiró. Solicita uno nuevo.");
  const {data:campaign}=await supabase.from("campaigns").select("status").eq("id",membership.campaign_id).single();if(!campaign||campaign.status!=="Abierta")throw new Error("La campaña ya no está abierta");
  const inst:any=Array.isArray((membership as any).installations)?(membership as any).installations[0]:(membership as any).installations;const contractId=inst?.contract_id;
  const {data:authorized,error:materialsError}=await supabase.from("contract_materials").select("material_id,installation_id,authorized_qty,materials(current_net_price)").eq("contract_id",contractId).eq("authorized",true).or(`installation_id.is.null,installation_id.eq.${membership.installation_id}`);
  if(materialsError)throw materialsError;const byMaterial=new Map<string,any>();for(const item of authorized||[]){if(!byMaterial.has(item.material_id)||item.installation_id===membership.installation_id)byMaterial.set(item.material_id,item)}
  if(!byMaterial.size)throw new Error("La instalación no tiene materiales autorizados");if(submitted.length!==byMaterial.size||submitted.some(line=>!byMaterial.has(line.material_id)||!Number.isFinite(Number(line.physical_remainder))||Number(line.physical_remainder)<0))throw new Error("El conteo no coincide con los materiales autorizados");
  const lines=submitted.map(line=>{const source=byMaterial.get(line.material_id);const authorizedQty=Number(source.authorized_qty||0);const remainder=Number(line.physical_remainder||0);const shortage=Math.max(authorizedQty-remainder,0);const material:any=Array.isArray(source.materials)?source.materials[0]:source.materials;const price=Number(material?.current_net_price||0);return{material_id:line.material_id,authorized_qty:authorizedQty,physical_remainder:remainder,shortage_qty:shortage,unit_net_price:price,line_net:shortage*price}});const shortageNet=lines.reduce((s,l)=>s+l.line_net,0);
  const {data:survey,error:surveyError}=await supabase.from("surveys").upsert({campaign_id:membership.campaign_id,installation_id:membership.installation_id,supervisor_id:null,status:"Borrador",shortage_net:shortageNet,confirmed_at:null},{onConflict:"campaign_id,installation_id"}).select("id").single();if(surveyError||!survey)throw surveyError||new Error("No se pudo guardar el levantamiento");
  await supabase.from("survey_lines").delete().eq("survey_id",survey.id);const {error:insertError}=await supabase.from("survey_lines").insert(lines.map(line=>({...line,survey_id:survey.id})));if(insertError)throw insertError;
  const confirmedAt=new Date().toISOString();const {error:confirmError}=await supabase.from("surveys").update({status:"Confirmada",confirmed_at:confirmedAt,shortage_net:shortageNet}).eq("id",survey.id);if(confirmError)throw confirmError;
  const {error:completeError}=await supabase.from("campaign_installations").update({status:"Completada",completed_at:confirmedAt,survey_token_used_at:confirmedAt}).eq("campaign_id",membership.campaign_id).eq("installation_id",membership.installation_id).eq("survey_token_hash",hash).is("survey_token_used_at",null);if(completeError)throw completeError;
  await supabase.from("activity_log").insert({actor_name:"Acceso por link seguro",module:"Levantamientos",action:"Confirmar levantamiento por token",entity_table:"surveys",entity_id:survey.id,new_data:{campaign_id:membership.campaign_id,installation_id:membership.installation_id,confirmed_at:confirmedAt,shortage_net:shortageNet,lines},observation:"Conteo confirmado mediante link temporal de acceso"});
  return{ok:true,installation:inst?.name||"Instalación"};
}
