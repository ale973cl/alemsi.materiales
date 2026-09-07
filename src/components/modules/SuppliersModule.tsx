"use client";
import {useEffect,useMemo,useState} from "react";
import {saveSupplier} from "@/app/supplier-actions";

type Supplier={
 id:string;legal_name:string;fantasy_name?:string|null;rut?:string|null;address?:string|null;region?:string|null;city?:string|null;commune?:string|null;contact_name?:string|null;phone?:string|null;commercial_email?:string|null;purchase_order_email?:string|null;billing_email?:string|null;dispatch_email?:string|null;website?:string|null;payment_terms?:string|null;lead_time_days?:number|null;minimum_order_net?:number|null;conditions?:string|null;notes?:string|null;active:boolean
};
const emptySupplier:Partial<Supplier>={active:true};
const money=(n:number)=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n||0);

export default function SuppliersModule(){
 const [suppliers,setSuppliers]=useState<Supplier[]>([]),[search,setSearch]=useState(""),[editing,setEditing]=useState<Partial<Supplier>|null>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState("");
 const load=async()=>{setLoading(true);try{const response=await fetch("/api/suppliers",{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"No se pudo cargar proveedores");setSuppliers(data.suppliers||[])}catch(error:any){setMessage(error?.message||"No se pudo cargar proveedores")}finally{setLoading(false)}};
 useEffect(()=>{void load()},[]);
 const rows=useMemo(()=>suppliers.filter(s=>!search||[s.legal_name,s.fantasy_name,s.rut,s.city,s.region,s.contact_name,s.purchase_order_email].some(v=>String(v||"").toLocaleLowerCase("es-CL").includes(search.toLocaleLowerCase("es-CL")))),[suppliers,search]);
 const patch=(key:keyof Supplier,value:any)=>setEditing(current=>({...current,[key]:value}));
 const submit=async(formData:FormData)=>{setSaving(true);setMessage("");try{const result=await saveSupplier(formData);setMessage(`Proveedor ${result.supplier.legal_name} guardado.`);setEditing(null);await load()}catch(error:any){setMessage(error?.message||"No se pudo guardar el proveedor")}finally{setSaving(false)}};
 return <section className="panel clientCore suppliersModule">
  <style dangerouslySetInnerHTML={{__html:`
   .suppliersModule{overflow:hidden}
   .supplierEditor{margin:0 0 18px;padding:18px;border:1px solid #b9ddd9;border-radius:14px;background:#f7fbfb}
   .supplierEditor h3{margin:0 0 16px;color:#0b2f4a;font-size:18px}
   .supplierSection{margin-top:16px;padding-top:14px;border-top:1px solid #dbe7ec}
   .supplierSection:first-of-type{margin-top:0;padding-top:0;border-top:0}
   .supplierSectionTitle{display:block;margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#557084}
   .supplierGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 14px;align-items:start}
   .supplierGrid.two{grid-template-columns:repeat(2,minmax(0,1fr))}
   .supplierGrid label,.supplierField{display:flex;flex-direction:column;gap:6px;min-width:0;font-size:13px;font-weight:600;color:#173650}
   .supplierGrid input,.supplierGrid textarea,.supplierField input,.supplierField textarea{box-sizing:border-box;width:100%;min-width:0;border:1px solid #c7d7e2;border-radius:9px;background:#fff;padding:10px 11px;font:inherit;color:#173650}
   .supplierGrid input{height:42px}
   .supplierGrid textarea,.supplierField textarea{min-height:88px;resize:vertical;line-height:1.35}
   .supplierFull{grid-column:1/-1}
   .supplierActive{display:flex;align-items:center;gap:8px;margin-top:14px;font-size:13px;font-weight:700;color:#173650}
   .supplierActive input{width:16px;height:16px}
   .supplierActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
   .supplierListMeta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:12px}
   .supplierListMeta p{margin:0;padding:10px 12px;border-radius:10px;background:#f7fafc}
   @media(max-width:1100px){.supplierGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
   @media(max-width:760px){.supplierGrid,.supplierGrid.two,.supplierListMeta{grid-template-columns:1fr}.supplierEditor{padding:14px}.supplierFull{grid-column:auto}}
  `}}/>
  <div className="catalogIntro"><div><p className="eyebrow">MAESTRO</p><h2>Proveedores</h2><p>Datos comerciales, correos de OC y facturación, condiciones de pago y parámetros de compra.</p></div><span className="catalogCount">{suppliers.filter(s=>s.active).length} activos</span></div>
  <div className="coreToolbar"><label>Buscar proveedor<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nombre, RUT, ciudad o correo"/></label>{search&&<button type="button" className="clearFilters" onClick={()=>setSearch("")}>Limpiar</button>}<button type="button" onClick={()=>setEditing({...emptySupplier})}>+ Nuevo proveedor</button></div>
  {message&&<p className="note">{message}</p>}
  {editing&&<form action={submit} className="supplierEditor">
   <input type="hidden" name="id" value={editing.id||""}/><input type="hidden" name="active" value={editing.active===false?"false":"true"}/>
   <h3>{editing.id?"Editar proveedor":"Nuevo proveedor"}</h3>

   <div className="supplierSection"><span className="supplierSectionTitle">Identificación</span><div className="supplierGrid">
    <label>Razón social / nombre<input name="legal_name" required value={editing.legal_name||""} onChange={e=>patch("legal_name",e.target.value)}/></label>
    <label>Nombre fantasía<input name="fantasy_name" value={editing.fantasy_name||""} onChange={e=>patch("fantasy_name",e.target.value)}/></label>
    <label>RUT<input name="rut" value={editing.rut||""} onChange={e=>patch("rut",e.target.value)}/></label>
   </div></div>

   <div className="supplierSection"><span className="supplierSectionTitle">Contacto y correos</span><div className="supplierGrid">
    <label>Contacto<input name="contact_name" value={editing.contact_name||""} onChange={e=>patch("contact_name",e.target.value)}/></label>
    <label>Teléfono<input name="phone" value={editing.phone||""} onChange={e=>patch("phone",e.target.value)}/></label>
    <label>Sitio web<input name="website" value={editing.website||""} onChange={e=>patch("website",e.target.value)}/></label>
    <label>Correo comercial<input type="email" name="commercial_email" value={editing.commercial_email||""} onChange={e=>patch("commercial_email",e.target.value)}/></label>
    <label>Correo OC<input type="email" name="purchase_order_email" value={editing.purchase_order_email||""} onChange={e=>patch("purchase_order_email",e.target.value)}/></label>
    <label>Correo facturación<input type="email" name="billing_email" value={editing.billing_email||""} onChange={e=>patch("billing_email",e.target.value)}/></label>
   </div></div>

   <div className="supplierSection"><span className="supplierSectionTitle">Ubicación</span><div className="supplierGrid">
    <label className="supplierFull">Dirección<input name="address" value={editing.address||""} onChange={e=>patch("address",e.target.value)}/></label>
    <label>Región<input name="region" value={editing.region||""} onChange={e=>patch("region",e.target.value)}/></label>
    <label>Ciudad<input name="city" value={editing.city||""} onChange={e=>patch("city",e.target.value)}/></label>
    <label>Comuna<input name="commune" value={editing.commune||""} onChange={e=>patch("commune",e.target.value)}/></label>
   </div></div>

   <div className="supplierSection"><span className="supplierSectionTitle">Condiciones de compra</span><div className="supplierGrid">
    <label>Condición de pago<input name="payment_terms" value={editing.payment_terms||""} onChange={e=>patch("payment_terms",e.target.value)} placeholder="30 días, contado..."/></label>
    <label>Plazo entrega (días)<input type="number" min="0" name="lead_time_days" value={editing.lead_time_days??""} onChange={e=>patch("lead_time_days",e.target.value===""?null:Number(e.target.value))}/></label>
    <label>Mínimo OC neto<input type="number" min="0" name="minimum_order_net" value={editing.minimum_order_net??""} onChange={e=>patch("minimum_order_net",e.target.value===""?null:Number(e.target.value))}/></label>
   </div><div className="supplierGrid two" style={{marginTop:12}}>
    <label>Condiciones para OC<textarea name="conditions" value={editing.conditions||""} onChange={e=>patch("conditions",e.target.value)} rows={4}/></label>
    <label>Notas internas<textarea name="notes" value={editing.notes||""} onChange={e=>patch("notes",e.target.value)} rows={4}/></label>
   </div></div>

   <label className="supplierActive"><input type="checkbox" checked={editing.active!==false} onChange={e=>patch("active",e.target.checked)}/> Proveedor activo</label>
   <div className="supplierActions"><button disabled={saving}>{saving?"Guardando...":"Guardar proveedor"}</button><button type="button" className="clearFilters" onClick={()=>setEditing(null)}>Cancelar</button></div>
  </form>}
  {loading?<div className="empty"><b>Cargando proveedores...</b></div>:<div className="clientGroups">{rows.map(s=><article className="contractGroup" key={s.id} style={{marginBottom:10}}><div className="contractTitle"><span><b>{s.legal_name}</b><small>{[s.rut,s.city,s.region].filter(Boolean).join(" · ")||"Datos tributarios y ubicación pendientes"}</small><small>{s.purchase_order_email?`OC: ${s.purchase_order_email}`:"Correo de OC pendiente"}{s.payment_terms?` · ${s.payment_terms}`:""}</small></span><span className="contractActions"><em>{s.active?"Activo":"Inactivo"}</em><button type="button" onClick={()=>setEditing({...s})}>Editar</button></span></div>{(s.contact_name||s.phone||s.minimum_order_net!=null||s.lead_time_days!=null)&&<div className="supplierListMeta"><p><small>Contacto</small><br/><b>{s.contact_name||"—"}</b>{s.phone&&<> · {s.phone}</>}</p><p><small>Plazo entrega</small><br/><b>{s.lead_time_days==null?"—":`${s.lead_time_days} días`}</b></p><p><small>Mínimo OC</small><br/><b>{s.minimum_order_net==null?"—":money(Number(s.minimum_order_net))}</b></p></div>}</article>)}</div>}
  {!loading&&!rows.length&&<div className="empty"><b>Sin proveedores</b><span>Crea el primer proveedor o cambia el filtro de búsqueda.</span></div>}
  <p className="catalogNote">El correo de OC y las condiciones de pago de este maestro pueden reutilizarse al emitir órdenes de compra.</p>
 </section>;
}
