import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export async function GET(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"No autorizado"},{status:401});
  const {data,error}=await supabase.from("suppliers").select("id,legal_name,fantasy_name,rut,address,region,city,commune,contact_name,phone,commercial_email,purchase_order_email,billing_email,dispatch_email,website,payment_terms,lead_time_days,minimum_order_net,conditions,notes,active,created_at,updated_at").order("legal_name");
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({suppliers:data||[]});
}
