"use server";
import {createClient} from "@/lib/supabase/server";
import {revalidatePath} from "next/cache";

async function allowedContext(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("Sesión no válida");
  const {data:profile}=await supabase.from("user_profiles").select("role,active,full_name,email").eq("id",user.id).single();
  if(!profile?.active||!["Admin Total","Gerencia","Admin"].includes(profile.role))throw new Error("No autorizado para configurar materiales");
  return{supabase,user,profile};
}

export async function loadMaterialProfile(contractId:string,installationId:string|null){
  const {supabase,profile}=await allowedContext();
  if(!contractId)throw new Error("Contrato obligatorio");
  const {data:contract,error:ce}=await supabase.from("contracts").select("id,name,active,client_id,net_budget").eq("id",contractId).eq("active",true).single();
  if(ce||!contract)throw new Error("Contrato no válido o inactivo");

  let installation:any=null;
  if(installationId){
    const r=await supabase.from("installations").select("id,contract_id,name").eq("id",installationId).eq("contract_id",contractId).eq("active",true).single();
    if(r.error||!r.data)throw new Error("Instalación no válida para este contrato");
    installation=r.data;
  }

  const [a,m,c,h]=await Promise.all([
    installationId
      ? supabase.from("contract_materials").select("id,material_id,installation_id,authorized,authorized_qty,source_quantity,source_reference,coverage_status,notes,updated_at,manually_overridden").eq("contract_id",contractId).or(`installation_id.is.null,installation_id.eq.${installationId}`)
      : supabase.from("contract_materials").select("id,material_id,installation_id,authorized,authorized_qty,source_quantity,source_reference,coverage_status,notes,updated_at,manually_overridden").eq("contract_id",contractId).is("installation_id",null),
    supabase.from("materials").select("id,family,name,presentation,unit,supplier_code,current_net_price,active").eq("active",true).order("family").order("name"),
    supabase.from("client_materials").select("material_id,authorized").eq("client_id",contract.client_id),
    installationId
      ? supabase.from("historical_material_records").select("material_id,quantity,unit_net_price,period_label,source_sheet,delivery_date").eq("contract_id",contractId).eq("installation_id",installationId)
      : Promise.resolve({data:[],error:null}) as any
  ]);
  if(a.error)throw a.error;if(m.error)throw m.error;if(c.error)throw c.error;if(h.error)throw h.error;

  const clientCatalogConfigured=(c.data||[]).length>0;
  const clientAllowed=new Set((c.data||[]).filter((x:any)=>x.authorized).map((x:any)=>x.material_id));
  const catalogMaterials=clientCatalogConfigured?(m.data||[]).filter((x:any)=>clientAllowed.has(x.id)):(m.data||[]);

  const assignments=a.data||[];
  const general=new Map(assignments.filter((x:any)=>!x.installation_id).map((x:any)=>[x.material_id,x]));
  const specific=new Map(assignments.filter((x:any)=>x.installation_id===installationId).map((x:any)=>[x.material_id,x]));

  let materials:any[]=[];
  if(installationId){
    const effectiveIds=new Set<string>();
    for(const [materialId,row] of general as any){if(row.authorized)effectiveIds.add(materialId);}
    for(const [materialId,row] of specific as any){if(row.authorized)effectiveIds.add(materialId);else effectiveIds.delete(materialId);}
    materials=catalogMaterials.filter((x:any)=>effectiveIds.has(x.id));
  }else{
    const configuredIds=new Set(assignments.filter((x:any)=>x.authorized).map((x:any)=>x.material_id));
    materials=catalogMaterials.filter((x:any)=>configuredIds.has(x.id));
  }

  const historyByMaterial:Record<string,any>={};
  for(const x of h.data||[]){
    const q=Number(x.quantity||0),p=x.unit_net_price==null?null:Number(x.unit_net_price),key=x.material_id;
    if(!historyByMaterial[key])historyByMaterial[key]={count:0,total_qty:0,max_qty:0,total_net:0,periods:[]};
    const r=historyByMaterial[key];
    r.count++;r.total_qty+=q;r.max_qty=Math.max(r.max_qty,q);if(p!=null)r.total_net+=q*p;
    r.periods.push({quantity:q,unit_net_price:p,period_label:x.period_label,source_reference:x.source_sheet,delivered_at:x.delivery_date});
  }
  Object.values(historyByMaterial).forEach((r:any)=>r.average_qty=r.count?r.total_qty/r.count:0);

  return{
    contract,
    installation,
    assignments,
    materials,
    catalogMaterials,
    clientCatalogConfigured,
    historyByMaterial,
    canEditHistoricalReference:["Admin Total","Gerencia"].includes(profile.role)
  };
}

