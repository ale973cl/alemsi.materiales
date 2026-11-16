import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export const runtime="nodejs";
const BUCKET="receipt-documents";
const allowedTypes=["application/pdf","image/jpeg","image/png","image/webp"];
async function context(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return{error:NextResponse.json({error:"Sesión requerida"},{status:401})};
 const {data:profile}=await supabase.from("user_profiles").select("role,active").eq("id",user.id).single();
 if(!profile?.active||!["Admin Total","Admin","Gerencia","Finanzas","Bodega"].includes(profile.role))return{error:NextResponse.json({error:"Sin permiso para documentos"},{status:403})};
 return{supabase,role:profile.role};
}
export async function POST(request:NextRequest){
 const ctx=await context();if(ctx.error)return ctx.error;
 if(!["Admin Total","Admin","Bodega"].includes(ctx.role||""))return NextResponse.json({error:"Sin permiso de carga"},{status:403});
 const form=await request.formData();
 const id=String(form.get("receipt_id")||"");
 const file=form.get("file");
 if(!/^[0-9a-f-]{36}$/i.test(id)||!(file instanceof File))return NextResponse.json({error:"Documento o recepción inválidos"},{status:400});
 if(!allowedTypes.includes(file.type)||file.size===0||file.size>8*1024*1024)return NextResponse.json({error:"PDF o imagen de hasta 8 MB"},{status:400});
 const {data:receipt}=await ctx.supabase!.from("receipts").select("id,inventory_posted").eq("id",id).single();
 if(!receipt||receipt.inventory_posted)return NextResponse.json({error:"Recepción inexistente o ya cotejada"},{status:409});
 const {error}=await ctx.supabase!.storage.from(BUCKET).upload(`${id}/original`,Buffer.from(await file.arrayBuffer()),{contentType:file.type,upsert:false,cacheControl:"private"});
 if(error)return NextResponse.json({error:"No se pudo almacenar la factura. Verifica que el depósito privado receipt-documents esté configurado."},{status:503});
 return NextResponse.json({ok:true,stored:true,inventory_updated:false});
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
