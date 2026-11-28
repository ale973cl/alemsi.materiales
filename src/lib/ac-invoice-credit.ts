/** Cálculo de días corridos sin depender de huso horario ni hora local. */
export type PaymentTerms="Contado"|"Crédito"|"Sin Costo";
export type PayableState="Pagada"|"Vencida"|"Por Vencer"|"Al Día"|"Sin fecha SII"|"No aplica";
export type PayableResult={dueDate:string|null;claimDeadline:string|null;remainingDays:number|null;lateDays:number;state:PayableState;outstandingCLP:number};
function dateNum(day:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error("Fecha no válida");const stamp=Date.parse(day+"T00:00:00Z");if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==day)throw new Error("Fecha inexistente");return Math.round(stamp/86400000);}
function fromNum(day:number){return new Date(day*86400000).toISOString().slice(0,10);}
export function calculatePayable(input:{paymentTerms:PaymentTerms;creditDays?:number;siiReceiptDate:string|null;today:string;totalCLP:number;accreditedCLP:number;warningDays?:number}):PayableResult{
 const {paymentTerms,siiReceiptDate,today,totalCLP,accreditedCLP}=input;const total=Number(totalCLP),paid=Number(accreditedCLP);
 if(!Number.isFinite(total)||total<0||!Number.isFinite(paid)||paid<0||paid>total)throw new Error("Saldo de factura inválido");
 const outstanding=total-paid;
 const warning=input.warningDays??5,days=input.creditDays??30;
 if(!Number.isSafeInteger(days)||days<0||days>3650||!Number.isSafeInteger(warning)||warning<0)throw new Error("Plazo de crédito inválido");
 const base=siiReceiptDate?dateNum(siiReceiptDate):null;const now=dateNum(today);
 const due=base===null?null:fromNum(base+days);
 const claim=base===null?null:fromNum(base+8);
 if(outstanding===0)return {dueDate:due,claimDeadline:claim,remainingDays:due?dateNum(due)-now:null,lateDays:0,state:"Pagada",outstandingCLP:0};
 if(paymentTerms==="Sin Costo")return {dueDate:null,claimDeadline:claim,remainingDays:null,lateDays:0,state:"No aplica",outstandingCLP:outstanding};
 if(paymentTerms==="Contado")return {dueDate:base===null?null:fromNum(base),claimDeadline:claim,remainingDays:base===null?null:base-now,lateDays:base===null?0:Math.max(0,now-base),state:base===null?"Sin fecha SII":now>base?"Vencida":now===base?"Por Vencer":"Al Día",outstandingCLP:outstanding};
 if(base===null)return {dueDate:null,claimDeadline:null,remainingDays:null,lateDays:0,state:"Sin fecha SII",outstandingCLP:outstanding};
 const remaining=base+days-now;
 return {dueDate:due,claimDeadline:claim,remainingDays:remaining,lateDays:Math.max(0,-remaining),state:remaining<0?"Vencida":remaining<=warning?"Por Vencer":"Al Día",outstandingCLP:outstanding};
}
