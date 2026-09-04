"use client";
import type {ReactNode} from "react";
export function Kpi({label,value}:{label:string;value:ReactNode}){return <div className="card kpi"><span>{label}</span><b>{value}</b></div>}
export function Progress({done,total}:{done:number;total:number}){const pct=total?Math.min(100,done/total*100):0;return <><div className="progressText"><b>{done}/{total}</b><span>{pct.toFixed(0)}%</span></div><div className="progress"><span style={{width:`${pct}%`}}/></div></>}
