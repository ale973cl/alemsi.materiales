import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {FLEET_DOCUMENT_TEMPLATES,type FleetDocumentKind} from "@/modules/flota/document-reader";

export const runtime="nodejs";
const allowed=new Set(["image/jpeg","image/png","image/webp","application/pdf"]);
const cleanJson=(value:string)=>value.replace(/^\`\`\`(?:json)?\s*/i,"").replace(/\s*\`\`\`$/i,"").trim();

function templatePrompt(kind:FleetDocumentKind,vehicle:{plate:string;chassis_vin?:string|null}){
 const template=FLEET_DOCUMENT_TEMPLATES.find(item=>item.kind===kind);
 if(!template)throw new Error("INVALID_KIND");
 return [
  "Lee un documento de flota chileno. Devuelve SOLO JSON válido, sin markdown.",
  "No inventes ni completes datos que no sean visibles: usa null.",
  "Tipo esperado: "+kind+".",
  "Vehículo abierto: patente "+vehicle.plate+(vehicle.chassis_vin?", VIN/chasis "+vehicle.chassis_vin:"")+".",
  "Si patente o VIN del documento no coinciden, requires_review debe ser true.",
  "Extrae únicamente estos campos: "+template.fields.map(field=>field.key).join(", ")+".",
  template.serviceTerms?.length?"Además devuelve services como arreglo con los servicios detectados entre: "+template.serviceTerms.map(x=>x.label).join(", ")+".":"Devuelve services como arreglo vacío.",
  "Devuelve también confidence entre 0 y 1 y requires_review boolean.",
  "Fechas en YYYY-MM-DD cuando sean inequívocas.",
 ].join("\n");
}
function normalize(raw:unknown){
 if(!raw||typeof raw!=="object")throw new Error("INVALID_RESPONSE");
 const source=raw as Record<string,unknown>;
 const data:Record<string,unknown>={};
 for(const [key,value] of Object.entries(source)){
  if(key==="confidence"||key==="requires_review")continue;
  if(Array.isArray(value))data[key]=value.map(v=>String(v)).slice(0,30);
  else if(typeof value==="string"||typeof value==="number"||typeof value==="boolean"||value===null)data[key]=value;
 }
 return {data,confidence:typeof source.confidence==="number"?source.confidence:null,requires_review:source.requires_review===true};
}
async function gemini(file:File,b64:string,prompt:string){
 const key=process.env.GEMINI_API_KEY;if(!key)throw new Error("GEMINI_NOT_CONFIGURED");
 const model=process.env.GEMINI_RECEIPT_MODEL||"gemini-3.5-flash-lite";
 const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt},{inline_data:{mime_type:file.type,data:b64}}]}],generationConfig:{responseMimeType:"application/json",maxOutputTokens:1400}})});
 const raw=await response.json();if(!response.ok)throw new Error("GEMINI_"+response.status);
 const content=raw?.candidates?.[0]?.content?.parts?.map((p:{text?:string})=>p.text||"").join("").trim();if(!content)throw new Error("GEMINI_EMPTY");
 return normalize(JSON.parse(cleanJson(content)));
}
async function openRouter(file:File,b64:string,prompt:string){
 if(file.type==="application/pdf")throw new Error("OPENROUTER_PDF_UNSUPPORTED");
 const key=process.env.OPENROUTER_API_KEY;if(!key)throw new Error("OPENROUTER_NOT_CONFIGURED");
 const response=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json","HTTP-Referer":process.env.NEXT_PUBLIC_SITE_URL||process.env.NEXT_PUBLIC_APP_URL||"https://alemsi.vercel.app","X-Title":"ALEMSI Flota"},body:JSON.stringify({model:"google/gemma-4-31b-it:free",response_format:{type:"json_object"},provider:{allow_fallbacks:true},messages:[{role:"user",content:[{type:"text",text:prompt},{type:"image_url",image_url:{url:"data:"+file.type+";base64,"+b64}}]}],temperature:0,max_tokens:1400})});
 const raw=await response.json();if(!response.ok)throw new Error("OPENROUTER_"+response.status);
 const content=raw?.choices?.[0]?.message?.content;if(typeof content!=="string")throw new Error("OPENROUTER_EMPTY");
 return normalize(JSON.parse(cleanJson(content)));
}
export async function POST(req:Request){
 try{
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Sesión requerida."},{status:401});
  const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();if(!profile?.active)return NextResponse.json({error:"Usuario no habilitado."},{status:403});
  const {data:access}=await supabase.rpc("has_additional_service_access",{p_service_code:"flota"});if(!access&&profile.role!=="Admin Total")return NextResponse.json({error:"Flota no habilitada."},{status:403});
  const fd=await req.formData();const file=fd.get("file"),kind=String(fd.get("kind")||"") as FleetDocumentKind,vehicleId=String(fd.get("vehicle_id")||"");
  if(!(file instanceof File)||!allowed.has(file.type))return NextResponse.json({error:"Usa PDF, JPG, PNG o WEBP."},{status:400});
  if(file.size>10*1024*1024)return NextResponse.json({error:"El archivo supera 10 MB."},{status:400});
  if(!FLEET_DOCUMENT_TEMPLATES.some(x=>x.kind===kind))return NextResponse.json({error:"Tipo documental inválido."},{status:400});
  const {data:vehicle}=await supabase.from("fleet_vehicles").select("plate,chassis_vin").eq("id",vehicleId).maybeSingle();if(!vehicle)return NextResponse.json({error:"Vehículo no encontrado."},{status:404});
  const b64=Buffer.from(await file.arrayBuffer()).toString("base64"),prompt=templatePrompt(kind,vehicle);
  try{return NextResponse.json({...await gemini(file,b64,prompt),reader:"gemini"});}catch(first){
   console.warn("Fleet Gemini reader failed",first instanceof Error?first.message:first);
   try{return NextResponse.json({...await openRouter(file,b64,prompt),reader:"openrouter"});}catch(second){
    console.error("Fleet reader fallback failed",second instanceof Error?second.message:second);
    return NextResponse.json({error:file.type==="application/pdf"?"No fue posible leer este PDF automáticamente. Puedes completar los datos manualmente y conservar el original.":"El lector automático no está disponible. Puedes completar los datos manualmente."},{status:503});
   }
  }
 }catch(error){console.error("Fleet reader unexpected error",error);return NextResponse.json({error:"No fue posible procesar el documento."},{status:500});}
}
