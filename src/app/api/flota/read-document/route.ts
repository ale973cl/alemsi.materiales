import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {buildFleetReaderInstruction} from "@/modules/flota/document-reader";

export const runtime="nodejs";
const ALLOWED=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
function outputText(payload:any){if(typeof payload?.output_text==="string")return payload.output_text.trim();for(const item of payload?.output??[])for(const content of item?.content??[])if(content?.type==="output_text"&&typeof content.text==="string")return content.text.trim();return "";}
const cleanJson=(value:string)=>value.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"").trim();

export async function POST(request:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Sesión requerida."},{status:401});
 const [{data:profile},{data:allowed}]=await Promise.all([supabase.from("user_profiles").select("active,role").eq("id",user.id).single(),supabase.rpc("has_additional_service_access",{p_service_code:"flota"})]);
 if(!profile?.active||(!allowed&&profile.role!=="Admin Total"))return NextResponse.json({error:"No tienes acceso a Flota."},{status:403});
 const form=await request.formData(),file=form.get("file"),vehicleId=String(form.get("vehicle_id")??"");
 if(!(file instanceof File)||!ALLOWED.has(file.type)||file.size<=0||file.size>10*1024*1024)return NextResponse.json({error:"Selecciona PDF, JPG, PNG o WEBP de hasta 10 MB."},{status:400});
 const {data:vehicle}=await supabase.from("fleet_vehicles").select("plate,chassis_vin").eq("id",vehicleId).maybeSingle();if(!vehicle)return NextResponse.json({error:"Vehículo no encontrado."},{status:404});
 const key=process.env.OPENAI_API_KEY;if(!key)return NextResponse.json({error:"El lector no está configurado en el servidor."},{status:503});
 const dataUrl=`data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
 const documentInput=file.type==="application/pdf"?{type:"input_file",filename:file.name,file_data:dataUrl}:{type:"input_image",image_url:dataUrl,detail:"high"};
 const instruction=buildFleetReaderInstruction(vehicle);
 const prompt=`${JSON.stringify(instruction)}\nDevuelve EXCLUSIVAMENTE JSON válido con esta forma: {"kind":"PADRON|REVISION_TECNICA|PERMISO_CIRCULACION|SOAP|SEGURO_AUTOMOTRIZ|MANTENCION|OTRO","document_plate":string|null,"document_vin":string|null,"valid_from":"YYYY-MM-DD"|null,"expires_at":"YYYY-MM-DD"|null,"insurer":string|null,"policy_number":string|null,"assistance_phone":string|null,"services":string[],"instructions":string|null,"confidence":number|null,"requires_review":boolean}. No inventes datos; usa null o [] si no son legibles.`;
 try{
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_INVOICE_MODEL||"gpt-5.6-luna",reasoning:{effort:"low"},input:[{role:"user",content:[{type:"input_text",text:prompt},documentInput]}],max_output_tokens:1800})});
  const payload=await response.json().catch(()=>null);if(!response.ok)return NextResponse.json({error:payload?.error?.message||"El lector no está disponible."},{status:502});
  const parsed=JSON.parse(cleanJson(outputText(payload)));return NextResponse.json({data:parsed,model:payload?.model||null});
 }catch{return NextResponse.json({error:"No se pudo interpretar el documento. Puedes completar los datos manualmente."},{status:502});}
}
