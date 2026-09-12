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

  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey){
    return NextResponse.json({error:"El reconocimiento está instalado, pero falta configurar OPENAI_API_KEY en el entorno Preview."},{status:503});
  }

  const formData=await request.formData();
  const file=formData.get("file");
  if(!(file instanceof File))return NextResponse.json({error:"Selecciona un PDF o una fotografía"},{status:400});
  if(!ALLOWED_TYPES.has(file.type))return NextResponse.json({error:"Formato no admitido. Usa PDF, JPG, PNG o WEBP."},{status:400});
  if(file.size<=0||file.size>MAX_BYTES)return NextResponse.json({error:"El archivo debe pesar entre 1 byte y 10 MB."},{status:400});

  const bytes=Buffer.from(await file.arrayBuffer());
  const dataUrl=`data:${file.type};base64,${bytes.toString("base64")}`;
  const documentInput=file.type==="application/pdf"
    ? {type:"input_file",filename:file.name,file_data:dataUrl}
    : {type:"input_image",image_url:dataUrl,detail:"high"};

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

  let aiResponse:Response;
  try{
    aiResponse=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:process.env.OPENAI_INVOICE_MODEL||"gpt-5.6-luna",
        reasoning:{effort:"low"},
        input:[{role:"user",content:[{type:"input_text",text:prompt},documentInput]}],
        max_output_tokens:5000,
      }),
    });
  }catch{
    return NextResponse.json({error:"No se pudo conectar con el servicio de reconocimiento"},{status:502});
  }

  const payload=await aiResponse.json().catch(()=>null);
  if(!aiResponse.ok){
    const detail=payload?.error?.message||"Error del servicio de reconocimiento";
    return NextResponse.json({error:detail},{status:502});
  }

  const text=extractText(payload);
  if(!text)return NextResponse.json({error:"El modelo no devolvió contenido utilizable"},{status:502});

  try{
    const data=parseJson(text);
    return NextResponse.json({ok:true,data,model:payload?.model||process.env.OPENAI_INVOICE_MODEL||"gpt-5.6-luna"});
  }catch{
    return NextResponse.json({error:"El documento fue leído, pero la respuesta no llegó en formato estructurado.",raw:text.slice(0,2000)},{status:502});
  }
}
