"use client";
import {useRouter} from "next/navigation";
export default function BackButton(){const router=useRouter();return <button type="button" onClick={()=>router.back()} style={{padding:"9px 12px",border:"1px solid #aac1cc",borderRadius:7,background:"white",color:"#12314a",cursor:"pointer"}}>← Volver</button>}
