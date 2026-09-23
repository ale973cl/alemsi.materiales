export type FleetDocumentKind="PADRON"|"REVISION_TECNICA"|"PERMISO_CIRCULACION"|"SOAP"|"SEGURO_AUTOMOTRIZ"|"MANTENCION"|"OTRO";

export type ReaderField={
 key:string;
 label:string;
 required:boolean;
 aliases:string[];
 zones:string[];
};

export type FleetDocumentTemplate={
 kind:FleetDocumentKind;
 labels:string[];
 priorityPages:string;
 fields:ReaderField[];
 serviceTerms?:{key:string;label:string;terms:string[]}[];
};

const identity:ReaderField[]=[
 {key:"plate",label:"Patente",required:true,aliases:["PATENTE","PLACA PATENTE","PLACA ÚNICA","PPU"],zones:["cabecera","bloque vehículo"]},
 {key:"vin",label:"Chasis / VIN",required:false,aliases:["VIN","CHASIS","N° CHASIS"],zones:["bloque vehículo","datos técnicos"]},
];

export const FLEET_DOCUMENT_TEMPLATES:FleetDocumentTemplate[]=[
 {kind:"PADRON",labels:["CERTIFICADO DE INSCRIPCIÓN R.V.M.","CERTIFICADO DE INSCRIPCION RVM"],priorityPages:"primera página",fields:[...identity,
  {key:"owner",label:"Propietario",required:false,aliases:["PROPIETARIO","NOMBRE"],zones:["datos propietario"]},
  {key:"owner_rut",label:"RUT propietario",required:false,aliases:["RUT","RUN"],zones:["datos propietario"]},
  {key:"vehicle_type",label:"Tipo",required:false,aliases:["TIPO VEHÍCULO","TIPO"],zones:["datos vehículo"]},
  {key:"year",label:"Año",required:false,aliases:["AÑO"],zones:["datos vehículo"]},
  {key:"brand",label:"Marca",required:false,aliases:["MARCA"],zones:["datos vehículo"]},
  {key:"model",label:"Modelo",required:false,aliases:["MODELO"],zones:["datos vehículo"]},
  {key:"engine",label:"Motor",required:false,aliases:["MOTOR","N° MOTOR"],zones:["datos técnicos"]},
  {key:"color",label:"Color",required:false,aliases:["COLOR"],zones:["datos vehículo"]},
  {key:"issued_at",label:"Fecha emisión",required:false,aliases:["FECHA EMISIÓN","FECHA DE EMISION"],zones:["bloque fechas"]},
 ]},
 {kind:"REVISION_TECNICA",labels:["CERTIFICADO DE REVISIÓN TÉCNICA","CERTIFICADO DE REVISION TECNICA","CERTIFICADO EMISIONES CONTAMINANTES"],priorityPages:"primera página",fields:[...identity,
  {key:"result",label:"Resultado",required:true,aliases:["RESULTADO","APROBADO","RECHAZADO"],zones:["superior izquierdo","resultado"]},
  {key:"reviewed_at",label:"Fecha revisión",required:false,aliases:["FECHA REVISIÓN","FECHA DE REVISION"],zones:["superior izquierdo"]},
  {key:"expires_at",label:"Válido hasta",required:true,aliases:["VÁLIDO HASTA","VALIDO HASTA","VENCIMIENTO"],zones:["inferior izquierdo","vigencia"]},
  {key:"plant",label:"Planta revisora",required:false,aliases:["PLANTA REVISORA","PRT"],zones:["cabecera"]},
 ]},
 {kind:"PERMISO_CIRCULACION",labels:["PERMISO DE CIRCULACIÓN","PERMISO DE CIRCULACION"],priorityPages:"primera página",fields:[...identity,
  {key:"municipality",label:"Municipalidad",required:false,aliases:["MUNICIPALIDAD","MUNICIPIO"],zones:["cabecera"]},
  {key:"period",label:"Período",required:false,aliases:["PERIODO","AÑO PERMISO"],zones:["cabecera","bloque central"]},
  {key:"issued_at",label:"Fecha emisión",required:false,aliases:["FECHA EMISIÓN","FECHA"],zones:["cabecera"]},
  {key:"expires_at",label:"Válido hasta",required:true,aliases:["VÁLIDO HASTA","VALIDO HASTA","VENCIMIENTO"],zones:["recuadro vigencia","sector derecho"]},
  {key:"amount",label:"Monto",required:false,aliases:["TOTAL","MONTO","IMPORTE"],zones:["totales"]},
 ]},
 {kind:"SOAP",labels:["SEGURO OBLIGATORIO ACCIDENTES PERSONALES","SOAP"],priorityPages:"primera página",fields:[...identity,
  {key:"insurer",label:"Aseguradora",required:true,aliases:["COMPAÑÍA","ASEGURADORA"],zones:["cabecera"]},
  {key:"policy_number",label:"N° póliza",required:true,aliases:["N° PÓLIZA","POLIZA","NRO POLIZA"],zones:["cabecera"]},
  {key:"valid_from",label:"Rige desde",required:true,aliases:["RIGE DESDE","VIGENCIA DESDE"],zones:["tabla central","vigencia"]},
  {key:"expires_at",label:"Rige hasta",required:true,aliases:["RIGE HASTA","VIGENCIA HASTA"],zones:["tabla central","vigencia"]},
 ]},
 {kind:"SEGURO_AUTOMOTRIZ",labels:["PÓLIZA DE VEHÍCULOS","POLIZA DE VEHICULOS","SEGURO DE VEHÍCULO","CERTIFICADO DE COBERTURA"],priorityPages:"carátula/condiciones particulares primero; buscar asistencia solo en páginas que contengan términos de servicio",fields:[...identity,
  {key:"insurer",label:"Aseguradora",required:true,aliases:["COMPAÑÍA","ASEGURADORA"],zones:["carátula"]},
  {key:"policy_number",label:"N° póliza",required:true,aliases:["N° PÓLIZA","POLIZA"],zones:["carátula"]},
  {key:"valid_from",label:"Inicio vigencia",required:true,aliases:["INICIO VIGENCIA","DESDE","RIGE DESDE"],zones:["carátula","vigencia"]},
  {key:"expires_at",label:"Término vigencia",required:true,aliases:["TÉRMINO VIGENCIA","HASTA","RIGE HASTA"],zones:["carátula","vigencia"]},
  {key:"deductible",label:"Deducible",required:false,aliases:["DEDUCIBLE"],zones:["condiciones particulares"]},
  {key:"assistance_phone",label:"Teléfono asistencia",required:false,aliases:["ASISTENCIA","TELÉFONO","FONO"],zones:["asistencia","contacto"]},
 ],serviceTerms:[
  {key:"tow",label:"Grúa / remolque",terms:["GRÚA","GRUA","REMOLQUE","REMOLCAJE"]},
  {key:"replacement_car",label:"Auto de reemplazo",terms:["AUTO DE REEMPLAZO","VEHÍCULO DE REEMPLAZO","VEHICULO DE REEMPLAZO"]},
  {key:"roadside_repair",label:"Reparación en terreno",terms:["REPARACIÓN DE EMERGENCIA","REPARACION DE EMERGENCIA","ASISTENCIA EN TERRENO"]},
  {key:"fuel",label:"Combustible de emergencia",terms:["COMBUSTIBLE","ENTREGA DE COMBUSTIBLE"]},
  {key:"driver",label:"Conductor profesional",terms:["CONDUCTOR PROFESIONAL"]},
  {key:"parts",label:"Envío de repuestos",terms:["ENVÍO DE REPUESTOS","ENVIO DE REPUESTOS","ENVÍO DE PIEZAS"]},
  {key:"legal",label:"Asistencia legal",terms:["ASISTENCIA LEGAL","DEFENSA JURÍDICA","DEFENSA JURIDICA"]},
 ]},
 {kind:"MANTENCION",labels:["ORDEN DE TRABAJO","MANTENCIÓN","MANTENCION","CAMBIO DE ACEITE"],priorityPages:"primera página",fields:[...identity,
  {key:"service_date",label:"Fecha servicio",required:true,aliases:["FECHA","FECHA SERVICIO"],zones:["cabecera"]},
  {key:"odometer_km",label:"Kilometraje",required:true,aliases:["KILOMETRAJE","ODÓMETRO","ODOMETRO","KM"],zones:["cabecera","datos vehículo"]},
  {key:"activity",label:"Trabajo realizado",required:true,aliases:["SERVICIO","TRABAJO","DETALLE"],zones:["detalle"]},
  {key:"amount",label:"Monto",required:false,aliases:["TOTAL","MONTO"],zones:["totales"]},
  {key:"next_service_km",label:"Próximo servicio km",required:false,aliases:["PRÓXIMO CAMBIO","PROXIMO CAMBIO","PRÓXIMA MANTENCIÓN"],zones:["observaciones"]},
 ]},
];

export function buildFleetReaderInstruction(vehicle:{plate:string;chassis_vin?:string|null}){
 return {
  task:"Identificar el documento y extraer SOLO los campos definidos en la plantilla coincidente. No inventar ni inferir valores ausentes.",
  vehicle,
  rules:[
   "Usar primero título/etiquetas y zonas indicadas; la posición es una ayuda, no una coordenada rígida.",
   "Si patente o VIN no coinciden con el vehículo abierto, marcar requires_review=true.",
   "Si una fecha es ambigua, devolver null y requires_review=true.",
   "Para póliza extensa, leer carátula primero y buscar páginas posteriores solo por serviceTerms.",
   "No considerar ningún valor confirmado hasta revisión humana.",
  ],
  templates:FLEET_DOCUMENT_TEMPLATES,
 };
}
