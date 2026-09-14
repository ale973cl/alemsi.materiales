"use client";

import { useEffect, useMemo, useState } from "react";
import { returnFromPreviewProfile, switchPreviewProfile } from "@/app/preview-profile-actions";

const ROLE_OPTIONS = [
  { role: "Gerencia", label: "Gerencia" },
  { role: "Admin", label: "Admin / Operaciones" },
  { role: "Finanzas", label: "Finanzas" },
  { role: "Bodega", label: "Bodega" },
  { role: "Supervisora", label: "Supervisora" },
];

export default function PreviewProfileSwitcher({ currentRole, users }:{ currentRole:string; users:any[] }) {
  const [isPreviewHost, setIsPreviewHost] = useState(false);
  const [activeMode, setActiveMode] = useState(false);

  useEffect(() => {
    const host = window.location.hostname;
    setIsPreviewHost(host.includes("git-") || host.includes("preview") || host.includes("vercel.app"));
    setActiveMode(document.cookie.split(";").some(part => part.trim() === "alemsi_preview_active=1"));
  }, []);

  const activeRoles = useMemo(() => new Set((users || []).filter((u:any) => u.active).map((u:any) => u.role)), [users]);
  if (!isPreviewHost) return null;

  if (activeMode && currentRole !== "Admin Total") {
    return <section style={{margin:"0 0 14px",padding:"12px 14px",border:"1px solid #d79a32",background:"#fff8e8",borderRadius:12,display:"flex",gap:12,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
      <div><b>MODO PRUEBA · {currentRole}</b><div style={{fontSize:12,color:"#6b5a36",marginTop:3}}>Sesión real del usuario asignado a este perfil. Los permisos y datos visibles son los de esa cuenta.</div></div>
      <form action={returnFromPreviewProfile}><button type="submit">Volver a Admin Total</button></form>
    </section>;
  }

  if (currentRole !== "Admin Total") return null;

  return <section style={{margin:"0 0 16px",padding:"14px",border:"1px solid #9ec8c5",background:"#f4fbfa",borderRadius:12}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
      <div><b>Acceso de prueba · Preview</b><div style={{fontSize:12,color:"#536b72",marginTop:3}}>Entra como un usuario real de cada perfil para comprobar permisos, asignaciones y circuitos.</div></div>
      <span style={{fontSize:11,fontWeight:700,color:"#0b6f69"}}>NO DISPONIBLE EN PRODUCTION</span>
    </div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
      {ROLE_OPTIONS.map(({role,label}) => {
        const available = activeRoles.has(role);
        return <form action={switchPreviewProfile} key={role}>
          <input type="hidden" name="role" value={role}/>
          <button type="submit" disabled={!available} title={available?`Entrar como ${label}`:`No existe usuario activo con perfil ${label}`}>
            {label}{available?"":" · sin usuario activo"}
          </button>
        </form>;
      })}
    </div>
  </section>;
}
