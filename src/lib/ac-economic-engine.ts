/** Motor económico opcional ALEMSI. Solo cálculos puros; no realiza escrituras. */
export type Month = string; // YYYY-MM
export type CurveMode="fija"|"variable"|"remanente";
export type BudgetMonth={month:Month;netCLP:number};
export type MaterialNeed={maxQty:number;physicalQty:number;consolidatedShortage:number;availableStock:number;weightedCost:number|null;lastInvoiceUnitNet:number|null};
export type CampaignValuation={theoretical:number|null;shortage:number|null;purchaseRequired:number|null;incomplete:string[]};
export type Allocation={month:Month;netCLP:number};
const cents=(n:number)=>Math.round(n*100);
function valid(n:number){if(!Number.isFinite(n)||n<0)throw new Error("Monto o cantidad inválida");return n;}
function parseMonth(s:string){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(s))throw new Error("Mes inválido: YYYY-MM");return Number(s.slice(0,4))*12+Number(s.slice(5,7))-1;}
export function monthPlus(month:Month,n:number):Month{
 const idx=parseMonth(month);if(!Number.isSafeInteger(n))throw new Error("Desplazamiento inválido");
 const target=idx+n;const year=Math.floor(target/12),m=target-year*12+1;
 return String(year).padStart(4,"0")+"-"+String(m).padStart(2,"0");
}
export function monthRange(from:Month,to:Month):Month[]{
 const a=parseMonth(from),b=parseMonth(to);if(b<a||b-a>119)throw new Error("Rango de meses inválido");
 return Array.from({length:b-a+1},(_,i)=>monthPlus(from,i));
}
export function buildBudgetCurve(input:{mode:CurveMode;start:Month;end:Month;fixedCLP?:number;values?:number[];existing?:readonly BudgetMonth[];todayMonth?:Month}):BudgetMonth[]{
 const months=monthRange(input.start,input.end);
 const existing=new Map((input.existing||[]).map(x=>[x.month,valid(x.netCLP)]));
 const active=input.mode==="remanente"&&input.todayMonth?months.filter(m=>m>=input.todayMonth!):months;
 if(input.mode==="variable"&&input.values?.length!==months.length)throw new Error("Cantidad mensual incompleta");
 if(input.mode==="remanente"&&input.values&&input.values.length!==active.length)throw new Error("Remanente incompleto");
 return months.flatMap((month,i)=>{
  if(input.mode==="remanente"&&input.todayMonth&&month<input.todayMonth)return [];
  const value=input.mode==="fija"?input.fixedCLP:
   input.mode==="variable"?input.values![i]:
   input.values?input.values[active.indexOf(month)]:input.fixedCLP;
  if(value===undefined)throw new Error("Falta monto mensual");
  if(input.mode==="remanente"&&existing.has(month))throw new Error("El mes futuro ya tiene presupuesto: "+month);
  return [{month,netCLP:Math.round(valid(value)*100)/100}];
 });
}
export function pasteExcelCurve(text:string):number[]{
 const row=text.trim().split(/\r?\n/).filter(Boolean);
 if(row.length!==1)throw new Error("Pega una sola fila de Excel");
 const values=row[0].split(/\t|;/).map(x=>x.trim());
 if(values.some(x=>!x))throw new Error("Celda de presupuesto vacía");
 return values.map(x=>{
  const normalized=x.replace(/[$\s]/g,"").replace(/\./g,"").replace(",",".");
  const n=Number(normalized);
  return valid(n);
 });
}
export function campaignBaseBudget(rows:readonly BudgetMonth[],start:Month,end:Month):number|null{
 const months=monthRange(start,end),lookup=new Map(rows.map(x=>[x.month,valid(x.netCLP)]));
 if(months.some(m=>!lookup.has(m)))return null;
 return months.reduce((sum,m)=>sum+lookup.get(m)!,0);
}
export function valueCampaign(rows:readonly MaterialNeed[]):CampaignValuation{
 let theoretical=0,shortage=0,purchaseRequired=0;const incomplete:string[]=[];
 for(const [index,row] of rows.entries()){
  const max=valid(row.maxQty),physical=valid(row.physicalQty),short=valid(row.consolidatedShortage),stock=valid(row.availableStock);
  if(row.weightedCost===null){incomplete.push("CPP faltante en línea "+(index+1));}else{
   theoretical+=max*valid(row.weightedCost);shortage+=Math.max(0,max-physical)*valid(row.weightedCost);
  }
  if(row.lastInvoiceUnitNet===null)incomplete.push("Precio factura faltante en línea "+(index+1));
  else purchaseRequired+=Math.max(0,short-stock)*valid(row.lastInvoiceUnitNet);
 }
 return {theoretical:incomplete.some(x=>x.includes("CPP"))?null:theoretical,
  shortage:incomplete.some(x=>x.includes("CPP"))?null:shortage,
  purchaseRequired:incomplete.some(x=>x.includes("factura"))?null:purchaseRequired,incomplete};
}
export function allocateGuide(netCLP:number,curve:readonly BudgetMonth[],mode:"campana"|"extra",issuanceMonth?:Month):Allocation[]{
 valid(netCLP);
 if(mode==="extra"){if(!issuanceMonth)throw new Error("Falta mes de emisión");parseMonth(issuanceMonth);return [{month:issuanceMonth,netCLP}];}
 if(!curve.length)throw new Error("Curva de campaña incompleta");
 const sorted=[...curve].sort((a,b)=>a.month.localeCompare(b.month));
 const seen=new Set<string>();let sum=0;
 for(const p of sorted){parseMonth(p.month);if(seen.has(p.month))throw new Error("Mes duplicado");seen.add(p.month);sum+=valid(p.netCLP);}
 if(sum<=0)throw new Error("Sin base presupuestaria para ponderación");
 let rest=cents(netCLP);
 return sorted.map((p,i)=>{const amount=i===sorted.length-1?rest:Math.round(cents(netCLP)*p.netCLP/sum);rest-=amount;return {month:p.month,netCLP:amount/100};});
}
export function nextCycle(fromMonth:Month,frequencyMonths:number){if(!Number.isSafeInteger(frequencyMonths)||frequencyMonths<1||frequencyMonths>24)throw new Error("Frecuencia inválida");return monthPlus(fromMonth,frequencyMonths);}
