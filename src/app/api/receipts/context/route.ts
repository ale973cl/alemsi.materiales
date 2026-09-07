import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export async function GET(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"No autorizado"},{status:401});

  const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
  if(!profile?.active)return NextResponse.json({error:"Usuario inactivo"},{status:403});

  const [{data:orders,error:ordersError},{data:receipts,error:receiptsError}]=await Promise.all([
    supabase.from("purchase_orders")
      .select("id,order_number,status,total_net,order_type,issued_at,created_at,supplier_id,suppliers(legal_name),purchase_order_lines(id,material_id,description,unit,supplier_code,ordered_qty,unit_net_price,line_net,materials(name,presentation,unit,supplier_code))")
      .order("created_at",{ascending:false}),
    supabase.from("receipts")
      .select("id,purchase_order_id,status,received_at,shipping_condition,freight_net,receipt_lines(purchase_order_line_id,material_id,received_qty,actual_unit_net,line_net)")
      .order("received_at",{ascending:false})
  ]);

  if(ordersError)return NextResponse.json({error:ordersError.message},{status:500});
  if(receiptsError)return NextResponse.json({error:receiptsError.message},{status:500});

  const receivedByLine:Record<string,number>={};
  for(const receipt of receipts||[]){
    for(const line of (receipt as any).receipt_lines||[]){
      if(!line.purchase_order_line_id)continue;
      receivedByLine[line.purchase_order_line_id]=(receivedByLine[line.purchase_order_line_id]||0)+Number(line.received_qty||0);
    }
  }

  const enriched=(orders||[]).map((order:any)=>({
    ...order,
    purchase_order_lines:(order.purchase_order_lines||[]).map((line:any)=>({
      ...line,
      already_received:Number(receivedByLine[line.id]||0),
      pending_qty:Math.max(Number(line.ordered_qty||0)-Number(receivedByLine[line.id]||0),0),
    }))
  }));

  return NextResponse.json({orders:enriched,receipts:receipts||[],role:profile.role});
}
