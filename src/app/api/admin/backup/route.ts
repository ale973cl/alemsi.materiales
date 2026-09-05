import {NextResponse} from "next/server";
import JSZip from "jszip";
import {timingSafeEqual} from "crypto";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const TABLES=["clients","contracts","installations","installation_contacts","client_contacts","suppliers","supplier_contacts","materials","supplier_materials","material_price_history","contract_materials","contract_limits","campaigns","campaign_installations","surveys","survey_lines","local_purchase_requests","local_purchase_lines","finance_movements","supply_runs","supply_lines","supply_allocations","purchase_orders","purchase_order_lines","receipts","receipt_lines","dispatches","dispatch_lines","dispatch_allocations","kits","kit_items","documents","email_templates","email_queue","email_events","user_profiles","activity_log"] as const;

function secureEqual(a:string,b:string){const aa=Buffer.from(a);const bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb)}
function csvCell(v:unknown){if(v===null||v===undefined)return "";const s=typeof v==="object"?JSON.stringify(v):String(v);return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
function toCsv(rows:Record<string,unknown>[]){if(!rows.length)return "";const cols=Array.from(new Set(rows.flatMap(r=>Object.keys(r))));return [cols.join(","),...rows.map(r=>cols.map(c=>csvCell(r[c])).join(","))].join("\r\n")}
async function readAll(url:string,key:string,table:string){const rows:Record<string,unknown>[]=[];let from=0;const page=1000;while(true){const r=await fetch(`${url}/rest/v1/${table}?select=*`,{headers:{apikey:key,Authorization:`Bearer ${key}`,Range:`${from}-${from+page-1}`,Prefer:"count=exact"},cache:"no-store"});if(!r.ok)throw new Error(`Error leyendo ${table}: ${r.status}`);const chunk=await r.json() as Record<string,unknown>[];rows.push(...chunk);if(chunk.length<page)break;from+=page}return rows}

export async function POST(req:Request){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const adminToken=process.env.BACKUP_ADMIN_TOKEN;
 if(!url||!serviceKey||!adminToken)return NextResponse.json({error:"Faltan variables seguras del generador de respaldo en Vercel."},{status:500});
 const body=await req.json().catch(()=>({}));if(typeof body.token!=="string"||!secureEqual(body.token,adminToken))return NextResponse.json({error:"Clave de Admin Total incorrecta."},{status:403});
 try{
  const data:Record<string,Record<string,unknown>[]>= {};const counts:Record<string,number>={};
  for(const table of TABLES){const rows=await readAll(url,serviceKey,table);data[table]=rows;counts[table]=rows.length}
  const generatedAt=new Date().toISOString();
  const manifest={system:"ALEMSI Materiales",backupVersion:"1.0",generatedAt,projectRef:new URL(url).hostname.split(".")[0],format:["CSV","JSON"],tables:counts,totalRecords:Object.values(counts).reduce((a,b)=>a+b,0)};
  const zip=new JSZip();zip.file("manifest.json",JSON.stringify(manifest,null,2));zip.file("full_backup.json",JSON.stringify({manifest,data},null,2));
  const folder=zip.folder("csv");for(const table of TABLES)folder?.file(`${table}.csv`,toCsv(data[table]));
  await fetch(`${url}/rest/v1/activity_log`,{method:"POST",headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,"content-type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({actor_name:"Admin Total",module:"Respaldos",action:"GENERAR_RESPALDO_COMPLETO",entity_table:"system",new_data:{generated_at:generatedAt,tables:counts,total_records:manifest.totalRecords},observation:"Respaldo externo ZIP/CSV/JSON generado desde el módulo Admin Total"})});
  const bytes=await zip.generateAsync({type:"uint8array",compression:"DEFLATE",compressionOptions:{level:6}});
  const stamp=generatedAt.replace(/[:.]/g,"-");return new Response(bytes,{status:200,headers:{"content-type":"application/zip","content-disposition":`attachment; filename="ALEMSI_Materiales_Backup_${stamp}.zip"`,"cache-control":"no-store"}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Error generando respaldo"},{status:500})}
}
