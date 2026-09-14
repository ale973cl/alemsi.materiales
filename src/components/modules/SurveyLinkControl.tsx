"use client";
import {useState} from "react";
import {createSurveyAccessLink} from "@/app/survey-link-actions";

export default function SurveyLinkControl({campaignId,installationId,installationName}:{campaignId:string;installationId:string;installationName:string}){
  const [email,setEmail]=useState("");const [link,setLink]=useState("");const [token,setToken]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  async function run(mode:"link"|"email"){
    setBusy(true);setMessage("");
    try{const result=await createSurveyAccessLink({campaign_id:campaignId,installation_id:installationId,mode,email:email||null,valid_hours:72});setLink(result.link);setToken(result.token);setMessage(mode==="email"?`Correo encolado${result.email?` para ${result.email}`:""}. El link también queda disponible para copiar.`:"Acceso seguro generado. Válido por 72 horas.");}
    catch(e:any){setMessage(e?.message||"No se pudo generar el acceso");}
    finally{setBusy(false)}
  }
  async function copy(value:string,label:string){if(!value)return;await navigator.clipboard.writeText(value);setMessage(`${label} copiado al portapapeles.`);}
  return <div style={{gridColumn:"1 / -1",borderTop:"1px solid #d7e2e7",paddingTop:10,display:"grid",gap:8}}><small><b>Acceso de conteo para colaboradora</b> · {installationName}</small><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Correo para enviar el acceso (opcional)" style={{minWidth:280,flex:"1 1 280px"}}/><button type="button" disabled={busy} onClick={()=>run("link")}>{busy?"Generando...":"Generar acceso"}</button><button type="button" disabled={busy} onClick={()=>run("email")}>Enviar por correo</button>{link&&<button type="button" onClick={()=>copy(link,"Link")}>Copiar link</button>}{token&&<button type="button" onClick={()=>copy(token,"Token")}>Copiar token</button>}</div>{link&&<div style={{display:"grid",gap:6}}><label style={{display:"grid",gap:4}}><small>Link de esta instalación</small><input readOnly value={link} onFocus={e=>e.currentTarget.select()}/></label><label style={{display:"grid",gap:4}}><small>Token</small><input readOnly value={token} onFocus={e=>e.currentTarget.select()}/></label><small>Este acceso corresponde solo a esta campaña e instalación y vence a las 72 horas.</small></div>}{message&&<small>{message}</small>}</div>;
}
