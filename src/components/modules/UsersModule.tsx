"use client";
import {useState} from "react";
import {inviteMaterialUser,setTemporaryPassword,updateMaterialUser} from "@/app/user-actions";

export type UserProfileRow={id:string;full_name?:string|null;email?:string|null;role:string;active:boolean;created_at?:string};

const roles=[
 {value:"Admin Total",label:"Admin Total"},
 {value:"Gerencia",label:"Gerencia"},
 {value:"Admin",label:"Operaciones"},
 {value:"Finanzas",label:"Finanzas"},
 {value:"Bodega",label:"Bodega"},
 {value:"Supervisora",label:"Supervisora"},
];
const roleLabel=(role:string)=>roles.find(item=>item.value===role)?.label||role;

export default function UsersModule({users,currentUserId}:{users:UserProfileRow[];currentUserId:string}){
 const [selected,setSelected]=useState("");
 const [showNew,setShowNew]=useState(false);
 const [inviteMessage,setInviteMessage]=useState("");
 const [inviteBusy,setInviteBusy]=useState(false);
 const [editMessage,setEditMessage]=useState("");
 const [editBusy,setEditBusy]=useState(false);
 const [passwordBusy,setPasswordBusy]=useState(false);
 const [passwordMessage,setPasswordMessage]=useState("");
 const [testBusy,setTestBusy]=useState(false);
 const [testMessage,setTestMessage]=useState("");
 const user=users.find(item=>item.id===selected)||null;


 const submitInvite=async(formData:FormData)=>{
  setInviteBusy(true);setInviteMessage("Creando usuario...");
  const result=await inviteMaterialUser(formData);
  setInviteMessage(result.ok?(result.message||"Usuario creado correctamente"):"Error: "+(result.error||"No se pudo crear el usuario"));
  if(result.ok)setShowNew(false);
  setInviteBusy(false);
 };
 const submitEdit=async(formData:FormData)=>{
  setEditBusy(true);setEditMessage("Guardando...");
  const result=await updateMaterialUser(formData);
  setEditMessage(result.ok?(result.message||"Usuario actualizado"):"Error: "+(result.error||"No se pudo actualizar el usuario"));
  setEditBusy(false);
 };
 const submitTemporaryPassword=async(formData:FormData)=>{
  setPasswordBusy(true);setPasswordMessage("Asignando clave temporal...");
  const result=await setTemporaryPassword(formData);
  setPasswordMessage(result.ok?(result.message||"Clave temporal asignada"):"Error: "+(result.error||"No se pudo asignar la clave temporal"));
  setPasswordBusy(false);
 };
 const testEmail=async()=>{
  if(!user?.email){setTestMessage("Error: el usuario seleccionado no tiene correo");return}
  setTestBusy(true);setTestMessage("Probando envío a "+user.email+"...");
  try{
   const response=await fetch("/api/email/test",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:user.email})});
   const result=await response.json().catch(()=>({}));
   setTestMessage(result.ok?"Correo de prueba enviado a "+(result.email||user.email)+". Revisa la bandeja de entrada y spam.":"Error: "+(result.error||"No se pudo completar la prueba SMTP"));
  }catch{setTestMessage("Error: no fue posible ejecutar la prueba de correo")}
  finally{setTestBusy(false)}
 };

 if(showNew)return <section className="panel usersModule"><div className="materialDedicatedHead"><div><button type="button" className="simpleBack" onClick={()=>setShowNew(false)}>← Usuarios</button><h2>Nuevo usuario</h2><p>Crea la cuenta y define su perfil inicial.</p></div></div>{inviteMessage&&<p className="note">{inviteMessage}</p>}<form action={submitInvite} className="adminForm userInviteForm"><label>Nombre<input name="full_name" required placeholder="Nombre completo"/></label><label>Correo<input name="email" type="email" required placeholder="usuario@correo.cl"/></label><label>Perfil de uso<select name="role" defaultValue="Supervisora">{roles.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}</select></label><label>Estado<select name="active" defaultValue="true"><option value="true">Activo</option><option value="false">Inactivo</option></select></label><div className="dedicatedActions"><button type="button" className="secondary" disabled={inviteBusy} onClick={()=>setShowNew(false)}>Cancelar</button><button disabled={inviteBusy}>{inviteBusy?"Creando…":"Crear usuario con ALEMSI2026"}</button></div><small>El usuario queda creado directamente en Supabase Auth. Acceso inicial: correo + ALEMSI2026.</small></form></section>;

 if(user)return <section className="panel usersModule userDedicatedPage">
  <div className="materialDedicatedHead"><div><button type="button" className="simpleBack" onClick={()=>{setSelected("");setEditMessage("");setPasswordMessage("");setTestMessage("")}}>← Usuarios</button><h2>{user.full_name||"Usuario"}</h2><p>{user.email||"Correo pendiente"} · {roleLabel(user.role)}</p></div><span className="catalogCount">{user.active?"Activo":"Inactivo"}</span></div>
  {editMessage&&<p className="note">{editMessage}</p>}
  <form key={user.id} action={submitEdit} className="adminForm userProfileForm"><input type="hidden" name="user_id" value={user.id}/><label>Nombre<input name="full_name" required defaultValue={user.full_name||""}/></label><label>Correo<input name="email" type="email" required defaultValue={user.email||""} disabled={user.id===currentUserId}/>{user.id===currentUserId&&<><input type="hidden" name="email" value={user.email||""}/><small>Tu propio correo de Admin Total no se cambia desde esta ficha.</small></>}</label><label>Perfil de uso<select name="role" defaultValue={user.role}>{roles.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}</select></label><label>Estado<select name="active" defaultValue={String(user.active)} disabled={user.id===currentUserId}><option value="true">Activo</option><option value="false">Inactivo</option></select>{user.id===currentUserId&&<input type="hidden" name="active" value="true"/>}</label><button disabled={editBusy}>{editBusy?"Guardando…":"Guardar usuario"}</button></form>
  <div className="userSecondaryActions"><form action={submitTemporaryPassword} className="adminForm"><input type="hidden" name="user_id" value={user.id}/><h3>Clave temporal</h3><p>Asigna la clave temporal ALEMSI2026 al usuario seleccionado.</p><button disabled={passwordBusy||!user.email}>{passwordBusy?"Asignando…":"Asignar ALEMSI2026"}</button>{passwordMessage&&<small>{passwordMessage}</small>}</form><div className="adminForm"><h3>Prueba de correo</h3><p>Envía un mensaje real usando el SMTP configurado en este Preview.</p><button type="button" disabled={testBusy||!user.email} onClick={testEmail}>{testBusy?"Probando SMTP…":"Probar correo"}</button>{testMessage&&<small>{testMessage}</small>}</div></div>

 </section>;

 return <section className="panel usersModule"><div className="catalogIntro"><div><h2>Usuarios y permisos</h2><p>Selecciona un usuario para abrir su ficha y permisos en una pantalla independiente.</p></div><div className="userHeaderActions"><span className="catalogCount">{users.length} usuarios</span><button type="button" onClick={()=>{setShowNew(true);setInviteMessage("")}}>+ Nuevo usuario</button></div></div>{inviteMessage&&<p className="note">{inviteMessage}</p>}{users.length?<div className="userIndexList">{users.map(item=><button type="button" key={item.id} onClick={()=>{setSelected(item.id);setEditMessage("");setPasswordMessage("");setTestMessage("")}}><span><b>{item.full_name||"Nombre pendiente"}</b><small>{item.email||"Correo pendiente"}</small></span><span>{roleLabel(item.role)}</span><span>{item.active?"Activo":"Inactivo"}</span><strong>Abrir →</strong></button>)}</div>:<div className="empty"><b>No hay perfiles disponibles</b></div>}<p className="catalogNote">El correo identifica la cuenta de acceso. Los cambios quedan trazados.</p></section>;
}
