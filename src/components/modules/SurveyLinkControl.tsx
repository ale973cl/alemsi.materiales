"use client";
import {useState} from "react";
import {createSurveyAccess} from "@/app/survey-access-actions";

export default function SurveyLinkControl({campaignId,installationId,installationName}:{campaignId:string;installationId:string;installationName:string}){
  const [email,setEmail]=useState("");
  const [link,setLink]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  async function run(mode:"link"|"email"){
    if(mode==="email"&&!email.trim()){setMessage("Ingresa un correo para enviar el acceso.");return}
    setBusy(true);setMessage("");
    try{
      const result=await createSurveyAccess({campaignId,installationId,email:email.trim()||undefined,sendEmail:mode==="email"});
      setLink(result.link);
      if(mode==="link")setMessage("Acceso listo.");
      else if(result.email_status==="sent")setMessage("Correo enviado.");
      else if(result.email_status==="blocked")setMessage("Acceso listo; correo bloqueado en Preview.");
      else if(result.email_status==="pending")setMessage("Acceso listo; correo pendiente.");
      else setMessage("Acceso listo; el correo no se pudo enviar.");
    }catch(e:any){setMessage(e?.message||"No se pudo generar el acceso")}
    finally{setBusy(false)}
  }

  async function copy(){
    if(!link)return;
    await navigator.clipboard.writeText(link);
    setMessage("Enlace copiado.");
  }

  return <div className="surveyAccessCompact">
    <div className="surveyAccessMeta">
      <b>Acceso remoto</b>
      <small>{installationName}</small>
    </div>
    <input
      type="email"
      value={email}
      onChange={e=>setEmail(e.target.value)}
      placeholder="Correo opcional"
      aria-label="Correo para enviar acceso"
    />
    <button type="button" disabled={busy} onClick={()=>run("link")}>{busy?"Procesando…":"Generar"}</button>
    <button type="button" disabled={busy||!email.trim()} onClick={()=>run("email")}>Enviar</button>
    {link&&<button type="button" className="secondary" onClick={copy}>Copiar</button>}
    {message&&<small className="surveyAccessStatus">{message}</small>}
  </div>;
}
