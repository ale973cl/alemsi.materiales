import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export async function GET(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sesión no válida"},{status:401});
 const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
 if(!profile?.active)return NextResponse.json({error:"Perfil no habilitado"},{status:403});

 const [{data:catalog,error:catalogError},{data:dispatches,error:dispatchError},{data:children,error:childrenError}]=await Promise.all([
  supabase.from("material_master_catalog").select("id,product,family,presentation,unit,supplier_code,availability,net_value").eq("active",true).order("product"),
  supabase.from("dispatches").select("id,status,dispatch_lines(id,material_id,required_qty,delivered_qty,pending_qty)").in("status",["En preparación","Preparado","Listo para ruta","En tránsito","Entrega parcial"]),
  supabase.from("dispatches").select("id,parent_dispatch_id,status").not("parent_dispatch_id","is",null)
 ]);
 const error=catalogError||dispatchError||childrenError;
 if(error)return NextResponse.json({error:error.message},{status:500});

 const superseded=new Set((children||[]).filter(child=>child.status!=="Anulado").map(child=>String(child.parent_dispatch_id)));
 const reserved:Record<string,number>={};
 for(const dispatch of dispatches||[]){
  if(superseded.has(String(dispatch.id)))continue;
  for(const line of dispatch.dispatch_lines||[]){
   if(!line.material_id)continue;
   const pending=Math.max(0,Number(line.pending_qty??(Number(line.required_qty||0)-Number(line.delivered_qty||0))));
   reserved[line.material_id]=(reserved[line.material_id]||0)+pending;
  }
 }
 const materials=(catalog||[]).map((row:any)=>({
  id:row.id,name:row.product,family:row.family,presentation:row.presentation,unit:row.unit,
  supplier_code:row.supplier_code,current_net_price:row.net_value,stock:Number(row.availability||0)
 }));
 return NextResponse.json({materials,reserved},{headers:{"Cache-Control":"private, max-age=15, stale-while-revalidate=45"}});
}
