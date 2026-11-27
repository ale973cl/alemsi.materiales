import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const code=readFileSync(new URL("../src/components/modules/DispatchDeliveryModule.tsx",import.meta.url),"utf8");
test("sin instrucción en encabezado",()=>{assert.doesNotMatch(code,/Seleccionar instalación\s*→\s*verificar preparación/);assert.match(code,/<h2>Despacho y guías<\/h2>/)});
test("etapas con títulos breves y estados intactos",()=>{for(const v of ['"Preparación"','"Asignar ruta"','"Rutas asignadas"','"En entrega"','"Guías pendientes"','"Designar ruta"','"En tránsito"'])assert.ok(code.includes(v),v)});
test("conserva acciones y advertencias",()=>{for(const v of ['createCampaignDispatch','generateBatch','setRouteOpen(true)','DeliveryRegistrationModal','ComplementaryDispatchModal','Pendientes material','no se pueden generar guías vacías','Confirma las cantidades preparadas por instalación'])assert.ok(code.includes(v),v)});
