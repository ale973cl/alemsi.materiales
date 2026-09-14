"use client";

import { useEffect, useMemo, useState } from "react";
import { returnFromPreviewProfile, switchPreviewProfile } from "@/app/preview-profile-actions";

const ROLE_OPTIONS = [
  { role: "Admin Total", label: "Admin Total" },
  { role: "Gerencia", label: "Gerencia" },
  { role: "Admin", label: "Admin / Operaciones" },
  { role: "Finanzas", label: "Finanzas" },
  { role: "Bodega", label: "Bodega" },
  { role: "Supervisora", label: "Supervisora" },
];

export default function PreviewProfileGlobal() {
  const [context, setContext] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/preview-profile-context", { cache: "no-store" })
      .then(r => r.json())
      .then(data => { if (active) setContext(data); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const activeRoles = useMemo(() => new Set((context?.users || []).filter((u:any) => u.active).map((u:any) => u.role)), [context]);
  const currentRole = context?.profile?.role || "";
  const previewMode = typeof document !== "undefined" && document.cookie.split(";").some(part => part.trim() === "alemsi_preview_active=1");

  if (!context?.enabled || !context?.authenticated || !context?.profile) return null;
  if (currentRole !== "Admin Total" && !previewMode) return null;

  const runSwitch = async (formData: FormData) => {
    const role = String(formData.get("role") || "");
    setError("");
    setLoading(role);
    try {
      const result:any = await switchPreviewProfile(formData);
      if (result?.error) setError(result.error);
    } finally {
      setLoading("");
    }
  };

  const runReturn = async () => {
    setError("");
    setLoading("return");
    try {
      const result:any = await returnFromPreviewProfile();
      if (result?.error) setError(result.error);
    } finally {
      setLoading("");
    }
  };

  if (previewMode && currentRole !== "Admin Total") {
    return <div style={{position:"fixed",right:16,bottom:16,zIndex:9999,maxWidth:420,padding:14,border:"1px solid #d79a32",background:"#fff8e8",borderRadius:12,boxShadow:"0 8px 24px rgba(0,0,0,.15)"}}>
      <div style={{fontWeight:800}}>MODO PRUEBA · {currentRole}</div>
      <div style={{fontSize:12,marginTop:4}}>Permisos y datos de la cuenta real asociada a este perfil.</div>
      {error && <div style={{fontSize:12,color:"#a12622",marginTop:8}}>{error}</div>}
      <form action={runReturn} style={{marginTop:10}}><button type="submit" disabled={Boolean(loading)}>{loading==="return"?"Volviendo...":"Volver a Admin Total"}</button></form>
    </div>;
  }

  return <div style={{position:"fixed",right:16,bottom:16,zIndex:9999,maxWidth:560,padding:14,border:"1px solid #9ec8c5",background:"#f4fbfa",borderRadius:12,boxShadow:"0 8px 24px rgba(0,0,0,.15)"}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
      <div><b>Acceso por perfiles · Preview</b><div style={{fontSize:12,marginTop:3}}>Todos los perfiles se muestran siempre. La disponibilidad del usuario no oculta el perfil.</div></div>
      <span style={{fontSize:11,fontWeight:700,color:"#0b6f69"}}>SOLO PREVIEW</span>
    </div>
    {error && <div style={{marginTop:10,padding:"8px 10px",border:"1px solid #e5b5b1",background:"#fff6f5",borderRadius:8,fontSize:12,color:"#a12622"}}>{error}</div>}
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
      {ROLE_OPTIONS.map(({role,label}) => {
        const isCurrent = role === currentRole;
        const hasUser = role === "Admin Total" || activeRoles.has(role);
        return <form action={runSwitch} key={role}>
          <input type="hidden" name="role" value={role}/>
          <button type="submit" disabled={isCurrent || Boolean(loading)} title={hasUser?`Entrar como ${label}`:`Perfil visible; todavía no existe usuario activo ${label}`}>
            {loading===role?"Entrando...":isCurrent?`${label} · actual`:hasUser?label:`${label} · sin usuario`}
          </button>
        </form>;
      })}
    </div>
  </div>;
}
