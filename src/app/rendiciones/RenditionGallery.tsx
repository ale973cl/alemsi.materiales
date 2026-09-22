"use client";
import {useEffect,useState} from "react";
type Item={id:string;url:string;mime:string;label:string;amount:number;status:string};
const money=(v:number)=>Number(v||0).toLocaleString("es-CL");
export default function RenditionGallery({items}:{items:Item[]}){
 const [active,setActive]=useState<Item|null>(null);
 useEffect(()=>{if(!active)return;const close=(e:KeyboardEvent)=>{if(e.key==="Escape")setActive(null)};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[active]);
 return <><div className="renditionGallery">{items.map(item=>{const image=item.mime.startsWith("image/");return image?<button key={item.id} type="button" className="renditionGalleryCard" onClick={()=>setActive(item)} aria-label={"Ampliar "+item.label}><img src={item.url} alt={item.label}/><span><b>{item.label}</b></span></button>:<a key={item.id} className="renditionGalleryCard renditionGalleryPdf" href={item.url} target="_blank" rel="noreferrer"><span className="renditionPdfMark">PDF</span><span><b>{item.label}</b><small>$ {money(item.amount)} · Abrir documento</small></span></a>})}</div>{active&&<div className="renditionLightbox" role="dialog" aria-modal="true" aria-label={active.label} onClick={()=>setActive(null)}><button type="button" className="renditionLightboxClose" onClick={()=>setActive(null)} aria-label="Cerrar">×</button><img src={active.url} alt={active.label} onClick={e=>e.stopPropagation()}/><div className="renditionLightboxCaption">{active.label} · $ {money(active.amount)}</div></div>}</>;
}
