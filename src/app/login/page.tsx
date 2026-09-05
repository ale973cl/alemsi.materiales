import Image from "next/image";
import { login } from "./actions";
export default async function Login({ searchParams }:{searchParams:Promise<{error?:string}>}) {
  const { error } = await searchParams;
  return <main className="loginPage"><section className="loginCard">
    <Image src="/alemsi-logo.png" width={330} height={150} alt="ALEMSI" priority />
    <div><p className="eyebrow">CONTROL OPERACIONAL</p><h1>Materiales</h1><p>Ingreso individualizado y protegido por perfil.</p></div>
    {error && <p className="alert danger">{error}</p>}
    <form action={login} className="formStack"><label>Correo<input name="email" type="email" required autoComplete="email"/></label><label>Contraseña<input name="password" type="password" required autoComplete="current-password"/></label><button className="primary">Ingresar</button></form>
    <small>Los permisos se obtienen desde Supabase; no existe selector manual de rol.</small>
  </section><Image className="loginMascot" src="/alemsin-maestro.png" width={420} height={610} alt="Alemsín" /></main>;
}
