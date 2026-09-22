"use client";
import {useState} from "react";
import {createSurveyAccessLink} from "@/app/survey-link-actions";

export default function SurveyLinkControl({campaignId,installationId,installationName}:{campaignId:string;installationId:string;installationName:string}){
  const [email,setEmail]=useState("");const [link,setLink]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  async function run(mode:"link"|"email"){
    setBusy(true);setMessage("");
    try{
      const result=await createSurveyAccessLink({campaign_id:campaignId,installation_id:installationId,mode,email:email||null,valid_hours:72});
      setLink(result.link);
      if(mode==="link")setMessage("Acceso seguro generado. Válido por 72 horas.");
      else if(result.email_status==="sent")setMessage("Correo enviado correctamente.");
      else if(result.email_status==="blocked")setMessage("Link generado; correo bloqueado por política de Preview.");
      else if(result.email_status==="pending")setMessage("Link generado; correo pendiente.");
      else setMessage("Link generado; no se pudo enviar el correo.");
    }catch(e:any){setMessage(e?.message||"No se pudo generar el acceso");}
    finally{setBusy(false)}
  }
  async function copy(value:string){if(!value)return;await navigator.clipboard.writeText(value);setMessage("Link copiado al portapapeles.");}
  return <details className="surveyAccessMenu"><summary>✉ Enviar link</summary><div className="surveyAccessPopover" aria-label={`Acceso al conteo de ${installationName}`}><label><small>Correo para acceso</small><input className="surveyAccessEmail" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="correo@ejemplo.cl" aria-label={`Correo para acceso a ${installationName}`}/></label><div className="surveyAccessActions"><button type="button" disabled={busy} onClick={()=>run("link")}>{busy?"Generando...":"Generar acceso"}</button><button type="button" disabled={busy} onClick={()=>run("email")}>{busy?"Procesando...":"Enviar por correo"}</button>{link&&<button type="button" onClick={()=>copy(link)}>Copiar link</button>}</div>{link&&<input className="surveyAccessLink" aria-label="Link de acceso generado" readOnly value={link} onFocus={e=>e.currentTarget.select()}/>} {message&&<small className="surveyAccessMessage">{message}</small>}</div></details>;
}
