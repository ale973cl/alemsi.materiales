import "server-only";
import { createClient } from "@supabase/supabase-js";
import { renderEmail, type EmailModule } from "@/lib/email-engine";
import { enviarCorreoSmtp } from "@/lib/email-smtp";

type ProcessResult={
  id:string;
  processed:boolean;
  ok:boolean;
  status:string;
  errorType?:string|null;
  blockedRecipients?:string[];
};

function serviceDb(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key=process.env.SUPABASE_SECRET_KEY?.trim();
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

async function syncRelatedStatus(db:any,item:any,status:string){
  if(item.related_table==="dispatches"&&item.email_type==="signed_delivery_copy"){
    await db.from("dispatches").update({email_status:status}).eq("id",item.related_id);
  }
}

export async function processQueuedEmailById(id:string):Promise<ProcessResult>{
  const db=serviceDb();
  if(!db)return{id,processed:false,ok:false,status:"Pendiente",errorType:"configuration"};

  const {data:item,error:loadError}=await db.from("email_queue").select("*").eq("id",id).maybeSingle();
  if(loadError||!item)return{id,processed:false,ok:false,status:"No encontrado",errorType:loadError?.message||"not_found"};
  if(item.status!=="Pendiente")return{id,processed:false,ok:item.status==="Enviado",status:item.status};

  const {data:claimed,error:claimError}=await db.from("email_queue").update({status:"Procesando"}).eq("id",id).eq("status","Pendiente").select("id").maybeSingle();
  if(claimError||!claimed)return{id,processed:false,ok:false,status:"Pendiente",errorType:claimError?.message||"already_claimed"};

  const payload:any=item.payload||{};
  const module=(item.module||payload.module||"alerts") as EmailModule;
  const event=String(item.event_code||payload.event||item.email_type||"notification");
  const summary=String(payload.summary||"Existe una actualización en el proceso de materiales.");
  const html=renderEmail({module,event,title:item.subject,summary,facts:payload.facts||{},actionUrl:payload.action_url||null});
  const delivery=await enviarCorreoSmtp({to:item.to_addresses,cc:item.cc_addresses||[],subject:item.subject,text:summary,html});
  const attempts=Number(item.attempts||0)+1;

  if(delivery.ok){
    const now=new Date().toISOString();
    await db.from("email_queue").update({status:"Enviado",attempts,sent_at:now,last_error:null}).eq("id",id);
    await syncRelatedStatus(db,item,"Enviado");
    await db.from("email_events").insert({email_queue_id:id,event_type:"sent",provider_message_id:null,detail:{module,event,provider:"smtp",status:delivery.status}});
    return{id,processed:true,ok:true,status:"Enviado"};
  }

  const blocked=delivery.errorType==="recipient_policy";
  const finalFailure=!blocked&&attempts>=5;
  const status=blocked?"Bloqueado":finalFailure?"Fallido":"Pendiente";
  const lastError=blocked?`Bloqueado por política de destinatarios del entorno: ${(delivery.blockedRecipients||[]).join(", ")}`:`SMTP ${delivery.errorType}`;
  await db.from("email_queue").update({status,attempts,last_error:lastError}).eq("id",id);
  await syncRelatedStatus(db,item,status);
  await db.from("email_events").insert({email_queue_id:id,event_type:blocked?"blocked":"failed",provider_message_id:null,detail:{module,event,provider:"smtp",status:lastError}});
  return{id,processed:true,ok:false,status,errorType:delivery.errorType,blockedRecipients:delivery.blockedRecipients};
}

export async function processPendingEmailQueue(limit=20){
  const db=serviceDb();
  if(!db)return{processed:0,results:[] as ProcessResult[],configurationError:true};
  const {data:queue,error}=await db.from("email_queue").select("id").eq("status","Pendiente").lt("attempts",5).order("created_at").limit(Math.max(1,Math.min(limit,50)));
  if(error)throw error;
  const results:ProcessResult[]=[];
  for(const item of queue||[])results.push(await processQueuedEmailById(String(item.id)));
  return{processed:results.filter(x=>x.processed).length,results,configurationError:false};
}
