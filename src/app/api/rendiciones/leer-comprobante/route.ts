import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export const runtime="nodejs";
const allowed=new Set(["image/jpeg","image/png","image/webp"]);
const clean=(s:string)=>s.replace(/^\`\`\`(?:json)?\s*/i,"").replace(/\s*\`\`\`$/i,"").trim();

export async function POST(req:Request){
 try{
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Sesión requerida."},{status:401});
  const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
  if(!profile?.active)return NextResponse.json({error:"Usuario no habilitado."},{status:403});
  const {data:access}=await supabase.rpc("has_additional_service_access",{p_service_code:"rendiciones"});
  if(!access&&profile.role!=="Admin Total")return NextResponse.json({error:"Rendiciones no habilitado."},{status:403});
  const fd=await req.formData();const file=fd.get("file");
  if(!(file instanceof File)||!allowed.has(file.type))return NextResponse.json({error:"Para lectura automática usa JPG, PNG o WEBP."},{status:400});
  if(file.size>10*1024*1024)return NextResponse.json({error:"La imagen supera 10 MB."},{status:400});
  const key=process.env.OPENROUTER_API_KEY;
  if(!key)return NextResponse.json({error:"El lector no está configurado en el servidor."},{status:503});
  const b64=Buffer.from(await file.arrayBuffer()).toString("base64");
  const image="data:"+file.type+";base64,"+b64;
  const response=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json","HTTP-Referer":process.env.NEXT_PUBLIC_SITE_URL||"https://alemsi.vercel.app","X-Title":"ALEMSI Rendiciones"},body:JSON.stringify({model:"google/gemma-4-31b-it:free",response_format:{type:"json_object"},provider:{allow_fallbacks:true},messages:[{role:"user",content:[{type:"text",text:"Lee este comprobante chileno de gasto. Devuelve SOLO JSON válido, sin markdown. No inventes datos: si no se ve con claridad usa null. Campos: expense_date en YYYY-MM-DD, document_type uno de Factura|Boleta|Transferencia|Otro, provider_name, provider_rut, document_number, description breve del gasto, presented_amount como número entero CLP. Para TOTAL usa el monto final pagado, no neto ni IVA."},{type:"image_url",image_url:{url:image}}]}],temperature:0,max_tokens:500})});
  const raw=await response.json();
  if(!response.ok){console.error("OpenRouter receipt reader",response.status,JSON.stringify(raw).slice(0,1200));return NextResponse.json({error:response.status===429?"El lector gratuito está temporalmente ocupado. Intenta nuevamente en unos segundos.":"El lector no pudo procesar esta imagen. Intenta nuevamente o completa manualmente."},{status:response.status===429?429:502});}
  const content=raw?.choices?.[0]?.message?.content;
  if(typeof content!=="string")return NextResponse.json({error:"No fue posible interpretar el comprobante. Completa manualmente."},{status:422});
  const parsed=JSON.parse(clean(content));
  return NextResponse.json({data:{expense_date:parsed.expense_date||"",document_type:["Factura","Boleta","Transferencia","Otro"].includes(parsed.document_type)?parsed.document_type:"Otro",provider_name:parsed.provider_name||"",provider_rut:parsed.provider_rut||"",document_number:parsed.document_number||"",description:parsed.description||"",presented_amount:Number(parsed.presented_amount)||null}});
 }catch{return NextResponse.json({error:"No se pudo leer el comprobante. Completa los datos manualmente."},{status:500});}
}
