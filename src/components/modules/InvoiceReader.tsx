"use client";
import {useEffect,useRef,useState} from "react";
import {invoiceUnitNet} from "@/lib/invoice-reconciliation";
import {inspectReceiptFile,type ReceiptMime} from "@/lib/receipt-file";

export type ExtractedInvoice={
 supplier_name?:string|null;supplier_rut?:string|null;document_type?:string|null;folio?:string|null;date?:string|null;
 net?:number|null;vat?:number|null;total?:number|null;payment_condition?:string|null;payment_days?:number|null;
 lines?:{description:string;supplier_code?:string|null;quantity?:number|null;unit?:string|null;unit_net?:number|null;line_net?:number|null}[];
 warnings?:string[];
};
export default function InvoiceReader({onExtract,onFile}:{onExtract:(value:ExtractedInvoice)=>void;onFile:(file:File|null)=>void}){
 const [file,setFile]=useState<File|null>(null),[mime,setMime]=useState<ReceiptMime|null>(null),[url,setUrl]=useState("");
 const [analyzing,setAnalyzing]=useState(false),[error,setError]=useState(""),[extracted,setExtracted]=useState<ExtractedInvoice|null>(null);
 const selection=useRef(0);
 useEffect(()=>{
  if(!file||!mime){setUrl("");return}
  // The File.type supplied by some browsers is empty/octet-stream for real PDFs.
  // A typed Blob fixes PDF preview without weakening server-side content validation.
  const objectUrl=URL.createObjectURL(new Blob([file],{type:mime}));
  setUrl(objectUrl);
  return()=>URL.revokeObjectURL(objectUrl);
 },[file,mime]);
 const analyze=async(target?:File|null,recognized?:ReceiptMime)=>{
  const current=target||file;if(!current)return;
  setAnalyzing(true);setError("");
  try{
   const actualMime=recognized||await inspectReceiptFile(current);
   const form=new FormData();
   form.append("file",new File([current],current.name,{type:actualMime}));
   const response=await fetch("/api/receipts/analyze",{method:"POST",body:form});
   const body=await response.json();
   if(!response.ok)throw new Error(body.error||"No se pudo analizar");
   setExtracted(body.extracted);
   onExtract(body.extracted);
  }catch(e:any){setError(e?.message||"Error de lectura de la factura")}
  finally{setAnalyzing(false)}
 };
 const chooseFile=async(next:File|null)=>{
  const currentSelection=++selection.current;
  setFile(null);setMime(null);setExtracted(null);setError("");onFile(null);
  if(!next)return;
  try{
   const recognized=await inspectReceiptFile(next);
   if(currentSelection!==selection.current)return;
   setFile(next);setMime(recognized);onFile(next);
   await analyze(next,recognized);
  }catch(e:any){
   if(currentSelection===selection.current)setError(e?.message||"No se pudo abrir la factura");
  }
 };
 return <section className="invoiceReader" style={{padding:16,border:"1px solid #c9dce4",borderRadius:12,margin:"12px 0",background:"#f8fbfc"}}>
  <h3 style={{margin:"0 0 8px"}}>Factura original y lectura asistida</h3>
  <p style={{fontSize:12,marginTop:0}}>Adjunta el PDF o imagen. El lector propone los datos y permite comparar contra la OC; la confirmación de inventario es independiente de esta lectura.</p>
  <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
   <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0]||null;void chooseFile(f);e.target.value=""}} aria-label="Adjuntar factura original"/>
   <label style={{display:"inline-flex",alignItems:"center",gap:6,cursor:"pointer",padding:"8px 10px",border:"1px solid #c9dce4",borderRadius:8,fontSize:13,position:"relative",overflow:"hidden"}}>Tomar fotografía<input type="file" accept="image/*" capture="environment" style={{position:"absolute",inset:0,opacity:0,width:"100%",height:"100%",cursor:"pointer"}} onChange={e=>{const f=e.target.files?.[0]||null;void chooseFile(f);e.target.value=""}} aria-label="Fotografiar factura con cámara"/></label>
   <button type="button" disabled={!file||analyzing} onClick={()=>void analyze()}>{analyzing?"Analizando factura…":extracted?"Releer factura":"Leer factura"}</button>
   {file&&<span style={{fontSize:12}}>{file.name} · {Math.ceil(file.size/1024)} KB</span>}
  </div>
  {url&&(mime==="application/pdf"?<div style={{marginTop:12}}><iframe src={url} title="Vista previa de la factura PDF" style={{width:"100%",height:340,border:"1px solid #d9e6ee",borderRadius:8}}/><a href={url} target="_blank" rel="noopener noreferrer">Abrir PDF original en otra pestaña</a></div>:<img src={url} alt="Vista previa de la factura original" style={{maxWidth:"100%",maxHeight:340,objectFit:"contain",marginTop:12}}/>)}
  {error&&<p className="warning" role="alert">{error}</p>}
  {extracted&&<div style={{marginTop:12}}>
   <b>Lectura propuesta · Revisión humana obligatoria</b>
   <p style={{fontSize:12}}>Proveedor: {extracted.supplier_name||"Sin identificar"} · RUT: {extracted.supplier_rut||"Sin identificar"} · Folio: {extracted.folio||"—"}</p>
   <div style={{overflowX:"auto"}}><table style={{minWidth:580,width:"100%",fontSize:12}}><thead><tr><th>Producto leído en la factura</th><th>Cantidad</th><th>Neto línea</th><th>Neto unitario calculado</th></tr></thead><tbody>
    {(extracted.lines||[]).map((line,i)=><tr key={i}><td>{line.description}</td><td>{line.quantity??"—"}</td><td>{line.line_net??"—"}</td><td>{invoiceUnitNet(line)||"—"}</td></tr>)}
   </tbody></table></div>
   {!!extracted.warnings?.length&&<p className="warning">{extracted.warnings.join(" · ")}</p>}
  </div>}
 </section>;
}
