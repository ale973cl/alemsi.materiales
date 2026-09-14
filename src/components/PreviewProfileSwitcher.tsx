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

export default function PreviewProfileSwitcher({ currentRole, users }:{ currentRole:string; users:any[] }) {
  const [isPreviewHost, setIsPreviewHost] = useState(false);
  const [activeMode, setActiveMode] = useState(false);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState("");

  useEffect(() => {
    const host = window.location.hostname;
    setIsPreviewHost(host.includes("-git-") || host.includes("preview"));
    setActiveMode(document.cookie.split(";").some(part => part.trim() === "alemsi_preview_active=1"));
  }, []);

  const activeRoles = useMemo(() => new Set((users || []).filter((u:any) => u.active).map((u:any) => u.role)), [users]);
  if (!isPreviewHost) return null;

  const runSwitch=async(formData:FormData)=>{
    const role=String(formData.get("role")||"");
    if(role===currentRole){setError("");return;}
    setError("");setLoading(role);
    try{const result=await switchPreviewProfile(formData);if(result?.error)setError(result.error);}finally{setLoading("");}
  };
  const runReturn=async()=>{
    setError("");setLoading("return");
    try{const result=await returnFromPreviewProfile();if(result?.error)setError(result.error);}finally{setLoading("");}
  };

  if (activeMode && currentRole !== "Admin Total") {
    return <section style={{margin:"0 0 14px",padding:"12px 14px",border:"1px solid #d79a32",background:"#fff8e8",borderRadius:12,display:"flex",gap:12,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
      <div><b>MODO PRUEBA · {currentRole}</b><div style={{fontSize:12,color:"#6b5a36",marginTop:3}}>Sesión real del usuario asignado a este perfil. Los permisos y datos visibles son los de esa cuenta.</div>{error&&<div style={{fontSize:12,color:"#a12622",marginTop:6}}>{error}</div>}</div>
      <form action={runReturn}><button type="submit" disabled={Boolean(loading)}>{loading==="return"?"Volviendo...":"Volver a Admin Total"}</button></form>
    </section>;
  }

  if (currentRole !== "Admin Total") return null;

  return <section style={{margin:"0 0 16px",padding:"14px",border:"1px solid #9ec8c5",background:"#f4fbfa",borderRadius:12}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
      <div><b>Acceso de prueba · Preview</b><div style={{fontSize:12,color:"#536b72",marginTop:3}}>Se muestran todos los perfiles definidos. Los que aún no tienen usuario pueden revisarse en el selector y quedarán identificados hasta que exista una cuenta real para probar sus asignaciones.</div></div>
      <span style={{fontSize:11,fontWeight:700,color:"#0b6f69"}}>NO DISPONIBLE EN PRODUCTION</span>
    </div>
    {error&&<div style={{marginTop:10,padding:"9px 10px",border:"1px solid #e5b5b1",background:"#fff6f5",borderRadius:8,fontSize:12,color:"#a12622"}}><b>No se pudo cambiar de perfil:</b> {error}</div>}
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
      {ROLE_OPTIONS.map(({role,label}) => {
        const available = activeRoles.has(role);
        const current = currentRole===role;
        return <form action={runSwitch} key={role}>
          <input type="hidden" name="role" value={role}/>
          <button type="submit" disabled={Boolean(loading)||current} title={current?"Perfil actual":available?`Entrar como ${label}`:`Perfil definido, todavía sin usuario activo de prueba`} style={current?{fontWeight:800,outline:"2px solid #0b6f69"}:undefined}>
            {loading===role?"Entrando...":current?`${label} · actual`:`${label}${available?"":" · sin usuario"}`}
          </button>
        </form>;
      })}
    </div>
  </section>;
}
