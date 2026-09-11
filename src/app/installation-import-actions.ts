"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

type Row={client?:string;rut?:string;contract?:string;installation?:string;region?:string;city?:string;commune?:string;address?:string;collaborator_count?:string|number;delivery_contact_name?:string;delivery_email?:string;general_email?:string;delivery_phone?:string;phone?:string};
type Detail={index:number;client:string;contract:string;installation:string;status:"AGREGAR"|"EXISTE"|"REVISAR";reason?:string};
const clean=(v:unknown)=>String(v??"").trim();
const norm=(v:unknown)=>clean(v).toLocaleLowerCase("es-CL").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ");
const rutNorm=(v:unknown)=>clean(v).toUpperCase().replace(/[^0-9K]/g,"");
async function ctx(){const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)throw new Error("Sesión no válida");const {data:p}=await s.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();if(!p?.active||!["Admin Total","Gerencia"].includes(p.role))throw new Error("No autorizado");return{s,user,p};}
async function loadStructure(s:any){const {data:clients,error}=await s.from("clients").select("id,legal_name,rut,active,contracts(id,name,active,installations(id,name,address,region,city,commune,active))");if(error)throw error;return clients||[];}
function resolve(row:Row,clients:any[]){
 const rn=rutNorm(row.rut),cn=norm(row.client),contractName=norm(row.contract),inName=norm(row.installation),addr=norm(row.address);
 if(!cn||!contractName||!inName)return{status:"REVISAR" as const,reason:"Cliente, contrato e instalación son obligatorios"};
 const matches=rn?clients.filter((c:any)=>rutNorm(c.rut)===rn):clients.filter((c:any)=>norm(c.legal_name)===cn);
 if(matches.length!==1)return{status:"REVISAR" as const,reason:matches.length?"Cliente ambiguo; revisar RUT/nombre":"Cliente no encontrado. Esta carga no crea clientes"};
 const client=matches[0];const contracts=(client.contracts||[]).filter((c:any)=>norm(c.name)===contractName);
 if(contracts.length!==1)return{status:"REVISAR" as const,reason:contracts.length?"Contrato ambiguo":"Contrato no encontrado en el cliente"};
 const contract=contracts[0];const own=(contract.installations||[]).find((i:any)=>norm(i.name)===inName||(addr&&norm(i.address)===addr));
 if(own)return{status:"EXISTE" as const,reason:`Ya existe como ${own.name}`,client,contract};
 for(const c of clients)for(const k of (c.contracts||[]))for(const i of (k.installations||[]))if(norm(i.name)===inName||(addr&&norm(i.address)===addr))return{status:"REVISAR" as const,reason:`Coincide con instalación existente en otro contrato/cliente: ${i.name}`};
 return{status:"AGREGAR" as const,client,contract};
}
export async function previewInstallationCsvRows(rows:Row[]){const {s}=await ctx();if(!Array.isArray(rows)||!rows.length)throw new Error("El CSV no contiene filas");const clients=await loadStructure(s);const details:Detail[]=[];let add=0,exists=0,review=0;rows.forEach((r,index)=>{const x=resolve(r,clients);if(x.status==="AGREGAR")add++;else if(x.status==="EXISTE")exists++;else review++;details.push({index,client:clean(r.client),contract:clean(r.contract),installation:clean(r.installation),status:x.status,reason:x.reason});});return{ok:true,total:rows.length,add,exists,review,details};}
export async function confirmInstallationCsvRows(rows:Row[]){const {s,user,p}=await ctx();if(!Array.isArray(rows)||!rows.length)throw new Error("No hay filas para confirmar");let created=0,skipped=0,review=0;for(const row of rows){const clients=await loadStructure(s);const x:any=resolve(row,clients);if(x.status==="EXISTE"){skipped++;continue;}if(x.status!=="AGREGAR"){review++;continue;}const count=Math.max(0,Number(row.collaborator_count||0)||0);const payload={contract_id:x.contract.id,name:clean(row.installation),region:clean(row.region)||null,city:clean(row.city)||null,commune:clean(row.commune)||null,address:clean(row.address)||null,collaborator_count:count,delivery_contact_name:clean(row.delivery_contact_name)||null,delivery_email:clean(row.delivery_email)||null,general_email:clean(row.general_email)||null,delivery_phone:clean(row.delivery_phone)||null,phone:clean(row.phone)||null,active:true};const {data,error}=await s.from("installations").insert(payload).select("id,name,contract_id,region,city,commune,address,collaborator_count,delivery_contact_name,delivery_email,general_email,delivery_phone,phone").single();if(error)throw error;created++;await s.from("activity_log").insert({actor_id:user.id,actor_name:p.full_name||p.email,module:"Clientes e instalaciones",action:"Importar instalación CSV",entity_table:"installations",entity_id:data.id,new_data:data});}revalidatePath("/");return{ok:true,created,skipped,review,total:rows.length};}
