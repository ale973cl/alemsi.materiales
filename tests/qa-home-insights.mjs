import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const get=(f)=>readFileSync(new URL("../"+f,import.meta.url),"utf8");
const page=get("src/app/page.tsx"),ui=get("src/components/OperationsHome.tsx"),lib=get("src/lib/home-insights.ts");
test("presupuesto financiero proviene solo de net_budget de contratos de materiales",()=>{
 assert.match(page,/from\("contracts"\)\.select\("id,name,net_budget,clients/);
 assert.match(ui,/Presupuesto neto de materiales por contrato/);
 assert.doesNotMatch(ui,/multiplicad[oa] por (?:12|mes)/i);
 assert.match(ui,/No corresponde al valor del servicio/);
});
test("entregas agrupadas por cliente campaña y mes, con estados",()=>{
 assert.match(ui,/Agrupar por/);
 for(const key of ["client","campaign","period"])assert.match(ui,new RegExp('value="'+key+'"'));
 assert.match(lib,/summarizeDeliveries/);
 assert.match(lib,/Entrega parcial/);
 assert.match(lib,/Entregado conforme/);
 assert.match(lib,/Sin campaña asociada/);
});
test("sin datos evita engaños y control de máximo de registros",()=>{
 assert.match(page,/\.limit\(1001\)/);
 assert.match(page,/\.length>1000/);
 assert.match(ui,/1\.000 movimientos más recientes/);
 assert.match(ui,/Sin acceso a presupuestos/);
});
