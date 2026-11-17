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
  const abort=AbortSignal.timeout(45000);
  const res=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",{
   method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},signal:abort,
   body:JSON.stringify({contents:[{parts:[{text:instruction},{inline_data:{mime_type:file.type,data:base64}}]}],generationConfig:{temperature:0,responseMimeType:"application/json"}}),
  });
  if(!res.ok)return NextResponse.json({error:`Gemini no respondió correctamente (HTTP ${res.status}). Revisa la configuración y vuelve a intentar.`},{status:502});
  const data=await res.json();
  const raw=(data?.candidates?.[0]?.content?.parts||[]).map((p:{text?:string})=>p.text||"").join("");
  const parsed=JSON.parse(raw);
  if(!parsed||typeof parsed!=="object"||!Array.isArray(parsed.lines))throw new Error("Respuesta inválida");
  return NextResponse.json({ok:true,extracted:parsed,verified:false,inventory_updated:false},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return NextResponse.json({error:"No se pudo analizar la factura. Revisa el archivo o ingresa los datos manualmente."},{status:502});}
}
