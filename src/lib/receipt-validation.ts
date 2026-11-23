export type ReceiptDraftLine = {material_id:string; purchase_order_line_id?:string|null; received_qty:number; actual_unit_net:number;difference_note?:string};

/** Same contract for manual entry and OCR drafts; recognition never confirms stock. */
export function validateReceiptDraft(input:{documentType:string;folio:string;date:string;net:number;vat:number;total:number;lines:unknown;withOrder:boolean;reason?:string;shipping?:string;freight?:number}) {
 const {documentType,folio,date,net,vat,total,lines,withOrder}=input;
 if(!['Factura','Boleta','Guía de despacho','Otro'].includes(documentType)||!folio.trim()||folio.trim().length>100)throw new Error('Tipo de documento o folio inválido');
 const parsed=new Date(date+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw new Error('Fecha del documento inválida');
 if(![net,vat,total,input.freight??0].every(n=>Number.isFinite(n)&&n>=0))throw new Error('Importes inválidos');
 if(Math.abs(net+vat-total)>1)throw new Error('Neto + IVA no coincide con el total del documento');
 if(!withOrder&&(input.reason||'').trim().length<8)throw new Error('Justifica la compra sin OC con al menos 8 caracteres');
 if(input.shipping&&!['Incluido','Por pagar','Retiro'].includes(input.shipping))throw new Error('Condición de flete inválida');
 if(input.shipping==='Por pagar'&&!(Number(input.freight)>0))throw new Error('Ingresa el flete neto por pagar');
 if(!Array.isArray(lines)||!lines.length||lines.length>500)throw new Error('Agrega entre 1 y 500 productos recibidos');
 const seen=new Set<string>();let sum=0;
 for(const line of lines){
  if(!line||typeof line!=='object')throw new Error('Producto recibido inválido');
  const key=withOrder&&line.purchase_order_line_id?line.purchase_order_line_id:line.material_id;
  if(typeof line.material_id!=='string'||!line.material_id.trim()||typeof key!=='string'||!key.trim()||seen.has((withOrder&&!line.purchase_order_line_id?'extra:':'')+key))throw new Error('Producto o línea de OC inválida o duplicada');
  if(typeof line.received_qty!=='number'||!Number.isFinite(line.received_qty)||line.received_qty<=0||typeof line.actual_unit_net!=='number'||!Number.isFinite(line.actual_unit_net)||line.actual_unit_net<0)throw new Error('Cantidad o precio inválido');
  if(withOrder&&!line.purchase_order_line_id&&String(line.difference_note||'').trim().length<8)throw new Error('El material adicional requiere explicación');
  seen.add((withOrder&&!line.purchase_order_line_id?'extra:':'')+key);sum+=line.received_qty*line.actual_unit_net;
 }
 // With OC, a partial physical receipt may differ from the invoice; cotejo records it.
 if(!Number.isFinite(sum)||Math.abs(sum-net)>1)throw new Error('El neto de las líneas no coincide con el neto del documento');
 return lines as ReceiptDraftLine[];
}

export function parseReceiptLines(value:FormDataEntryValue|null):unknown {
 try{return JSON.parse(String(value||'[]'));}catch{throw new Error('Productos recibidos inválidos');}
}
