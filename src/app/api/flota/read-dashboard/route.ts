import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export const runtime="nodejs";
const ALLOWED=new Set(["image/jpeg","image/png","image/webp"]);

function outputText(payload:any){
 if(typeof payload?.output_text==="string")return payload.output_text.trim();
 for(const item of payload?.output??[])for(const content of item?.content??[])if(content?.type==="output_text"&&typeof content.text==="string")return content.text.trim();
 return "";
}
function jsonText(value:string){return value.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"").trim()}
function nullableNumber(value:unknown){const n=typeof value==="number"?value:Number(value);return Number.isFinite(n)&&n>=0?n:null}

export async function POST(request:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sesión requerida."},{status:401});
 const [{data:profile},{data:allowed}]=await Promise.all([
  supabase.from("user_profiles").select("active").eq("id",user.id).single(),
  supabase.rpc("has_additional_service_access",{p_service_code:"flota"}),
 ]);
 if(!profile?.active||!allowed)return NextResponse.json({error:"No tienes acceso a Flota."},{status:403});
 const form=await request.formData();const file=form.get("file");
 if(!(file instanceof File)||!ALLOWED.has(file.type)||file.size<=0||file.size>8*1024*1024)return NextResponse.json({error:"Usa una fotografía JPG, PNG o WEBP de hasta 8 MB."},{status:400});
 const key=process.env.OPENAI_API_KEY;
 if(!key)return NextResponse.json({data:{odometer_km:null,fuel_level:null,rpm:null,warning_lights:"Revisar"},reader:"not-configured"});
 const dataUrl=`data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
 const prompt=`Analiza EXCLUSIVAMENTE esta fotografía del tablero de un vehículo. Devuelve solo JSON válido.
No inventes ni completes dígitos. Si un valor no es completamente legible usa null.
Campos exactos: {"odometer_km":number|null,"fuel_level":"FULL|3/4|1/2|1/4|RESERVA|null","rpm":number|null,"warning_lights":"Revisar"|null,"notes":string|null}.
odometer_km es el kilometraje TOTAL, nunca el viaje parcial. Los testigos solo pueden producir "Revisar", nunca diagnóstico.`;
 try{
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_INVOICE_MODEL||"gpt-5.6-luna",reasoning:{effort:"low"},input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:dataUrl,detail:"high"}]}],max_output_tokens:700})});
  const payload=await response.json().catch(()=>null);if(!response.ok)throw new Error("reader");
  const parsed=JSON.parse(jsonText(outputText(payload)));
  const fuel=["FULL","3/4","1/2","1/4","RESERVA"].includes(parsed?.fuel_level)?parsed.fuel_level:null;
  return NextResponse.json({data:{odometer_km:nullableNumber(parsed?.odometer_km),fuel_level:fuel,rpm:nullableNumber(parsed?.rpm),warning_lights:parsed?.warning_lights?"Revisar":null,notes:typeof parsed?.notes==="string"?parsed.notes.slice(0,300):null},reader:"openai"});
 }catch{return NextResponse.json({data:{odometer_km:null,fuel_level:null,rpm:null,warning_lights:"Revisar"},reader:"unavailable"});}
}
