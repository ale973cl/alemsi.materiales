/** Explicit opt-in after migration verification. Production cannot enable this pilot. */
export function receiptTransactionsEnabled(env:Record<string,string|undefined>=process.env):boolean {
 if(env.ALEMSI_RECEIPT_V2!=='1')return false;
 if(env.VERCEL_ENV==='production')throw new Error('El piloto de recepción V2 solo está permitido en Preview y pruebas');
 if(env.VERCEL_ENV && !['preview','development'].includes(env.VERCEL_ENV))throw new Error('Entorno de recepción V2 no reconocido');
 return true;
}

/** Safe pilot: never confirm real inventory against a shared Production database. */
export function receiptSingleStepEnabled(env:Record<string,string|undefined>=process.env):boolean {
 if(env.ALEMSI_RECEIPT_V3!=='1')return false;
 if(env.VERCEL_ENV==='production')throw new Error('Confirmación única V3 prohibida en Production');
 if(!receiptTransactionsEnabled(env))throw new Error('V3 requiere el piloto V2 en base de datos aislada');
 return true;
}
