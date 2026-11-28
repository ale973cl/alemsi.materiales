import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {calculatePayable} from "@/lib/ac-invoice-credit";
import {santiagoDate} from "@/lib/central-calendar";
const roles=["Admin Total","Gerencia","Finanzas","Admin"];
const uid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function ctx(){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return {db,ok:false};
 const {data:profile}=await db.from("user_profiles").select("role,active").eq("id",user.id).single();
 return {db,ok:Boolean(profile?.active&&roles.includes(profile.role))};
}
const validDate=(value:unknown)=>{if(value==null||value==="")return null;const s=String(value);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||new Date(s+"T00:00:00Z").toISOString().slice(0,10)!==s)throw Error("Fecha inválida");return s};
export async function GET(){
 const c=await ctx();if(!c.ok)return NextResponse.json({error:"Sin permisos"},{status:403});
 const [rr,cr,pa]=await Promise.all([
  c.db.from("receipts").select("id,document_type,document_folio,document_date,document_total,invoice_date,invoice_number,suppliers(legal_name,payment_terms)").order("created_at",{ascending:false}).limit(501),
  c.db.from("ac_factura_credito").select("factura_id,condicion_pago,dias_credito,fecha_emision,fecha_recepcion_sii,fecha_vencimiento,fecha_limite_reclamo").limit(501),
  c.db.from("ac_factura_pagos").select("factura_id,monto_clp,acreditado,fecha_pago,referencia").limit(1001)
 ]);
 if(cr.error&&/does not exist|schema cache/i.test(cr.error.message))return NextResponse.json({available:false,reason:"Módulo de crédito pendiente de habilitación"});
 if(rr.error||cr.error||pa.error||rr.data?.length===501||cr.data?.length===501||pa.data?.length===1001)
  return NextResponse.json({error:"Consulta de facturas incompleta o no autorizada"},{status:503});
 const today=santiagoDate(),settings=new Map((cr.data||[]).map(x=>[x.factura_id,x])),payments=new Map<string,number>();
 for(const p of pa.data||[])if(p.acreditado)payments.set(p.factura_id,(payments.get(p.factura_id)||0)+Number(p.monto_clp||0));
 const rows=(rr.data||[]).filter(r=>String(r.document_type||"Factura").toLowerCase().includes("factura")).map(r=>{
  const c:any=settings.get(r.id),paid=payments.get(r.id)||0;
  const payable=calculatePayable({paymentTerms:c?.condicion_pago||"Crédito",creditDays:c?.dias_credito||30,
   siiReceiptDate:c?.fecha_recepcion_sii||null,today,totalCLP:Number(r.document_total||0),accreditedCLP:paid});
  const supplier:any=Array.isArray(r.suppliers)?r.suppliers[0]:r.suppliers;
  return {id:r.id,folio:r.document_folio||r.invoice_number||r.id,supplier:supplier?.legal_name||"Proveedor",supplierTerms:supplier?.payment_terms||"",
   issueDate:c?.fecha_emision||r.document_date||r.invoice_date||null,
   siiReceiptDate:c?.fecha_recepcion_sii||null,
   paymentTerms:c?.condicion_pago||"Crédito",creditDays:c?.dias_credito??30,
   totalCLP:Number(r.document_total||0),paidCLP:paid,configured:Boolean(c),...payable};
 });
 return NextResponse.json({available:true,rows});
}
export async function POST(req:NextRequest){
 const c=await ctx();if(!c.ok)return NextResponse.json({error:"Sin permisos"},{status:403});
 let b:any;try{b=await req.json()}catch{return NextResponse.json({error:"Solicitud inválida"},{status:400})}
 const receiptId=String(b.receiptId||"");
 if(!uid.test(receiptId))return NextResponse.json({error:"Factura inválida"},{status:400});
 const {data:receipt,error:re}=await c.db.from("receipts").select("id,document_total,document_date,document_type").eq("id",receiptId).single();
 if(re||!receipt||!String(receipt.document_type).toLowerCase().includes("factura"))return NextResponse.json({error:"Factura no disponible"},{status:404});
 try{
  if(b.action==="terms"){
   const terms=String(b.paymentTerms||"");
   if(!["Contado","Crédito","Sin Costo"].includes(terms))throw Error("Condición de pago inválida");
   const creditDays=Number(b.creditDays??30);
   if(!Number.isInteger(creditDays)||creditDays<0||creditDays>3650)throw Error("Días de crédito inválidos");
   const sii=validDate(b.siiReceiptDate),issue=validDate(b.issueDate)||receipt.document_date;
   const {error}=await c.db.from("ac_factura_credito").upsert({
    factura_id:receiptId,condicion_pago:terms,dias_credito:creditDays,fecha_emision:issue,fecha_recepcion_sii:sii,actualizado_en:new Date().toISOString()
   },{onConflict:"factura_id"});
   if(error)throw error;
   return NextResponse.json({ok:true,message:"Condiciones y vencimientos guardados"});
  }
  if(b.action==="payment"){
   const amount=Number(b.amount),reference=String(b.reference||"").trim(),date=validDate(b.date);
   if(!Number.isFinite(amount)||amount<=0||!reference||!date)throw Error("Completa monto, fecha y comprobante");
   const {error}=await c.db.from("ac_factura_pagos").insert({factura_id:receiptId,monto_clp:amount,fecha_pago:date,referencia,acreditado:true});
   if(error)throw error;
   return NextResponse.json({ok:true,message:"Pago acreditado registrado"});
  }
  throw Error("Acción no reconocida");
 }catch(e:any){return NextResponse.json({error:e?.message||"No se pudo guardar"},{status:400})}
}
