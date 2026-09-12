"use client";
import {useState} from "react";
import {createSurveyAccessLink} from "@/app/survey-link-actions";

export default function SurveyLinkControl({campaignId,installationId,installationName}:{campaignId:string;installationId:string;installationName:string}){
  const [email,setEmail]=useState("");const [link,setLink]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  async function run(mode:"link"|"email"){
    setBusy(true);setMessage("");
    try{const result=await createSurveyAccessLink({campaign_id:campaignId,installation_id:installationId,mode,email:email||null,valid_hours:72});setLink(result.link);setMessage(mode==="email"?`Correo encolado${result.email?` para ${result.email}`:""}. Link válido por 72 horas.`:"Link seguro generado. Válido por 72 horas.");}
    catch(e:any){setMessage(e?.message||"No se pudo generar el link");}
    finally{setBusy(false)}
  }
  async function copy(){if(!link)return;await navigator.clipboard.writeText(link);setMessage("Link copiado al portapapeles.");}
  return <div style={{gridColumn:"1 / -1",borderTop:"1px solid #d7e2e7",paddingTop:10,display:"grid",gap:8}}><small><b>Conteo por link seguro</b> · {installationName}</small><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Correo supervisora (opcional si está asignada)" style={{minWidth:280,flex:"1 1 280px"}}/><button type="button" disabled={busy} onClick={()=>run("link")}>{busy?"Generando...":"Generar link"}</button><button type="button" disabled={busy} onClick={()=>run("email")}>Enviar por correo</button>{link&&<button type="button" onClick={copy}>Copiar link</button>}</div>{link&&<input readOnly value={link} onFocus={e=>e.currentTarget.select()}/>} {message&&<small>{message}</small>}</div>;
}
