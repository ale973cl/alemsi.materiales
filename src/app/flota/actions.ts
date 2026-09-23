"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

function clean(value:FormDataEntryValue|null,max:number){return String(value??"").trim().slice(0,max)}
export async function createVehicle(formData:FormData){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
 if(!profile?.active||profile.role!=="Admin Total")throw new Error("Solo Admin Total puede registrar vehículos en esta etapa.");
 const {data:allowed}=await supabase.rpc("has_additional_service_access",{p_service_code:"flota"});
 if(!allowed)throw new Error("Flota no está habilitada para este usuario.");
 const plate=clean(formData.get("plate"),10).toUpperCase().replace(/[^A-Z0-9]/g,"");
 const label=clean(formData.get("label"),80);
 const brand=clean(formData.get("brand"),60)||null,model=clean(formData.get("model"),60)||null;
 const yearRaw=Number(formData.get("year")||0),km=Number(formData.get("current_km")||0);
 if(plate.length<4||!label||!Number.isInteger(km)||km<0)throw new Error("Revisa patente, identificación y kilometraje.");
 const year=yearRaw?Math.trunc(yearRaw):null;
 if(year!==null&&(year<1950||year>2100))throw new Error("Año de vehículo inválido.");
 const {error}=await supabase.from("fleet_vehicles").insert({plate,label,brand,model,year,current_km:km,created_by:user.id});
 if(error){
  if(error.code==="23505")redirect("/flota?notice=duplicate");
  redirect("/flota?notice=create-error");
 }
 revalidatePath("/flota");
 redirect("/flota?notice=created");
}


async function requireFleetUser(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 const {data:profile}=await supabase.from("user_profiles").select("id,full_name,role,active").eq("id",user.id).single();
 if(!profile?.active)throw new Error("Usuario inactivo.");
 const {data:allowed}=await supabase.rpc("has_additional_service_access",{p_service_code:"flota"});
 if(!allowed)throw new Error("No tienes acceso a Flota.");
 return {supabase,user,profile};
}
export async function takeVehicle(formData:FormData){
 const {supabase,user,profile}=await requireFleetUser();
 const vehicleId=clean(formData.get("vehicle_id"),80),rut=clean(formData.get("driver_rut"),20),comment=clean(formData.get("comment"),800);
 const startKm=Number(formData.get("start_km"));
 if(!vehicleId||!rut||!Number.isInteger(startKm)||startKm<0)throw new Error("Completa RUT y kilometraje.");
 const {data:v}=await supabase.from("fleet_vehicles").select("id,status,current_km").eq("id",vehicleId).maybeSingle();
 if(!v||v.status!=="Disponible")throw new Error("El vehículo ya no está disponible.");
 if(startKm<Number(v.current_km))throw new Error("El kilometraje no puede ser menor al último registrado.");
 const {error}=await supabase.from("fleet_assignments").insert({vehicle_id:vehicleId,driver_user_id:user.id,driver_name:profile.full_name||"Usuario",driver_rut:rut,start_km:startKm,take_comment:comment||null,created_by:user.id});
 if(error)throw new Error("No fue posible iniciar el uso del vehículo.");
 const {error:updateError}=await supabase.from("fleet_vehicles").update({status:"En uso",current_km:startKm,updated_at:new Date().toISOString()}).eq("id",vehicleId).eq("status","Disponible");
 if(updateError)throw new Error("El uso se registró, pero no se pudo actualizar el estado del vehículo.");
 revalidatePath("/flota");revalidatePath("/flota/"+vehicleId);
}
export async function returnVehicle(formData:FormData){
 const {supabase}=await requireFleetUser();
 const vehicleId=clean(formData.get("vehicle_id"),80),assignmentId=clean(formData.get("assignment_id"),80),comment=clean(formData.get("comment"),800);
 const endKm=Number(formData.get("end_km"));
 if(!vehicleId||!assignmentId||!Number.isInteger(endKm)||endKm<0)throw new Error("Kilometraje de devolución inválido.");
 const {data:a}=await supabase.from("fleet_assignments").select("id,start_km,returned_at").eq("id",assignmentId).eq("vehicle_id",vehicleId).maybeSingle();
 if(!a||a.returned_at)throw new Error("Este uso ya fue cerrado.");
 if(endKm<Number(a.start_km))throw new Error("El kilometraje final no puede ser menor al inicial.");
 const now=new Date().toISOString();
 const {error}=await supabase.from("fleet_assignments").update({returned_at:now,end_km:endKm,return_comment:comment||null,status:"Devuelto"}).eq("id",assignmentId).is("returned_at",null);
 if(error)throw new Error("No fue posible cerrar el uso.");
 const {error:updateError}=await supabase.from("fleet_vehicles").update({status:"Disponible",current_km:endKm,updated_at:now}).eq("id",vehicleId);
 if(updateError)throw new Error("La devolución quedó registrada, pero no se pudo actualizar el vehículo.");
 revalidatePath("/flota");revalidatePath("/flota/"+vehicleId);
}

export async function updateVehicle(formData:FormData){
 const {supabase,profile}=await requireFleetUser();
 if(profile.role!=="Admin Total")throw new Error("Solo Admin Total puede editar los datos maestros del vehículo.");
 const id=clean(formData.get("vehicle_id"),80),plate=clean(formData.get("plate"),10).toUpperCase().replace(/[^A-Z0-9]/g,""),label=clean(formData.get("label"),80);
 const brand=clean(formData.get("brand"),60)||null,model=clean(formData.get("model"),60)||null;
 const yearRaw=Number(formData.get("year")||0),km=Number(formData.get("current_km")||0);
 if(!id||plate.length<4||!label||!Number.isInteger(km)||km<0)throw new Error("Revisa los datos del vehículo.");
 const year=yearRaw?Math.trunc(yearRaw):null;if(year!==null&&(year<1950||year>2100))throw new Error("Año inválido.");
 const {error}=await supabase.from("fleet_vehicles").update({plate,label,brand,model,year,current_km:km,updated_at:new Date().toISOString()}).eq("id",id);
 if(error){if(error.code==="23505")redirect("/flota/"+id+"?notice=duplicate");redirect("/flota/"+id+"?notice=edit-error");}
 revalidatePath("/flota");revalidatePath("/flota/"+id);redirect("/flota/"+id+"?notice=updated");
}
