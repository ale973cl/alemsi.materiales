import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("src/components/OperationalApp.tsx"),home=read("src/components/OperationsHome.tsx"),css=read("src/app/mobile-operations.css"),layout=read("src/app/layout.tsx");
test("barra móvil conserva rutas y navegación principal",()=>{
 assert.match(app,/operationsMobileDock/);
 assert.match(app,/onClick=\{\(\)=>navigate\(id\)\}/);
 assert.match(app,/aria-current=\{tab===id\?"page":undefined\}/);
 assert.match(app,/mainNav\.map/);
});
test("nueve acciones móviles usan la misma navegación que escritorio",()=>{
 for(const key of ['campañas','levantamientos','consolidado','compras','recepcion','inventario','preparacion','entregas','clientes'])
  assert.match(home,new RegExp('"'+key+'","'));
 assert.match(home,/operationsMobileTasks/);
});
test("análisis y presupuesto siguen accesibles",()=>{
 assert.match(home,/showMobileAnalysis/);
 assert.match(home,/aria-expanded=\{showMobileAnalysis\}/);
 assert.match(home,/operations-complete-analysis/);
 assert.match(home,/operationsBudgetRows/);
 assert.match(home,/operationsGroupControl/);
});
test("CSS móvil separado conserva escritorio y foco",()=>{
 assert.match(layout,/import "\.\/mobile-operations\.css"/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/min-height:54px!important/);
 assert.match(css,/@media\(min-width:761px\)/);
 assert.match(css,/operationsHomeDetail\{display:contents\}/);
 assert.match(css,/:focus-visible/);
});
