"use client";

import {useFormStatus} from "react-dom";

export default function LoginSubmitButton(){
 const {pending}=useFormStatus();
 return <>
  <button className="primary" type="submit" disabled={pending} aria-disabled={pending} aria-busy={pending} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:10,minHeight:44,opacity:pending?.8:1,cursor:pending?"wait":"pointer",backgroundColor:pending?"#176d67":undefined}}>
   {pending&&<span aria-hidden="true" style={{display:"inline-block",width:17,height:17,border:"2px solid rgba(255,255,255,.42)",borderTopColor:"#fff",borderRadius:"50%",animation:"alemsi-login-spin .75s linear infinite"}}/>}
   {pending?"Ingresando…":"Ingresar"}
  </button>
  <span role="status" aria-live="polite" style={{fontSize:13,color:"#315e64",minHeight:18}}>{pending?"Validando credenciales y cargando sesión…":""}</span>
  <style>{`@keyframes alemsi-login-spin{to{transform:rotate(360deg)}}`}</style>
 </>;
}
