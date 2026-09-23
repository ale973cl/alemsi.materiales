"use client";
import {useEffect,useRef,useState} from "react";
import {takeVehicleWithPhotos,returnVehicleWithPhotos} from "./photo-actions";

type View="Frontal"|"Trasera"|"Lateral izquierdo"|"Lateral derecho"|"Tablero"|"Interior 1"|"Interior 2";
const VIEWS:View[]=["Frontal","Trasera","Lateral izquierdo","Lateral derecho","Tablero","Interior 1","Interior 2"];
type Props={vehicleId:string;plate:string;driverName:string;currentKm:number;assignmentId?:string;mode:"take"|"return";startKm?:number};

function Silhouette({view}:{view:View}){
 const flip=view==="Lateral derecho";
 if(view==="Lateral izquierdo"||view==="Lateral derecho"){
  return <svg className={"fleetSvgGuide "+(flip?"fleetGuideFlip":"")} viewBox="0 0 220 120" aria-label={view}>
   <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 79 L28 55 Q33 45 49 42 L83 36 L139 36 Q154 37 164 49 L178 62 L203 67 L208 84 L196 88 H27 L16 84 Z"/>
    <path d="M52 43 L84 39 V63 H38 Q42 50 52 43 Z M90 39 H137 Q149 40 158 52 L168 63 H90 Z"/>
    <path d="M84 39 V87 M139 38 L142 87 M34 64 H177 M65 69 H75 M111 69 H121"/>
    <circle cx="52" cy="87" r="16"/><circle cx="52" cy="87" r="8"/><circle cx="174" cy="87" r="16"/><circle cx="174" cy="87" r="8"/>
   </g>
  </svg>;
 }
 if(view==="Tablero"){
  return <svg className="fleetSvgGuide" viewBox="0 0 220 120" aria-label={view}>
   <g fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 44 Q110 20 208 44 L201 94 H19 Z"/><circle cx="62" cy="68" r="27"/><circle cx="62" cy="68" r="18"/>
    <path d="M62 50 V86 M44 68 H80"/><rect x="102" y="43" width="49" height="28" rx="3"/><path d="M109 80 H145 M109 87 H145 M163 49 H194 M163 59 H194 M163 69 H194"/>
   </g>
  </svg>;
 }
 if(view==="Interior 1"){
  return <svg className="fleetSvgGuide" viewBox="0 0 220 120" aria-label={view}>
   <g fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 102 L33 32 Q110 15 187 32 L202 102"/><rect x="42" y="43" width="49" height="38" rx="12"/><rect x="129" y="43" width="49" height="38" rx="12"/>
    <path d="M37 105 Q39 76 66 76 Q93 76 96 105 M124 105 Q127 76 153 76 Q181 76 183 105 M101 65 H119 V105"/>
   </g>
  </svg>;
 }
 if(view==="Interior 2"){
  return <svg className="fleetSvgGuide" viewBox="0 0 220 120" aria-label={view}>
   <g fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 101 L29 38 Q110 20 191 38 L202 101"/><rect x="42" y="43" width="38" height="30" rx="10"/><rect x="91" y="39" width="38" height="30" rx="10"/><rect x="140" y="43" width="38" height="30" rx="10"/>
    <path d="M32 104 Q34 69 61 69 H159 Q186 69 188 104 M83 70 V104 M137 70 V104"/>
   </g>
  </svg>;
 }
 const rear=view==="Trasera";
 return <svg className="fleetSvgGuide" viewBox="0 0 170 120" aria-label={view}>
  <g fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
   <path d="M35 17 Q85 8 135 17 L146 100 H24 Z"/><path d="M42 25 H128 L133 64 H37 Z"/><path d="M85 24 V64"/>
   <path d="M24 76 H146 M31 100 H139"/><path d="M25 57 H15 V76 H25 M145 57 H155 V76 H145"/>
   {rear?<><path d="M85 65 V98"/><rect x="65" y="75" width="40" height="13" rx="2"/><path d="M39 72 V87 M131 72 V87"/></>:<><path d="M40 71 H61 M109 71 H130"/><path d="M62 81 H108"/><path d="M74 67 H96"/></>}
  </g>
 </svg>;
}
export default function FleetInspectionCamera({vehicleId,plate,driverName,currentKm,assignmentId,mode,startKm}:Props){
 const [photos,setPhotos]=useState<(File|null)[]>(Array(7).fill(null)); const [active,setActive]=useState<number|null>(null); const [error,setError]=useState("");
 const videoRef=useRef<HTMLVideoElement>(null); const streamRef=useRef<MediaStream|null>(null); const complete=photos.filter(Boolean).length;
 useEffect(()=>()=>streamRef.current?.getTracks().forEach(t=>t.stop()),[]);
 async function openCamera(index:number){setError("");setActive(index);try{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});streamRef.current=stream;setTimeout(()=>{if(videoRef.current)videoRef.current.srcObject=stream},0)}catch{setError("No se pudo abrir la cámara. Autoriza Cámara para este sitio en Chrome.");setActive(null)}}
 function closeCamera(){streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;setActive(null)}
 function capture(){const video=videoRef.current;if(active===null||!video||!video.videoWidth)return;const canvas=document.createElement("canvas");canvas.width=video.videoWidth;canvas.height=video.videoHeight;const ctx=canvas.getContext("2d");if(!ctx)return;ctx.drawImage(video,0,0);canvas.toBlob(blob=>{if(!blob)return;const file=new File([blob],VIEWS[active].replaceAll(" ","-")+".jpg",{type:"image/jpeg"});setPhotos(prev=>prev.map((p,i)=>i===active?file:p));closeCamera()},"image/jpeg",.88)}
 const action=mode==="take"?takeVehicleWithPhotos:returnVehicleWithPhotos;
 return <form action={action} className="fleetInspectionForm"><input type="hidden" name="vehicle_id" value={vehicleId}/>{assignmentId&&<input type="hidden" name="assignment_id" value={assignmentId}/>}
  <div className="fleetActionForm">{mode==="take"?<><label>Conductor<input value={driverName} readOnly/></label><label>RUT<input name="driver_rut" required placeholder="12.345.678-9"/></label><label>Kilometraje inicial<input name="start_km" type="number" min={currentKm} defaultValue={currentKm} required/></label></>:<label>Kilometraje final<input name="end_km" type="number" min={startKm??currentKm} defaultValue={currentKm} required/></label>}<label>Observación<textarea name="comment" placeholder="Sin observaciones"/></label></div>
  <div className="fleetInspectionHead"><div><span className="fleetStepLabel">INSPECCIÓN · {plate}</span><h3>{complete}/7 fotografías</h3></div><progress value={complete} max={7}/></div>
  <div className="fleetInspectionGrid">{VIEWS.map((view,i)=><button type="button" key={view} className={"fleetInspectionTile "+(photos[i]?"fleetInspectionDone":"")} onClick={()=>openCamera(i)}>{photos[i]?<img src={URL.createObjectURL(photos[i]!)} alt={"Foto "+view}/>:<Silhouette view={view}/>}<strong>{photos[i]?"✓ ":""}{view}</strong><span>{photos[i]?"Tocar para repetir":"Tocar para abrir cámara"}</span></button>)}</div>
  {photos.map((file,i)=>file&&<FileBridge key={i} file={file} name={"photo_"+i}/>)}
  {photos[4]&&<div className="fleetDashboardRead"><strong>Tablero capturado</strong><span>La foto queda guardada como evidencia. La lectura automática de odómetro se activará cuando el motor visual esté conectado; no se inventan valores.</span></div>}
  {error&&<p className="fleetCameraError">{error}</p>}<button className="fleetBtn fleetBtnPrimary fleetConfirmInspection" disabled={complete!==7}>{mode==="take"?"Confirmar toma":"Confirmar devolución"} · {complete}/7</button>
  {active!==null&&<div className="fleetCameraModal" role="dialog" aria-modal="true"><div className="fleetCameraTop"><strong>{plate} · {VIEWS[active]} · {active+1}/7</strong><button type="button" onClick={closeCamera}>Cerrar</button></div><div className="fleetCameraViewport"><video ref={videoRef} autoPlay playsInline muted/><p>{VIEWS[active]==="Tablero"?"Encuadra el tablero completo y deja visible el odómetro":"Encuadra el vehículo completo"}</p></div><button type="button" className="fleetShutter" onClick={capture} aria-label="Tomar foto"><span/></button></div>}
 </form>
}
function FileBridge({file,name}:{file:File;name:string}){const ref=useRef<HTMLInputElement>(null);useEffect(()=>{if(!ref.current)return;const dt=new DataTransfer();dt.items.add(file);ref.current.files=dt.files},[file]);return <input ref={ref} type="file" name={name} hidden readOnly/>}
