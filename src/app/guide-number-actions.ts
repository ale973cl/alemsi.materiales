"use server";
import {createClient} from "@/lib/supabase/server";
import {revalidatePath} from "next/cache";
async function authorized(adminOnly:boolean){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)throw new Error("Sesión no válida");
 const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
 if(!profile?.active||!["Admin Total","Gerencia","Admin"].includes(profile.role)||adminOnly&&profile.role!=="Admin Total")throw new Error("No autorizado");
 return supabase;
}
export async function getGuideSequenceStatus(){
 const supabase=await authorized(false);
 const {data,error}=await supabase.rpc("dispatch_guide_sequence_status");
 if(error)throw new Error(error.message);
 const row=Array.isArray(data)?data[0]:data;
 return{next:Number(row?.next_number||0),highest:Number(row?.highest_issued||0)};
}
export async function configureGuideSequence(next:number){
 if(!Number.isSafeInteger(next)||next<1||next>999999)throw new Error("Correlativo inválido");
 const supabase=await authorized(true);
 const {data,error}=await supabase.rpc("configure_dispatch_guide_next_number",{p_next:next});
 if(error)throw new Error(error.message);
 revalidatePath("/");
 return{next:Number(data)};
}
