"use client";
import {useState} from "react";
import {createSurveyAccessLink} from "@/app/survey-link-actions";

export default function SurveyLinkControl({campaignId,installationId,installationName}:{campaignId:string;installationId:string;installationName:string}){
  const [opened,setOpened]=useState(false);
  const [email,setEmail]=useState("");
  const [link,setLink]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  async function run(mode:"link"|"email"){
    if(mode==="email"&&!email.trim()){setMessage("Ingresa un correo para enviar el acceso.");return}
    setBusy(true);setMessage("");
    try{
      const result=await createSurveyAccessLink({
        campaign_id:campaignId,
        installation_id:installationId,
        mode,
        email:email.trim()||null,
        valid_hours:72
      });
      setLink(result.link);
      if(mode==="link")setMessage("Acceso listo por 72 horas.");
      else if(result.email_status==="sent")setMessage("Correo enviado.");
      else if(result.email_status==="blocked")setMessage("Acceso generado; correo bloqueado en Preview.");
      else if(result.email_status==="pending")setMessage("Acceso generado; correo pendiente.");
      else setMessage("Acceso generado; no se pudo enviar el correo.");
    }catch(e:any){setMessage(e?.message||"No se pudo generar el acceso")}
    finally{setBusy(false)}
  }

  async function copy(){
    if(!link)return;
    await navigator.clipboard.writeText(link);
    setMessage("Enlace copiado.");
  }

  function close(){
    if(busy)return;
    setOpened(false);
    setMessage("");
  }

  return <>
    <button type="button" className="surveyAccessTrigger" onClick={()=>setOpened(true)}>Acceso remoto ↗</button>
    {opened&&<div className="surveyAccessOverlay" role="dialog" aria-modal="true" aria-label={"Acceso remoto "+installationName} onMouseDown={e=>{if(e.currentTarget===e.target)close()}}>
      <div className="surveyAccessDialog">
        <div className="surveyAccessDialogHead">
          <div><small>ACCESO REMOTO</small><b>{installationName}</b></div>
          <button type="button" className="surveyAccessClose" aria-label="Cerrar" onClick={close}>×</button>
        </div>
        <p>Genera un enlace seguro para realizar el levantamiento desde teléfono o tablet.</p>
        <div className="surveyAccessPrimary">
          {!link?<button type="button" disabled={busy} onClick={()=>run("link")}>{busy?"Generando…":"Generar enlace"}</button>:<>
            <span className="surveyAccessReady">Acceso listo · 72 h</span>
            <button type="button" onClick={copy}>Copiar enlace</button>
          </>}
        </div>
        <div className="surveyAccessEmail">
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Correo para enviar (opcional)" aria-label="Correo para enviar acceso"/>
          <button type="button" disabled={busy||!email.trim()} onClick={()=>run("email")}>{busy?"Enviando…":"Enviar"}</button>
        </div>
        {message&&<small className="surveyAccessStatus">{message}</small>}
      </div>
    </div>}
  </>;
}
