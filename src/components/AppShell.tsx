"use client";
import type {ReactNode} from "react";
import type {ClientProfile,MaterialState,Role} from "@/lib/materiales-domain";
import {visibleModules} from "@/lib/materiales-store";
const labels:Record<string,string>={inicio:"Inicio",clientes:"1. Clientes / Contratos",maestro:"2. Maestro",levantamiento:"3. Levantamiento",cotejo:"4. Cotejo / Diferencias",consolidado:"5. Consolidado / Abastecimiento",kits:"6. Kits",oc:"7. Órdenes de Compra",ingreso:"8. Ingreso Mercadería",guias:"9. Guías / Despachos",pendientes:"10. Pendientes",historico:"11. Histórico / Costos",gestion:"12. Gestión"};
export default function AppShell({tab,setTab,state,patch,profiles,children}:{tab:string;setTab:(x:string)=>void;state:MaterialState;patch:(x:Partial<MaterialState>)=>void;profiles:ClientProfile[];children:ReactNode}){
 const mods=visibleModules(state.role);
 return <div className="app"><header className="top"><div><div className="brand">ALEMSI Materiales</div><div className="sub">Sistema modular V0.5</div></div><select value={state.role} onChange={e=>patch({role:e.target.value as Role})}>{["Supervisora","Gerencia","Finanzas","Bodega","Admin"].map(r=><option key={r}>{r}</option>)}</select></header>
 <div className="mobileContext"><select value={state.selectedProfileId} onChange={e=>patch({selectedProfileId:e.target.value})}>{profiles.map(p=><option key={p.id} value={p.id}>{p.region} · {p.institution}</option>)}</select></div>
 <div className="shell"><aside className="side">{mods.map(k=><button key={k} className={`navbtn ${tab===k?"active":""}`} onClick={()=>setTab(k)}>{labels[k]}</button>)}</aside><main className="main"><div className="desktopContext"><span>CLIENTE / CONTRATO</span><select value={state.selectedProfileId} onChange={e=>patch({selectedProfileId:e.target.value})}>{profiles.map(p=><option key={p.id} value={p.id}>{p.region} · {p.institution}</option>)}</select></div>{children}</main></div>
 <nav className="mobileNav">{mods.slice(0,5).map(k=><button key={k} className={tab===k?"active":""} onClick={()=>setTab(k)}>{labels[k].replace(/^\d+\.\s*/,"")}</button>)}</nav></div>
}
