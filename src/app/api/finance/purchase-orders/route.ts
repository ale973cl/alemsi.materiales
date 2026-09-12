import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export async function GET(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"No autorizado"},{status:401});
 const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
 if(!profile?.active||!["Admin Total","Gerencia","Finanzas","Admin"].includes(profile.role))return NextResponse.json({error:"Sin permisos"},{status:403});
 const {data,error}=await supabase.from("purchase_orders").select("id,order_number,total_net,status,supplier_id,suppliers(legal_name,rut),purchase_order_lines(id,material_id,ordered_qty,unit_net_price,line_net,description,unit,supplier_code,materials(name,family,presentation,unit,supplier_code))").order("created_at",{ascending:false}).limit(100);
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({orders:data||[]});
}
