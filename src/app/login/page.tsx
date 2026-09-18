import Image from "next/image";
import Link from "next/link";
import LoginForm from "./LoginForm";

export default async function Login({ searchParams }:{searchParams:Promise<{error?:string}>}) {
  const { error } = await searchParams;
  return <main className="loginPage"><section className="loginCard">
    <Image src="/alemsi-logo.png" width={330} height={150} alt="ALEMSI" priority />
    <div><p className="eyebrow">CONTROL OPERACIONAL</p><h1>Materiales</h1><p>Ingreso individualizado y protegido por perfil.</p></div>
    {error && <p className="alert danger">{error}</p>}
    <LoginForm />
    <Link href="/forgot-password">¿Olvidaste tu contraseña?</Link>
    <small>Puedes ingresar con tu correo o con el nombre de tu perfil cuando exista un único usuario activo en ese perfil.</small>
  </section><Image className="loginMascot" src="/alemsin-maestro.png" width={420} height={610} alt="Alemsín" /></main>;
}
