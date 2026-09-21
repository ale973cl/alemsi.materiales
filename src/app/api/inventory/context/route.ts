import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export async function GET(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sesión no válida"},{status:401});
 const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
 if(!profile?.active)return NextResponse.json({error:"Perfil no habilitado"},{status:403});
 const [{data:materials,error:materialError},{data:movements,error:movementError},{data:dispatches,error:dispatchError}]=await Promise.all([
  supabase.from("materials").select("id,name,family,presentation,unit,supplier_code,active,current_net_price").eq("active",true).order("name"),
  supabase.from("inventory_movements").select("id,material_id,movement_type,quantity,signed_quantity,observation,created_at,receipt_line_id,dispatch_line_id").order("created_at",{ascending:false}),
  supabase.from("dispatches").select("id,guide_number,status,dispatch_lines(id,material_id,required_qty,delivered_qty,pending_qty)").in("status",["En preparación","Preparado","Listo para ruta"])
 ]);
 const error=materialError||movementError||dispatchError;if(error)return NextResponse.json({error:error.message},{status:500});
 const reserved:Record<string,number>={};
 for(const dispatch of dispatches||[])for(const line of dispatch.dispatch_lines||[]){if(!line.material_id)continue;const pending=Math.max(0,Number(line.pending_qty??(Number(line.required_qty||0)-Number(line.delivered_qty||0))));reserved[line.material_id]=(reserved[line.material_id]||0)+pending}
 return NextResponse.json({materials:materials||[],movements:movements||[],reserved});
}
