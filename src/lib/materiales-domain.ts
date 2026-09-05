export type Role = "Supervisora" | "Gerencia" | "Finanzas" | "Bodega" | "Admin" | "Admin Total";

export type Product = {
  id:string; name:string; price:number; presentation?:string; code?:string; active:boolean;
};

export type Installation = {
  id:string; name:string; city:string; commune:string; address:string; active?:boolean;
  type?:string; logisticsMode?:"Normal"|"Evaluar"|"Remota";
};

export type ClientProfile = {
  id:string; region:string; institution:string; clientName:string; installations:Installation[];
};

export type ContractMaterial = {
  profileId:string; installationId?:string; productId:string; authorizedQty:number;
  authorized:boolean; budgetNet?:number;
};

export type SurveyLine = {
  productId:string; productName:string; unitPrice:number; authorizedQty:number;
  remainder:number; shortage:number; lineNet:number;
};

export type Survey = {
  id:string; campaignId:string; profileId:string; installationId:string; installationName:string;
  supervisor:string; date:string; status:"Borrador"|"Confirmado";
  remoteCandidate:boolean; logisticsNote:string; lines:SurveyLine[]; shortageNet:number;
};

export type Campaign = {
  id:string; profileId:string; label:string; createdAt:string; status:"Abierta"|"Cerrada";
  expectedInstallationIds:string[]; closedAt?:string;
};

export type ConsolidatedLine = {
  productId:string; productName:string; qty:number; net:number;
  origins:Array<{installationId:string; installationName:string; qty:number}>;
};

export type SupplyLine = ConsolidatedLine & {
  supplier:string; approvedQty:number; approvedNet:number;
};

export type SupplyRun = {
  id:string; profileId:string; campaignId:string; createdAt:string;
  contractLimitNet:number; consolidatedNet:number; approvedNet:number;
  lines:SupplyLine[]; status:"Borrador"|"Aprobado Gerencia"|"OC generadas";
};

export type PurchaseOrder = {
  id:string; supplyRunId:string; supplier:string; totalNet:number; receivedNet:number;
  status:"Emitida"|"Recepción parcial"|"Recibida";
};

export type Receipt = {
  id:string; purchaseOrderId:string; supplier:string; invoiceNumber:string; invoiceDate:string;
  netAmount:number; receivedAt:string;
};

export type LocalPurchase = {
  id:string; surveyId:string; profileId:string; installationId:string; installationName:string;
  shortageNet:number; reason:string; requestedBy:string;
  status:"Solicitada"|"Aprobada Gerencia"|"En Finanzas"|"Transferida"|"Comprobante cargado"|"Cerrada";
  maxAuthorized:number; mode:"Anticipo"|"Contra boleta"; actualNet:number;
};

export type DispatchLine = {
  productId:string; productName:string; required:number; delivered:number;
};

export type Dispatch = {
  id:string; profileId:string; installationId:string; installationName:string;
  lines:DispatchLine[]; status:"Pendiente"|"Parcial"|"Cerrada";
};

export type KitItem = {
  id:string; profileId:string; installationId:string; name:string; qty:number;
  policy:"Inicial"|"Desgaste"|"Justificada"; status:"Activo"|"Recuperado"|"Deteriorado"|"Baja";
};

export type MaterialState = {
  role:Role; selectedProfileId:string; contractMaterials:ContractMaterial[]; campaigns:Campaign[];
  surveys:Survey[]; supplyRuns:SupplyRun[]; purchaseOrders:PurchaseOrder[]; receipts:Receipt[];
  localPurchases:LocalPurchase[]; dispatches:Dispatch[]; kits:KitItem[]; limits:Record<string,number>;
  suppliers:string[];
};
