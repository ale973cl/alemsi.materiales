import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

const csv=(value:unknown)=>{const text=String(value??"");return /[;"\n\r]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;};
export async function GET(req:NextRequest){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"No autorizado"},{status:401});
 const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();if(!profile?.active||!["Admin Total","Gerencia","Admin"].includes(profile.role))return NextResponse.json({error:"No autorizado"},{status:403});
 const kind=req.nextUrl.searchParams.get("kind")==="installation"?"installation":"contract",contractId=req.nextUrl.searchParams.get("contract_id")||"",installationId=kind==="installation"?(req.nextUrl.searchParams.get("installation_id")||""):null;
 const {data:contract}=await supabase.from("contracts").select("id,name,code,client_id,active,clients(id,legal_name,rut)").eq("id",contractId).eq("active",true).single();if(!contract)return NextResponse.json({error:"Contrato no válido"},{status:404});
 let installation:any=null;if(kind==="installation"){const r=await supabase.from("installations").select("id,name,contract_id,active").eq("id",installationId).eq("contract_id",contractId).eq("active",true).single();if(r.error||!r.data)return NextResponse.json({error:"Instalación no válida"},{status:404});installation=r.data;}
 const [{data:materials,error:me},{data:catalog,error:ce},{data:assignments,error:ae}]=await Promise.all([
  supabase.from("materials").select("id,family,name,presentation,unit,supplier_code,active").eq("active",true).order("family").order("name"),
  supabase.from("client_materials").select("material_id,authorized").eq("client_id",contract.client_id),
  installation?supabase.from("contract_materials").select("material_id,installation_id,authorized,authorized_qty").eq("contract_id",contractId).or(`installation_id.is.null,installation_id.eq.${installation.id}`):supabase.from("contract_materials").select("material_id,installation_id,authorized,authorized_qty").eq("contract_id",contractId).is("installation_id",null)
 ]);if(me||ce||ae)return NextResponse.json({error:me?.message||ce?.message||ae?.message||"No fue posible generar la plantilla"},{status:500});
 const configured=(catalog||[]).length>0,allowed=new Set((catalog||[]).filter((x:any)=>x.authorized).map((x:any)=>x.material_id)),list=configured?(materials||[]).filter((m:any)=>allowed.has(m.id)):(materials||[]);
 const general=new Map((assignments||[]).filter((x:any)=>!x.installation_id).map((x:any)=>[x.material_id,x])),specific=new Map((assignments||[]).filter((x:any)=>installation&&x.installation_id===installation.id).map((x:any)=>[x.material_id,x]));
 const client:any=contract.clients;const headers=["Seleccionar","Máximo autorizado","Periodicidad","material_id","Familia","Código","Material","Presentación","Unidad","Cliente","RUT cliente","Contrato","Código contrato","Instalación"];
 const rows=list.map((m:any)=>{const current:any=installation?(specific.get(m.id)||general.get(m.id)):general.get(m.id);return[current?.authorized?"X":"",current?.authorized?Number(current.authorized_qty||0):"","",m.id,m.family,m.supplier_code,m.name,m.presentation,m.unit,client?.legal_name||"",client?.rut||"",contract.name,contract.code||"",installation?.name||""].map(csv).join(";");});
 const body="\uFEFF"+[headers.join(";"),...rows].join("\r\n");const safe=(installation?.name||contract.name||"materiales").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"-");
 return new NextResponse(body,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="materiales-autorizados-${safe}.csv"`,"Cache-Control":"no-store"}});
}
