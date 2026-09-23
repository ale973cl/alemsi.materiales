import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {CAPABILITIES,roleCan} from "@/lib/authorization";

export async function GET(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"No autorizado"},{status:401});
  const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
  if(!profile?.active)return NextResponse.json({error:"Usuario inactivo"},{status:403});
  const canManageSupply=roleCan(profile.role,CAPABILITIES.SUPPLY_MANAGE);
  const [{data:suppliers,error:supplierError},{data:orders,error:ordersError}]=await Promise.all([
    supabase.from("suppliers").select("id,legal_name,rut,address,purchase_order_email,payment_terms,conditions").eq("active",true).order("legal_name"),
    supabase.from("purchase_orders").select("id,order_number,status,total_net,total_amount,order_type,supply_run_id,supply_runs(campaign_id),purchase_order_lines(material_id,ordered_qty,unit_net_price,line_net)").order("created_at",{ascending:false})
  ]);
  if(supplierError)return NextResponse.json({error:supplierError.message},{status:500});
  if(ordersError)return NextResponse.json({error:ordersError.message},{status:500});
  const visibleOrders=canManageSupply
    ? orders||[]
    : (orders||[]).map((order:any)=>({
        id:order.id,
        status:order.status,
        supply_run_id:order.supply_run_id,
        supply_runs:order.supply_runs,
        purchase_order_lines:order.purchase_order_lines,
      }));
  return NextResponse.json({suppliers:canManageSupply?suppliers||[]:[],orders:visibleOrders,role:profile.role});
}
