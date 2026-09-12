import Image from "next/image";
import {requestPasswordReset} from "./actions";

export default async function ForgotPassword({searchParams}:{searchParams:Promise<{error?:string;sent?:string}>}){
  const {error,sent}=await searchParams;
  return <main className="loginPage"><section className="loginCard">
    <Image src="/alemsi-logo.png" width={330} height={150} alt="ALEMSI" priority />
    <div><p className="eyebrow">RECUPERACIÓN DE ACCESO</p><h1>Restablecer contraseña</h1><p>Ingresa tu correo de acceso. Si corresponde a un usuario habilitado, recibirás un enlace seguro para crear una nueva contraseña.</p></div>
    {error&&<p className="alert danger">{error}</p>}
    {sent&&<p className="alert">Revisa tu correo. Si la cuenta existe, Supabase enviará el enlace de recuperación.</p>}
    <form action={requestPasswordReset} className="formStack"><label>Correo<input name="email" type="email" required autoComplete="email"/></label><button className="primary">Enviar enlace de recuperación</button></form>
    <a href="/login">Volver al ingreso</a>
  </section><Image className="loginMascot" src="/alemsin-maestro.png" width={420} height={610} alt="Alemsín" /></main>;
}
