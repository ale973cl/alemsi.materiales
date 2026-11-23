import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export const runtime="nodejs";
const MAX_BYTES=8*1024*1024;
const MIME=["application/pdf","image/jpeg","image/png","image/webp"] as const;
export async function POST(request:NextRequest){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"No autorizado"},{status:401});
 const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
 if(!profile?.active||!["Admin Total","Gerencia","Admin","Bodega","Finanzas"].includes(profile.role))return NextResponse.json({error:"Sin autorización para analizar documentos"},{status:403});
 const key=process.env.GEMINI_API_KEY;
 if(!key)return NextResponse.json({error:"Gemini no configurado: falta GEMINI_API_KEY en el entorno Preview."},{status:503});
 const form=await request.formData();
 const file=form.get("file");
 if(!(file instanceof File))return NextResponse.json({error:"Adjunta la factura"},{status:400});
 if(!MIME.includes(file.type as typeof MIME[number])||!file.size||file.size>MAX_BYTES)return NextResponse.json({error:"Factura inválida: PDF/JPG/PNG/WebP, máximo 8 MB"},{status:400});
 const base64=Buffer.from(await file.arrayBuffer()).toString("base64");
 const instruction=`Extrae los datos visibles de esta factura chilena. No estimes ni inventes. Devuelve SOLO JSON válido con:
 { "supplier_name":string|null,"supplier_rut":string|null,"document_type":string|null,"folio":string|null,"date":string|null,"net":number|null,"vat":number|null,"total":number|null,"payment_condition":string|null,"payment_days":number|null,"lines":[{"description":string,"supplier_code":string|null,"quantity":number|null,"unit":string|null,"unit_net":number|null,"line_net":number|null}],"warnings":string[] }
Formato de fecha YYYY-MM-DD si es legible; montos CLP sin separadores. line_net debe ser el NETO TOTAL de esa línea, sin IVA. unit_net solo si aparece explícito; si no aparece, déjalo null porque el sistema calculará line_net / quantity. En warnings explica textos o cifras ilegibles, datos ausentes y discrepancias de suma. Las líneas no son productos del maestro ALEMSI; NO hagas equivalencia automática.`;
 try{
  const catalog=await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100",{headers:{"x-goog-api-key":key},cache:"no-store",signal:AbortSignal.timeout(12000)});
  if(!catalog.ok){console.error("receipt_gemini_catalog",{status:catalog.status});return NextResponse.json({error:"No se pudo consultar el catálogo de modelos de esta clave (HTTP "+catalog.status+")."},{status:502});}
  const listing=await catalog.json();
  const supported=(listing.models||[]).filter((m:{name?:string;supportedGenerationMethods?:string[]})=>m.supportedGenerationMethods?.includes("generateContent")&&/^models\\/gemini-(?:[3-9](?:\\.\\d+)?)-(?:flash|flash-lite)(?:-[\\w-]+)?$/.test(m.name||"")).map((m:{name:string})=>m.name.replace("models/","")) as string[];
  const priority=(m:string)=>/flash-lite$/.test(m)?0:/flash$/.test(m)?1:2;
  supported.sort((a,b)=>priority(a)-priority(b)||b.localeCompare(a));
  if(!supported.length)return NextResponse.json({error:"La clave no ofrece modelos Gemini Flash compatibles con generateContent. Revisa el proyecto en Google AI Studio."},{status:502});
  let res:Response|null=null;
  let chosen="";
  let lastStatus=0;
  for(const model of supported.slice(0,6)){
   for(let attempt=0;attempt<2;attempt++){
    const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent",{
     method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},
     signal:AbortSignal.timeout(45000),
     body:JSON.stringify({contents:[{parts:[{text:instruction},{inline_data:{mime_type:file.type,data:base64}}]}],generationConfig:{temperature:0,responseMimeType:"application/json"}})
    });
    if(response.ok){res=response;chosen=model;break;}
    lastStatus=response.status;
    console.error("receipt_gemini_http",{status:response.status,model,attempt:attempt+1});
    if(response.status===429&&attempt===0){await new Promise(resolve=>setTimeout(resolve,20000));continue;}
    break;
   }
   if(res||lastStatus!==404)break;
  }
  if(!res)return NextResponse.json({error:lastStatus===429?"Gemini devolvió HTTP 429: límite de cuota del proyecto.":lastStatus===404?"Ninguno de los modelos Flash anunciados para esta clave aceptó la solicitud (404).":"Gemini rechazó la lectura (HTTP "+lastStatus+")."},{status:502});
  const data=await res.json();
  const raw=(data?.candidates?.[0]?.content?.parts||[]).map((p:{text?:string})=>p.text||"").join("");
  const parsed=JSON.parse(raw);
  if(!parsed||typeof parsed!=="object"||!Array.isArray(parsed.lines))throw new Error("Respuesta inválida");
  return NextResponse.json({ok:true,extracted:parsed,model:chosen,verified:false,inventory_updated:false},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("receipt_gemini_exception",{message:error instanceof Error?error.message:"unknown"});return NextResponse.json({error:"No se pudo analizar la factura. Revisa el archivo o ingresa los datos manualmente."},{status:502});}
}
