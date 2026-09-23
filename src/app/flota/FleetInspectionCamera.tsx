"use client";
import {useEffect,useRef,useState} from "react";
import {takeVehicleWithPhotos,returnVehicleWithPhotos} from "./photo-actions";

type View="Frontal"|"Trasera"|"Lateral izquierdo"|"Lateral derecho"|"Tablero"|"Interior 1"|"Interior 2";
const VIEWS:View[]=["Frontal","Trasera","Lateral izquierdo","Lateral derecho","Tablero","Interior 1","Interior 2"];
type Props={vehicleId:string;plate:string;driverName:string;currentKm:number;assignmentId?:string;mode:"take"|"return";startKm?:number};

function Silhouette({view,overlay=false}:{view:View;overlay?:boolean}){
 if(view==="Tablero")return <div className={overlay?"fleetDashOverlay":"fleetInteriorGuide"}>ODO<br/><small>Tablero completo</small></div>;
 if(view.startsWith("Interior"))return <div className={overlay?"fleetDashOverlay":"fleetInteriorGuide"}>▱<br/><small>{view}</small></div>;

 const side=view.startsWith("Lateral");
 const flip=view==="Lateral derecho";
 if(side){
  return <img
   className={(overlay?"fleetImageOverlay ":"fleetImageGuide ")+(flip?"fleetGuideFlip":"")}
   src="/flota/guias/pickup-lateral-izquierda.svg"
   alt={view}
  />;
 }
 const rear=view==="Trasera";
 return <svg className={overlay?"fleetSvgOverlay":"fleetSvgGuide"} viewBox="0 0 170 120" aria-label={view}>
  <g fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
   <path d="M35 17 Q85 8 135 17 L146 100 H24 Z"/>
   <path d="M42 25 H128 L133 64 H37 Z"/>
   <path d="M85 24 V64"/><path d="M24 76 H146 M31 100 H139"/>
   <path d="M25 57 H15 V76 H25 M145 57 H155 V76 H145"/>
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
