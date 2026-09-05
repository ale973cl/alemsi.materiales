import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { renderEmail } from "@/lib/email-engine";

export async function POST(request:Request){
  if(!process.env.EMAIL_WORKER_TOKEN||request.headers.get("authorization")!==`Bearer ${process.env.EMAIL_WORKER_TOKEN}`) return NextResponse.json({error:"No autorizado"},{status:401});
  if(!process.env.SUPABASE_SECRET_KEY||!process.env.RESEND_API_KEY) return NextResponse.json({error:"Faltan variables privadas"},{status:503});
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
  const {data:queue,error}=await db.from("email_queue").select("*").eq("status","Pendiente").lt("attempts",5).order("created_at").limit(20);
  if(error) return NextResponse.json({error:error.message},{status:500});
  const results=[];
  for(const item of queue||[]){
    const payload:any=item.payload||{};
    const html=renderEmail({module:payload.module||"alerts",event:payload.event||item.email_type,title:item.subject,summary:payload.summary||"Existe una actualización en el proceso de materiales.",facts:payload});
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json","Idempotency-Key":`${item.email_type}-${item.related_id||item.id}`},body:JSON.stringify({from:process.env.EMAIL_FROM,to:item.to_addresses,cc:item.cc_addresses,subject:item.subject,html})});
    const body:any=await response.json().catch(()=>({}));
    if(response.ok){await db.from("email_queue").update({status:"Enviado",attempts:item.attempts+1,sent_at:new Date().toISOString(),last_error:null}).eq("id",item.id);await db.from("email_events").insert({email_queue_id:item.id,event_type:"sent",provider_message_id:body.id,detail:body});}
    else await db.from("email_queue").update({status:item.attempts+1>=5?"Fallido":"Pendiente",attempts:item.attempts+1,last_error:body.message||`HTTP ${response.status}`}).eq("id",item.id);
    results.push({id:item.id,ok:response.ok});
  }
  return NextResponse.json({processed:results.length,results});
}
