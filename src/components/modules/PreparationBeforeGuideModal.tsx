"use client";
import {useState} from "react";
type Line={material_id:string;name:string;unit:string;pending:number;available:number;can_allocate:number};
type Suggestion={survey_id:string;installation_name:string;campaign_name:string;lines:Line[]};
export default function PreparationBeforeGuideModal({suggestion,close,confirm,busy}:{suggestion:Suggestion;close:()=>void;confirm:(lines:{material_id:string;quantity:number}[])=>void;busy:boolean}){
 const [quantity,setQuantity]=useState<Record<string,number>>(()=>Object.fromEntries(suggestion.lines.map(l=>[l.material_id,Math.max(0,Number(l.can_allocate||0))])));
 const [checked,setChecked]=useState(false);
 const total=Object.values(quantity).reduce((a,b)=>a+Number(b||0),0);
 const selected=suggestion.lines.map(l=>({material_id:l.material_id,quantity:Number(quantity[l.material_id]||0)})).filter(l=>l.quantity>0);
 return <div className="modalBg" role="dialog" aria-modal="true" aria-label="Preparar materiales por instalación">
  <div className="modal" style={{maxWidth:850,width:"94vw",maxHeight:"90vh",overflowY:"auto"}}>
   <div className="modalHead"><div><h2>Preparar materiales</h2><p>{suggestion.installation_name} · {suggestion.campaign_name}</p></div><button type="button" onClick={close} disabled={busy}>Cerrar</button></div>
   <p>Comprueba físicamente lo que separarás para esta instalación. <b>La guía se generará después de confirmar</b> y solo incluirá esas cantidades.</p>
   <div style={{overflowX:"auto"}}><table style={{borderCollapse:"collapse",width:"100%",fontSize:13}}>
    <thead><tr>{["Material","Necesidad","Disponible bodega","Cantidad preparada"].map(x=><th key={x} style={{padding:9,textAlign:"left",borderBottom:"1px solid #dbe5e9"}}>{x}</th>)}</tr></thead>
    <tbody>{suggestion.lines.map(l=><tr key={l.material_id}>
     <td style={{padding:9}}><b>{l.name}</b><small style={{display:"block"}}>{l.unit}</small></td>
     <td style={{padding:9}}>{l.pending}</td>
     <td style={{padding:9}}>{l.available}</td>
     <td style={{padding:9}}><input type="number" min={0} step="1" max={l.can_allocate} value={quantity[l.material_id]??0} onChange={e=>{const x=Number(e.target.value);setQuantity(v=>({...v,[l.material_id]:Number.isFinite(x)?Math.max(0,Math.min(l.can_allocate,Math.floor(x))):0}));setChecked(false)}} style={{width:95}}/></td>
    </tr>)}</tbody>
   </table></div>
   <div style={{marginTop:15,padding:12,background:"#f1f7f8",borderRadius:10}}><b>{total} unidades preparadas</b><p style={{margin:"6px 0",fontSize:13}}>Las unidades no preparadas continuarán como necesidad de esta instalación.</p></div>
   <label style={{display:"flex",alignItems:"flex-start",gap:8,margin:"14px 0"}}><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/><span>Confirmo que verifiqué las cantidades físicas separadas para esta instalación.</span></label>
   <div style={{display:"flex",justifyContent:"flex-end",gap:10,flexWrap:"wrap"}}><button type="button" onClick={close} disabled={busy}>Cancelar</button><button type="button" disabled={busy||!checked||!selected.length} onClick={()=>confirm(selected)}>{busy?"Registrando...":"Confirmar preparación y generar guía"}</button></div>
  </div>
 </div>;
}
