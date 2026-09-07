import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";

const roles=["Admin Total","Gerencia","Admin","Supervisora","Finanzas","Bodega"];
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});

Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({error:"Método no permitido"},405);
 const authorization=req.headers.get("authorization");if(!authorization)return json({error:"Sesión no válida"},401);
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const caller=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const {data:{user:actor},error:userError}=await caller.auth.getUser();if(userError||!actor)return json({error:"Sesión no válida"},401);
 const {data:actorProfile}=await caller.from("user_profiles").select("role,active,full_name,email").eq("id",actor.id).single();
 if(!actorProfile?.active||actorProfile.role!=="Admin Total")return json({error:"Solo Admin Total puede administrar usuarios"},403);
 const body=await req.json();const action=String(body.action||"");
 const fullName=String(body.full_name||"").trim(),email=String(body.email||"").trim().toLowerCase(),role=String(body.role||""),active=body.active!==false;
 if(!fullName||!/^\S+@\S+\.\S+$/.test(email)||!roles.includes(role))return json({error:"Nombre, correo y perfil válido son obligatorios"},400);
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});

 if(action==="invite"){
  const options:any={data:{full_name:fullName}};if(body.redirect_to)options.redirectTo=String(body.redirect_to);
  const {data:invited,error:inviteError}=await admin.auth.admin.inviteUserByEmail(email,options);
  if(inviteError)return json({error:inviteError.message},400);
  const invitedUser=invited.user;if(!invitedUser)return json({error:"Supabase no devolvió el usuario invitado"},500);
  const {error:profileError}=await admin.from("user_profiles").upsert({id:invitedUser.id,full_name:fullName,email,role,active,updated_at:new Date().toISOString()},{onConflict:"id"});
  if(profileError){await admin.auth.admin.deleteUser(invitedUser.id);return json({error:profileError.message},500)}
  await admin.from("activity_log").insert({actor_id:actor.id,actor_name:actorProfile.full_name||actorProfile.email,module:"Usuarios",action:"Creó/invitó usuario",entity_table:"user_profiles",entity_id:invitedUser.id,new_data:{full_name:fullName,email,role,active},observation:`Invitación Auth enviada. Perfil asignado: ${role==="Admin"?"Operaciones":role}`});
  return json({ok:true,id:invitedUser.id,email,role,active});
 }

 if(action==="update"){
  const userId=String(body.user_id||"");if(!userId)return json({error:"Usuario obligatorio"},400);
  const {data:oldProfile,error:oldError}=await admin.from("user_profiles").select("id,full_name,email,role,active").eq("id",userId).single();
  if(oldError||!oldProfile)return json({error:"Usuario no encontrado"},404);
  if(userId===actor.id&&(email!==String(oldProfile.email||"").toLowerCase()||role!=="Admin Total"||!active))return json({error:"No puedes cambiar tu propio correo, perfil Admin Total o estado desde esta ficha"},400);
  const authUpdate:any={email,user_metadata:{full_name:fullName},email_confirm:true};
  const {data:authUser,error:authError}=await admin.auth.admin.updateUserById(userId,authUpdate);if(authError)return json({error:authError.message},400);
  const {data:updated,error:profileError}=await admin.from("user_profiles").update({full_name:fullName,email,role,active,updated_at:new Date().toISOString()}).eq("id",userId).select("id,full_name,email,role,active").single();
  if(profileError)return json({error:profileError.message},500);
  await admin.from("activity_log").insert({actor_id:actor.id,actor_name:actorProfile.full_name||actorProfile.email,module:"Usuarios",action:"Actualizar usuario",entity_table:"user_profiles",entity_id:userId,old_data:oldProfile,new_data:updated,observation:email!==oldProfile.email?"Se actualizó también el correo de acceso en Supabase Auth.":null});
  return json({ok:true,user:updated,auth_email:authUser.user?.email||email});
 }
 return json({error:"Acción no válida"},400);
});
