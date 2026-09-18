"use client";

import {useFormStatus} from "react-dom";
import {login} from "./actions";
import AlemsiActionButton from "@/components/ui/AlemsiActionButton";

function SubmitButton(){const {pending}=useFormStatus();return <AlemsiActionButton className="primary loginSubmit" type="submit" loading={pending} loadingText="Ingresando…">Ingresar</AlemsiActionButton>}
export default function LoginForm(){return <form action={login} className="formStack"><label>Correo o perfil<input name="identifier" type="text" required autoComplete="username" placeholder="Correo o perfil" autoCapitalize="none" spellCheck={false}/></label><label>Contraseña<input name="password" type="password" required autoComplete="current-password"/></label><SubmitButton/></form>}