export async function loadContractMaterialMatrix(contractId:string){
  const {supabase}=await allowedContext();
  if(!contractId)throw new Error("Contrato obligatorio");
  const {data:contract,error:ce}=await supabase.from("contracts").select("id,name,active,client_id,net_budget").eq("id",contractId).eq("active",true).single();
  if(ce||!contract)throw new Error("Contrato no válido o inactivo");
  const [i,a,m,c]=await Promise.all([
    supabase.from("installations").select("id,name,address,region,city,commune,active").eq("contract_id",contractId).eq("active",true).order("name"),
    supabase.from("contract_materials").select("id,material_id,installation_id,authorized,authorized_qty,source_quantity,source_reference,coverage_status,notes,updated_at,manually_overridden").eq("contract_id",contractId),
    supabase.from("materials").select("id,family,name,presentation,unit,supplier_code,current_net_price,active").eq("active",true).order("family").order("name"),
    supabase.from("client_materials").select("material_id,authorized").eq("client_id",contract.client_id)
  ]);
  if(i.error)throw i.error;if(a.error)throw a.error;if(m.error)throw m.error;if(c.error)throw c.error;

  const clientCatalogConfigured=(c.data||[]).length>0;
  const clientAllowed=new Set((c.data||[]).filter((x:any)=>x.authorized).map((x:any)=>x.material_id));
  const catalogMaterials=clientCatalogConfigured?(m.data||[]).filter((x:any)=>clientAllowed.has(x.id)):(m.data||[]);
  const assignments=a.data||[];
  const general=new Map(assignments.filter((x:any)=>!x.installation_id).map((x:any)=>[x.material_id,x]));
  const specifics=new Map<string,Map<string,any>>();
  for(const row of assignments.filter((x:any)=>x.installation_id)){
    if(!specifics.has(row.material_id))specifics.set(row.material_id,new Map());
    specifics.get(row.material_id)!.set(row.installation_id,row);
  }
  const effectiveByMaterial:Record<string,string[]>={};
  const includedIds=new Set<string>();
  for(const material of catalogMaterials){
    const g:any=general.get(material.id),spec=specifics.get(material.id),selected:string[]=[];
    for(const installation of i.data||[]){
      const s=spec?.get(installation.id);
      const active=s?Boolean(s.authorized):Boolean(g?.authorized);
      if(active)selected.push(installation.id);
    }
    if(selected.length){includedIds.add(material.id);effectiveByMaterial[material.id]=selected;}
  }
  const materials=catalogMaterials.filter((x:any)=>includedIds.has(x.id));
  return{contract,installations:i.data||[],materials,catalogMaterials,effectiveByMaterial};
}

