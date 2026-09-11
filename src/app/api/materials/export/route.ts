import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

const csv=(value:unknown)=>{
  const text=String(value??"");
  return /[;"\n\r]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
};
const supplierName=(row:any)=>row?.suppliers?.fantasy_name||row?.suppliers?.legal_name||"";

export async function GET(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"No autorizado"},{status:401});
  const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).maybeSingle();
  if(!profile?.active)return NextResponse.json({error:"Perfil inactivo"},{status:403});

  const [{data:materials,error:materialsError},{data:links,error:linksError}]=await Promise.all([
    supabase.from("materials").select("id,family,name,presentation,unit,current_net_price,active").eq("active",true).order("family").order("name"),
    supabase.from("supplier_materials").select("material_id,priority,supplier_code,active,suppliers(id,legal_name,fantasy_name,rut)").eq("active",true).order("priority")
  ]);
  if(materialsError||linksError)return NextResponse.json({error:materialsError?.message||linksError?.message||"No fue posible generar el archivo"},{status:500});

  const byMaterial=new Map<string,any[]>();
  for(const link of links||[]){const list=byMaterial.get(link.material_id)||[];list.push(link);byMaterial.set(link.material_id,list);}
  const headers=[
    "material_id","familia","producto","presentacion","unidad",
    "proveedor_primario_rut","proveedor_primario","codigo_proveedor_primario",
    "proveedor_secundario_rut","proveedor_secundario","codigo_proveedor_secundario",
    "proveedor_tercero_rut","proveedor_tercero","codigo_proveedor_tercero","valor_neto"
  ];
  const rows=(materials||[]).map((m:any)=>{
    const links=byMaterial.get(m.id)||[];
    const slot=(priority:number)=>links.find((x:any)=>Number(x.priority)===priority);
    const p1=slot(1),p2=slot(2),p3=slot(3);
    return [
      m.id,m.family,m.name,m.presentation,m.unit,
      p1?.suppliers?.rut,supplierName(p1),p1?.supplier_code,
      p2?.suppliers?.rut,supplierName(p2),p2?.supplier_code,
      p3?.suppliers?.rut,supplierName(p3),p3?.supplier_code,
      m.current_net_price
    ].map(csv).join(";");
  });
  const body="\uFEFF"+[headers.join(";"),...rows].join("\r\n");
  return new NextResponse(body,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="maestro-materiales-alemsi.csv"`}});
}
