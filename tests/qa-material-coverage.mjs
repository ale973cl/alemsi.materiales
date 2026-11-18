import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/material-coverage.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exports = {};
new Function("exports", js)(exports);
const {evaluarCobertura} = exports;
const maestro = [
 {id:"m1",name:"Detergente multiuso",functions:["limpieza general"],surfaces:["pisos lavables"]},
 {id:"m2",name:"Limpiavidrios",functions:["limpieza de vidrios"],surfaces:["vidrios"]}
];
test("sin materiales exigidos no se preselecciona nada",()=>assert.deepEqual(evaluarCobertura([],maestro),[]));
test("Poett se sugiere por función sin asignar",()=>{
 const [r]=evaluarCobertura([{requested:"Poett",function:"limpieza general",surface:"pisos lavables"}],maestro);
 assert.equal(r.status,"REVISION");assert.equal(r.materialId,null);assert.match(r.reason,/Detergente multiuso/);
});
test("sin coincidencia ni función documentada queda no atendido",()=>{
 const [r]=evaluarCobertura([{requested:"Producto desconocido"}],maestro);
 assert.equal(r.status,"NO_ATENDIDO");assert.equal(r.materialId,null);
});
test("coincidencia exacta única con cobertura documentada",()=>{
 const [r]=evaluarCobertura([{requested:"Limpiavidrios",function:"limpieza de vidrios",surface:"vidrios"}],maestro);
 assert.equal(r.status,"COINCIDENCIA");assert.equal(r.materialId,"m2");
});
test("coincidencia nominal sin función acreditada requiere revisión",()=>{
 const [r]=evaluarCobertura([{requested:"Limpiavidrios",function:"desinfección"}],maestro);
 assert.equal(r.status,"REVISION");assert.equal(r.materialId,null);
});
