export type InvoiceLineLike={
  description?:string|null;
  supplier_code?:string|null;
  quantity?:number|null;
  unit_net?:number|null;
  line_net?:number|null;
};

export const normalizeInvoiceText=(value:unknown)=>String(value??"")
  .trim()
  .toLocaleLowerCase("es-CL")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"")
  .replace(/[^a-z0-9]+/g," ")
  .replace(/\s+/g," ")
  .trim();

export function invoiceUnitNet(line:InvoiceLineLike){
  const quantity=Number(line.quantity||0);
  const lineNet=Number(line.line_net);
  const unitNet=Number(line.unit_net);
  if(quantity>0&&Number.isFinite(lineNet)&&lineNet>=0)return Number((lineNet/quantity).toFixed(6));
  if(Number.isFinite(unitNet)&&unitNet>=0)return unitNet;
  return 0;
}

export function invoiceLineNet(line:InvoiceLineLike){
  const lineNet=Number(line.line_net);
  if(Number.isFinite(lineNet)&&lineNet>=0)return lineNet;
  const quantity=Number(line.quantity||0),unit=invoiceUnitNet(line);
  return Number((quantity*unit).toFixed(6));
}

export function matchInvoiceLine<T extends {supplier_code?:string|null;name?:string|null;description?:string|null}>(line:InvoiceLineLike,candidates:T[]){
  const code=normalizeInvoiceText(line.supplier_code);
  if(code){
    const byCode=candidates.filter(item=>normalizeInvoiceText(item.supplier_code)===code);
    if(byCode.length===1)return{item:byCode[0],confidence:"code" as const};
  }
  const description=normalizeInvoiceText(line.description);
  if(description){
    const exact=candidates.filter(item=>normalizeInvoiceText(item.name||item.description)===description);
    if(exact.length===1)return{item:exact[0],confidence:"name" as const};
    if(description.length>=5){
      const contained=candidates.filter(item=>{
        const candidate=normalizeInvoiceText(item.name||item.description);
        return candidate.length>=5&&(candidate.includes(description)||description.includes(candidate));
      });
      if(contained.length===1)return{item:contained[0],confidence:"description" as const};
    }
  }
  return{item:null,confidence:"none" as const};
}
