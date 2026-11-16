import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildUnifiedPlan,isValidRut,runUnifiedCommit} from '../src/lib/client-unified-import.ts';

const materials=[
 {id:'m1',name:'Guante de nitrilo',presentation:'Caja 100 unidades',unit:'Caja',supplier_code:'MAT-01'},
 {id:'m2',name:'Alcohol gel',presentation:'Bidón 5 litros',unit:'Litro',supplier_code:'MAT-02'},
 {id:'m3',name:'Toalla de papel',presentation:'Rollo 200 m',unit:'Rollo',supplier_code:'MAT-03'},
];

const baseRow={
 client_name:'QA Import SpA',client_rut:'76.543.210-3',client_email:'qa@import.cl',client_phone:'+56911111111',
 contract_name:'QA Contrato Uno',contract_code:'QA-CT-01',contract_budget:'1000000',contract_periodicity:'Mensual',
};

const row=(extra={})=>({...baseRow,...extra});

function materialize(plan){
 const clients=plan.clients.map((c,i)=>{
  const contracts=plan.contracts.filter(k=>k.clientKey===c.key).map((k,j)=>{
   const installations=plan.installations.filter(x=>x.contractKey===k.key).map((x,n)=>({id:`i${i}${j}${n}`,key:x.key,name:x.name,region:x.region,city:x.city,commune:x.commune,address:x.address,delivery_contact_name:x.delivery_contact,delivery_email:x.delivery_email}));
   return{id:`k${i}${j}`,key:k.key,name:k.name,code:k.code,net_budget:k.budget,installations};
  });
  return{id:`c${i}`,key:c.key,legal_name:c.name,rut:c.rut,central_email:c.email,central_phone:c.phone,contracts};
 });
 const assignments=plan.assignments.map((a,i)=>{
  const contract=clients.flatMap(c=>c.contracts).find(k=>k.key===a.contractKey);
  const installation=a.installationKey?clients.flatMap(c=>c.contracts).flatMap(k=>k.installations).find(x=>x.key===a.installationKey):null;
  if(!contract)throw new Error('Contrato no materializado');
  return{id:`a${i}`,contract_id:contract.id,material_id:a.materialId,installation_id:installation?.id||null,authorized:true,authorized_qty:a.scope==='contrato'?0:Number(a.quantity||0),notes:a.notes};
 });
 return{clients,materials,assignments};
}

test('RUT chileno válido e inválido',()=>{
 assert.equal(isValidRut('76.543.210-3'),true);
 assert.equal(isValidRut('77.123.456-9'),true);
 assert.equal(isValidRut('76.543.210-2'),false);
});

test('cliente nuevo con un contrato y dos instalaciones',()=>{
 const plan=buildUnifiedPlan([
  row({installation_name:'Oficina Central',commune:'Santiago',address:'Av. Uno 1',material_code:'MAT-01',quantity:'100',unit:'Caja',quantity_scope:'instalacion'}),
  row({installation_name:'Bodega Norte',commune:'Quilicura',address:'Camino Dos 2',material_code:'MAT-01',quantity:'60',unit:'Caja',quantity_scope:'instalacion'}),
 ],{clients:[],materials,assignments:[]});
 assert.equal(plan.summary.clientsNew,1);
 assert.equal(plan.summary.contractsNew,1);
 assert.equal(plan.summary.installationsNew,2);
 assert.equal(plan.summary.assignmentsNew,2);
 assert.equal(plan.summary.conflicts,0);
 assert.equal(plan.assignments[0].quantity,100);
 assert.equal(plan.assignments[1].quantity,60);
});

test('cliente nuevo con varios contratos',()=>{
 const plan=buildUnifiedPlan([
  row({contract_name:'QA Contrato A',contract_code:'QA-A',installation_name:'Sede A',material_code:'MAT-01',quantity:'10'}),
  row({contract_name:'QA Contrato B',contract_code:'QA-B',installation_name:'Sede B',material_code:'MAT-02',quantity:'20'}),
 ],{clients:[],materials,assignments:[]});
 assert.equal(plan.summary.clientsNew,1);
 assert.equal(plan.summary.contractsNew,2);
 assert.equal(plan.summary.installationsNew,2);
});

