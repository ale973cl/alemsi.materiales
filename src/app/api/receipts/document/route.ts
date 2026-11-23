import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {inspectReceiptFile} from "@/lib/receipt-file";

export const runtime="nodejs";
const BUCKET="receipt-documents";
async function context(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return{error:NextResponse.json({error:"Sesión requerida"},{status:401})};
 const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
 if(!profile?.active||!["Admin Total","Admin","Gerencia","Finanzas","Bodega"].includes(profile.role))return{error:NextResponse.json({error:"Sin permiso para documentos"},{status:403})};
 return{supabase,role:profile.role,userId:user.id};
}
export async function POST(request:NextRequest){
 const ctx=await context();if(ctx.error)return ctx.error;
 if(!["Admin Total","Admin","Bodega"].includes(ctx.role||""))return NextResponse.json({error:"Sin permiso de carga"},{status:403});
 const form=await request.formData();
 const id=String(form.get("receipt_id")||"");
 const file=form.get("file");
 if(!/^[0-9a-f-]{36}$/i.test(id)||!(file instanceof File))return NextResponse.json({error:"Documento o recepción inválidos"},{status:400});
 let detectedMime:string;
 try{detectedMime=await inspectReceiptFile(file)}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Archivo inválido"},{status:400})}
 const {data:receipt}=await ctx.supabase!.from("receipts").select("id,inventory_posted,received_by,received_at").eq("id",id).single();
 if(!receipt)return NextResponse.json({error:"Recepción inexistente"},{status:404});
 // V3 confirms stock before uploading the original; accept only the same user, soon after confirmation.
 if(String(receipt.received_by)!==String(ctx.userId))return NextResponse.json({error:"Solo quien registró esta recepción puede adjuntar su factura."},{status:403});
 const registeredAt=receipt.received_at?Date.parse(receipt.received_at):NaN;
 if(receipt.inventory_posted&&(!Number.isFinite(registeredAt)||Date.now()-registeredAt>30*60*1000||registeredAt>Date.now()+60*1000))
  return NextResponse.json({error:"La recepción ya está confirmada. Solo es posible adjuntar su factura durante los 30 minutos siguientes al registro."},{status:409});
 const {error}=await ctx.supabase!.storage.from(BUCKET).upload(`${id}/original`,Buffer.from(await file.arrayBuffer()),{contentType:detectedMime,upsert:false,cacheControl:"3600"});
 if(error)return NextResponse.json({error:"No se pudo almacenar la factura. Verifica que el depósito privado receipt-documents esté configurado."},{status:503});
 await ctx.supabase!.from("activity_log").insert({actor_id:ctx.userId,module:"Recepción",action:"Adjuntar factura original",entity_table:"receipts",entity_id:id,new_data:{content_type:detectedMime,size:file.size}});
 return NextResponse.json({ok:true,stored:true,inventory_updated:Boolean(receipt.inventory_posted)});
}
export async function GET(request:NextRequest){
 const ctx=await context();if(ctx.error)return ctx.error;
 const id=request.nextUrl.searchParams.get("receipt_id")||"";
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Recepción inválida"},{status:400});
 const {data:receipt}=await ctx.supabase!.from("receipts").select("id").eq("id",id).single();
 if(!receipt)return NextResponse.json({error:"Recepción no encontrada"},{status:404});
 const {data,error}=await ctx.supabase!.storage.from(BUCKET).createSignedUrl(`${id}/original`,90);
 if(error||!data?.signedUrl)return NextResponse.json({error:"No hay factura original almacenada para esta recepción"},{status:404});
 return NextResponse.redirect(data.signedUrl,{status:302,headers:{"Cache-Control":"no-store"}});
}
