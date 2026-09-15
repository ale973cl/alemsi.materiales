"use client";
import {useState} from "react";
import {submitSurveyToken} from "./actions";

type Material={material_id:string;name:string;presentation?:string|null;unit?:string|null;authorized_qty:number};
type Condition="Bueno"|"Regular"|"Malo";

function isLiquid(m:Material){
  const text=`${m.name} ${m.presentation||""} ${m.unit||""}`.toLowerCase();
  return /\b(lt|litro|litros|ml)\b|detergente|desinfectante|multiuso|mantenedor|desengrasante|removedor|ceracrilita|lavalosas/.test(text);
}
function needsCondition(m:Material){
  const text=`${m.name} ${m.presentation||""}`.toLowerCase();
  return /escobill|escoba|pala|mopa|mango|señal|carro|balde|dispensador/.test(text);
}

export default function TokenSurveyForm({token,materials,installation}:{token:string;materials:Material[];installation:string}){
  const [values,setValues]=useState<Record<string,number>>({});
  const [conditions,setConditions]=useState<Record<string,Condition>>({});
  const [saving,setSaving]=useState(false);const [message,setMessage]=useState("");const [done,setDone]=useState(false);
  async function submit(){setSaving(true);setMessage("");try{const fd=new FormData();fd.set("token",token);fd.set("lines",JSON.stringify(materials.map(m=>({material_id:m.material_id,physical_remainder:Number(values[m.material_id]||0),condition:needsCondition(m)?conditions[m.material_id]||null:null,input_unit:isLiquid(m)?"L":m.unit||"unidad"}))));await submitSurveyToken(fd);setDone(true);setMessage("Conteo confirmado correctamente. La información ya quedó enviada a ALEMSI.");}catch(e:any){setMessage(e?.message||"No se pudo confirmar el conteo");}finally{setSaving(false)}}
  if(done)return <div style={{padding:22,border:"1px solid #b9d8d4",borderRadius:12,background:"#f3fbf9"}}><h2>Conteo enviado</h2><p>{message}</p><p>Puedes cerrar esta página.</p></div>;
  return <div>
    <div style={{marginBottom:16}}><h2 style={{marginBottom:4}}>Conteo de materiales</h2><p style={{margin:0,color:"#607684"}}>Indica solamente cuánto queda físicamente. ALEMSI realizará los cálculos automáticamente.</p></div>
    <div style={{display:"grid",gap:12}}>{materials.map(m=>{const liquid=isLiquid(m);const condition=needsCondition(m);return <article key={m.material_id} style={{padding:14,border:"1px solid #d7e2e7",borderRadius:10}}>
      <div style={{marginBottom:10}}><b>{m.name}</b>{m.presentation&&<small style={{display:"block",color:"#607684"}}>{m.presentation}</small>}</div>
      <label style={{display:"block"}}><b>{liquid?"¿Cuántos litros le quedan en total?":"¿Cuántos tiene actualmente?"}</b><div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}><input type="number" min="0" step={liquid?"0.25":"1"} inputMode="decimal" value={values[m.material_id]??""} onChange={e=>setValues(v=>({...v,[m.material_id]:Math.max(0,Number(e.target.value)||0)}))} style={{width:120,padding:11,fontSize:16}}/><b>{liquid?"L":m.unit||"un."}</b></div></label>
      {condition&&<div style={{marginTop:12}}><b>Estado</b><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>{(["Bueno","Regular","Malo"] as Condition[]).map(c=><button key={c} type="button" onClick={()=>setConditions(v=>({...v,[m.material_id]:c}))} style={{padding:"9px 14px",borderRadius:8,border:conditions[m.material_id]===c?"2px solid #0b6f69":"1px solid #b8c8cf",background:conditions[m.material_id]===c?"#e8f5f3":"white",fontWeight:conditions[m.material_id]===c?700:500}}>{c}</button>)}</div>{conditions[m.material_id]==="Malo"&&<small style={{display:"block",marginTop:6,color:"#8a4b08"}}>Marcado para revisión y posible cambio.</small>}</div>}
    </article>})}</div>
    <div style={{marginTop:18,padding:16,borderTop:"2px solid #0b6f69"}}><p><b>{installation}</b></p><p style={{fontSize:13,color:"#607684"}}>No necesitas calcular carencias ni cantidades a comprar.</p>{message&&<p><b>{message}</b></p>}<button type="button" disabled={saving} onClick={submit} style={{padding:"12px 18px",background:"#0b6f69",color:"white",border:0,borderRadius:8,fontWeight:700}}>{saving?"Enviando...":"Confirmar conteo"}</button></div>
  </div>;
}
