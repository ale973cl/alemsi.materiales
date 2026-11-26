import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const dispatch=source("src/components/modules/DispatchDeliveryModule.tsx");
const printed=source("src/lib/print-batch-consolidated.ts");
const css=source("src/app/purchase-order-document.css");
const operational=source("src/app/operational-compact.css");
const po=source("src/app/ordenes-compra/[id]/page.tsx");

test("tanda permite diferentes clientes y campañas sin bloqueo heredado",()=>{
 assert.match(dispatch,/Confirmar preparación de toda la tanda/);
 assert.match(dispatch,/setChecked\(Object\.fromEntries\(suggestions\.map/);
 assert.doesNotMatch(dispatch,/disabled=\{busy\|\|!allChecked\|\|!sameCampaign/);
 assert.doesNotMatch(dispatch,/disabled=\{busy\|\|!allChecked\|\|!sameClient/);
 assert.match(dispatch,/Seleccionar todas con stock/);
});
test("una guía por instalación conserva cliente y campaña y evita guías vacías",()=>{
 assert.match(dispatch,/eligible=batchRows\.filter/);
 assert.match(dispatch,/for\(const s of eligible\)/);
 assert.match(dispatch,/client:s\.client_name,campaign:s\.campaign_name/);
 assert.match(dispatch,/createCampaignDispatch\(\{surveyId:s\.survey_id,preparedLines:/);
 assert.match(dispatch,/no se pueden generar guías vacías/);
});
test("consolidado multicliente identifica origen por columna",()=>{
 assert.match(printed,/new Set\(installations\.map\(s=>s\.client_name\)\)/);
 assert.match(printed,/safe\(s\.client_name\).*safe\(s\.campaign_name\)/);
});
test("OC conserva tabla original también en móvil y A4 de impresión",()=>{
 assert.match(po,/className="poTableScroll"/);
 assert.match(css,/@media screen and \(max-width:760px\)/);
 assert.match(css,/\.poDoc thead\{display:table-header-group!important\}/);
 assert.match(css,/@page\{size:A4 portrait/);
 assert.doesNotMatch(css,/\.poDoc tbody\{display:grid!important/);
});
test("acciones críticas cumplen objetivo táctil mínimo en móviles",()=>{
 assert.match(operational,/@media \(pointer:coarse\)/);
 assert.match(operational,/\.simpleApp \.compactTabs button.*min-height:44px!important/);
 assert.match(operational,/\.simpleApp \.dispatchSuggestionRow button.*min-height:44px!important/);
});
