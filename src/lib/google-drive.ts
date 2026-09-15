import "server-only";
import {createSign} from "node:crypto";

const DRIVE_SCOPE="https://www.googleapis.com/auth/drive.file";
const TOKEN_URL="https://oauth2.googleapis.com/token";
const DRIVE_FILES_URL="https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL="https://www.googleapis.com/upload/drive/v3/files";

function env(){
  const email=process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey=process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g,"\n").trim();
  const rootFolderId=process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim();
  if(!email||!privateKey||!rootFolderId)throw new Error("Google Drive no está configurado");
  return{email,privateKey,rootFolderId};
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
