"use client";

import {useState} from "react";

declare global{interface Window{Tesseract?:any;pdfjsLib?:any}}
const money=(v:number|null|undefined)=>v==null?"—":new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(Number(v)||0);
type Line={supplier_code?:string|null;description?:string|null;quantity?:number|null;unit?:string|null;unit_net_price?:number|null;line_net?:number|null};
type Recognition={document_type?:string|null;folio?:string|null;document_date?:string|null;supplier_name?:string|null;supplier_rut?:string|null;purchase_order_reference?:string|null;net_amount?:number|null;vat_amount?:number|null;total_amount?:number|null;lines?:Line[];notes?:string[];confidence?:string|null};

const loadScript=(src:string,id:string)=>new Promise<void>((resolve,reject)=>{if(document.getElementById(id)){resolve();return}const s=document.createElement("script");s.id=id;s.src=src;s.async=true;s.onload=()=>resolve();s.onerror=()=>reject(new Error("No se pudo cargar el lector gratuito"));document.head.appendChild(s)});
const num=(s?:string|null)=>{if(!s)return null;const n=Number(s.replace(/[$\s]/g,"").replace(/\./g,"").replace(",","."));return Number.isFinite(n)?n:null};
const first=(text:string,re:RegExp)=>text.match(re)?.[1]?.trim()||null;
function parseInvoice(text:string):Recognition{
 const clean=text.replace(/\r/g,"");
 const rut=first(clean,/\b(\d{1,2}\.\d{3}\.\d{3}-[\dkK])\b/)||first(clean,/\b(\d{7,8}-[\dkK])\b/);
 const folio=first(clean,/(?:folio|factura(?:\s+electr[oó]nica)?\s*(?:n[°ºo.]*)?|n[°º]\s*factura)\s*[:#-]?\s*(\d{2,12})/i);
 const oc=first(clean,/(?:orden\s+de\s+compra|o\.?c\.?)\s*[:#-]?\s*([A-Z0-9-]{3,30})/i);
 const net=num(first(clean,/(?:monto\s+)?neto\s*[:$]?\s*\$?\s*([\d.]+(?:,\d+)?)/i));
 const iva=num(first(clean,/iva(?:\s*19\s*%)?\s*[:$]?\s*\$?\s*([\d.]+(?:,\d+)?)/i));
 const total=num(first(clean,/(?:monto\s+)?total\s*[:$]?\s*\$?\s*([\d.]+(?:,\d+)?)/i));
 const dateRaw=first(clean,/(?:fecha(?:\s+emisi[oó]n)?|emisi[oó]n)\s*[:]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
 let date:string|null=dateRaw;if(dateRaw){const p=dateRaw.split(/[\/-]/);if(p.length===3)date=`${p[2].length===2?"20"+p[2]:p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`}
 const supplier=clean.split("\n").map(x=>x.trim()).find(x=>x.length>4&&x.length<90&&!/factura|rut|giro|fecha|señor|cliente|direcci[oó]n/i.test(x))||null;
 const notes:string[]=[];if(!folio)notes.push("Folio no detectado: revisar manualmente.");if(!rut)notes.push("RUT proveedor no detectado: revisar manualmente.");if(net==null)notes.push("Neto no detectado: revisar manualmente.");
 return {document_type:/factura/i.test(clean)?"Factura":/boleta/i.test(clean)?"Boleta":"Documento",folio,document_date:date,supplier_name:supplier,supplier_rut:rut,purchase_order_reference:oc,net_amount:net,vat_amount:iva,total_amount:total,lines:[],notes,confidence:folio&&rut&&net!=null?"media":"baja"};
}
async function pdfText(file:File){
 await loadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js","alemsi-pdfjs");
 const pdfjs=window.pdfjsLib;if(!pdfjs)throw new Error("No se pudo iniciar el lector PDF");pdfjs.GlobalWorkerOptions.workerSrc="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
 const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;let out="";
 for(let p=1;p<=Math.min(pdf.numPages,5);p++){const page=await pdf.getPage(p);const content=await page.getTextContent();out+=(content.items||[]).map((i:any)=>i.str).join(" ")+"\n"}return out;
}
async function imageText(file:File){
 await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js","alemsi-tesseract");
 if(!window.Tesseract)throw new Error("No se pudo iniciar OCR");const r=await window.Tesseract.recognize(file,"spa",{logger:()=>{}});return r?.data?.text||"";
}
export default function InvoiceRecognitionTest(){
 const [file,setFile]=useState<File|null>(null),[loading,setLoading]=useState(false),[message,setMessage]=useState(""),[result,setResult]=useState<Recognition|null>(null),[raw,setRaw]=useState("");
 const recognize=async()=>{if(!file){setMessage("Selecciona un PDF o una fotografía.");return}if(file.size>10*1024*1024){setMessage("Máximo 10 MB.");return}setLoading(true);setMessage("");setResult(null);setRaw("");try{const text=file.type==="application/pdf"?await pdfText(file):await imageText(file);if(!text.trim())throw new Error(file.type==="application/pdf"?"El PDF no contiene texto legible. Para un PDF escaneado, usa una foto JPG/PNG en esta primera versión.":"No se pudo leer texto de la imagen.");setRaw(text);setResult(parseInvoice(text));setMessage("Lectura terminada. Revisa los datos antes de usarlos; no se modificó inventario ni precios.")}catch(e:any){setMessage(e?.message||"No se pudo leer el documento")}finally{setLoading(false)}};
 return <section className="recognitionTest"><div className="recognitionHead"><div><h3>Lector gratuito de facturas</h3><p>Lectura local y liviana, sin API de pago, tarjeta ni cuenta externa. Solo propone datos para revisión de Finanzas.</p></div><span className="testBadge">PRUEBA GRATIS</span></div><div className="recognitionUpload"><label>Documento<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>{setFile(e.target.files?.[0]||null);setResult(null);setMessage("")}}/><small>PDF con texto, JPG, PNG o WEBP · máximo 10 MB</small></label><button type="button" onClick={recognize} disabled={loading||!file}>{loading?"Leyendo…":"Leer factura"}</button></div>{file&&<p><b>{file.name}</b> · {(file.size/1024/1024).toFixed(2)} MB</p>}{message&&<p className="note"><b>{message}</b></p>}{result&&<div className="recognitionResult"><div className="recognitionSummary"><span><small>Documento</small><b>{result.document_type} {result.folio||""}</b></span><span><small>Fecha</small><b>{result.document_date||"—"}</b></span><span><small>Proveedor</small><b>{result.supplier_name||"—"}</b><small>{result.supplier_rut||""}</small></span><span><small>OC</small><b>{result.purchase_order_reference||"No detectada"}</b></span><span><small>Neto</small><b>{money(result.net_amount)}</b></span><span><small>IVA</small><b>{money(result.vat_amount)}</b></span><span><small>Total</small><b>{money(result.total_amount)}</b></span><span><small>Confianza</small><b>{result.confidence}</b></span></div>{(result.notes||[]).length>0&&<div className="recognitionNotes"><b>Revisar</b><ul>{result.notes!.map((n,i)=><li key={i}>{n}</li>)}</ul></div>}<details><summary>Ver texto leído</summary><pre>{raw}</pre></details></div>}<style jsx>{`.recognitionTest{margin:16px 0 20px;padding:16px;border:1px solid #d8e3e8;border-radius:14px;background:#fbfdfe}.recognitionHead{display:flex;justify-content:space-between;gap:16px}.recognitionHead h3{margin:0 0 5px}.recognitionHead p{margin:0}.testBadge{font-size:12px;font-weight:800;padding:6px 9px;border:1px solid #9fc7bd;border-radius:999px;height:max-content}.recognitionUpload{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:end;margin-top:14px}.recognitionUpload label{display:flex;flex-direction:column;gap:6px;font-weight:700}.recognitionUpload small{font-weight:400;opacity:.7}.recognitionResult{margin-top:14px}.recognitionSummary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.recognitionSummary span{display:flex;flex-direction:column;padding:9px;border:1px solid #e0e8eb;border-radius:10px;background:white}.recognitionSummary small{opacity:.65}.recognitionNotes{margin-top:12px}details{margin-top:12px}pre{white-space:pre-wrap;max-height:220px;overflow:auto;background:white;padding:10px;border-radius:8px;font-size:12px}@media(max-width:850px){.recognitionSummary{grid-template-columns:1fr 1fr}.recognitionUpload{grid-template-columns:1fr}}@media(max-width:560px){.recognitionHead{display:block}.testBadge{display:inline-block;margin-top:8px}.recognitionSummary{grid-template-columns:1fr}}`}</style></section>;
}
