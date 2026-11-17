import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export async function GET(request:NextRequest){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sesión no válida"},{status:401});
 const {data:profile}=await supabase.from("user_profiles").select("active").eq("id",user.id).single();
 if(!profile?.active)return NextResponse.json({error:"Perfil no habilitado"},{status:403});
 const materialId=request.nextUrl.searchParams.get("material_id")||"";
 if(!materialId)return NextResponse.json({error:"Material requerido"},{status:400});
 const {data,error}=await supabase.from("inventory_movements")
  .select("id,material_id,movement_type,quantity,signed_quantity,observation,created_at,receipt_line_id,dispatch_line_id")
  .eq("material_id",materialId).order("created_at",{ascending:false}).limit(500);
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({movements:data||[]},{headers:{"Cache-Control":"private, max-age=10, stale-while-revalidate=30"}});
}
