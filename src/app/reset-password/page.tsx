import Image from "next/image";
import {updatePassword} from "./actions";

export default async function ResetPassword({searchParams}:{searchParams:Promise<{error?:string}>}){
  const {error}=await searchParams;
  return <main className="loginPage"><section className="loginCard">
    <Image src="/alemsi-logo.png" width={330} height={150} alt="ALEMSI" priority />
    <div><p className="eyebrow">NUEVA CONTRASEÑA</p><h1>Crear contraseña</h1><p>Define una nueva contraseña para tu cuenta ALEMSI Materiales.</p></div>
    {error&&<p className="alert danger">{error}</p>}
    <form action={updatePassword} className="formStack"><label>Nueva contraseña<input name="password" type="password" minLength={8} required autoComplete="new-password"/></label><label>Repetir contraseña<input name="confirm_password" type="password" minLength={8} required autoComplete="new-password"/></label><button className="primary">Guardar nueva contraseña</button></form>
  </section><Image className="loginMascot" src="/alemsin-maestro.png" width={420} height={610} alt="Alemsín" /></main>;
}
