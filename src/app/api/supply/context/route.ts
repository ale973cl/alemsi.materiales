import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export async function GET(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"No autorizado"},{status:401});
  const [{data:suppliers,error:supplierError},{data:orders,error:ordersError}]=await Promise.all([
    supabase.from("suppliers").select("id,legal_name").eq("active",true).order("legal_name"),
    supabase.from("purchase_orders").select("id,order_number,status,total_net,supply_run_id,supply_runs(campaign_id),purchase_order_lines(material_id,ordered_qty,unit_net_price,line_net)").order("created_at",{ascending:false})
  ]);
  if(supplierError)return NextResponse.json({error:supplierError.message},{status:500});
  if(ordersError)return NextResponse.json({error:ordersError.message},{status:500});
  return NextResponse.json({suppliers:suppliers||[],orders:orders||[]});
}
