"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

const USER_ROLES=["Admin Total","Gerencia","Admin","Supervisora","Finanzas","Bodega"] as const;
type UserRole=typeof USER_ROLES[number];
type ActionResult={ok:boolean;error?:string;message?:string;[key:string]:unknown};

async function adminContext(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)throw new Error("Sesión no válida");
 const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
 if(!profile?.active||profile.role!=="Admin Total")throw new Error("Solo Admin Total puede administrar usuarios");
 const {data:{session}}=await supabase.auth.getSession();
 if(!session?.access_token)throw new Error("Sesión no válida");
 return{supabase,user,token:session.access_token};
}

async function callUserManager(token:string,payload:Record<string,unknown>):Promise<ActionResult>{
 try{
  const response=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-material-user`,{
   method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(payload),cache:"no-store"
  });
  const text=await response.text();
  let result:any={};
  try{result=text?JSON.parse(text):{};}catch{result={error:text||`Respuesta HTTP ${response.status}`};}
  if(!response.ok)return{ok:false,error:String(result.error||`Error HTTP ${response.status}`)};
  return{ok:true,...result};
 }catch(error:any){return{ok:false,error:error?.message||"No se pudo conectar con el servicio de usuarios"};}
}

export async function inviteMaterialUser(formData:FormData):Promise<ActionResult>{
 try{
  const {token}=await adminContext();
  const fullName=String(formData.get("full_name")||"").trim();
  const email=String(formData.get("email")||"").trim().toLowerCase();
  const role=String(formData.get("role")||"") as UserRole;
  const active=String(formData.get("active")||"")==="true";
  if(!fullName||!/^\S+@\S+\.\S+$/.test(email)||!USER_ROLES.includes(role))return{ok:false,error:"Nombre, correo y perfil válido son obligatorios"};
  const deploymentHost=process.env.VERCEL_BRANCH_URL||process.env.VERCEL_URL;
  const appUrl=deploymentHost?`https://${deploymentHost}`:process.env.NEXT_PUBLIC_APP_URL;
  const result=await callUserManager(token,{action:"invite",full_name:fullName,email,role,active,redirect_to:appUrl?`${appUrl.replace(/\/$/,"")}/login`:undefined});
  if(!result.ok)return result;
  revalidatePath("/");return{...result,message:`Invitación enviada a ${email}`};
 }catch(error:any){return{ok:false,error:error?.message||"No se pudo crear la invitación"};}
}

export async function updateMaterialUser(formData:FormData):Promise<ActionResult>{
 try{
  const {user,token}=await adminContext();
  const id=String(formData.get("user_id")||"");
  const fullName=String(formData.get("full_name")||"").trim();
  const email=String(formData.get("email")||"").trim().toLowerCase();
  const role=String(formData.get("role")||"") as UserRole;
  const active=String(formData.get("active")||"")==="true";
  if(!id||!fullName||!/^\S+@\S+\.\S+$/.test(email)||!USER_ROLES.includes(role))return{ok:false,error:"Usuario, nombre, correo y perfil válido son obligatorios"};
  if(id===user.id&&(!active||role!=="Admin Total"))return{ok:false,error:"No puedes quitar tu propio acceso de Admin Total"};
  const result=await callUserManager(token,{action:"update",user_id:id,full_name:fullName,email,role,active});
  if(!result.ok)return result;
  revalidatePath("/");return{...result,message:"Usuario actualizado correctamente"};
 }catch(error:any){return{ok:false,error:error?.message||"No se pudo actualizar el usuario"};}
}
