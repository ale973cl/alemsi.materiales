"use client";
const safeFilePart=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[<>:"/\\|?*\u0000-\u001f]/g,"_").replace(/\s+/g,"_").replace(/_+/g,"_").replace(/^[._ ]+|[._ ]+$/g,"").slice(0,180)||"Guia";
export default function PrintButton({guideNumber,installationCode}:{guideNumber:string;installationCode:string}){
 const print=()=>{const previousTitle=document.title;document.title=`ALEMSI_Guia_${safeFilePart(guideNumber)}_${safeFilePart(installationCode)}`;window.setTimeout(()=>{window.print();document.title=previousTitle},0)};
 return <button type="button" onClick={print}>Imprimir / Guardar PDF</button>
}
