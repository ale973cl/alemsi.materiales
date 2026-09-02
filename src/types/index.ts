export type Installation = { id:string; name:string; city:string; commune:string; address:string; active:boolean };
export type Contract = { id:string; clientId:string; name:string; periodLabel:string; budget4m:number; startDate:string; endDate:string; active:boolean };
export type RequestLine = { productId:string; productName:string; unitPrice:number|null; baseQty:number; remainder:number; requestedQty:number; lineTotal:number };
export type MaterialRequest = { id:string; contractId:string; installationId:string; createdAt:string; reviewed:boolean; reviewDate:string; notes:string; lines:RequestLine[]; total:number; status:"Borrador"|"Solicitada"|"Aprobada"|"Entregada"|"Parcial" };
export type AppState = { contracts:Contract[]; installations:Record<string,Installation[]>; requests:MaterialRequest[]; budgetOverrides:Record<string,number> };
