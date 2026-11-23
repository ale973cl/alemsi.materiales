/** Explicit opt-in after migration verification. Production cannot enable this pilot. */
export function receiptTransactionsEnabled(env:Record<string,string|undefined>=process.env):boolean {
 if(env.ALEMSI_RECEIPT_V2!=='1')return false;
 if(env.VERCEL_ENV==='production')throw new Error('El piloto de recepción V2 solo está permitido en Preview y pruebas');
 if(env.VERCEL_ENV && !['preview','development'].includes(env.VERCEL_ENV))throw new Error('Entorno de recepción V2 no reconocido');
 return true;
}

/** Confirm invoice and stock only against an explicitly identified isolated test database.
 * Never rely on VERCEL_ENV alone: Preview may still point to the shared database.
 */
export type ReceiptConfirmationStatus={enabled:boolean;reason:string};
export function receiptConfirmationStatus(env:Record<string,string|undefined>=process.env):ReceiptConfirmationStatus {
 const locked=(reason:string):ReceiptConfirmationStatus=>({enabled:false,reason});
 if(env.VERCEL_ENV==='production')return locked("La confirmación de recepciones en un solo paso no está autorizada en Production.");
 if(env.ALEMSI_RECEIPT_V2!=='1'||env.ALEMSI_RECEIPT_V3!=='1')
  return locked("Recepción en modo revisión: la confirmación única y el ingreso a inventario aún no están habilitados para este Preview. Ningún movimiento se registró.");
 let currentRef="";
 try{currentRef=new URL(env.NEXT_PUBLIC_SUPABASE_URL||"").hostname.split(".")[0]}catch{}
 const testRef=String(env.ALEMSI_RECEIPT_TEST_SUPABASE_REF||"").trim();
 if(!currentRef||!testRef||currentRef!==testRef||currentRef==="vxqxbjkttymgvyskzheu")
  return locked("No hay una base Supabase de pruebas aislada y verificada para confirmar esta factura. Se bloqueó el guardado para proteger los registros existentes.");
 return {enabled:true,reason:"Recepción de pruebas habilitada: al confirmar se registrará el documento y su inventario en una transacción."};
}
export function receiptSingleStepEnabled(env:Record<string,string|undefined>=process.env):boolean {
 return receiptConfirmationStatus(env).enabled;
}
