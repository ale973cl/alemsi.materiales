export type VehicleOperationalStatus="Disponible"|"En uso"|"Fuera de servicio";
export type FleetAlertLevel="ok"|"warning"|"critical";
export type FleetDocumentKind="PADRON"|"REVISION_TECNICA"|"PERMISO_CIRCULACION"|"SOAP"|"SEGURO_AUTOMOTRIZ"|"MANTENCION"|"OTRO";
export type FleetPhotoPosition="Frontal"|"Trasera"|"Lateral izquierdo"|"Lateral derecho"|"Tablero"|"Interior 1"|"Interior 2";

export const REQUIRED_FLEET_PHOTOS:readonly FleetPhotoPosition[]=["Frontal","Trasera","Lateral izquierdo","Lateral derecho","Tablero","Interior 1","Interior 2"];

export type FleetVehicleSummary={
 id:string;plate:string;label:string;status:VehicleOperationalStatus;
 currentDriver?:string|null;currentDriverRut?:string|null;takenAt?:string|null;
 currentKm:number;fuelLevel?:string|null;nextOilChangeKm?:number|null;
 insurancePolicy?:string|null;insuranceExpiresAt?:string|null;
 assistanceContact?:string|null;assistancePhone?:string|null;assistanceEmail?:string|null;
 assistanceInstructions?:string|null;services?:string[];
 lastLocation?:{lat:number;lng:number;recordedAt:string}|null;
 referenceKmPerLiter?:number|null;operationalCostPerKm?:number|null;
};

export function remainingKm(currentKm:number,targetKm?:number|null){return targetKm==null?null:targetKm-currentKm}
export function documentAlert(expiresAt?:string|null,now=new Date()):FleetAlertLevel{
 if(!expiresAt)return"warning";
 const end=new Date(expiresAt+"T23:59:59");
 const days=Math.ceil((end.getTime()-now.getTime())/86400000);
 if(days<=7)return"critical";
 if(days<=15)return"warning";
 return"ok";
}
export function mileageAlert(currentKm:number,targetKm?:number|null):FleetAlertLevel{
 const left=remainingKm(currentKm,targetKm);if(left==null)return"ok";if(left<=250)return"critical";if(left<=750)return"warning";return"ok";
}
export function confirmedFuelEfficiency(startKm:number,endKm:number,liters:number){
 if(endKm<=startKm||liters<=0)return null;return (endKm-startKm)/liters;
}
