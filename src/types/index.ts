export type Installation = {
  id:string;
  name:string;
  city:string;
  commune:string;
  address:string;
  active:boolean;
  type?:string;
  verification?:string;
  source?:string;
  editable?:boolean;
};

export type Contract = {
  id:string;
  clientId:string;
  name:string;
  periodLabel:string;
  budget4m:number;
  startDate:string;
  endDate:string;
  active:boolean;
  region?:string;
  institution?:string;
  procurementId?:string;
  purchaseOrder?:string;
  provider?:string;
  statusLabel?:string;
  services?:string[];
  sourceUrl?:string;
  monthlyNet?:number|null;
  contractNet?:number|null;
};

export type RequestLine = { productId:string; productName:string; unitPrice:number|null; baseQty:number; remainder:number; requestedQty:number; lineTotal:number };
export type MaterialRequest = { id:string; contractId:string; installationId:string; createdAt:string; reviewed:boolean; reviewDate:string; notes:string; lines:RequestLine[]; total:number; status:"Borrador"|"Solicitada"|"Aprobada"|"Entregada"|"Parcial" };
export type AppState = { contracts:Contract[]; installations:Record<string,Installation[]>; requests:MaterialRequest[]; budgetOverrides:Record<string,number> };

export type HistoricalRecord = {
  id:string;
  region:string;
  contractId:string;
  institution:string;
  clientName:string;
  installationName:string;
  productName:string;
  quantity:number;
  sourceUnitPrice:number|null;
  unitPriceNormalized:number|null;
  priceNeedsReview:boolean;
  period:string;
  sourceSheet:string;
  sourceRow:number;
  status:string;
};
