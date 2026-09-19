"use client";

import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; loadingText?: string };

export function AlemsiLoadingMark({ size = 22 }: { size?: number }) {
  return <span className="alemsiLoadingMark" style={{width:size,height:size}} aria-hidden="true">
    <span className="alemsiRhombus alemsiRhombusTop"/><span className="alemsiRhombus alemsiRhombusRight"/>
    <span className="alemsiRhombus alemsiRhombusBottom"/><span className="alemsiRhombus alemsiRhombusLeft"/>
  </span>;
}

export function AlemsiLoadingState({text="Cargando…",overlay=false}:{text?:string;overlay?:boolean}){
  return <div className={overlay?"alemsiLoadingState alemsiLoadingOverlay":"alemsiLoadingState"} role="status" aria-live="polite" aria-busy="true"><AlemsiLoadingMark size={28}/><strong>{text}</strong></div>;
}

export default function AlemsiActionButton({loading=false,loadingText="Procesando…",disabled,children,className="",...props}:Props){
  return <button {...props} className={`alemsiActionButton ${className}`.trim()} disabled={disabled||loading} aria-busy={loading}>
    {loading?<><AlemsiLoadingMark/><span>{loadingText}</span></>:children}
  </button>;
}
