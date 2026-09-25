"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {REQUIRED_FLEET_PHOTOS} from "@/modules/flota/domain";

function textValue(v:FormDataEntryValue|null,max=800){return String(v??"").trim().slice(0,max)}
async function context(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:profile}=await supabase.from("user_profiles").select("full_name,active").eq("id",user.id).single();
 if(!profile?.active)throw new Error("Usuario inactivo.");
 const {data:allowed}=await supabase.rpc("has_additional_service_access",{p_service_code:"flota"});
 if(!allowed)throw new Error("No tienes acceso a Flota.");
 return {supabase,user,profile};
}
function photoFiles(formData:FormData){
 return REQUIRED_FLEET_PHOTOS.map((position,index)=>{
  const value=formData.get("photo_"+index);
  if(!(value instanceof File)||value.size===0||!value.type.startsWith("image/"))throw new Error("Debes completar las 7 fotografías de inspección.");
  if(value.size>8*1024*1024)throw new Error("Cada fotografía debe pesar máximo 8 MB.");
  return {position,file:value};
 });
}
async function uploadInspection(supabase:any,userId:string,vehicleId:string,assignmentId:string,phase:"Toma"|"Devolución",photos:ReturnType<typeof photoFiles>){
 const uploaded:string[]=[];const rows:any[]=[];
 try{
  for(const [i,item] of photos.entries()){
   const ext=item.file.type==="image/png"?"png":item.file.type==="image/webp"?"webp":"jpg";
   const path=vehicleId+"/"+assignmentId+"/"+phase.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")+"/"+String(i+1).padStart(2,"0")+"-"+crypto.randomUUID()+"."+ext;
   const bytes=await item.file.arrayBuffer();
   const {error}=await supabase.storage.from("fleet-photos").upload(path,bytes,{contentType:item.file.type,upsert:false});
   if(error)throw error;uploaded.push(path);
   rows.push({vehicle_id:vehicleId,assignment_id:assignmentId,phase,position:item.position,storage_path:path,source_file_name:item.file.name||null,captured_by:userId});
  }
  const {error}=await supabase.from("fleet_photos").insert(rows);if(error)throw error;
 }catch(error){if(uploaded.length)await supabase.storage.from("fleet-photos").remove(uploaded);throw error;}
}
export async function takeVehicleWithPhotos(formData:FormData){
 const {supabase,user,profile}=await context();const vehicleId=textValue(formData.get("vehicle_id"),80);
 const rut=textValue(formData.get("driver_rut"),20),comment=textValue(formData.get("comment"));const startKm=Number(formData.get("start_km"));const photos=photoFiles(formData);
 if(!vehicleId||!rut||!Number.isInteger(startKm)||startKm<0)throw new Error("Completa RUT y kilometraje.");
 const {data:v}=await supabase.from("fleet_vehicles").select("id,status,current_km").eq("id",vehicleId).maybeSingle();
 if(!v)redirect("/flota?notice=vehicle-missing");
 if(v.status!=="Disponible"){revalidatePath("/flota/"+vehicleId);redirect("/flota/"+vehicleId+"?notice=already-in-use");}
 if(startKm<Number(v.current_km))throw new Error("El kilometraje no puede ser menor al último registrado.");
 const {data:a,error}=await supabase.from("fleet_assignments").insert({vehicle_id:vehicleId,driver_user_id:user.id,driver_name:profile.full_name||"Usuario",driver_rut:rut,start_km:startKm,take_comment:comment||null,created_by:user.id}).select("id").single();
 if(error||!a)throw new Error("No fue posible iniciar el uso del vehículo.");
 try{await uploadInspection(supabase,user.id,vehicleId,a.id,"Toma",photos);}catch{await supabase.from("fleet_assignments").delete().eq("id",a.id);throw new Error("No fue posible guardar la inspección fotográfica.");}
 const {error:updateError}=await supabase.from("fleet_vehicles").update({status:"En uso",current_km:startKm,updated_at:new Date().toISOString()}).eq("id",vehicleId).eq("status","Disponible");
 if(updateError)throw new Error("La toma quedó registrada, pero no se pudo actualizar el vehículo.");
 revalidatePath("/flota");revalidatePath("/flota/"+vehicleId);redirect("/flota/"+vehicleId+"?notice=taken");
}
export async function returnVehicleWithPhotos(formData:FormData){
 const {supabase,user}=await context();const vehicleId=textValue(formData.get("vehicle_id"),80),assignmentId=textValue(formData.get("assignment_id"),80);
 const comment=textValue(formData.get("comment"));const endKmRaw=textValue(formData.get("end_km"),20);const endKm=Number(endKmRaw);const fuelLevel=textValue(formData.get("return_fuel_level"),20);const photos=photoFiles(formData);
 const allowedFuelLevels=new Set(["Vacío","1/4","1/2","3/4","Lleno"]);
 if(!vehicleId||!assignmentId||endKmRaw===""||!Number.isInteger(endKm)||endKm<0)throw new Error("Debes ingresar un kilometraje final válido.");
 if(!allowedFuelLevels.has(fuelLevel))throw new Error("Debes registrar el nivel de combustible al devolver.");
 const {data:a}=await supabase.from("fleet_assignments").select("id,start_km,returned_at").eq("id",assignmentId).eq("vehicle_id",vehicleId).maybeSingle();
 if(!a)redirect("/flota/"+vehicleId+"?notice=assignment-missing");
 if(a.returned_at){revalidatePath("/flota/"+vehicleId);redirect("/flota/"+vehicleId+"?notice=already-returned");}
 if(endKm<Number(a.start_km))throw new Error("El kilometraje final no puede ser menor al inicial.");
 try{await uploadInspection(supabase,user.id,vehicleId,assignmentId,"Devolución",photos);}catch{throw new Error("No fue posible guardar la inspección fotográfica de devolución.");}
 const now=new Date().toISOString();const {error}=await supabase.from("fleet_assignments").update({returned_at:now,end_km:endKm,return_fuel_level:fuelLevel,return_comment:comment||null,status:"Devuelto"}).eq("id",assignmentId).is("returned_at",null);
 if(error)throw new Error("No fue posible cerrar el uso.");
 const {error:updateError}=await supabase.from("fleet_vehicles").update({status:"Disponible",current_km:endKm,updated_at:now}).eq("id",vehicleId);
 if(updateError)throw new Error("La devolución quedó registrada, pero no se pudo actualizar el vehículo.");
 revalidatePath("/flota");revalidatePath("/flota/"+vehicleId);redirect("/flota/"+vehicleId+"?notice=returned");
}
