"use server";

import {createClient} from "@/lib/supabase/server";
import {revalidatePath} from "next/cache";

async function context(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) throw new Error("Sesión no válida");
 const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
 if(!profile?.active||!["Admin Total","Gerencia","Admin"].includes(profile.role)) throw new Error("No autorizado");
 return supabase;
}

export async function loadClientMaterialCatalog(clientId:string){
 const supabase=await context();
 const [{data:materials,error:mError},{data:assigned,error:aError}]=await Promise.all([
  supabase.from("materials").select("id,family,name,presentation,unit,supplier_code,current_net_price").eq("active",true).order("family").order("name"),
  supabase.from("client_materials").select("material_id,authorized,notes").eq("client_id",clientId)
 ]);
 if(mError) throw mError;if(aError) throw aError;
 return {materials:materials||[],assigned:assigned||[]};
}

export async function saveClientMaterial(input:{client_id:string;material_id:string;authorized:boolean;notes?:string|null}){
 const supabase=await context();
 const {error}=await supabase.from("client_materials").upsert({client_id:input.client_id,material_id:input.material_id,authorized:input.authorized,notes:input.notes||null,updated_at:new Date().toISOString()},{onConflict:"client_id,material_id"});
 if(error) throw error;revalidatePath("/");return {ok:true};
}

export async function loadContractBudget(contractId:string){
 const supabase=await context();
 const [{data:contract,error:cError},{data:installations,error:iError},{data:allocations,error:aError}]=await Promise.all([
  supabase.from("contracts").select("id,name,net_budget").eq("id",contractId).single(),
  supabase.from("installations").select("id,name").eq("contract_id",contractId).eq("active",true).order("name"),
  supabase.from("contract_budget_allocations").select("installation_id,allocated_net,notes").eq("contract_id",contractId)
 ]);
 if(cError) throw cError;if(iError) throw iError;if(aError) throw aError;
 return {contract,installations:installations||[],allocations:allocations||[]};
}

export async function saveContractBudget(input:{contract_id:string;net_budget:number;allocations:{installation_id:string;allocated_net:number;notes?:string|null}[]}){
 const supabase=await context();const budget=Number(input.net_budget||0);
 if(budget<0) throw new Error("El límite del contrato no puede ser negativo");
 const total=input.allocations.reduce((s,x)=>s+Number(x.allocated_net||0),0);
 if(total>budget) throw new Error(`La distribución por instalaciones (${total}) supera el límite global del contrato (${budget})`);
 const {error:cError}=await supabase.from("contracts").update({net_budget:budget,updated_at:new Date().toISOString()}).eq("id",input.contract_id);
 if(cError) throw cError;
 const {error:dError}=await supabase.from("contract_budget_allocations").delete().eq("contract_id",input.contract_id);if(dError) throw dError;
 const rows=input.allocations.filter(x=>Number(x.allocated_net||0)>0).map(x=>({contract_id:input.contract_id,installation_id:x.installation_id,allocated_net:Number(x.allocated_net||0),notes:x.notes||null}));
 if(rows.length){const {error}=await supabase.from("contract_budget_allocations").insert(rows);if(error) throw error;}
 revalidatePath("/");return {ok:true,total,remaining:budget-total};
}
