import {NextResponse} from "next/server";

const DRIVE_SCOPE="https://www.googleapis.com/auth/drive.file";

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
    const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id",clientId);
    url.searchParams.set("redirect_uri",redirectUri);
    url.searchParams.set("response_type","code");
    url.searchParams.set("scope",DRIVE_SCOPE);
    url.searchParams.set("access_type","offline");
    url.searchParams.set("prompt","consent");
    url.searchParams.set("include_granted_scopes","true");
    return NextResponse.redirect(url);
  }catch(error){
    console.error("GOOGLE_DRIVE_OAUTH_START_ERROR",error);
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"No se pudo iniciar Google Drive OAuth"},{status:500});
  }
}