type SaveMatrixRowInput={contract_id:string;material_id:string;installation_ids:string[]};
export async function saveContractMaterialMatrixRow(input:SaveMatrixRowInput){
  const {supabase}=await allowedContext();
  const {data:contract}=await supabase.from("contracts").select("id,client_id,active").eq("id",input.contract_id).eq("active",true).single();
  if(!contract)throw new Error("Contrato no válido o inactivo");
  const [{data:installations,error:ie},{data:material,error:me},{data:catalog,error:ca},{data:assignments,error:ae}]=await Promise.all([
    supabase.from("installations").select("id").eq("contract_id",input.contract_id).eq("active",true),
    supabase.from("materials").select("id,active").eq("id",input.material_id).eq("active",true).single(),
    supabase.from("client_materials").select("material_id,authorized").eq("client_id",contract.client_id),
    supabase.from("contract_materials").select("id,material_id,installation_id,authorized,authorized_qty,notes").eq("contract_id",input.contract_id).eq("material_id",input.material_id)
  ]);
  if(ie)throw ie;if(me||!material)throw new Error("Material no válido o inactivo");if(ca)throw ca;if(ae)throw ae;
  if((catalog||[]).length>0&&!catalog?.some((x:any)=>x.material_id===input.material_id&&x.authorized))throw new Error("Este material no está autorizado en el catálogo del cliente");

  const validIds=new Set((installations||[]).map((x:any)=>x.id));
  const selected=new Set((input.installation_ids||[]).filter(id=>validIds.has(id)));
  if(selected.size!==(input.installation_ids||[]).length)throw new Error("La selección contiene una instalación que no pertenece al contrato");

  const general=(assignments||[]).find((x:any)=>!x.installation_id);
  const specific=new Map((assignments||[]).filter((x:any)=>x.installation_id).map((x:any)=>[x.installation_id,x]));
  const shouldExist=selected.size>0;

  if(Boolean(general?.authorized)!==shouldExist){
    const {error}=await supabase.rpc("save_client_profile_material_config",{
      p_contract_id:input.contract_id,p_installation_id:null,p_material_id:input.material_id,p_assigned:shouldExist,
      p_authorized_qty:shouldExist?Number(general?.authorized_qty||0):0,p_period_type:null,p_period_value:null,p_quantity_limit:null,
      p_net_amount_limit:null,p_coverage_status:shouldExist?"included":"not_included",p_notes:shouldExist?(general?.notes||null):"Sin instalaciones seleccionadas en matriz"
    });
    if(error)throw new Error(error.message);
  }

  if(shouldExist){
    for(const installation of installations||[]){
      const current:any=specific.get(installation.id);
      const desired=selected.has(installation.id);
      const effectiveBefore=current?Boolean(current.authorized):Boolean(general?.authorized);
      if(desired){
        if(current&&!current.authorized){
          const {error}=await supabase.rpc("clear_installation_material_exception",{p_contract_id:input.contract_id,p_installation_id:installation.id,p_material_id:input.material_id});
          if(error)throw new Error(error.message);
        }else if(!general?.authorized&&!current?.authorized){
          // El nuevo perfil general ya deja esta instalación incluida por herencia.
        }
      }else if(effectiveBefore||!current){
        const {error}=await supabase.rpc("save_client_profile_material_config",{
          p_contract_id:input.contract_id,p_installation_id:installation.id,p_material_id:input.material_id,p_assigned:false,
          p_authorized_qty:0,p_period_type:null,p_period_value:null,p_quantity_limit:null,p_net_amount_limit:null,
          p_coverage_status:"not_included",p_notes:"Excluido desde matriz Material × Instalación"
        });
        if(error)throw new Error(error.message);
      }
    }
  }else{
    for(const installation of installations||[]){
      const current:any=specific.get(installation.id);
      if(current?.authorized){
        const {error}=await supabase.rpc("save_client_profile_material_config",{
          p_contract_id:input.contract_id,p_installation_id:installation.id,p_material_id:input.material_id,p_assigned:false,
          p_authorized_qty:0,p_period_type:null,p_period_value:null,p_quantity_limit:null,p_net_amount_limit:null,
          p_coverage_status:"not_included",p_notes:"Excluido desde matriz Material × Instalación"
        });
        if(error)throw new Error(error.message);
      }
    }
  }
  revalidatePath("/");
  return{ok:true,selected_count:selected.size,total_installations:(installations||[]).length};
}

type SaveInput={contract_id:string;installation_id:string|null;material_id:string;assigned:boolean;authorized_qty:number;historical_reference_qty?:number|null;period_type?:string|null;notes?:string|null;override_reason?:string|null};

