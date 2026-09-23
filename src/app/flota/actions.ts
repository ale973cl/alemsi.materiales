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
 if(error){if(error.code==="23505")throw new Error("La patente ya está registrada.");throw new Error("No fue posible registrar el vehículo.");}
 revalidatePath("/flota");
}
