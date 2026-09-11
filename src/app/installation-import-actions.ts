"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

type Row={
 client?:string;rut?:string;contract?:string;installation?:string;region?:string;city?:string;commune?:string;address?:string;
 collaborator_count?:string|number;delivery_contact_name?:string;delivery_email?:string;general_email?:string;delivery_phone?:string;phone?:string;
 delivery_notes?:string;postal_code?:string;latitude?:string|number;longitude?:string|number;access_hours?:string;technical_contact_name?:string;
 technical_contact_email?:string;technical_contact_phone?:string;observations?:string
};

type Status="NUEVA"|"EXISTE"|"REVISAR"|"DUPLICADA";
type Detail={index:number;client:string;contract:string;installation:string;status:Status;reason?:string};

const clean=(v:unknown)=>String(v??"").trim();
const norm=(v:unknown)=>clean(v).toLocaleLowerCase("es-CL").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ");
const rutNorm=(v:unknown)=>clean(v).toUpperCase().replace(/[^0-9K]/g,"");

async function ctx(){
 const s=await createClient();
 const {data:{user}}=await s.auth.getUser();
 if(!user)throw new Error("Sesión no válida");
 const {data:p}=await s.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
 if(!p?.active||!["Admin Total","Gerencia"].includes(p.role))throw new Error("No autorizado");
 return{s,user,p};
}

async function loadStructure(s:any){
 const {data:clients,error}=await s.from("clients").select("id,legal_name,rut,active,contracts(id,name,active,installations(id,name,address,region,city,commune,active))");
 if(error)throw error;
 return clients||[];
}

function resolve(row:Row,clients:any[]){
 const rn=rutNorm(row.rut),cn=norm(row.client),contractName=norm(row.contract),inName=norm(row.installation),addr=norm(row.address);
 if(!cn||!contractName||!inName)return{status:"REVISAR" as const,reason:"Cliente, contrato e instalación son obligatorios"};

 const matches=rn?clients.filter((c:any)=>rutNorm(c.rut)===rn):clients.filter((c:any)=>norm(c.legal_name)===cn);
 if(matches.length!==1)return{status:"REVISAR" as const,reason:matches.length?"Cliente ambiguo; revisar RUT/nombre":rn?"RUT de cliente no encontrado. Esta carga no crea clientes":"Cliente no encontrado. Esta carga no crea clientes"};
 const client=matches[0];
 if(rn&&cn&&norm(client.legal_name)!==cn)return{status:"REVISAR" as const,reason:"El RUT coincide con un cliente, pero el nombre legal del CSV no coincide"};

 const contracts=(client.contracts||[]).filter((c:any)=>norm(c.name)===contractName);
 if(contracts.length!==1)return{status:"REVISAR" as const,reason:contracts.length?"Contrato ambiguo":"Contrato no encontrado en el cliente"};
 const contract=contracts[0];

 const own=(contract.installations||[]).find((i:any)=>norm(i.name)===inName||(addr&&norm(i.address)===addr));
 if(own)return{status:"EXISTE" as const,reason:`Ya existe como ${own.name}`,client,contract};

 for(const c of clients)for(const k of (c.contracts||[]))for(const i of (k.installations||[])){
  if(norm(i.name)===inName||(addr&&norm(i.address)===addr))return{status:"REVISAR" as const,reason:`Coincide con instalación existente en otro contrato/cliente: ${i.name}`};
 }

 if(clean(row.collaborator_count)&&(!Number.isFinite(Number(row.collaborator_count))||Number(row.collaborator_count)<0))return{status:"REVISAR" as const,reason:"Dotación/colaboradoras no es un número válido"};
 if(clean(row.latitude)&&!Number.isFinite(Number(row.latitude)))return{status:"REVISAR" as const,reason:"Latitud no válida"};
 if(clean(row.longitude)&&!Number.isFinite(Number(row.longitude)))return{status:"REVISAR" as const,reason:"Longitud no válida"};

 return{status:"NUEVA" as const,client,contract};
}

function isCsvDuplicate(row:Row,seen:Array<{client:string;contract:string;name:string;address:string}>){
 const client=rutNorm(row.rut)||norm(row.client),contract=norm(row.contract),name=norm(row.installation),address=norm(row.address);
 return seen.some(x=>x.client===client&&x.contract===contract&&(x.name===name||Boolean(address&&x.address===address)));
}