test('cliente existente con contrato nuevo',()=>{
 const existing={clients:[{id:'c1',legal_name:'QA Import SpA',rut:'76543210-3',contracts:[]}],materials,assignments:[]};
 const plan=buildUnifiedPlan([row({installation_name:'Oficina',material_code:'MAT-01',quantity:'5'})],existing);
 assert.equal(plan.summary.clientsNew,0);
 assert.equal(plan.summary.clientsExisting,1);
 assert.equal(plan.summary.contractsNew,1);
});

test('contrato existente con instalación nueva',()=>{
 const existing={clients:[{id:'c1',legal_name:'QA Import SpA',rut:'76543210-3',contracts:[{id:'k1',name:'QA Contrato Uno',code:'QA-CT-01',net_budget:1000000,installations:[{id:'i1',name:'Oficina Central',commune:'Santiago'}]}]}],materials,assignments:[]};
 const plan=buildUnifiedPlan([row({installation_name:'Bodega Sur',commune:'San Bernardo',material_code:'MAT-01',quantity:'8'})],existing);
 assert.equal(plan.summary.contractsNew,0);
 assert.equal(plan.summary.installationsNew,1);
 assert.equal(plan.assignments[0].quantity,8);
});

test('reimportación idéntica no crea registros',()=>{
 const rows=[
  row({installation_name:'Oficina Central',commune:'Santiago',material_code:'MAT-01',quantity:'100'}),
  row({installation_name:'Bodega Norte',commune:'Quilicura',material_code:'MAT-01',quantity:'60'}),
 ];
 const first=buildUnifiedPlan(rows,{clients:[],materials,assignments:[]});
 const existing=materialize(first);
 const second=buildUnifiedPlan(rows,existing);
 assert.equal(second.summary.newTotal,0);
 assert.equal(second.summary.clientsNew,0);
 assert.equal(second.summary.contractsNew,0);
 assert.equal(second.summary.installationsNew,0);
 assert.equal(second.summary.assignmentsNew,0);
 assert.equal(second.summary.assignmentsExisting,2);
 assert.equal(second.summary.conflicts,0);
});

test('materiales repetidos dentro del archivo se consolidan',()=>{
 const plan=buildUnifiedPlan([
  row({installation_name:'Oficina',material_code:'MAT-01',quantity:'10'}),
  row({installation_name:'Oficina',material_code:'MAT-01',quantity:'10'}),
 ],{clients:[],materials,assignments:[]});
 assert.equal(plan.summary.assignmentsNew,1);
 assert.equal(plan.summary.duplicates,1);
});

test('contratos homónimos con códigos distintos se crean separados',()=>{
 const plan=buildUnifiedPlan([
  row({contract_name:'QA Homónimo',contract_code:'QA-H-1',installation_name:'Sede 1',material_code:'MAT-01',quantity:'2'}),
  row({contract_name:'QA Homónimo',contract_code:'QA-H-2',installation_name:'Sede 2',material_code:'MAT-01',quantity:'3'}),
 ],{clients:[],materials,assignments:[]});
 assert.equal(plan.summary.contractsNew,2);
 assert.equal(plan.summary.conflicts,0);
});

test('datos incompletos o contradictorios quedan en conflicto',()=>{
 const missing=buildUnifiedPlan([{client_name:'',client_rut:'',contract_name:'X'}],{clients:[],materials,assignments:[]});
 assert.ok(missing.summary.conflicts>=1);
 assert.equal(missing.summary.newTotal,0);
 const invalidRut=buildUnifiedPlan([row({client_rut:'76.543.210-2',installation_name:'Sede',material_code:'MAT-01',quantity:'1'})],{clients:[],materials,assignments:[]});
 assert.ok(invalidRut.summary.conflicts>=1);
 const unknownMaterial=buildUnifiedPlan([row({installation_name:'Sede',material_code:'NO-EXISTE',material_name:'Material fantasma',quantity:'1'})],{clients:[],materials,assignments:[]});
 assert.ok(unknownMaterial.summary.conflicts>=1);
 assert.equal(unknownMaterial.summary.assignmentsNew,0);
});

