import {randomBytes} from "node:crypto";
import {NextResponse} from "next/server";

export const runtime="nodejs";

const DRIVE_SCOPE="https://www.googleapis.com/auth/drive.file";
const STATE_COOKIE="google_drive_oauth_state";

function config(request:Request){
  const clientId=process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim();
  const clientSecret=process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim();
  if(!clientId||!clientSecret)throw new Error("Google Drive OAuth no está configurado");
  const redirectUri=new URL("/api/google-drive/oauth/callback",request.url).toString();
  return{clientId,redirectUri};
}

export async function GET(request:Request){
  try{
    const {clientId,redirectUri}=config(request);
    const state=randomBytes(32).toString("base64url");
    const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id",clientId);
    url.searchParams.set("redirect_uri",redirectUri);
    url.searchParams.set("response_type","code");
    url.searchParams.set("scope",DRIVE_SCOPE);
    url.searchParams.set("access_type","offline");
    url.searchParams.set("prompt","consent");
    url.searchParams.set("include_granted_scopes","true");
    url.searchParams.set("state",state);
    const response=NextResponse.redirect(url);
    response.cookies.set(STATE_COOKIE,state,{httpOnly:true,secure:true,sameSite:"lax",path:"/api/google-drive/oauth",maxAge:600});
    response.headers.set("Cache-Control","no-store");
    return response;
  }catch(error){
    console.error("GOOGLE_DRIVE_OAUTH_START_ERROR",error instanceof Error?error.message:"OAuth start error");
    return NextResponse.json({ok:false,error:"No se pudo iniciar Google Drive OAuth"},{status:500,headers:{"Cache-Control":"no-store"}});
  }
}
