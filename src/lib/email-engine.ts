export type EmailModule="campaigns"|"supply"|"purchase_orders"|"finance"|"receipts"|"dispatch"|"alerts";
export type EmailPayload={module:EmailModule;event:string;title:string;summary:string;facts?:Record<string,string|number|null>};

export function renderEmail(payload:EmailPayload){
  const facts=Object.entries(payload.facts||{}).map(([k,v])=>`<tr><td style="padding:8px;color:#52606d">${escape(k)}</td><td style="padding:8px;font-weight:700">${escape(String(v??"—"))}</td></tr>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f3f7f8;font-family:Arial,sans-serif;color:#102a43"><table width="100%"><tr><td align="center" style="padding:28px"><table width="620" style="max-width:100%;background:white;border-radius:14px;overflow:hidden"><tr><td style="background:#073b5c;padding:22px;color:white"><b style="font-size:22px">ALEMSI Materiales</b><div style="color:#71d5ce;margin-top:5px">${escape(payload.module)}</div></td></tr><tr><td style="padding:28px"><h1 style="font-size:24px">${escape(payload.title)}</h1><p>${escape(payload.summary)}</p>${facts?`<table width="100%" style="border-collapse:collapse">${facts}</table>`:""}<p style="margin-top:25px;color:#627d98;font-size:12px">Mensaje transaccional generado por el motor central de ALEMSI. El módulo y evento quedan registrados para auditoría.</p></td></tr></table></td></tr></table></body></html>`;
}
function escape(value:string){return value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]!));}
