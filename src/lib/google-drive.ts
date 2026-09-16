import "server-only";
import {createPrivateKey,createSign} from "node:crypto";

// La cuenta de servicio trabaja exclusivamente dentro de la carpeta raíz que
// ALEMSI le comparte como Editor. El scope drive permite acceder a esa carpeta
// compartida; drive.file puede no verla cuando fue creada por otro usuario.
const DRIVE_SCOPE="https://www.googleapis.com/auth/drive";
const TOKEN_URL="https://oauth2.googleapis.com/token";
const DRIVE_FILES_URL="https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL="https://www.googleapis.com/upload/drive/v3/files";

function normalizePrivateKey(raw:string){
  let value=raw.trim();

  // Acepta el JSON completo de Google, un string JSON o el valor aislado de
  // private_key. Esto evita que las comillas/escapes copiados desde el JSON
  // lleguen a OpenSSL como parte de la clave.
  try{
    const parsed=JSON.parse(value);
    if(typeof parsed==="string")value=parsed;
    else if(parsed&&typeof parsed.private_key==="string")value=parsed.private_key;
  }catch{
    const field=value.match(/["']?private_key["']?\s*:\s*("(?:\\.|[^"\\])*")\s*,?/);
    if(field){
      try{value=JSON.parse(field[1])}catch{value=field[1].slice(1,-1)}
    }
  }

  value=value
    .replace(/^["']|["'],?$/g,"")
    .replace(/\\r\\n/g,"\n")
    .replace(/\\n/g,"\n")
    .replace(/\r\n?/g,"\n")
    .trim();

  if(!value.includes("-----BEGIN PRIVATE KEY-----")||!value.includes("-----END PRIVATE KEY-----")){
    throw new Error("GOOGLE_DRIVE_PRIVATE_KEY no contiene una clave PEM válida");
  }

  try{
    return createPrivateKey({key:value,format:"pem"});
  }catch{
    throw new Error("GOOGLE_DRIVE_PRIVATE_KEY tiene formato PEM inválido; vuelva a copiar private_key desde el JSON de Google Cloud");
  }
}

function env(){
  const email=process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKeyRaw=process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  const rootFolderId=process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim();
  if(!email||!privateKeyRaw||!rootFolderId)throw new Error("Google Drive no está configurado");
  return{email,privateKey:normalizePrivateKey(privateKeyRaw),rootFolderId};
}
function b64url(value:string|Buffer){return Buffer.from(value).toString("base64url")}
async function accessToken(){
  const {email,privateKey}=env(),now=Math.floor(Date.now()/1000);
  const header=b64url(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const claims=b64url(JSON.stringify({iss:email,scope:DRIVE_SCOPE,aud:TOKEN_URL,iat:now,exp:now+3600}));
  const unsigned=`${header}.${claims}`;
  const signer=createSign("RSA-SHA256");signer.update(unsigned);signer.end();
  const assertion=`${unsigned}.${b64url(signer.sign(privateKey))}`;
  const body=new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion});
  const response=await fetch(TOKEN_URL,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body,cache:"no-store"});
  const data:any=await response.json();
  if(!response.ok||!data.access_token)throw new Error(`Google Drive auth: ${data.error_description||data.error||response.status}`);
  return String(data.access_token);
}
function q(value:string){return value.replace(/\\/g,"\\\\").replace(/'/g,"\\'")}
async function assertRootAccess(token:string,rootFolderId:string){
  const response=await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(rootFolderId)}?fields=id,name,mimeType,capabilities(canAddChildren)&supportsAllDrives=true`,{headers:{authorization:`Bearer ${token}`},cache:"no-store"});
  const data:any=await response.json();
  if(!response.ok)throw new Error(`Google Drive carpeta raíz: ${data.error?.message||response.status}`);
  if(data.mimeType!=="application/vnd.google-apps.folder")throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID no corresponde a una carpeta");
  if(data.capabilities?.canAddChildren===false)throw new Error("La cuenta de servicio no tiene permiso Editor en la carpeta raíz de Drive");
  return data;
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
function safeName(value:string){return(value||"Sin nombre").replace(/[\\/:*?"<>|]/g,"-").replace(/\s+/g," ").trim().slice(0,120)||"Sin nombre"}
export async function archiveGuidePdf(input:{pdf:Uint8Array|Buffer;filename:string;client:string;contract?:string|null;campaign?:string|null;year?:string|number|null}){
  const {rootFolderId}=env(),token=await accessToken();
  await assertRootAccess(token,rootFolderId);
  let parent=rootFolderId;
  for(const part of [safeName(input.client),safeName(input.contract||"Sin contrato"),safeName(String(input.year||new Date().getFullYear())),safeName(input.campaign||"Sin campaña"),"Guías"]){parent=await ensureFolder(token,parent,part)}
  const boundary=`alemsi_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const metadata=JSON.stringify({name:safeName(input.filename),parents:[parent]});
  const prefix=Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`);
  const suffix=Buffer.from(`\r\n--${boundary}--`);
  const body=Buffer.concat([prefix,Buffer.from(input.pdf),suffix]);
  const response=await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,webViewLink,parents&supportsAllDrives=true`,{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":`multipart/related; boundary=${boundary}`},body,cache:"no-store"});
  const data:any=await response.json();if(!response.ok||!data.id)throw new Error(`Google Drive subir PDF: ${data.error?.message||response.status}`);
  return{id:String(data.id),name:String(data.name||input.filename),webViewLink:data.webViewLink?String(data.webViewLink):`https://drive.google.com/file/d/${data.id}/view`,folderId:parent};
}
