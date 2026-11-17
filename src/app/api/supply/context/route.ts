import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {committedPurchaseQty} from "@/lib/purchase-order-balance";

export async function GET(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"No autorizado"},{status:401});
  const [{data:suppliers,error:supplierError},{data:orders,error:ordersError},{data:materials,error:materialError}]=await Promise.all([
    supabase.from("suppliers").select("id,legal_name,rut,address,purchase_order_email,payment_terms,conditions").eq("active",true).order("legal_name"),
    supabase.from("purchase_orders").select("id,order_number,status,total_net,total_amount,order_type,supply_run_id,supplier_id,payment_terms,delivery_terms,conditions,observations,created_at,supply_runs(campaign_id),purchase_order_lines(id,material_id,line_type,description,unit,supplier_code,ordered_qty,unit_net_price,line_net)").order("created_at",{ascending:false}),
    supabase.from("materials").select("id,name,family,presentation,unit,supplier_code,current_net_price").eq("active",true).order("name")
  ]);
  if(supplierError)return NextResponse.json({error:supplierError.message},{status:500});
  if(ordersError)return NextResponse.json({error:ordersError.message},{status:500});
  if(materialError)return NextResponse.json({error:materialError.message},{status:500});
  const ids=(orders||[]).map((o:any)=>o.id);
  let posted=new Map<string,number>();
  if(ids.length){
    const {data:receipts,error:receiptError}=await supabase.from("receipts").select("purchase_order_id,receipt_lines(purchase_order_line_id,received_qty)").in("purchase_order_id",ids).eq("inventory_posted",true);
    if(receiptError)return NextResponse.json({error:receiptError.message},{status:500});
    for(const receipt of receipts||[])for(const line of (receipt as any).receipt_lines||[]){
      const id=String(line.purchase_order_line_id||"");
      posted.set(id,(posted.get(id)||0)+Number(line.received_qty||0));
    }
  }
  const enriched=(orders||[]).map((o:any)=>({...o,purchase_order_lines:(o.purchase_order_lines||[]).map((l:any)=>({...l,committed_qty:committedPurchaseQty(o.status,l.ordered_qty,posted.get(String(l.id)))}))}));
  return NextResponse.json({suppliers:suppliers||[],orders:enriched,materials:materials||[]});
}
