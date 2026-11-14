/**
 * Cantidad cubierta del requerimiento de campaña.
 * Mientras la guía está en preparación/ruta, reserva lo asignado.
 * Una vez concluida una entrega, solo cubre lo recibido realmente.
 * La diferencia queda visible como necesidad que debe resolverse,
 * no como compra/guía automática.
 */
const DELIVERY_FINAL = new Set(["Entregado conforme","Entrega con observaciones","Entrega parcial","Rechazado/No entregado"]);
export function coveredCampaignQuantity(status:string,required:unknown,delivered:unknown):number{
  const reserved=Math.max(0,Number(required)||0);
  const actual=Math.max(0,Number(delivered)||0);
  return DELIVERY_FINAL.has(status)?Math.min(reserved,actual):reserved;
}
