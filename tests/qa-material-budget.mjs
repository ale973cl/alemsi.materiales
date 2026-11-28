import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=f=>readFileSync(new URL("../"+f,import.meta.url),"utf8");
const p=read("src/app/page.tsx"),ui=read("src/components/OperationalApp.tsx"),engine=read("src/lib/material-budget-report.ts"),module=read("src/components/modules/MaterialBudgetModule.tsx");
test("gasto documental solo de facturas recepcionadas con enlace a contrato",()=>{
 assert.match(p,/\.eq\("inventory_posted",true\)/);
 for(const name of ["receipt_lines","purchase_order_lines","supply_lines","supply_runs"])assert.match(p,new RegExp('from\\("'+name+'"\\)'));
 assert.match(engine,/po\?supplyLines/);
 assert.match(engine,/contractIds\.has\(contractId\)/);
});
test("no se inventa gasto ni periodicidad",()=>{
 assert.match(module,/no se calcula un saldo presupuestario mensual/);
 assert.match(module,/Compras sin atribución contractual/);
 assert.match(engine,/unattributedNet/);
 assert.doesNotMatch(engine,/current_net_price/);
});
test("filtros y accesos autorizados, sin cifras incompletas",()=>{
 for(const key of ["Cliente","Contrato","Período de factura"])assert.match(module,new RegExp(key));
 assert.match(p,/sources\.some\(r=>\(r\.data\|\|\[\]\)\.length>1000\)/);
 assert.match(ui,/canManageMaterials\?<MaterialBudgetModule/);
 assert.match(ui,/\["presupuesto","Presupuesto"\]/);
});
