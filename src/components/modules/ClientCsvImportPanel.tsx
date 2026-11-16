"use client";

import {useState} from "react";
import UnifiedClientImportPanel from "@/components/modules/UnifiedClientImportPanel";

export default function ClientCsvImportPanel(){
 const [opened,setOpened]=useState(false);
 return <div className="clientUnifiedImportLauncher">
  <button type="button" className="secondary" aria-expanded={opened} onClick={()=>setOpened(v=>!v)}>{opened?"Cerrar importación":"Importar cliente, contratos e instalaciones"}</button>
  {opened&&<UnifiedClientImportPanel/>}
 </div>;
}
