import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export async function GET(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"No autenticado"},{status:401});
 const {data,error}=await supabase.from("delivery_routes").select("id,route_name,planned_date,status,preparation_assignee_id,delivery_assignee_id,created_at,preparation_assignee:user_profiles!delivery_routes_preparation_assignee_id_fkey(id,full_name,email),delivery_assignee:user_profiles!delivery_routes_delivery_assignee_id_fkey(id,full_name,email),creator:user_profiles!delivery_routes_created_by_fkey(id,full_name,email),prepared_by_profile:user_profiles!delivery_routes_prepared_by_fkey(id,full_name,email),started_by_profile:user_profiles!delivery_routes_started_by_fkey(id,full_name,email),delivery_route_dispatches(id,dispatch_id,delivery_order,load_order,dispatches(id,status,internal_number,guide_number,observations,installations(id,name,address,region,city,commune),dispatch_lines(id,material_id,required_qty,delivered_qty,pending_qty,materials(id,name,family,presentation,unit,supplier_code))))").order("planned_date",{ascending:true}).order("created_at",{ascending:true});
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({routes:data||[]});
}