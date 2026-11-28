import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const ui=read("src/components/modules/DispatchDeliveryModule.tsx"),css=read("src/app/dispatch-mobile-search.css"),layout=read("src/app/layout.tsx");
test("móvil filtra primero por campaña o cliente y despliega refinamientos",()=>{
 for(const token of ['mobileFilterMode','switchMobileFilterMode','dispatchMobileMode','Seleccionar campaña','Seleccionar cliente','dispatchMobileRefine','aria-expanded={mobileMoreFilters}','dispatch-mobile-refinements'])assert.ok(ui.includes(token),token);
});
test("los filtros refinados operan sobre el mismo estado y resetean filtros ocultos",()=>{
 for(const token of ['filters.campaign','filters.client','filters.contract','filters.installation','filters.region','filters.q','setFilters({q:"",client:"",contract:"",installation:"",region:"",campaign:"",status:""})'])assert.ok(ui.includes(token),token);
 assert.match(ui,/setMobileMoreFilters\(false\)/);
});
test("no altera selección de preparación, creación de guías ni ruta",()=>{
 for(const token of ['generateBatch=async','generateSuggestion=async','setRouteOpen(true)','DeliveryRoutesModule','setBatchSelected','CreateDispatchModal'])assert.ok(ui.includes(token),token);
});
test("búsqueda progresiva también en escritorio, sin cuadrícula duplicada",()=>{
 assert.doesNotMatch(ui,/className="dispatchFilters"/);assert.match(ui,/className="dispatchMobileFilters"/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/\.dispatchFilters\{display:none!important\}/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/\.dispatchMobileRefinements\.open\{display:grid\}/);
 assert.match(css,/scroll-snap-type:x proximity/);
 assert.match(css,/min-height:44px!important/);
 assert.match(layout,/import "\.\/dispatch-mobile-search\.css"/);
});

test("elimina el aviso redundante bajo etapas sin retirar su navegación",()=>{
 assert.ok(!ui.includes("Instalaciones pendientes de preparación."));
 assert.match(ui,/className="dispatchBuckets"/);
 assert.match(ui,/Instalaciones por preparar/);
});
