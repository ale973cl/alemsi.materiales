import type {EmailModule} from "@/lib/email-engine";

type QueueInput={
  module:EmailModule;
  event:string;
  emailType:string;
  relatedTable:string;
  relatedId:string;
  subject:string;
  summary:string;
  to?:string[];
  cc?:string[];
  facts?:Record<string,string|number|null>;
  actionUrl?:string|null;
  idempotencyKey?:string;
};

const uniqueEmails=(values:(string|null|undefined)[])=>[...new Set(values.map(v=>String(v||"").trim().toLowerCase()).filter(Boolean))];

export async function enqueueModuleEmail(supabase:any,input:QueueInput){
  const {data:rule}=await supabase.from("email_module_rules").select("to_roles,cc_roles,template_code,active").eq("module",input.module).eq("event_code",input.event).eq("active",true).maybeSingle();
  const toRoles=Array.isArray(rule?.to_roles)?rule.to_roles:[];
  const ccRoles=Array.isArray(rule?.cc_roles)?rule.cc_roles:[];
  let roleProfiles:any[]=[];
  if(toRoles.length||ccRoles.length){
    const {data}=await supabase.from("user_profiles").select("email,role").eq("active",true).in("role",[...new Set([...toRoles,...ccRoles])]);
    roleProfiles=data||[];
  }
  const to=uniqueEmails([...(input.to||[]),...roleProfiles.filter(p=>toRoles.includes(p.role)).map(p=>p.email)]);
  const cc=uniqueEmails([...(input.cc||[]),...roleProfiles.filter(p=>ccRoles.includes(p.role)).map(p=>p.email)]).filter(email=>!to.includes(email));
  if(!to.length)return{queued:false,reason:"Sin destinatarios configurados"};
  const idempotencyKey=input.idempotencyKey||`${input.module}:${input.event}:${input.relatedId}`;
  const {data:existing}=await supabase.from("email_queue").select("id,status").eq("idempotency_key",idempotencyKey).maybeSingle();
  if(existing)return{queued:false,existing:true,id:existing.id,status:existing.status};
  const payload={module:input.module,event:input.event,summary:input.summary,facts:input.facts||{},action_url:input.actionUrl||null,template_code:rule?.template_code||null};
  const {data,error}=await supabase.from("email_queue").insert({
    email_type:input.emailType,
    module:input.module,
    event_code:input.event,
    related_table:input.relatedTable,
    related_id:input.relatedId,
    to_addresses:to,
    cc_addresses:cc,
    subject:input.subject,
    payload,
    idempotency_key:idempotencyKey,
    status:"Pendiente"
  }).select("id,status").single();
  if(error)throw error;
  return{queued:true,id:data.id,status:data.status};
}
