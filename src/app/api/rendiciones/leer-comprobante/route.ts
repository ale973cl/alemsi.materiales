import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export const runtime="nodejs";

const allowed=new Set(["image/jpeg","image/png","image/webp"]);
const documentTypes=["Factura","Boleta","Transferencia","Otro"] as const;
const prompt="Lee este comprobante chileno de gasto. Devuelve SOLO JSON válido, sin markdown. No inventes datos: si no se ve con claridad usa null. Campos: expense_date en YYYY-MM-DD, document_type uno de Factura|Boleta|Transferencia|Otro, provider_name, provider_rut, document_number, description breve del gasto, presented_amount como número entero CLP. Para TOTAL usa el monto final pagado, no neto ni IVA.";

type ReceiptData={
 expense_date?:unknown;document_type?:unknown;provider_name?:unknown;provider_rut?:unknown;
 document_number?:unknown;description?:unknown;presented_amount?:unknown;
};

const clean=(s:string)=>s.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"").trim();
const text=(v:unknown)=>typeof v==="string"?v:"";
function normalize(parsed:ReceiptData){
 return {
  expense_date:text(parsed.expense_date),
  document_type:documentTypes.includes(parsed.document_type as typeof documentTypes[number])?parsed.document_type:"Otro",
  provider_name:text(parsed.provider_name),
  provider_rut:text(parsed.provider_rut),
  document_number:text(parsed.document_number),
  description:text(parsed.description),
  presented_amount:Number(parsed.presented_amount)||null,
 };
}

async function readWithGemini(file:File,b64:string){
 const key=process.env.GEMINI_API_KEY;
 if(!key)throw new Error("GEMINI_NOT_CONFIGURED");
 const model=process.env.GEMINI_RECEIPT_MODEL||"gemini-3.5-flash-lite";
 const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
  method:"POST",
  headers:{"Content-Type":"application/json","x-goog-api-key":key},
  body:JSON.stringify({
   contents:[{role:"user",parts:[{text:prompt},{inline_data:{mime_type:file.type,data:b64}}]}],
   generationConfig:{responseMimeType:"application/json",maxOutputTokens:500},
  }),
 });
 const raw=await response.json();
 if(!response.ok){
  console.error("Gemini receipt reader",response.status,JSON.stringify(raw).slice(0,1200));
  throw new Error(`GEMINI_${response.status}`);
 }
 const content=raw?.candidates?.[0]?.content?.parts?.map((part:{text?:string})=>part?.text||"").join("").trim();
 if(!content)throw new Error("GEMINI_EMPTY");
 return normalize(JSON.parse(clean(content)));
}

async function readWithOpenRouter(file:File,b64:string){
 const key=process.env.OPENROUTER_API_KEY;
 if(!key)throw new Error("OPENROUTER_NOT_CONFIGURED");
 const image="data:"+file.type+";base64,"+b64;
 const response=await fetch("https://openrouter.ai/api/v1/chat/completions",{
  method:"POST",
  headers:{Authorization:"Bearer "+key,"Content-Type":"application/json","HTTP-Referer":process.env.NEXT_PUBLIC_SITE_URL||"https://alemsi.vercel.app","X-Title":"ALEMSI Rendiciones"},
  body:JSON.stringify({model:"google/gemma-4-31b-it:free",response_format:{type:"json_object"},provider:{allow_fallbacks:true},messages:[{role:"user",content:[{type:"text",text:prompt},{type:"image_url",image_url:{url:image}}]}],temperature:0,max_tokens:500}),
 });
 const raw=await response.json();
 if(!response.ok){
  console.error("OpenRouter receipt reader",response.status,JSON.stringify(raw).slice(0,1200));
  throw new Error(`OPENROUTER_${response.status}`);
 }
 const content=raw?.choices?.[0]?.message?.content;
 if(typeof content!=="string")throw new Error("OPENROUTER_EMPTY");
 return normalize(JSON.parse(clean(content)));
}

export async function POST(req:Request){
 try{
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Sesión requerida."},{status:401});
  const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
  if(!profile?.active)return NextResponse.json({error:"Usuario no habilitado."},{status:403});
  const {data:access}=await supabase.rpc("has_additional_service_access",{p_service_code:"rendiciones"});
  if(!access&&profile.role!=="Admin Total")return NextResponse.json({error:"Rendiciones no habilitado."},{status:403});

  const fd=await req.formData();
  const file=fd.get("file");
  if(!(file instanceof File)||!allowed.has(file.type))return NextResponse.json({error:"Para lectura automática usa JPG, PNG o WEBP."},{status:400});
  if(file.size>10*1024*1024)return NextResponse.json({error:"La imagen supera 10 MB."},{status:400});

  const b64=Buffer.from(await file.arrayBuffer()).toString("base64");
  let geminiError:unknown;
  try{
   const data=await readWithGemini(file,b64);
   return NextResponse.json({data,reader:"gemini"});
  }catch(error){
   geminiError=error;
   console.warn("Gemini no disponible; intentando respaldo OpenRouter.",error instanceof Error?error.message:error);
  }

  try{
   const data=await readWithOpenRouter(file,b64);
   return NextResponse.json({data,reader:"openrouter"});
  }catch(error){
   console.error("OpenRouter fallback failed",error instanceof Error?error.message:error);
   const noGemini=geminiError instanceof Error&&geminiError.message==="GEMINI_NOT_CONFIGURED";
   const noOpenRouter=error instanceof Error&&error.message==="OPENROUTER_NOT_CONFIGURED";
   if(noGemini&&noOpenRouter)return NextResponse.json({error:"El lector no está configurado en el servidor."},{status:503});
   return NextResponse.json({error:"Los lectores automáticos no están disponibles en este momento. Completa los datos manualmente."},{status:503});
  }
 }catch(error){
  console.error("Receipt reader unexpected error",error);
  return NextResponse.json({error:"No se pudo leer el comprobante. Completa los datos manualmente."},{status:500});
 }
}
