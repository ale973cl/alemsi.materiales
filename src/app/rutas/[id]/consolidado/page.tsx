import {notFound,redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import PrintButton from "./PrintButton";

const asOne=(v:any)=>Array.isArray(v)?v[0]:v;
const num=(v:any)=>Number(v||0);

export default async function RouteConsolidatedPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:route,error}=await supabase.from("delivery_routes").select("id,route_name,planned_date,status,created_at,preparation_assignee:user_profiles!delivery_routes_preparation_assignee_id_fkey(full_name,email),delivery_assignee:user_profiles!delivery_routes_delivery_assignee_id_fkey(full_name,email),delivery_route_dispatches(id,delivery_order,load_order,dispatch_id,dispatches(id,internal_number,guide_number,status,installations(id,name,address,region,city,commune,contracts(name,clients(legal_name))),dispatch_lines(id,material_id,required_qty,materials(id,name,family,presentation,unit,supplier_code))))").eq("id",id).single();
 if(error||!route)notFound();
 const links=[...((route as any).delivery_route_dispatches||[])].sort((a:any,b:any)=>num(a.delivery_order)-num(b.delivery_order));
 const dispatches=links.map((x:any)=>asOne(x.dispatches)).filter(Boolean);
 const prep=asOne((route as any).preparation_assignee),delivery=asOne((route as any).delivery_assignee);
 const materialMap=new Map<string,{id:string;name:string;unit:string;presentation:string}>();
 for(const d of dispatches)for(const l of d.dispatch_lines||[]){const m=asOne(l.materials);materialMap.set(String(l.material_id),{id:String(l.material_id),name:m?.name||"Material",unit:m?.unit||"",presentation:m?.presentation||""})}
 const materials=[...materialMap.values()].sort((a,b)=>a.name.localeCompare(b.name,"es"));
 const totalFor=(materialId:string,d:any)=>((d.dispatch_lines||[]) as any[]).filter(l=>String(l.material_id)===materialId).reduce((s,l)=>s+num(l.required_qty),0);
 const loadOrder=[...links].sort((a:any,b:any)=>num(a.load_order)-num(b.load_order)).map((x:any)=>asOne(x.dispatches)).filter(Boolean);
 return <main style={{fontFamily:"Arial,sans-serif",color:"#173650",padding:24,maxWidth:1500,margin:"0 auto"}}>
  <style>{`@media print{.noPrint{display:none!important}body{margin:0}@page{size:A4 landscape;margin:8mm}.sheet{break-after:page}.sheet:last-child{break-after:auto}} table{border-collapse:collapse;width:100%}th,td{border:1px solid #9fb9c7;padding:6px;text-align:center;font-size:11px}th{background:#e9f4f3}th:first-child,td:first-child{text-align:left;min-width:180px}.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin:12px 0 16px}.meta div{border:1px solid #d5e3ea;border-radius:8px;padding:8px}`}</style>
  <div className="noPrint" style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",marginBottom:16}}><a href="/">← Volver a ALEMSI Materiales</a><PrintButton/></div>
  <section className="sheet"><h1 style={{marginBottom:4}}>ALEMSI · Consolidado de preparación de despacho</h1><h2 style={{marginTop:0}}>{(route as any).route_name}</h2><div className="meta"><div><small>Fecha prevista</small><br/><b>{(route as any).planned_date}</b></div><div><small>Estado</small><br/><b>{(route as any).status}</b></div><div><small>Responsable preparación</small><br/><b>{prep?.full_name||prep?.email||"—"}</b></div><div><small>Responsable entrega</small><br/><b>{delivery?.full_name||delivery?.email||"—"}</b></div></div><p><b>Orden de entrega:</b> {dispatches.map((d:any,i:number)=>`${i+1}. ${asOne(d.installations)?.name||"Instalación"}`).join(" → ")}</p><p><b>Orden de carga:</b> {loadOrder.map((d:any,i:number)=>`${i+1}. ${asOne(d.installations)?.name||"Instalación"}`).join(" → ")}</p>
  {dispatches.length&&materials.length?<table><thead><tr><th>Material</th>{dispatches.map((d:any)=><th key={d.id}>{asOne(d.installations)?.name||"Instalación"}</th>)}<th>Total ruta</th></tr></thead><tbody>{materials.map(m=><tr key={m.id}><td><b>{m.name}</b><br/><small>{[m.presentation,m.unit].filter(Boolean).join(" · ")}</small></td>{dispatches.map((d:any)=><td key={d.id}>{totalFor(m.id,d)||"—"}</td>)}<td><b>{dispatches.reduce((s:number,d:any)=>s+totalFor(m.id,d),0)}</b></td></tr>)}</tbody></table>:<p>La ruta no tiene materiales asociados.</p>}
  </section>
 </main>;
}
