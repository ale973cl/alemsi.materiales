import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function GET(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"No autorizado"},{status:401});
 const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();if(!profile?.active)return NextResponse.json({error:"Usuario inactivo"},{status:403});
 const [rr,ss,mm,cc,oo,sr]=await Promise.all([
  supabase.from("receipts").select("id,purchase_order_id,supplier_id,document_type,document_folio,document_date,document_net,vat_amount,document_total,no_oc_reason,reconciliation_status,inventory_posted,received_at,reconciled_at,suppliers(id,legal_name,rut,payment_terms),purchase_orders(id,order_number,total_net,status,payment_terms,supply_run_id),receipt_lines(id,purchase_order_line_id,material_id,received_qty,actual_unit_net,line_net,materials(name,family,presentation,unit,supplier_code))").order("received_at",{ascending:false}),
  supabase.from("suppliers").select("id,legal_name,rut,payment_terms,conditions").eq("active",true).order("legal_name"),
  supabase.from("materials").select("id,name,family,presentation,unit,supplier_code,current_net_price").eq("active",true).order("name"),
  supabase.from("clients").select("id,legal_name,rut,active,contracts(id,name,code,net_budget,active,installations(id,name,region,city,commune,surface_m2,collaborator_count,active),contract_budget_allocations(id,installation_id,allocated_net))").eq("active",true).order("legal_name"),
  supabase.from("purchase_orders").select("id,supply_run_id,supplier_id,order_number,status,total_net,issued_at,created_at,payment_terms,suppliers(id,legal_name,rut,payment_terms)").order("created_at",{ascending:false}),
  supabase.from("supply_runs").select("id,contract_id,campaign_id,status,contract_limit_net,consolidated_net,approved_net,created_at").order("created_at",{ascending:false})
 ]);
 for(const x of [rr,ss,mm,cc,oo,sr])if(x.error)return NextResponse.json({error:x.error.message},{status:500});
 return NextResponse.json({receipts:rr.data||[],suppliers:ss.data||[],materials:mm.data||[],clients:cc.data||[],orders:oo.data||[],supplyRuns:sr.data||[],role:profile.role});
}
