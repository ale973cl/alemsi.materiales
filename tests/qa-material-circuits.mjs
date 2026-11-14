import {test} from 'node:test';
import assert from 'node:assert/strict';
import {committedPurchaseQty,isClosedPurchaseOrder,isCancelledPurchaseOrder} from '../src/lib/purchase-order-balance.ts';
import {coveredCampaignQuantity} from '../src/lib/campaign-dispatch-balance.ts';

const cases=[
 ['01 OC Borrador reserva todo',()=>assert.equal(committedPurchaseQty('Borrador',10,0),10)],
 ['02 OC Emitida reserva todo',()=>assert.equal(committedPurchaseQty('Emitida',10,4),10)],
 ['03 OC Pendiente reserva todo',()=>assert.equal(committedPurchaseQty('Pendiente',10,2),10)],
 ['04 OC Cerrada conserva solo recibido',()=>assert.equal(committedPurchaseQty('Cerrada',10,10),10)],
 ['05 OC Cerrada incompleta libera carencia',()=>assert.equal(committedPurchaseQty('Cerrada incompleta',10,6),6)],
 ['06 OC Cerrada incompleta sin recepción',()=>assert.equal(committedPurchaseQty('Cerrada incompleta',10,0),0)],
 ['07 OC Anulada no compromete',()=>assert.equal(committedPurchaseQty('Anulada',10,5),0)],
 ['08 OC Cancelada no compromete',()=>assert.equal(committedPurchaseQty('Cancelada',10,5),0)],
 ['09 OC con cantidad negativa no compromete',()=>assert.equal(committedPurchaseQty('Emitida',-5,0),0)],
 ['10 OC cerrada con recibido negativo no compromete',()=>assert.equal(committedPurchaseQty('Cerrada',10,-2),0)],
 ['11 estado cerrado detectado',()=>assert.equal(isClosedPurchaseOrder('Cerrada incompleta'),true)],
 ['12 estado recepcionado detectado',()=>assert.equal(isClosedPurchaseOrder('Recepcionada'),true)],
 ['13 estado finalizado detectado',()=>assert.equal(isClosedPurchaseOrder('Finalizada'),true)],
 ['14 estado emitido no cerrado',()=>assert.equal(isClosedPurchaseOrder('Emitida'),false)],
 ['15 estado cancelado detectado',()=>assert.equal(isCancelledPurchaseOrder('CANCELADA'),true)],
 ['16 estado anulado detectado',()=>assert.equal(isCancelledPurchaseOrder('Anulada'),true)],
 ['17 estado pendiente no cancelado',()=>assert.equal(isCancelledPurchaseOrder('Pendiente'),false)],
 ['18 sin estado conserva reserva',()=>assert.equal(committedPurchaseQty(null,7,null),7)],
 ['19 guía borrador reserva requerido',()=>assert.equal(coveredCampaignQuantity('Borrador',10,0),10)],
 ['20 guía en preparación reserva requerido',()=>assert.equal(coveredCampaignQuantity('En preparación',10,0),10)],
 ['21 guía lista reserva requerido',()=>assert.equal(coveredCampaignQuantity('Listo para despacho',10,0),10)],
 ['22 guía en tránsito reserva requerido',()=>assert.equal(coveredCampaignQuantity('En tránsito',10,0),10)],
 ['23 entrega conforme cubre lo entregado',()=>assert.equal(coveredCampaignQuantity('Entregado conforme',10,10),10)],
 ['24 entrega con observaciones parcial',()=>assert.equal(coveredCampaignQuantity('Entrega con observaciones',10,6),6)],
 ['25 entrega parcial cubre seis',()=>assert.equal(coveredCampaignQuantity('Entrega parcial',10,6),6)],
 ['26 rechazo libera requerido',()=>assert.equal(coveredCampaignQuantity('Rechazado/No entregado',10,0),0)],
 ['27 entrega excedida no cubre más que reservado',()=>assert.equal(coveredCampaignQuantity('Entregado conforme',10,15),10)],
 ['28 cantidad de guía negativa no reserva',()=>assert.equal(coveredCampaignQuantity('En preparación',-5,0),0)],
 ['29 entrega negativa no cubre',()=>assert.equal(coveredCampaignQuantity('Entrega parcial',10,-4),0)],
 ['30 recepción posterior permite nueva carencia',()=>assert.equal(10-committedPurchaseQty('Cerrada incompleta',10,4),6)],
];
for (const [name,fn] of cases)test(name,fn);
