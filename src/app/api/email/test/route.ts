import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {enviarCorreoSmtp} from "@/lib/email-smtp";
import {renderEmail} from "@/lib/email-engine";

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(userError||!user)return NextResponse.json({ok:false,error:"Sesión no válida"},{status:401});

  const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).maybeSingle();
  if(!profile?.active||profile.role!=="Admin Total")return NextResponse.json({ok:false,error:"Solo Admin Total puede ejecutar la prueba de correo"},{status:403});

  let body:any={};
  try{body=await request.json();}catch{}
  const email=String(body.email||profile.email||user.email||"").trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(email))return NextResponse.json({ok:false,error:"Correo de prueba no válido"},{status:400});

  const title="Prueba de correo · ALEMSI Materiales";
  const summary="Este mensaje confirma que el servidor de ALEMSI Materiales logró conectarse, autenticarse y entregar un correo mediante SMTP.";
  const html=renderEmail({module:"alerts",event:"smtp_test",title,summary,facts:{Destino:email,Ejecutado_por:profile.full_name||profile.email||"Admin Total",Fecha:new Date().toLocaleString("es-CL")}});
  const delivery=await enviarCorreoSmtp({to:[email],subject:title,text:summary,html});

  if(!delivery.ok){
    const labels:Record<string,string>={configuration:"Configuración SMTP incompleta o inválida",connection:"No fue posible conectar con el servidor SMTP",tls:"Falló la negociación TLS",authentication:"El servidor rechazó usuario o contraseña",timeout:"El servidor SMTP no respondió dentro del tiempo esperado",protocol:"Respuesta SMTP inesperada",recipient_policy:"Destinatario bloqueado por política temporal: solo @alemsi.cl y correos personales autorizados"};
    return NextResponse.json({ok:false,errorType:delivery.errorType,error:labels[delivery.errorType]||"Error SMTP",blockedRecipients:delivery.blockedRecipients||[]},{status:delivery.errorType==="recipient_policy"?403:502});
  }

  return NextResponse.json({ok:true,status:delivery.status,email});
}
