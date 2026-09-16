import "server-only";

const TOKEN_URL="https://oauth2.googleapis.com/token";
const DRIVE_FILES_URL="https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL="https://www.googleapis.com/upload/drive/v3/files";

function env(){
  const clientId=process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim();
  const clientSecret=process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken=process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?.trim();
  const rootFolderId=process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim()||null;
  if(!clientId||!clientSecret||!refreshToken)throw new Error("Google Drive OAuth no está configurado");
  return{clientId,clientSecret,refreshToken,rootFolderId};
}

async function accessToken(){
  const {clientId,clientSecret,refreshToken}=env();
  const response=await fetch(TOKEN_URL,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:"refresh_token"}),cache:"no-store"});
  const data:any=await response.json();
  if(!response.ok||!data.access_token)throw new Error(`Google Drive OAuth: ${data.error_description||data.error||response.status}`);
  return String(data.access_token);
}
function q(value:string){return value.replace(/\\/g,"\\\\").replace(/'/g,"\\'")}
async function assertRootAccess(token:string,rootFolderId:string){
  const response=await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(rootFolderId)}?fields=id,name,mimeType,capabilities(canAddChildren)&supportsAllDrives=true`,{headers:{authorization:`Bearer ${token}`},cache:"no-store"});
  const data:any=await response.json();
  if(!response.ok)throw new Error(`Google Drive carpeta raíz: ${data.error?.message||response.status}`);
  if(data.mimeType!=="application/vnd.google-apps.folder")throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID no corresponde a una carpeta");
  if(data.capabilities?.canAddChildren===false)throw new Error("La cuenta OAuth no puede crear archivos en la carpeta raíz de Drive");
  return data;
}
async function resolveRootFolder(token:string,configuredId:string|null){
  if(configuredId){
    try{
      await assertRootAccess(token,configuredId);
      return configuredId;
    }catch(error){
      console.warn("GOOGLE_DRIVE_ROOT_FALLBACK",{reason:error instanceof Error?error.message:String(error)});
    }
  }
  const rootName=safeName(process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME?.trim()||"ALEMSI Materiales - Documentos",80);
  const existing=await findFolder(token,"root",rootName);
  if(existing)return existing;
  const response=await fetch(`${DRIVE_FILES_URL}?fields=id,name,webViewLink&supportsAllDrives=true`,{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({name:rootName,mimeType:"application/vnd.google-apps.folder"}),cache:"no-store"});
  const data:any=await response.json();
  if(!response.ok||!data.id)throw new Error(`Google Drive crear carpeta raíz: ${data.error?.message||response.status}`);
  return String(data.id);
}
async function findFolder(token:string,parentId:string,name:string){
  const query=`'${q(parentId)}' in parents and name = '${q(name)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const url=`${DRIVE_FILES_URL}?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const response=await fetch(url,{headers:{authorization:`Bearer ${token}`},cache:"no-store"});
  const data:any=await response.json();if(!response.ok)throw new Error(`Google Drive buscar carpeta: ${data.error?.message||response.status}`);
  return data.files?.[0]?.id?String(data.files[0].id):null;
}
async function ensureFolder(token:string,parentId:string,name:string){
  const existing=await findFolder(token,parentId,name);if(existing)return existing;
  const response=await fetch(`${DRIVE_FILES_URL}?fields=id,name,webViewLink&supportsAllDrives=true`,{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({name,mimeType:"application/vnd.google-apps.folder",parents:[parentId]}),cache:"no-store"});
  const data:any=await response.json();if(!response.ok||!data.id)throw new Error(`Google Drive crear carpeta: ${data.error?.message||response.status}`);return String(data.id);
}
function safeName(value:string,max=120){return(value||"Sin nombre").replace(/[\\/:*?"<>|]/g,"-").replace(/\s+/g," ").trim().slice(0,max)||"Sin nombre"}
function monthName(value:Date){const name=new Intl.DateTimeFormat("es-CL",{month:"long",timeZone:"America/Santiago"}).format(value);return name.charAt(0).toUpperCase()+name.slice(1)}
function archiveParts(input:{client:string;contract?:string|null;campaign?:string|null;region?:string|null;year?:string|number|null;archiveDate?:string|Date|null}){
  const date=input.archiveDate?new Date(input.archiveDate):new Date();
  const safeDate=Number.isNaN(date.getTime())?new Date():date;
  const regionCampaign=[input.region,input.campaign].filter(Boolean).join(" - ")||"Sin región - Sin campaña";
  return[safeName(input.client,80),safeName(input.contract||"Sin contrato",80),safeName(String(input.year||safeDate.getFullYear()),20),safeName(regionCampaign,100),safeName(`${monthName(safeDate)} - Guías`,40)];
}
export async function archiveGuidePdf(input:{pdf:Uint8Array|Buffer;filename:string;client:string;contract?:string|null;campaign?:string|null;region?:string|null;year?:string|number|null;archiveDate?:string|Date|null}){
  const {rootFolderId}=env(),token=await accessToken();
  const resolvedRootFolderId=await resolveRootFolder(token,rootFolderId);
  let parent=resolvedRootFolderId;
  for(const part of archiveParts(input)){parent=await ensureFolder(token,parent,part)}
  const boundary=`alemsi_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const metadata=JSON.stringify({name:safeName(input.filename),parents:[parent]});
  const prefix=Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`);
  const suffix=Buffer.from(`\r\n--${boundary}--`);
  const body=Buffer.concat([prefix,Buffer.from(input.pdf),suffix]);
  const response=await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,webViewLink,parents&supportsAllDrives=true`,{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":`multipart/related; boundary=${boundary}`},body,cache:"no-store"});
  const data:any=await response.json();if(!response.ok||!data.id)throw new Error(`Google Drive subir PDF: ${data.error?.message||response.status}`);
  return{id:String(data.id),name:String(data.name||input.filename),webViewLink:data.webViewLink?String(data.webViewLink):`https://drive.google.com/file/d/${data.id}/view`,folderId:parent};
}
