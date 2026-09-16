import {NextRequest,NextResponse} from "next/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const TOKEN_URL="https://oauth2.googleapis.com/token";
const STATE_COOKIE="google_drive_oauth_state";

function html(message:string,status=200){
  return new NextResponse(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="referrer" content="no-referrer"><title>Google Drive OAuth</title></head><body style="font-family:Arial,sans-serif;max-width:720px;margin:48px auto;padding:24px;color:#10233f"><h1>Google Drive</h1>${message}</body></html>`,{status,headers:{"content-type":"text/html; charset=utf-8","Cache-Control":"no-store, max-age=0","Pragma":"no-cache","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
}

export async function GET(request:NextRequest){
  const state=request.nextUrl.searchParams.get("state");
  const expectedState=request.cookies.get(STATE_COOKIE)?.value;
  const code=request.nextUrl.searchParams.get("code");
  const oauthError=request.nextUrl.searchParams.get("error");
  let response:NextResponse;
  try{
    if(oauthError)throw new Error("La autorización fue cancelada o rechazada");
    if(!state||!expectedState||state!==expectedState)throw new Error("La autorización expiró o no es válida. Iníciela nuevamente");
    if(!code)throw new Error("Google no devolvió el código de autorización");

    const clientId=process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim();
    const clientSecret=process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim();
    if(!clientId||!clientSecret)throw new Error("Google Drive OAuth no está configurado");
    const redirectUri=new URL("/api/google-drive/oauth/callback",request.url).toString();
    const tokenResponse=await fetch(TOKEN_URL,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,grant_type:"authorization_code",redirect_uri:redirectUri}),cache:"no-store"});
    const tokenData:any=await tokenResponse.json();
    if(!tokenResponse.ok)throw new Error("Google rechazó el intercambio OAuth");
    const refreshToken=typeof tokenData.refresh_token==="string"?tokenData.refresh_token:"";
    if(!refreshToken)throw new Error("Google no entregó refresh_token. Revoca el acceso anterior e inicia nuevamente la autorización");

    const encoded=JSON.stringify(refreshToken).replace(/</g,"\\u003c");
    response=html(`<p>Autorización completada. Copia este valor una sola vez en Vercel como <strong>GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN</strong>.</p><input id="token" type="password" readonly style="width:100%;padding:12px;box-sizing:border-box" aria-label="Refresh token"><p><button id="copy" style="padding:10px 16px">Copiar token</button> <button id="show" style="padding:10px 16px">Mostrar/ocultar</button></p><p id="status">Esta página no guarda el token. Ciérrala después de copiarlo.</p><script>const value=${encoded};const input=document.getElementById("token");input.value=value;document.getElementById("copy").onclick=async()=>{await navigator.clipboard.writeText(value);document.getElementById("status").textContent="Token copiado. Guárdalo en Vercel y cierra esta página."};document.getElementById("show").onclick=()=>{input.type=input.type==="password"?"text":"password"};</script>`);
  }catch(error){
    const message=error instanceof Error?error.message:"No se pudo completar Google Drive OAuth";
    response=html(`<p>No se completó la autorización.</p><p>${message.replace(/[<>&]/g,"")}</p><p>Vuelve a iniciar desde <code>/api/google-drive/oauth/start</code>.</p>`,400);
  }
  response.cookies.set(STATE_COOKIE,"",{httpOnly:true,secure:true,sameSite:"lax",path:"/api/google-drive/oauth",maxAge:0});
  return response;
}
