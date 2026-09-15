import "server-only";
import {createClient} from "@supabase/supabase-js";

// Cliente exclusivo de servidor para validar accesos temporales de conteo.
// Nunca exponer la clave privada al navegador.
export function createPublicTokenAdminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error("PUBLIC_TOKEN_SERVER_CONFIG_MISSING");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
