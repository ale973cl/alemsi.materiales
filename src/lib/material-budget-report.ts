export type BudgetContract={id:string;clientId:string;clientName:string;name:string;netBudget:number|null};
export type BudgetMovement={id:string;contractId:string;month:string;amount:number;reference:string};
export type BudgetReport={contracts:BudgetContract[];movements:BudgetMovement[];unattributedNet:number;unattributedLines:number;errors:string[];loadedCount:number};
type BudgetSource={contracts:any[];receipts:any[];lines:any[];purchaseLines:any[];supplyLines:any[];runs:any[]};
const value=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)&&n>=0?n:null};
export function buildBudgetReport(src:BudgetSource):BudgetReport{
 const contracts:BudgetContract[]=src.contracts.map(c=>({id:String(c.id),clientId:String(c.client_id),clientName:String(c.clients?.legal_name||"Cliente sin nombre"),name:String(c.name||"Contrato sin nombre"),netBudget:c.net_budget===null?null:value(c.net_budget)}));
 const contractIds=new Set(contracts.map(c=>c.id));
 const receipts=new Map(src.receipts.filter(r=>r.inventory_posted===true).map(r=>[r.id,r]));
 const purchaseLines=new Map(src.purchaseLines.map(x=>[x.id,x]));
 const supplyLines=new Map(src.supplyLines.map(x=>[x.id,x]));
 const runs=new Map(src.runs.map(x=>[x.id,x]));
 const movements:BudgetMovement[]=[];let unattributedNet=0,unattributedLines=0;
 for(const line of src.lines){
  const receipt:any=receipts.get(line.receipt_id);
  if(!receipt)continue;
  const amount=value(line.line_net);
  if(amount===null)continue;
  const po:any=purchaseLines.get(line.purchase_order_line_id);
  const supply:any=po?supplyLines.get(po.supply_line_id):null;
  const run:any=supply?runs.get(supply.supply_run_id):null;
  const contractId=String(run?.contract_id||"");
  const date=String(receipt.invoice_date||receipt.document_date||receipt.received_at||receipt.created_at||"");
  const month=/^\d{4}-\d{2}/.test(date)?date.slice(0,7):"Sin fecha";
  if(!contractIds.has(contractId)||month==="Sin fecha"){unattributedNet+=amount;unattributedLines++;continue}
  movements.push({id:String(line.id),contractId,month,amount,reference:String(receipt.document_folio||receipt.invoice_number||receipt.id)});
 }
 return {contracts,movements,unattributedNet,unattributedLines,errors:[],loadedCount:movements.length};
}
export function totalsByContract(report:BudgetReport,month:string,clientId:string,contractId:string){
 const contracts=report.contracts.filter(c=>(!clientId||c.clientId===clientId)&&(!contractId||c.id===contractId));
 return contracts.map(c=>({...c,spent:report.movements.filter(m=>m.contractId===c.id&&(!month||m.month===month)).reduce((s,m)=>s+m.amount,0)}));
}
