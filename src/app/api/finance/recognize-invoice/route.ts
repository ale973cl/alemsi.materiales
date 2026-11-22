import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

const MAX_BYTES=10*1024*1024;
const ALLOWED_TYPES=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);

function extractText(payload:any){
  if(typeof payload?.output_text==="string"&&payload.output_text.trim())return payload.output_text.trim();
  for(const item of payload?.output||[]){
    for(const content of item?.content||[]){
      if(content?.type==="output_text"&&typeof content?.text==="string")return content.text.trim();
    }
  }
  return "";
}

function parseJson(text:string){
  const cleaned=text.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```$/i,"").trim();
  return JSON.parse(cleaned);
}

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"No autorizado"},{status:401});

  const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
  if(!profile?.active||!["Admin Total","Gerencia","Finanzas","Admin"].includes(profile.role)){
    return NextResponse.json({error:"Tu perfil no puede ejecutar reconocimiento de facturas"},{status:403});
  }

  const apiKey=process.env.GEMINI_API_KEY;
  if(!apiKey)return NextResponse.json({error:"Falta GEMINI_API_KEY en el despliegue."},{status:503});

  const formData=await request.formData();
  const file=formData.get("file");
  if(!(file instanceof File))return NextResponse.json({error:"Selecciona un PDF o una fotografía"},{status:400});
  if(!ALLOWED_TYPES.has(file.type))return NextResponse.json({error:"Formato no admitido. Usa PDF, JPG, PNG o WEBP."},{status:400});
  if(file.size<=0||file.size>MAX_BYTES)return NextResponse.json({error:"El archivo debe pesar entre 1 byte y 10 MB."},{status:400});

  const bytes=Buffer.from(await file.arrayBuffer());
  const prompt=`Analiza este documento de compra chileno. Devuelve EXCLUSIVAMENTE JSON válido, sin markdown ni explicaciones.
Extrae lo visible sin inventar datos. Si un dato no aparece, usa null. Los montos deben ser números sin puntos de miles ni símbolos.
Estructura exacta:
{
  "document_type": "Factura|Boleta|Guía de despacho|Otro|null",
  "folio": "string|null",
  "document_date": "YYYY-MM-DD|null",
  "supplier_name": "string|null",
  "supplier_rut": "string|null",
  "buyer_name": "string|null",
  "buyer_rut": "string|null",
  "purchase_order_reference": "string|null",
  "net_amount": number|null,
  "vat_amount": number|null,
  "total_amount": number|null,
  "currency": "CLP|USD|EUR|null",
  "lines": [
    {
      "supplier_code": "string|null",
      "description": "string|null",
      "quantity": number|null,
      "unit": "string|null",
      "unit_net_price": number|null,
      "line_net": number|null
    }
  ],
  "notes": ["string"],
  "confidence": "alta|media|baja"
}
No calcules ni completes valores que no estén impresos claramente. Si el documento contiene descuentos, flete u otros cargos, inclúyelos en notes.`;


  const model="gemini-2.5-flash-lite";
  try{
    let response:Response|null=null;
    for(let attempt=0;attempt<2;attempt++){
    response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent",{
      method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
      body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt},{inline_data:{mime_type:file.type,data:bytes.toString("base64")}}]}],generationConfig:{responseMimeType:"application/json",temperature:0}}),
      cache:"no-store",signal:AbortSignal.timeout(45000)
    });
    if(response.status===429&&attempt===0){await new Promise(resolve=>setTimeout(resolve,20000));continue;}
    break;
    }
    if(!response)throw Error("Gemini no respondió");
    if(!response.ok){
      console.error("invoice_gemini_failure",{httpStatus:response.status,model});
      const explanation=response.status===404?"Modelo Gemini no disponible; revisa GEMINI_RECEIPT_MODEL.":response.status===429?"Cuota Gemini agotada.":response.status===401||response.status===403?"Clave Gemini no autorizada.":"Gemini rechazó la lectura (HTTP "+response.status+").";
      return NextResponse.json({error:explanation},{status:502});
    }
    const payload=await response.json();
    const text=(payload?.candidates?.[0]?.content?.parts||[]).map((p:any)=>p.text||"").join("").trim();
    if(!text)return NextResponse.json({error:"Gemini no devolvió contenido."},{status:502});
    const data=parseJson(text);
    if(!data||typeof data!=="object"||Array.isArray(data)||!Array.isArray(data.lines))throw Error("Respuesta sin líneas de factura");
    return NextResponse.json({ok:true,data,model},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    const timedOut=error instanceof Error&&error.name==="TimeoutError";
    console.error("invoice_gemini_exception",{kind:timedOut?"timeout":"upstream_or_format",model});
    return NextResponse.json({error:timedOut?"Lectura excedió 45 segundos.":"No se pudo completar la lectura con Gemini."},{status:timedOut?504:502});
  }
}
