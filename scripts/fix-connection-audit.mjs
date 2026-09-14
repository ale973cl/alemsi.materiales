import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const ignored=new Set(["node_modules",".git",".next"]);
const textExt=new Set([".ts",".tsx",".js",".jsx",".mjs",".cjs",".json",".md",".css"]);
function walk(dir,out=[]){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(ignored.has(ent.name))continue;const full=path.join(dir,ent.name);if(ent.isDirectory())walk(full,out);else if(textExt.has(path.extname(ent.name)))out.push(full)}return out}
const files=walk(root);
const rel=(p)=>path.relative(root,p).replaceAll(path.sep,"/");

console.log("=== PROCESS_ENV_USAGE ===");
const env=new Map();
for(const file of files.filter(f=>rel(f).startsWith("src/"))){const lines=fs.readFileSync(file,"utf8").split(/\r?\n/);lines.forEach((line,i)=>{for(const m of line.matchAll(/process\.env\.([A-Z0-9_]+)/g)){if(!env.has(m[1]))env.set(m[1],[]);env.get(m[1]).push(`${rel(file)}:${i+1}`)}})}
for(const [name,refs] of [...env.entries()].sort(([a],[b])=>a.localeCompare(b)))console.log(`${name} => ${refs.join(", ")}`);

console.log("=== DEAD_CODE_REFERENCES ===");
const targets=[
"src/components/modules/ClientsModule.tsx","src/components/modules/CompareModule.tsx","src/components/modules/ConsolidadoModule.tsx","src/components/modules/DispatchModule.tsx","src/components/modules/HistoryModule.tsx","src/components/modules/HomeModule.tsx","src/components/modules/KitsModule.tsx","src/components/modules/ManagementModule.tsx","src/components/modules/MasterModule.tsx","src/components/modules/OCModule.tsx","src/components/modules/PendingModule.tsx","src/components/modules/ReceiptModule.tsx","src/components/modules/SurveyModule.tsx","src/components/AppShell.tsx","src/components/Common.tsx","src/lib/materiales-domain.ts","src/lib/materiales-store.ts","src/lib/storage.ts","src/data/master.json","src/data/operations.v02.json"];
for(const target of targets){const base=path.basename(target);const stem=base.replace(/\.[^.]+$/,'');const hits=[];for(const file of files){if(rel(file)===target)continue;const lines=fs.readFileSync(file,"utf8").split(/\r?\n/);lines.forEach((line,i)=>{const importLike=/(?:from\s*|import\s*\(|require\s*\()[^\n]*["'][^"']+["']/.test(line);const needle=base.endsWith(".json")?base:stem;if(importLike&&line.includes(needle))hits.push(`${rel(file)}:${i+1}: ${line.trim()}`);else if(base.endsWith(".json")&&line.includes(base))hits.push(`${rel(file)}:${i+1}: ${line.trim()}`)})}console.log(`--- ${target} ---`);if(hits.length)hits.forEach(h=>console.log(h));else console.log("SIN_REFERENCIAS")}
