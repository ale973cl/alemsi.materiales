"use client";

import { useFormStatus } from "react-dom";
import { login } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="primary loginSubmit" type="submit" disabled={pending} aria-busy={pending}>
      {pending && <span className="loginSpinner" aria-hidden="true" />}
      <span>{pending ? "Ingresando…" : "Ingresar"}</span>
    </button>
  );
}

export default function LoginForm() {
  return (
    <form action={login} className="formStack">
      <label>
        Correo o perfil
        <input
          name="identifier"
          type="text"
          required
          autoComplete="username"
          placeholder="Correo o perfil"
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>
      <label>
        Contraseña
        <input name="password" type="password" required autoComplete="current-password" />
      </label>
      <SubmitButton />
    </form>
  );
}
