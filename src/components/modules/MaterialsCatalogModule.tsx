"use client";

import { useMemo, useState } from "react";
import {createMaterial,importMaterialsCsv} from "@/app/actions";

export type MaterialCatalogRow = { id?:string; family?:string|null; supplier?:string|null; supplier_code?:string|null; product?:string|null; presentation?:string|null; unit?:string|null; net_value?:number|string|null; availability?:number|string|null; duplicate_count?:number };
const text=(value:unknown)=>String(value??"").trim();
const normalized=(value:unknown)=>text(value).toLocaleLowerCase("es-CL");
const money=(value:unknown)=>{const number=Number(value);return Number.isFinite(number)?new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(number):"—"};
const quantity=(value:unknown)=>{const number=Number(value);return Number.isFinite(number)?new Intl.NumberFormat("es-CL",{maximumFractionDigits:2}).format(number):"0"};

export default function MaterialsCatalogModule({rows,sourceCount,error}:{rows:MaterialCatalogRow[];sourceCount:number;error?:string|null}){
 const [search,setSearch]=useState(""),[family,setFamily]=useState(""),[supplier,setSupplier]=useState(""),[showCreate,setShowCreate]=useState(false),[showImport,setShowImport]=useState(false);
 const families=useMemo(()=>Array.from(new Set(rows.map(row=>text(row.family)).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"es")),[rows]);
 const suppliers=useMemo(()=>Array.from(new Set(rows.map(row=>text(row.supplier)).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"es")),[rows]);
 const filtered=useMemo(()=>{const term=normalized(search);return rows.filter(row=>{if(family&&text(row.family)!==family)return false;if(supplier&&text(row.supplier)!==supplier)return false;return !term||[row.family,row.supplier,row.supplier_code,row.product,row.presentation,row.unit].some(value=>normalized(value).includes(term))})},[rows,search,family,supplier]);
 return <section className="panel materialCatalog">
  <div className="catalogIntro"><div><h2>Catálogo único de materiales</h2><p>Una ficha por producto y presentación. La asignación por instalación se administra por separado.</p></div><span className="catalogCount">{filtered.length} de {rows.length} materiales</span></div>
  {sourceCount>rows.length&&<div className="dedupeNotice"><b>{sourceCount-rows.length} repeticiones consolidadas</b><span>Los registros repetidos de las planillas se agrupan en una sola ficha del maestro.</span></div>}
  <div className="masterActions"><button type="button" onClick={()=>setShowCreate(v=>!v)}>+ Nuevo producto</button><button type="button" onClick={()=>setShowImport(v=>!v)}>Carga masiva CSV</button><a href="/plantilla-maestro-materiales.csv" download>Descargar plantilla CSV</a></div>
  {showCreate&&<form action={createMaterial} className="adminForm materialForm"><input name="family" placeholder="Familia"/><input name="name" required placeholder="Producto"/><input name="presentation" placeholder="Presentación"/><input name="unit" placeholder="Unidad"/><input name="supplier_code" placeholder="Código proveedor"/><input name="current_net_price" type="number" min="0" step="1" placeholder="Valor neto"/><button>Guardar producto</button></form>}
  {showImport&&<form action={importMaterialsCsv} className="adminForm csvForm"><label>Archivo CSV<input name="file" type="file" accept=".csv,text/csv" required/></label><button>Cargar productos</button><small>Agrega productos; no sobrescribe ni elimina los existentes.</small></form>}
  <div className="catalogFilters" aria-label="Filtros del maestro de materiales">
   <label className="catalogSearch">Buscar<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Código, producto o presentación"/></label>
   <label>Familia<select value={family} onChange={e=>setFamily(e.target.value)}><option value="">Todas</option>{families.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
   <label>Proveedor<select value={supplier} onChange={e=>setSupplier(e.target.value)}><option value="">Todos</option>{suppliers.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
   {(search||family||supplier)&&<button type="button" className="clearFilters" onClick={()=>{setSearch("");setFamily("");setSupplier("")}}>Limpiar filtros</button>}
  </div>
  {error?<div className="empty"><b>No fue posible cargar el maestro</b><span>{error}</span></div>:!rows.length?<div className="empty"><b>El maestro no contiene registros visibles</b><span>La consulta respeta los permisos de acceso del usuario.</span></div>:!filtered.length?<div className="empty"><b>Sin coincidencias</b><span>Prueba otro término o limpia los filtros.</span></div>:<div className="catalogTableWrap"><table className="catalogTable"><thead><tr><th>Familia</th><th>Proveedor</th><th>Código</th><th>Producto</th><th>Presentación</th><th>Unidad</th><th className="numeric">Valor neto</th><th className="numeric">Disponibilidad</th></tr></thead><tbody>{filtered.map((row,index)=><tr key={row.id||`${text(row.product)}-${index}`}><td>{text(row.family)||"—"}</td><td>{text(row.supplier)||"—"}</td><td className="codeCell">{text(row.supplier_code)||"—"}</td><td><b>{text(row.product)||"Sin nombre"}</b></td><td>{text(row.presentation)||"—"}</td><td>{text(row.unit)||"—"}</td><td className="numeric">{money(row.net_value)}</td><td className={`numeric availability ${Number(row.availability)>0?"positive":"zero"}`}>{quantity(row.availability)}</td></tr>)}</tbody></table></div>}
  <p className="catalogNote">La disponibilidad corresponde a recepciones menos despachos. Los campos sin normalizar se muestran como “—”; no se separan datos del nombre del producto sin revisión y trazabilidad.</p>
 </section>
}
