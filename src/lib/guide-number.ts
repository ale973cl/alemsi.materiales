export function formatInternalGuideNumber(value:unknown){
 const raw=String(value??"").trim();
 if(!raw)return"Guía interna";
 const match=raw.match(/(\d+)$/);
 if(!match)return raw;
 const n=Number(match[1]);
 if(!Number.isFinite(n))return raw;
 return "GI"+String(n).padStart(4,"0");
}
