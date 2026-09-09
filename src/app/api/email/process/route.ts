import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { renderEmail, type EmailModule } from "@/lib/email-engine";

export async function POST(request:Request){
  if(!process.env.EMAIL_WORKER_TOKEN||request.headers.get("authorization")!==`Bearer ${process.env.EMAIL_WORKER_TOKEN}`) return NextResponse.json({error:"No autorizado"},{status:401});
  if(!process.env.SUPABASE_SECRET_KEY||!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM) return NextResponse.json({error:"Faltan variables privadas del motor de correo"},{status:503});
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
  const {data:queue,error}=await db.from("email_queue").select("*").eq("status","Pendiente").lt("attempts",5).order("created_at").limit(20);
  if(error) return NextResponse.json({error:error.message},{status:500});
  const results=[];
  for(const item of queue||[]){
    const payload:any=item.payload||{};
    const module=(item.module||payload.module||"alerts") as EmailModule;
    const event=String(item.event_code||payload.event||item.email_type||"notification");
    const html=renderEmail({module,event,title:item.subject,summary:payload.summary||"Existe una actualización en el proceso de materiales.",facts:payload.facts||{},actionUrl:payload.action_url||null});
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json","Idempotency-Key":item.idempotency_key||`${item.email_type}-${item.related_id||item.id}`},body:JSON.stringify({from:process.env.EMAIL_FROM,to:item.to_addresses,cc:item.cc_addresses||[],subject:item.subject,html})});
    const body:any=await response.json().catch(()=>({}));
    const attempts=Number(item.attempts||0)+1;
    if(response.ok){
      await db.from("email_queue").update({status:"Enviado",attempts,sent_at:new Date().toISOString(),last_error:null}).eq("id",item.id);
      await db.from("email_events").insert({email_queue_id:item.id,event_type:"sent",provider_message_id:body.id||null,detail:{module,event,provider:"resend",response:body}});
    }else{
      const status=attempts>=5?"Fallido":"Pendiente";
      const lastError=body.message||`HTTP ${response.status}`;
      await db.from("email_queue").update({status,attempts,last_error:lastError}).eq("id",item.id);
      await db.from("email_events").insert({email_queue_id:item.id,event_type:"failed",provider_message_id:body.id||null,detail:{module,event,provider:"resend",status:lastError,response:body}});
    }
    results.push({id:item.id,ok:response.ok,status:response.ok?"Enviado":attempts>=5?"Fallido":"Pendiente"});
  }
  return NextResponse.json({processed:results.length,results});
}
