"use client";

export type PreparationPrintRow = {survey_id:string;installation_name:string;campaign_name:string;client_name:string;lines:{material_id:string;name:string;unit:string;pending:number}[]};
const safe=(value:unknown)=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
export function printPreparationConsolidated(
 installations:PreparationPrintRow[],
 quantities:Record<string,{material_id:string;quantity:number}[]>,
){
 if(!installations.length)return false;
 const master=new Map<string,{name:string;unit:string}>();
 for(const s of installations)for(const l of s.lines)master.set(l.material_id,{name:l.name,unit:l.unit});
 const materials=[...master.entries()].sort((a,b)=>a[1].name.localeCompare(b[1].name,"es"));
 const value=(surveyId:string,id:string)=>quantities[surveyId]?.find(l=>l.material_id===id)?.quantity||0;
 const total=(id:string)=>installations.reduce((sum,s)=>sum+value(s.survey_id,id),0);
 const groups=Array.from({length:Math.ceil(installations.length/8)},(_,i)=>installations.slice(i*8,(i+1)*8));
 const materialGroups=Array.from({length:Math.ceil(materials.length/24)},(_,i)=>materials.slice(i*24,(i+1)*24));
 const sections:string[]=[];
 for(const group of groups)for(const segment of materialGroups){
  sections.push(`<section class="page"><header><h1>ALEMSI · CONSOLIDADO PARA PREPARACIÓN FÍSICA</h1>
   <p><b>Cliente:</b> ${safe(installations[0].client_name)} &nbsp; <b>Campaña:</b> ${safe(installations[0].campaign_name)}</p>
   <p><b>Instalaciones seleccionadas:</b> ${installations.length} &nbsp; <b>Productos:</b> ${materials.length} &nbsp; <b>Bloque:</b> ${groups.indexOf(group)+1}/${groups.length}</p>
   <p>Instrucción a bodega: retirar las cantidades indicadas y revisar físicamente antes de generar guías.</p></header>
   <table><thead><tr><th>Material</th>${group.map(s=>`<th>${safe(s.installation_name)}</th>`).join("")}<th>Total bloque</th></tr></thead><tbody>
   ${segment.map(([id,m])=>`<tr><td><strong>${safe(m.name)}</strong><small>${safe(m.unit)}</small></td>${group.map(s=>`<td>${value(s.survey_id,id)||"—"}</td>`).join("")}<td><b>${group.reduce((n,s)=>n+value(s.survey_id,id),0)||"—"}</b></td></tr>`).join("")}
   </tbody></table></section>`);
 }
 sections.push(`<section class="page"><h1>RESUMEN GENERAL DE CARGA</h1><p>${safe(installations[0].campaign_name)} · ${installations.length} instalaciones</p>
 <table><thead><tr><th>Material</th><th>Total de la tanda</th></tr></thead><tbody>${materials.map(([id,m])=>`<tr><td><b>${safe(m.name)}</b><small>${safe(m.unit)}</small></td><td><b>${total(id)}</b></td></tr>`).join("")}</tbody></table>
 <p><b>Total de unidades:</b> ${materials.reduce((a,[id])=>a+total(id),0)}</p><p>Revisión de bodega: ______________________ &nbsp; Fecha: ______________</p></section>`);
 const w=window.open("","_blank");if(!w)return false;
 try{w.opener=null}catch{}
 w.document.open();w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>ALEMSI · Consolidado de preparación</title><style>
 @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#183b51;margin:0}
 .page{break-after:page}.page:last-child{break-after:auto}h1{font-size:17px;margin:0 0 10px}p{font-size:10px;margin:4px 0}
 table{width:100%;border-collapse:collapse;margin-top:10px;font-size:9px}th,td{border:1px solid #a8bdc8;padding:5px;text-align:center;vertical-align:middle}th{background:#e9f4f3}td:first-child,th:first-child{text-align:left;min-width:150px}small{display:block;font-size:8px;margin-top:3px}</style></head><body>${sections.join("")}</body></html>`);
 w.document.close();w.focus();w.print();return true;
}
