import { NextResponse } from "next/server";
import { processPendingEmailQueue } from "@/lib/email-delivery";

export async function POST(request: Request) {
  if (
    !process.env.EMAIL_WORKER_TOKEN ||
    request.headers.get("authorization") !== `Bearer ${process.env.EMAIL_WORKER_TOKEN}`
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const result=await processPendingEmailQueue(20);
    if(result.configurationError){
      return NextResponse.json({error:"Faltan variables privadas del motor de correo"},{status:503});
    }
    return NextResponse.json(result);
  } catch(error:any){
    return NextResponse.json({error:error?.message||"No se pudo procesar la cola"},{status:500});
  }
}
