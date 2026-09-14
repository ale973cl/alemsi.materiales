import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

const PRE_OUTPUT=["Borrador","Pendiente","En preparación","Listo para despacho"];
function info(label:string){try{return JSON.parse(label||"{}")}catch{return{name:label||"Campaña"}}}

export async function GET(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Sesión no válida"},{status:401});
  const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
  if(!profile?.active)return NextResponse.json({error:"Usuario inactivo"},{status:403});

  const [{data:surveys,error:surveyError},{data:movements},{data:dispatches}]=await Promise.all([
    supabase.from("surveys").select("id,campaign_id,installation_id,status,confirmed_at,campaigns(id,label,status),installations(id,name,address,region,city,commune,contracts(id,name,clients(id,legal_name,rut))),survey_lines(material_id,shortage_qty,materials(id,name,family,presentation,unit,supplier_code))").eq("status","Confirmada").order("confirmed_at",{ascending:true}),
    supabase.from("inventory_movements").select("material_id,signed_quantity"),
    supabase.from("dispatches").select("id,installation_id,status,observations,dispatch_lines(material_id,required_qty)").neq("status","Anulado"),
  ]);
  if(surveyError)return NextResponse.json({error:surveyError.message},{status:500});

  const stock=new Map<string,number>();for(const m of movements||[])stock.set(String((m as any).material_id),(stock.get(String((m as any).material_id))||0)+Number((m as any).signed_quantity||0));
  const committed=new Map<string,number>();for(const d of dispatches||[]){if(!PRE_OUTPUT.includes((d as any).status))continue;for(const l of (d as any).dispatch_lines||[]){const id=String(l.material_id);committed.set(id,(committed.get(id)||0)+Number(l.required_qty||0));}}

  const suggestions:any[]=[];
  for(const s of surveys||[]){
    const campaign:any=Array.isArray((s as any).campaigns)?(s as any).campaigns[0]:(s as any).campaigns;
    const installation:any=Array.isArray((s as any).installations)?(s as any).installations[0]:(s as any).installations;
    if(!campaign||!installation)continue;
    const contract:any=Array.isArray(installation.contracts)?installation.contracts[0]:installation.contracts;
    const client:any=Array.isArray(contract?.clients)?contract.clients[0]:contract?.clients;
    const already=new Map<string,number>();const marker=`CAMPAÑA:${(s as any).campaign_id}`;
    for(const d of dispatches||[]){if(String((d as any).installation_id)!==String((s as any).installation_id)||!String((d as any).observations||"").includes(marker))continue;for(const l of (d as any).dispatch_lines||[]){const id=String(l.material_id);already.set(id,(already.get(id)||0)+Number(l.required_qty||0));}}
    const lines=((s as any).survey_lines||[]).map((l:any)=>{const id=String(l.material_id);const pending=Math.max(Number(l.shortage_qty||0)-(already.get(id)||0),0);const available=Math.max((stock.get(id)||0)-(committed.get(id)||0),0);return{material_id:id,name:l.materials?.name||"Material",unit:l.materials?.unit||"",pending,available,can_allocate:Math.min(pending,available)}}).filter((l:any)=>l.pending>0);
    if(!lines.length)continue;
    const totalPending=lines.reduce((sum:number,l:any)=>sum+l.pending,0);const allocatable=lines.reduce((sum:number,l:any)=>sum+l.can_allocate,0);const cInfo=info(campaign.label);
    suggestions.push({survey_id:(s as any).id,campaign_id:(s as any).campaign_id,campaign_name:cInfo.name||"Campaña",delivery_period:cInfo.deliveryPeriod||cInfo.name||"",installation_id:(s as any).installation_id,installation_name:installation.name,address:[installation.address,installation.commune,installation.city,installation.region].filter(Boolean).join(" · "),client_id:client?.id||"",client_name:client?.legal_name||"Cliente",contract_id:contract?.id||"",contract_name:contract?.name||"Contrato",confirmed_at:(s as any).confirmed_at,total_pending:totalPending,allocatable,needs_supply:allocatable<totalPending,lines});
  }
  return NextResponse.json({suggestions});
}
