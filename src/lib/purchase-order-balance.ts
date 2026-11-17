export const isCancelledPurchaseOrder=(status:unknown)=>/anulad|cancelad/i.test(String(status||""));
export const isClosedPurchaseOrder=(status:unknown)=>/cerrad|recepcionad|finalizad/i.test(String(status||""));
/** Compromiso para un requerimiento: OC activa reserva pedido total; cerrada reserva solo recibido validado. */
export function committedPurchaseQty(status:unknown,ordered:unknown,receivedPosted:unknown){
 if(isCancelledPurchaseOrder(status)||/cotiz/i.test(String(status||"")))return 0;
 if(isClosedPurchaseOrder(status))return Math.max(0,Number(receivedPosted)||0);
 return Math.max(0,Number(ordered)||0);
}
