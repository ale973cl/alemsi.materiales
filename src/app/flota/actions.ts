"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {FLEET_DOCUMENT_TEMPLATES} from "@/modules/flota/document-reader";

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
 const brand=clean(formData.get("brand"),60)||null,model=clean(formData.get("model"),60)||null,vehicle_type=clean(formData.get("vehicle_type"),40)||null,chassis_vin=clean(formData.get("chassis_vin"),40).toUpperCase()||null;
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
 const vehicle_type=clean(formData.get("vehicle_type"),40)||null;
 const chassis_vin=clean(formData.get("chassis_vin"),40).toUpperCase()||null;
 const yearRaw=Number(formData.get("year")||0),km=Number(formData.get("current_km")||0);
 if(!id||plate.length<4||!label||!Number.isInteger(km)||km<0)throw new Error("Revisa los datos del vehículo.");
 const year=yearRaw?Math.trunc(yearRaw):null;if(year!==null&&(year<1950||year>2100))throw new Error("Año inválido.");
 const {error}=await supabase.from("fleet_vehicles").update({plate,label,brand,model,vehicle_type,chassis_vin,year,current_km:km,updated_at:new Date().toISOString()}).eq("id",id);
 if(error){if(error.code==="23505")redirect("/flota/"+id+"?notice=duplicate");redirect("/flota/"+id+"?notice=edit-error");}
 revalidatePath("/flota");revalidatePath("/flota/"+id);redirect("/flota/"+id+"?notice=updated");
}

export async function saveFleetDocument(formData:FormData){
 const {supabase,user}=await requireFleetUser();
 const vehicleId=clean(formData.get("vehicle_id"),80);
 const kind=clean(formData.get("kind"),50).toUpperCase();
 const template=FLEET_DOCUMENT_TEMPLATES.find(t=>t.kind===kind);
 if(!vehicleId||!template)throw new Error("Selecciona un tipo de documento válido.");
 const file=formData.get("document_file");
 const allowedFiles=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
 if(!(file instanceof File)||file.size<=0||!allowedFiles.has(file.type))throw new Error("Selecciona el archivo original en PDF, JPG, PNG o WEBP.");
 if(file.size>10*1024*1024)throw new Error("El archivo original no puede superar 10 MB.");
 const {data:v}=await supabase.from("fleet_vehicles").select("id,plate,chassis_vin").eq("id",vehicleId).maybeSingle();
 if(!v)throw new Error("Vehículo no encontrado.");
 const validFrom=clean(formData.get("valid_from"),10)||null;
 const expiresAt=clean(formData.get("expires_at"),10)||null;
 const insurer=clean(formData.get("insurer"),100)||null;
 const policyNumber=clean(formData.get("policy_number"),100)||null;
 const documentPlate=clean(formData.get("document_plate"),10).toUpperCase().replace(/[^A-Z0-9]/g,"")||null;
 const documentVin=clean(formData.get("document_vin"),40).toUpperCase()||null;
 const assistancePhone=clean(formData.get("assistance_phone"),50)||null;
 const instructions=clean(formData.get("instructions"),1500)||null;
 const services=String(formData.get("services")??"").split(",").map(x=>x.trim()).filter(Boolean).slice(0,30);
 const requiresReview=Boolean((documentPlate&&documentPlate!==v.plate)||(documentVin&&v.chassis_vin&&documentVin!==String(v.chassis_vin).toUpperCase()));
 const {data:current}=await supabase.from("fleet_documents").select("id,version").eq("vehicle_id",vehicleId).eq("kind",kind).eq("is_current",true).maybeSingle();
 const nextVersion=(current?.version??0)+1;
 const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-140)||"documento";
 const storagePath=`${vehicleId}/${kind.toLowerCase()}/v${nextVersion}-${crypto.randomUUID()}-${safeName}`;
 const {error:uploadError}=await supabase.storage.from("fleet-documents").upload(storagePath,file,{contentType:file.type,upsert:false});
 if(uploadError)throw new Error("No fue posible cargar el archivo original de Flota.");
 if(current){const {error:e}=await supabase.from("fleet_documents").update({is_current:false,updated_at:new Date().toISOString()}).eq("id",current.id);if(e){await supabase.storage.from("fleet-documents").remove([storagePath]);throw new Error("No fue posible cerrar la versión anterior.");}}
 const confirmedData={plate:documentPlate,vin:documentVin,valid_from:validFrom,expires_at:expiresAt,insurer,policy_number:policyNumber,assistance_phone:assistancePhone,instructions,services};
 const {error}=await supabase.from("fleet_documents").insert({vehicle_id:vehicleId,kind,version:nextVersion,valid_from:validFrom,expires_at:expiresAt,insurer,policy_number:policyNumber,assistance_phone:assistancePhone,instructions,services,document_plate:documentPlate,document_vin:documentVin,confirmed_data:confirmedData,reader_status:requiresReview?"Revisar":"Confirmado",storage_path:storagePath,source_file_name:file.name,is_current:true,created_by:user.id});
 if(error){if(current)await supabase.from("fleet_documents").update({is_current:true,updated_at:new Date().toISOString()}).eq("id",current.id);await supabase.storage.from("fleet-documents").remove([storagePath]);throw new Error("No fue posible guardar el documento.");}
 revalidatePath("/flota/"+vehicleId);
 redirect("/flota/"+vehicleId+"?vista=documentos&notice=document-saved");
}
