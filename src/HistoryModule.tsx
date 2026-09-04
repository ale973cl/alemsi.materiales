"use client";
import type {ClientProfile,MaterialState} from "@/lib/materiales-domain";
import {clp} from "@/lib/materiales-store";
export default function HistoryModule({state,profile}:{state:MaterialState;profile:ClientProfile}){const s=state.surveys.filter(x=>x.profileId===profile.id);return <><h1>Histórico / Costos</h1><div className="tableWrap"><table><thead><tr><th>Fecha</th><th>Instalación</th><th>Carencia neta</th><th>Ruta</th></tr></thead><tbody>{s.length?s.map(x=><tr key={x.id}><td>{x.date}</td><td>{x.installationName}</td><td>{clp(x.shortageNet)}</td><td>{x.remoteCandidate?"Evaluación logística":"Normal"}</td></tr>):<tr><td colSpan={4}>Sin histórico.</td></tr>}</tbody></table></div></>}
