import Image from "next/image";
import Link from "next/link";
import LoginSubmitButton from "@/components/LoginSubmitButton";
import { login, requestPreviewTestCode, verifyPreviewTestCode } from "./actions";

export default async function Login({ searchParams }:{searchParams:Promise<{error?:string;test_code?:string;email?:string}>}) {
  const { error, test_code, email } = await searchParams;
  return <main className="loginPage loginExperience"><div className="loginScene"><div className="loginBrand"><Image src="/alemsi-logo.png" width={460} height={210} alt="ALEMSI Servicios de Higiene y Desinfección" priority /></div><section className="loginCard loginCompactCard">
    <div><p className="eyebrow">CONTROL OPERACIONAL</p><h1>Materiales</h1><p>Ingreso individualizado y protegido por perfil.</p></div>
    {error && <p className="alert danger">{error}</p>}
    <form action={login} className="formStack"><label>Correo o perfil<input name="identifier" type="text" required autoComplete="username" placeholder="Correo o perfil" autoCapitalize="none" spellCheck={false}/></label><label>Contraseña<input name="password" type="password" required autoComplete="current-password"/></label><LoginSubmitButton/></form>
    {process.env.VERCEL_ENV === "preview" && <details className="loginPreviewAccess" aria-label="Acceso de pruebas en Preview"><summary>Acceso de pruebas (solo Preview)</summary>
      <p>Utiliza el correo de un usuario existente. Se mantiene Supabase Auth y la autorización por perfil.</p>
      {test_code === "1" ? <form action={verifyPreviewTestCode} className="formStack">
        <input type="hidden" name="email" value={email || ""} />
        <label>Código recibido por correo<input name="token" type="text" inputMode="numeric" pattern="[0-9]{6,8}" autoComplete="one-time-code" required /></label>
        <button type="submit">Ingresar con código</button>
      </form> : <form action={requestPreviewTestCode} className="formStack">
        <label>Correo de usuario existente<input name="email" type="email" autoComplete="email" required /></label>
        <button type="submit">Enviar código de acceso</button>
      </form>}
    </details>}
    <Link href="/forgot-password">¿Olvidaste tu contraseña?</Link>
    <small>Puedes ingresar con tu correo o con el nombre de tu perfil cuando exista un único usuario activo en ese perfil.</small>
  </section><div className="loginShowcase" aria-hidden="true"><div className="loginMascotStand"><Image className="loginMascot" src="/alemsin-maestro.png" width={420} height={610} alt="" /></div></div></div></main>;
}
