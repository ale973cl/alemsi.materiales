"use client";
import {useEffect,useMemo,useState} from "react";
import {registerInventoryCount} from "@/app/inventory-actions";

const norm=(v:any)=>String(v||"").toLocaleLowerCase("es-CL");
const qty=(n:number)=>new Intl.NumberFormat("es-CL",{maximumFractionDigits:2}).format(n||0);
const dt=(v:string)=>v?new Intl.DateTimeFormat("es-CL",{dateStyle:"short",timeStyle:"short",timeZone:"America/Santiago"}).format(new Date(v)):"—";

export default function InventoryModule({role}:{role:string}){
 const [materials,setMaterials]=useState<any[]>([]);
 const [movements,setMovements]=useState<any[]>([]);
 const [reserved,setReserved]=useState<Record<string,number>>({});
 const [search,setSearch]=useState("");
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [countMode,setCountMode]=useState(false);
 const [physical,setPhysical]=useState(0);
 const [reason,setReason]=useState("");
 const [message,setMessage]=useState("");
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const canAdjust=["Admin Total","Gerencia","Admin","Operaciones","Bodega"].includes(role);

 const load=async()=>{
  setLoading(true);
  try{
   const r=await fetch("/api/inventory/context",{cache:"no-store"}),b=await r.json();
   if(!r.ok)throw new Error(b.error||"No se pudo cargar inventario");
   setMaterials(b.materials||[]);setMovements(b.movements||[]);setReserved(b.reserved||{});
  }catch(e:any){setMessage(e.message||"No se pudo cargar inventario")}
  finally{setLoading(false)}
 };
 useEffect(()=>{void load()},[]);

 const allRows=useMemo(()=>materials.map(m=>{
  const mm=movements.filter(x=>x.material_id===m.id);
  const stock=mm.reduce((a,x)=>a+Number(x.signed_quantity||0),0);
  const res=Math.max(0,Number(reserved[m.id]||0));
  return {...m,mm,stock,reserved:res,available:stock-res,
   entries:mm.filter(x=>Number(x.signed_quantity)>0).reduce((a,x)=>a+Number(x.signed_quantity),0),
   outputs:Math.abs(mm.filter(x=>Number(x.signed_quantity)<0).reduce((a,x)=>a+Number(x.signed_quantity),0)),
   last:mm[0]?.created_at};
 }),[materials,movements,reserved]);

 const rows=useMemo(()=>allRows.filter(m=>!search||norm(String(m.name||"")+" "+String(m.family||"")+" "+String(m.presentation||"")+" "+String(m.supplier_code||"")).includes(norm(search))),[allRows,search]);
 const selected=allRows.find(m=>m.id===selectedId)||null;

 const adjust=async()=>{
  if(!selected)return;
  if(!reason.trim()){setMessage("Indica el motivo del conteo o ajuste.");return}
  const form=new FormData();
  form.set("material_id",selected.id);form.set("physical_qty",String(physical));form.set("reason",reason);
  setSaving(true);setMessage("");
  try{
   const r=await registerInventoryCount(form);
   const difference=Number(r.difference);
   setMessage(difference===0?"Conteo confirmado: no existen diferencias.":"Ajuste registrado: "+(difference>0?"+":"")+qty(difference)+".");
   setCountMode(false);setReason("");await load();
  }catch(e:any){setMessage(e.message||"No se pudo registrar el conteo")}
  finally{setSaving(false)}
 };

 if(selected){
  return <section className="panel inventory inventoryDetailPage">
   <div className="inventoryDetailHead">
    <div>
     <button type="button" className="simpleBack" onClick={()=>{setSelectedId(null);setCountMode(false);setMessage("")}}>← Inventario</button>
     <h2>{selected.name}</h2>
     <p>{selected.supplier_code||"Sin código"} · {selected.presentation||selected.unit||"Sin presentación"}</p>
    </div>
    <span className={selected.available<0?"catalogCount negative":"catalogCount"}>Disponible {qty(selected.available)}</span>
   </div>
   {message&&<p className="note"><b>{message}</b></p>}
   <div className="inventorySummary">
    <span><small>Entradas</small><b>{qty(selected.entries)}</b></span>
    <span><small>Salidas</small><b>{qty(selected.outputs)}</b></span>
    <span><small>Stock físico</small><b>{qty(selected.stock)}</b></span>
    <span><small>Reservado</small><b>{qty(selected.reserved)}</b></span>
    <span><small>Disponible</small><b>{qty(selected.available)}</b></span>
   </div>
   {!countMode&&<div className="inventoryDetailActions"><span>Último movimiento: <b>{dt(selected.last)}</b></span>{canAdjust&&<button type="button" onClick={()=>{setCountMode(true);setPhysical(Math.max(0,selected.stock));setReason("");setMessage("")}}>Conteo físico / ajuste →</button>}</div>}
   {countMode?<div className="inventoryCountPage">
    <div><h3>Conteo físico</h3><p>Registra el conteo real. El ajuste quedará trazado como movimiento.</p></div>
    <div className="inventoryCountGrid">
     <label>Stock sistema<input value={qty(selected.stock)} disabled/></label>
     <label>Conteo físico<input type="number" min="0" step="any" value={physical} onChange={e=>setPhysical(Number(e.target.value))}/></label>
     <label>Diferencia<input value={qty(physical-selected.stock)} disabled/></label>
     <label className="wide">Motivo / observación<input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ej.: conteo general de bodega"/></label>
    </div>
    <div className="inventoryCountActions"><button type="button" className="secondary" disabled={saving} onClick={()=>{setCountMode(false);setReason("")}}>Cancelar</button><button type="button" disabled={saving} onClick={()=>void adjust()}>{saving?"Guardando…":"Registrar conteo"}</button></div>
   </div>:<div className="kardex"><div className="krow kh"><span>Fecha</span><span>Movimiento</span><span>Cantidad</span><span>Saldo movimiento</span><span>Observación</span></div>{selected.mm.length?selected.mm.map((x:any)=><div className="krow" key={x.id}><span>{dt(x.created_at)}</span><span>{x.movement_type==="receipt"?"Recepción":x.movement_type==="dispatch"?"Despacho":"Ajuste"}</span><span>{qty(Number(x.quantity||0))}</span><span className={Number(x.signed_quantity)<0?"negative":""}>{Number(x.signed_quantity)>0?"+":""}{qty(Number(x.signed_quantity||0))}</span><span>{x.observation||"—"}</span></div>):<div className="empty"><b>Sin movimientos</b></div>}</div>}
  </section>;
 }

 return <section className="panel inventory">
  <div className="inventoryHead"><div><h2>Inventario de bodega</h2><p>Selecciona un material para abrir su Kardex en una pantalla independiente.</p></div><span className="catalogCount">{rows.filter(x=>x.stock>0).length} materiales con stock</span></div>
  <div className="inventorySummary"><span><small>Entradas acumuladas</small><b>{qty(rows.reduce((a,x)=>a+x.entries,0))}</b></span><span><small>Salidas acumuladas</small><b>{qty(rows.reduce((a,x)=>a+x.outputs,0))}</b></span><span><small>Stock físico</small><b>{qty(rows.reduce((a,x)=>a+x.stock,0))}</b></span><span><small>Reservado</small><b>{qty(rows.reduce((a,x)=>a+x.reserved,0))}</b></span><span><small>Disponible</small><b>{qty(rows.reduce((a,x)=>a+x.available,0))}</b></span></div>
  <input className="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar material, código, familia o presentación"/>
  {message&&<p className="note"><b>{message}</b></p>}
  {loading?<div className="empty"><b>Cargando inventario…</b></div>:<div className="stockList">{rows.map(m=><article key={m.id} className="stock"><button type="button" className="stockHead" onClick={()=>{setSelectedId(m.id);setCountMode(false);setMessage("")}}><span><b>{m.name}</b><small>{m.supplier_code||"Sin código"} · {m.presentation||m.unit||"Sin presentación"}</small></span><span><small>Entradas</small><b>{qty(m.entries)}</b></span><span><small>Salidas</small><b>{qty(m.outputs)}</b></span><span><small>Stock</small><b>{qty(m.stock)}</b></span><span><small>Reservado</small><b>{qty(m.reserved)}</b></span><span className={m.available<0?"negative":""}><small>Disponible</small><b>{qty(m.available)}</b></span><strong>Kardex →</strong></button></article>)}</div>}
 </section>;
}