function remember(row:Row,seen:Array<{client:string;contract:string;name:string;address:string}>){
 seen.push({client:rutNorm(row.rut)||norm(row.client),contract:norm(row.contract),name:norm(row.installation),address:norm(row.address)});
}

function addIfPresent(payload:Record<string,unknown>,key:string,value:unknown,transform?:(v:string)=>unknown){
 const v=clean(value);if(!v)return;payload[key]=transform?transform(v):v;
}

export async function previewInstallationCsvRows(rows:Row[]){
 const {s}=await ctx();
 if(!Array.isArray(rows)||!rows.length)throw new Error("El CSV no contiene filas");
 const clients=await loadStructure(s),details:Detail[]=[];
 const seen:Array<{client:string;contract:string;name:string;address:string}>=[];
 let newCount=0,exists=0,review=0,duplicates=0;
 rows.forEach((r,index)=>{
  if(isCsvDuplicate(r,seen)){duplicates++;details.push({index,client:clean(r.client),contract:clean(r.contract),installation:clean(r.installation),status:"DUPLICADA",reason:"Fila duplicada dentro del CSV"});return;}
  remember(r,seen);
  const x=resolve(r,clients);
  if(x.status==="NUEVA")newCount++;else if(x.status==="EXISTE")exists++;else review++;
  details.push({index,client:clean(r.client),contract:clean(r.contract),installation:clean(r.installation),status:x.status,reason:x.reason});
 });
 return{ok:true,total:rows.length,new:newCount,exists,review,duplicates,details};
}

export async function confirmInstallationCsvRows(rows:Row[]){
 const {s,user,p}=await ctx();
 if(!Array.isArray(rows)||!rows.length)throw new Error("No hay filas para confirmar");
 let created=0,exists=0,review=0,duplicates=0;
 const seen:Array<{client:string;contract:string;name:string;address:string}>=[];
 for(const row of rows){
  if(isCsvDuplicate(row,seen)){duplicates++;continue;}
  remember(row,seen);

  const clients=await loadStructure(s);
  const x:any=resolve(row,clients);
  if(x.status==="EXISTE"){exists++;continue;}
  if(x.status!=="NUEVA"){review++;continue;}

  const payload:Record<string,unknown>={contract_id:x.contract.id,name:clean(row.installation)};
  addIfPresent(payload,"region",row.region);
  addIfPresent(payload,"city",row.city);
  addIfPresent(payload,"commune",row.commune);
  addIfPresent(payload,"address",row.address);
  addIfPresent(payload,"phone",row.phone);
  addIfPresent(payload,"general_email",row.general_email);
  addIfPresent(payload,"delivery_email",row.delivery_email);
  addIfPresent(payload,"delivery_notes",row.delivery_notes);
  addIfPresent(payload,"postal_code",row.postal_code);
  addIfPresent(payload,"latitude",row.latitude,v=>Number(v));
  addIfPresent(payload,"longitude",row.longitude,v=>Number(v));
  addIfPresent(payload,"access_hours",row.access_hours);
  addIfPresent(payload,"delivery_contact_name",row.delivery_contact_name);
  addIfPresent(payload,"delivery_phone",row.delivery_phone);
  addIfPresent(payload,"technical_contact_name",row.technical_contact_name);
  addIfPresent(payload,"technical_contact_email",row.technical_contact_email);
  addIfPresent(payload,"technical_contact_phone",row.technical_contact_phone);
  addIfPresent(payload,"observations",row.observations);
  addIfPresent(payload,"collaborator_count",row.collaborator_count,v=>Number(v));

  const {data,error}=await s.from("installations").insert(payload).select("*").single();
  if(error)throw error;
  created++;
  const {error:logError}=await s.from("activity_log").insert({actor_id:user.id,actor_name:p.full_name||p.email,module:"Clientes e instalaciones",action:"Importar instalación CSV",entity_table:"installations",entity_id:data.id,new_data:data,observation:"Creada mediante Cargar instalaciones CSV"});
  if(logError)throw logError;
 }
 revalidatePath("/");
 return{ok:true,created,exists,review,duplicates,total:rows.length};
}