test('cantidad máxima inexistente no inventa valores',()=>{
 const plan=buildUnifiedPlan([row({installation_name:'Sede',material_code:'MAT-01'})],{clients:[],materials,assignments:[]});
 assert.equal(plan.summary.assignmentsNew,1);
 assert.equal(plan.assignments[0].quantity,null);
 assert.match(plan.assignments[0].notes,/sin cantidad máxima/i);
});

test('cantidad contractual no se distribuye entre instalaciones',()=>{
 const plan=buildUnifiedPlan([row({installation_name:'Sede',material_code:'MAT-02',quantity:'240',unit:'Litro',quantity_scope:'contrato'})],{clients:[],materials,assignments:[]});
 assert.equal(plan.assignments.length,1);
 assert.equal(plan.assignments[0].scope,'contrato');
 assert.equal(plan.assignments[0].installationKey,null);
 assert.equal(plan.assignments[0].quantity,240);
 assert.match(plan.assignments[0].notes,/no distribuida/i);
});

test('cantidad ya configurada distinta queda en conflicto',()=>{
 const existing={clients:[{id:'c1',legal_name:'QA Import SpA',rut:'76543210-3',contracts:[{id:'k1',name:'QA Contrato Uno',code:'QA-CT-01',installations:[{id:'i1',name:'Oficina'}]}]}],materials,assignments:[{id:'a1',contract_id:'k1',material_id:'m1',installation_id:'i1',authorized:true,authorized_qty:50}]};
 const plan=buildUnifiedPlan([row({installation_name:'Oficina',material_code:'MAT-01',quantity:'60'})],existing);
 assert.equal(plan.summary.conflicts,1);
 assert.equal(plan.summary.assignmentsNew,0);
});

test('reimportación de una cantidad contractual informa EXISTE sin conflicto',()=>{
 const rows=[row({installation_name:'Sede',material_code:'MAT-02',quantity:'240',unit:'Litro',quantity_scope:'contrato'})];
 const first=buildUnifiedPlan(rows,{clients:[],materials,assignments:[]});
 assert.equal(first.summary.assignmentsNew,1);
 const second=buildUnifiedPlan(rows,materialize(first));
 assert.equal(second.summary.assignmentsNew,0);
 assert.equal(second.summary.conflicts,0);
 const detail=second.details.find(d=>d.level==='Material'&&d.status==='EXISTE');
 assert.ok(detail);
 assert.match(detail.reason||'',/contractual ya existe/i);
});

test('la importación revierte todo si una operación falla',async()=>{
 const plan=buildUnifiedPlan([
  row({installation_name:'Oficina',material_code:'MAT-01',quantity:'10'}),
  row({installation_name:'Bodega',material_code:'MAT-02',quantity:'20'}),
 ],{clients:[],materials,assignments:[]});
 const created=[];
 let counter=0;
 let assignmentCalls=0;
 const executor={
  async createClient(){const id=`c${++counter}`;created.push(['clients',id]);return id;},
  async createContract(){const id=`k${++counter}`;created.push(['contracts',id]);return id;},
  async createInstallation(){const id=`i${++counter}`;created.push(['installations',id]);return id;},
  async createAssignment(){assignmentCalls++;if(assignmentCalls===2)throw new Error('Falla simulada al grabar material');const id=`a${++counter}`;created.push(['contract_materials',id]);return id;},
  async remove(table,id){const at=created.findIndex(x=>x[0]===table&&x[1]===id);if(at<0)throw new Error('No existe');created.splice(at,1);},
 };
 await assert.rejects(()=>runUnifiedCommit(plan,executor),/revirtieron todos los registros/i);
 assert.equal(created.length,0);
});

test('la reversión informa registros que no pudo eliminar',async()=>{
 const plan=buildUnifiedPlan([row({installation_name:'Oficina',material_code:'MAT-01',quantity:'10'})],{clients:[],materials,assignments:[]});
 let counter=0;
 const executor={
  async createClient(){return `c${++counter}`;},
  async createContract(){return `k${++counter}`;},
  async createInstallation(){return `i${++counter}`;},
  async createAssignment(){throw new Error('Falla simulada');},
  async remove(){throw new Error('Sin permiso de borrado');},
 };
 await assert.rejects(()=>runUnifiedCommit(plan,executor),(error)=>{
  assert.match(error.message,/No se pudo revertir todo/);
  assert.equal(error.rolledBack,false);
  return true;
 });
});
