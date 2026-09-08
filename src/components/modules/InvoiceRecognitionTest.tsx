"use client";

import {useState} from "react";

const money=(value:number|null|undefined)=>value==null?"—":new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(Number(value)||0);

type RecognizedLine={
  supplier_code?:string|null;
  description?:string|null;
  quantity?:number|null;
  unit?:string|null;
  unit_net_price?:number|null;
  line_net?:number|null;
};

type Recognition={
  document_type?:string|null;
  folio?:string|null;
  document_date?:string|null;
  supplier_name?:string|null;
  supplier_rut?:string|null;
  buyer_name?:string|null;
  buyer_rut?:string|null;
  purchase_order_reference?:string|null;
  net_amount?:number|null;
  vat_amount?:number|null;
  total_amount?:number|null;
  currency?:string|null;
  lines?:RecognizedLine[];
  notes?:string[];
  confidence?:string|null;
};

export default function InvoiceRecognitionTest(){
  const [file,setFile]=useState<File|null>(null);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [result,setResult]=useState<Recognition|null>(null);
  const [model,setModel]=useState("");

  const recognize=async()=>{
    if(!file){setMessage("Selecciona un PDF o una fotografía de factura.");return}
    setLoading(true);setMessage("");setResult(null);setModel("");
    const body=new FormData();body.set("file",file);
    try{
      const response=await fetch("/api/finance/recognize-invoice",{method:"POST",body});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||"No se pudo reconocer el documento");
      setResult(payload.data||null);setModel(payload.model||"");
      setMessage("Documento reconocido. Esta prueba no guardó ni modificó datos del sistema.");
    }catch(error:any){
      setMessage(error?.message||"No se pudo reconocer el documento");
    }finally{setLoading(false)}
  };

  return <section className="recognitionTest">
    <div className="recognitionHead">
      <div><h3>Prueba de reconocimiento de factura</h3><p>Sube un PDF o una foto tomada con el celular. El modelo solo lee y propone datos; no registra factura, no actualiza inventario y no cambia precios.</p></div>
      <span className="testBadge">PRUEBA AISLADA</span>
    </div>
    <div className="recognitionUpload">
      <label>Documento
        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>{setFile(e.target.files?.[0]||null);setResult(null);setMessage("")}}/>
        <small>PDF, JPG, PNG o WEBP · máximo 10 MB</small>
      </label>
      <button type="button" onClick={recognize} disabled={loading||!file}>{loading?"Reconociendo…":"Reconocer documento"}</button>
    </div>
    {file&&<p className="fileInfo"><b>{file.name}</b> · {(file.size/1024/1024).toFixed(2)} MB</p>}
    {message&&<p className="note"><b>{message}</b></p>}
    {result&&<div className="recognitionResult">
      <div className="recognitionSummary">
        <span><small>Documento</small><b>{result.document_type||"—"} {result.folio||""}</b></span>
        <span><small>Fecha</small><b>{result.document_date||"—"}</b></span>
        <span><small>Proveedor</small><b>{result.supplier_name||"—"}</b><small>{result.supplier_rut||""}</small></span>
        <span><small>Referencia OC</small><b>{result.purchase_order_reference||"No detectada"}</b></span>
        <span><small>Neto</small><b>{money(result.net_amount)}</b></span>
        <span><small>IVA</small><b>{money(result.vat_amount)}</b></span>
        <span><small>Total</small><b>{money(result.total_amount)}</b></span>
        <span><small>Confianza</small><b>{result.confidence||"—"}</b></span>
      </div>
      <h4>Ítems reconocidos</h4>
      <div className="recognizedTable">
        <div className="recognizedRow header"><span>Código</span><span>Descripción</span><span>Cant.</span><span>Unidad</span><span>Neto unit.</span><span>Neto línea</span></div>
        {(result.lines||[]).length?(result.lines||[]).map((line,index)=><div className="recognizedRow" key={index}><span>{line.supplier_code||"—"}</span><span><b>{line.description||"—"}</b></span><span>{line.quantity??"—"}</span><span>{line.unit||"—"}</span><span>{money(line.unit_net_price)}</span><span>{money(line.line_net)}</span></div>):<div className="empty"><b>No se reconocieron líneas de producto</b></div>}
      </div>
      {(result.notes||[]).length>0&&<div className="recognitionNotes"><b>Observaciones detectadas</b><ul>{result.notes!.map((note,index)=><li key={index}>{note}</li>)}</ul></div>}
      {model&&<p className="modelNote">Modelo de prueba: {model}</p>}
    </div>}
    <style jsx>{`
      .recognitionTest{margin:16px 0 20px;padding:16px;border:1px solid #d8e3e8;border-radius:14px;background:#fbfdfe}.recognitionHead{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.recognitionHead h3{margin:0 0 5px}.recognitionHead p{margin:0;max-width:850px}.testBadge{font-size:12px;font-weight:800;padding:6px 9px;border-radius:999px;border:1px solid #9fc7bd;white-space:nowrap}.recognitionUpload{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:end;margin-top:14px}.recognitionUpload label{display:flex;flex-direction:column;gap:6px;font-weight:700}.recognitionUpload small{font-weight:400;opacity:.7}.fileInfo{margin:8px 0}.recognitionResult{margin-top:16px}.recognitionSummary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.recognitionSummary span{display:flex;flex-direction:column;padding:9px;border:1px solid #e0e8eb;border-radius:10px;background:white}.recognitionSummary small{opacity:.65}.recognizedTable{overflow:auto;border:1px solid #dfe6ea;border-radius:12px;background:white}.recognizedRow{display:grid;grid-template-columns:120px minmax(260px,2fr) 80px 90px 120px 120px;gap:10px;align-items:center;padding:9px 11px;border-bottom:1px solid #edf1f2;min-width:860px}.recognizedRow:last-child{border-bottom:0}.recognizedRow.header{font-weight:800;background:#f4f7f8}.recognitionNotes{margin-top:12px}.recognitionNotes ul{margin:6px 0 0;padding-left:20px}.modelNote{font-size:12px;opacity:.65;margin:10px 0 0}@media(max-width:850px){.recognitionSummary{grid-template-columns:1fr 1fr}.recognitionUpload{grid-template-columns:1fr}}@media(max-width:560px){.recognitionHead{display:block}.testBadge{display:inline-block;margin-top:8px}.recognitionSummary{grid-template-columns:1fr}}
    `}</style>
  </section>;
}