export async function saveMaterialProfileConfig(input:SaveInput){
  const {supabase,user,profile}=await allowedContext();
  const {data:contract}=await supabase.from("contracts").select("client_id").eq("id",input.contract_id).single();
  if(!contract)throw new Error("Contrato no válido");
  const {data:catalog}=await supabase.from("client_materials").select("material_id,authorized").eq("client_id",contract.client_id);
  if((catalog||[]).length>0&&!catalog?.some((x:any)=>x.material_id===input.material_id&&x.authorized))throw new Error("Este material no está autorizado en el catálogo del cliente");

  let q=supabase.from("contract_materials").select("id,authorized,authorized_qty,source_quantity,source_reference,notes,manually_overridden").eq("contract_id",input.contract_id).eq("material_id",input.material_id);
  q=input.installation_id?q.eq("installation_id",input.installation_id):q.is("installation_id",null);
  const {data:existing}=await q.maybeSingle();
  const nextQty=input.assigned?Number(input.authorized_qty||0):0;
  const nextHistorical=input.historical_reference_qty==null?null:Math.max(Number(input.historical_reference_qty||0),0);
  const changedQty=Boolean(existing&&Number(existing.authorized_qty||0)!==nextQty);
  const changedHistorical=Boolean((existing?.source_quantity==null?null:Number(existing.source_quantity))!==nextHistorical);
  if(changedHistorical&&!["Admin Total","Gerencia"].includes(profile.role))throw new Error("Solo Gerencia o Admin Total puede modificar la referencia histórica");
  if((changedQty||changedHistorical)&&!String(input.override_reason||"").trim())throw new Error("Indica el motivo del ajuste");

  const pv=({Mensual:1,Bimensual:2,Trimestral:3,Cuatrimestral:4,Semestral:6} as Record<string,number>)[input.period_type||""]||null;
  const {data,error}=await supabase.rpc("save_client_profile_material_config",{
    p_contract_id:input.contract_id,
    p_installation_id:input.installation_id,
    p_material_id:input.material_id,
    p_assigned:Boolean(input.assigned),
    p_authorized_qty:nextQty,
    p_period_type:input.period_type||null,
    p_period_value:pv,
    p_quantity_limit:input.period_type?nextQty:null,
    p_net_amount_limit:null,
    p_coverage_status:input.assigned?"included":"not_included",
    p_notes:input.notes||null
  });
  if(error)throw new Error(error.message);

  let savedQuery=supabase.from("contract_materials").select("id,authorized,authorized_qty,source_quantity,source_reference").eq("contract_id",input.contract_id).eq("material_id",input.material_id);
  savedQuery=input.installation_id?savedQuery.eq("installation_id",input.installation_id):savedQuery.is("installation_id",null);
  const {data:saved}=await savedQuery.maybeSingle();
  if(changedHistorical&&saved?.id){
    const {error:refError}=await supabase.from("contract_materials").update({source_quantity:nextHistorical,source_reference:nextHistorical==null?null:"Referencia manual Gerencia",updated_at:new Date().toISOString()}).eq("id",saved.id);
    if(refError)throw new Error(refError.message);
  }
  if(changedQty||changedHistorical)await supabase.from("activity_log").insert({
    actor_id:user.id,actor_name:profile.full_name||profile.email,module:"Perfil de materiales",
    action:changedHistorical?"Ajustar referencia histórica / máximo":"Ajustar máximo autorizado",
    entity_table:"contract_materials",entity_id:saved?.id||existing?.id,old_data:existing,
    new_data:{authorized_qty:nextQty,historical_reference_qty:nextHistorical},observation:String(input.override_reason||"").trim()
  });
  revalidatePath("/");
  return data;
}

export async function clearInstallationMaterialException(contractId:string,installationId:string,materialId:string){
  const {supabase}=await allowedContext();
  if(!contractId||!installationId||!materialId)throw new Error("Datos incompletos");
  const {error}=await supabase.rpc("clear_installation_material_exception",{p_contract_id:contractId,p_installation_id:installationId,p_material_id:materialId});
  if(error)throw new Error(error.message);
  revalidatePath("/");
  return{ok:true};
}

export async function loadInstallationMaterialProfile(contractId:string,installationId:string){return loadMaterialProfile(contractId,installationId);}
export async function saveInstallationMaterialConfig(input:Omit<SaveInput,"installation_id">&{installation_id:string}){return saveMaterialProfileConfig(input);}
