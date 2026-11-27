import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const get=f=>readFileSync(new URL("../"+f,import.meta.url),"utf8");
const ui=get("src/components/OperationalApp.tsx"),inv=get("src/components/modules/InventoryModule.tsx"),page=get("src/app/page.tsx"),materials=get("src/components/modules/MaterialsCatalogModule.tsx");
test("Bodega incorpora Maestro de materiales y preserva la preparación",()=>{
 assert.match(ui,/\["maestro","Maestro de materiales"\]/);
 assert.match(ui,/tab==="maestro"/);
 assert.match(ui,/tab==="inventario"&&<InventoryModule/);
 assert.match(ui,/tab==="preparacion"/);
});
test("Inventario muestra botón y conserva conteo y Kardex",()=>{
 assert.match(inv,/Administrar maestro de materiales/);
 assert.match(inv,/onClick=\{onOpenMaterials\}/);
 assert.match(inv,/registerInventoryCount/);
 assert.match(inv,/loadKardex/);
});
test("Acceso restringido por rol sin exponer editor",()=>{
 assert.match(ui,/\["Admin Total","Gerencia","Admin"\]\.includes\(profile\.role\)/);
 assert.match(ui,/id!=="maestro"\|\|canManageMaterials/);
 assert.match(ui,/canManageMaterials\?<MaterialsCatalogModule/);
 assert.match(page,/view==="maestro"&&\["Admin Total","Gerencia","Admin"\]/);
});
test("Se reutiliza el maestro completo y carga de catálogo",()=>{
 assert.match(ui,/MaterialsCatalogModule rows=\{masterMaterialCatalog/);
 assert.match(page,/if\(view==="maestro"/);
 for(const v of ["createMaterialConfigured","updateMaterialConfiguration","updateMaterialNetPrice","importMaterialMasterCsv"])assert.ok(materials.includes(v),v);
});
