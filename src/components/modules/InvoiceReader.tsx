"use client";
import {useEffect,useState} from "react";
import {invoiceUnitNet} from "@/lib/invoice-reconciliation";

export type ExtractedInvoice={
 supplier_name?:string|null;supplier_rut?:string|null;document_type?:string|null;folio?:string|null;date?:string|null;
 net?:number|null;vat?:number|null;total?:number|null;payment_condition?:string|null;payment_days?:number|null;
 lines?:{description:string;supplier_code?:string|null;quantity?:number|null;unit?:string|null;unit_net?:number|null;line_net?:number|null}[];
 warnings?:string[];
};
export default function InvoiceReader({onExtract,onFile}:{onExtract:(value:ExtractedInvoice)=>void;onFile:(file:File|null)=>void}){
 const [file,setFile]=useState<File|null>(null),[url,setUrl]=useState(""),[analyzing,setAnalyzing]=useState(false),[error,setError]=useState(""),[extracted,setExtracted]=useState<ExtractedInvoice|null>(null);
 useEffect(()=>{if(!file){setUrl("");return;}const u=URL.createObjectURL(file);setUrl(u);return()=>URL.revokeObjectURL(u);},[file]);
 const analyze=async(target?:File|null)=>{const current=target||file;if(!current)return;setAnalyzing(true);setError("");
  try{const form=new FormData();form.append("file",current);const response=await fetch("/api/receipts/analyze",{method:"POST",body:form});const body=await response.json();if(!response.ok)throw new Error(body.error||"No se pudo analizar");setExtracted(body.extracted);onExtract(body.extracted)}
  catch(e:any){setError(e?.message||"Error de lectura")}finally{setAnalyzing(false)}
 };
 return <section className="invoiceReader" style={{padding:16,border:"1px solid #c9dce4",borderRadius:12,margin:"12px 0",background:"#f8fbfc"}}>
  <h3 style={{margin:"0 0 8px"}}>Factura original y lectura Gemini</h3>
  <p style={{fontSize:12,marginTop:0}}>Adjunta el PDF o imagen. Gemini propone los datos, pero debes verificar proveedor, productos y montos. No genera movimientos de inventario.</p>
  <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
   <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0]||null;setFile(f);onFile(f);setExtracted(null);setError("");if(f)void analyze(f)}} aria-label="Adjuntar factura original"/>
   <button type="button" disabled={!file||analyzing} onClick={()=>void analyze()}>{analyzing?"Analizando factura…":extracted?"Releer factura":"Leer factura"}</button>
   {file&&<span style={{fontSize:12}}>{file.name}</span>}
  </div>
  {url&&(file?.type==="application/pdf"?<iframe src={url} title="Vista previa factura original" style={{width:"100%",height:340,marginTop:12,border:"1px solid #d9e6ee",borderRadius:8}}/>:<img src={url} alt="Vista previa de la factura original" style={{maxWidth:"100%",maxHeight:340,objectFit:"contain",marginTop:12}}/>)}
  {error&&<p className="warning">{error}</p>}
  {extracted&&<div style={{marginTop:12}}>
   <b>Propuesta de Gemini · Revisión humana obligatoria</b>
   <p style={{fontSize:12}}>Proveedor: {extracted.supplier_name||"Sin identificar"} · RUT: {extracted.supplier_rut||"Sin identificar"} · Folio: {extracted.folio||"—"}</p>
   <div style={{overflowX:"auto"}}><table style={{minWidth:580,width:"100%",fontSize:12}}><thead><tr><th>Producto leído en la factura</th><th>Cantidad</th><th>Neto línea</th><th>Neto unitario calculado</th></tr></thead><tbody>
    {(extracted.lines||[]).map((line,i)=><tr key={i}><td>{line.description}</td><td>{line.quantity??"—"}</td><td>{line.line_net??"—"}</td><td>{invoiceUnitNet(line)||"—"}</td></tr>)}
   </tbody></table></div>
   {!!extracted.warnings?.length&&<p className="warning">{extracted.warnings.join(" · ")}</p>}
  </div>}
 </section>;
}
