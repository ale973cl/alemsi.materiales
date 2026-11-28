import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {monthRange,buildBudgetCurve,pasteExcelCurve,campaignBaseBudget,valueCampaign,allocateGuide,nextCycle} from "../src/lib/ac-economic-engine.ts";
import {calculatePayable} from "../src/lib/ac-invoice-credit.ts";
const id=n=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");

test("curvas mensuales, remanentes y fila de Excel",()=>{
 assert.deepEqual(monthRange("2026-11","2027-02"),["2026-11","2026-12","2027-01","2027-02"]);
 const fixed=buildBudgetCurve({mode:"fija",start:"2026-12",end:"2027-02",fixedCLP:120000});
 assert.equal(campaignBaseBudget(fixed,"2026-12","2027-02"),360000);
 assert.equal(campaignBaseBudget(fixed,"2026-11","2027-02"),null);
 assert.deepEqual(pasteExcelCurve("120.000\t90.000\t60.000"),[120000,90000,60000]);
 assert.deepEqual(buildBudgetCurve({mode:"remanente",start:"2026-10",end:"2027-01",todayMonth:"2026-12",values:[80000,60000]}),[{month:"2026-12",netCLP:80000},{month:"2027-01",netCLP:60000}]);
 assert.throws(()=>buildBudgetCurve({mode:"variable",start:"2026-11",end:"2026-12",values:[1000]}));
 assert.equal(nextCycle("2026-11",4),"2027-03");
});
test("valorización estructural sin mezclar el CPP con último precio factura",()=>{
 const rows=[{maxQty:5,physicalQty:2,consolidatedShortage:3,availableStock:1,weightedCost:1000,lastInvoiceUnitNet:1100},
 {maxQty:4,physicalQty:4,consolidatedShortage:0,availableStock:2,weightedCost:500,lastInvoiceUnitNet:800}];
 assert.deepEqual(valueCampaign(rows),{theoretical:7000,shortage:3000,purchaseRequired:2200,incomplete:[]});
 assert.equal(valueCampaign([{...rows[0],weightedCost:null}]).theoretical,null);
});
test("devengo ponderado, redondeo y extraordinarios",()=>{
 const c=[{month:"2026-11",netCLP:6000},{month:"2026-12",netCLP:3000},{month:"2027-01",netCLP:1000}];
 assert.deepEqual(allocateGuide(100,c,"campana"),[{month:"2026-11",netCLP:60},{month:"2026-12",netCLP:30},{month:"2027-01",netCLP:10}]);
 assert.equal(allocateGuide(100.01,c,"campana").reduce((a,x)=>a+x.netCLP,0).toFixed(2),"100.01");
 assert.deepEqual(allocateGuide(42,[],"extra","2026-11"),[{month:"2026-11",netCLP:42}]);
 assert.throws(()=>allocateGuide(100,[{month:"2026-11",netCLP:0}],"campana"));
});
test("plazo SII, reclamo, pagos y zona horaria",()=>{
 const p=calculatePayable({paymentTerms:"Crédito",creditDays:30,siiReceiptDate:"2026-11-27",today:"2026-12-23",totalCLP:119000,accreditedCLP:0});
 assert.equal(p.dueDate,"2026-12-27");assert.equal(p.claimDeadline,"2026-12-05");assert.equal(p.state,"Por Vencer");
 assert.equal(calculatePayable({paymentTerms:"Crédito",siiReceiptDate:"2026-11-27",today:"2027-01-02",totalCLP:119000,accreditedCLP:0}).lateDays,6);
 assert.equal(calculatePayable({paymentTerms:"Crédito",siiReceiptDate:null,today:"2026-11-27",totalCLP:119000,accreditedCLP:0}).state,"Sin fecha SII");
 assert.equal(calculatePayable({paymentTerms:"Crédito",siiReceiptDate:"2026-11-27",today:"2026-12-01",totalCLP:119000,accreditedCLP:119000}).state,"Pagada");
 assert.equal(calculatePayable({paymentTerms:"Crédito",siiReceiptDate:"2024-02-28",today:"2024-03-29",totalCLP:1,accreditedCLP:0}).dueDate,"2024-03-29");
});
test("PostgreSQL aislado: migración, activación, guías, devoluciones y facturas",async t=>{
 const db=new PGlite();
 const fixture=[
 "create schema auth",
 "create role anon",
 "create role authenticated",
 "create table auth.users(id uuid primary key)",
 "create function auth.uid() returns uuid language sql stable as $$select null::uuid$$",
 "create table public.user_profiles(id uuid primary key,active boolean,role text)",
 "create table public.clients(id uuid primary key,legal_name text)",
 "create table public.contracts(id uuid primary key,client_id uuid references clients(id),name text,active boolean default true,start_date date)",
 "create table public.campaigns(id uuid primary key,contract_id uuid references contracts(id))",
 "create table public.campaign_installations(campaign_id uuid references campaigns(id),installation_id uuid)",
 "create table public.installations(id uuid primary key,contract_id uuid references contracts(id))",
 "create table public.materials(id uuid primary key,current_net_price numeric)",
 "create table public.dispatches(id uuid primary key,installation_id uuid references installations(id),contract_id uuid references contracts(id),campaign_id uuid references campaigns(id),observations text,created_at timestamptz default now(),dispatched_at timestamptz,status text)",
 "create table public.dispatch_lines(id uuid primary key default gen_random_uuid(),dispatch_id uuid references dispatches(id),material_id uuid references materials(id),required_qty numeric,delivered_qty numeric)",
 "create table public.inventory_movements(id uuid primary key,material_id uuid references materials(id),signed_quantity numeric,movement_type text)",
 "create table public.receipts(id uuid primary key,supplier_id uuid,document_folio text,document_type text,document_total numeric)"
 ].join(";\n")+";";
 try{
  await db.exec(fixture);
  await db.exec(await readFile(new URL("../supabase/migrations/20261127220000_ac_motor_economico_opcional.sql",import.meta.url),"utf8"));
  const count=async table=>Number((await db.query("select count(*) n from "+table)).rows[0].n);
  await db.query("insert into clients values ($1,'Demo'),($2,'Otro')",[id(1),id(2)]);
  await db.query("insert into contracts(id,client_id,name) values ($1,$2,'C1'),($3,$4,'C2')",[id(3),id(1),id(4),id(2)]);
  await db.query("insert into campaigns values ($1,null)",[id(5)]);
  await db.query("insert into installations values ($1,$2),($3,$4)",[id(6),id(3),id(7),id(4)]);
  await db.query("insert into campaign_installations values ($1,$2),($1,$3)",[id(5),id(6),id(7)]);
  await db.query("insert into materials values ($1,1000)",[id(8)]);
  await db.query("insert into dispatches(id,installation_id,campaign_id,observations,status) values ($1,$2,null,$3,'En preparación')",[id(9),id(6),"CAMPAÑA:"+id(5)]);
  await t.test("sin control no congela, no imputa y no bloquea",async()=>{
   await db.query("insert into dispatch_lines(dispatch_id,material_id,required_qty,delivered_qty) values ($1,$2,2,0)",[id(9),id(8)]);
   assert.equal(await count("ac_guia_imputacion_mensual"),0);
   assert.equal(Number((await db.query("select count(*) n from dispatch_lines where costo_unitario_congelado_clp is null")).rows[0].n),1);
  });
  await db.query("update contracts set control_economico_activo=true where id in ($1,$2)",[id(3),id(4)]);
  await db.query("insert into ac_contrato_presupuesto_mensual(contrato_id,mes,techo_neto_clp) values ($1,'2026-11',600),($1,'2026-12',300),($2,'2026-11',1200),($2,'2026-12',800)",[id(3),id(4)]);
  await db.query("insert into ac_campana_periodo(campana_id,contrato_id,mes_inicio,mes_fin) values ($1,$2,'2026-11','2026-12'),($1,$3,'2026-11','2026-12')",[id(5),id(3),id(4)]);
  await t.test("prorrateo ponderado y precio congelado",async()=>{
   await db.query("insert into dispatch_lines(dispatch_id,material_id,required_qty,delivered_qty) values ($1,$2,3,3)",[id(9),id(8)]);
   const v=(await db.query("select mes,importe_neto_clp from ac_guia_imputacion_mensual order by mes")).rows;
   assert.equal(v.length,2);assert.equal(Number(v[0].importe_neto_clp),2000);assert.equal(Number(v[1].importe_neto_clp),1000);
   assert.equal(Number((await db.query("select max(costo_unitario_congelado_clp) n from dispatch_lines")).rows[0].n),1000);
  });
  await t.test("campaña multicontrato no mezcla presupuestos",async()=>{
   await db.query("insert into dispatches(id,installation_id,campaign_id,observations,status) values ($1,$2,null,$3,'En preparación')",[id(10),id(7),"CAMPAÑA:"+id(5)]);
   await db.query("insert into dispatch_lines(dispatch_id,material_id,required_qty,delivered_qty) values ($1,$2,2,2)",[id(10),id(8)]);
   const v=(await db.query("select contrato_id,mes,importe_neto_clp from ac_guia_imputacion_mensual where guia_id=$1 order by mes",[id(10)])).rows;
   assert.equal(v.length,2);assert.equal(Number(v[0].importe_neto_clp),1200);assert.equal(Number(v[1].importe_neto_clp),800);
   assert.equal(v[0].contrato_id,id(4));
  });
  await t.test("retorno acreditado reduce gasto del contrato",async()=>{
   const line=(await db.query("select id from dispatch_lines where dispatch_id=$1 and costo_unitario_congelado_clp is not null limit 1",[id(9)])).rows[0].id;
   await db.query("insert into inventory_movements values ($1,$2,1,'return')",[id(11),id(8)]);
   await db.query("insert into ac_devoluciones_materiales(linea_guia_id,movimiento_inventario_id,cantidad_reingresada) values ($1,$2,1)",[line,id(11)]);
   assert.equal(Number((await db.query("select sum(retornos_neto) n from ac_v_resumen_mensual where contrato_id=$1",[id(3)])).rows[0].n),1000);
  });
  await t.test("factura: fecha vencimiento 30 y reclamo 8",async()=>{
   await db.query("insert into receipts values ($1,null,'F-1','Factura',119000)",[id(12)]);
   await db.query("insert into ac_factura_credito(factura_id,fecha_recepcion_sii) values ($1,'2026-11-27')",[id(12)]);
   const p=(await db.query("select fecha_vencimiento,fecha_limite_reclamo from ac_factura_credito where factura_id=$1",[id(12)])).rows[0];
   assert.equal(new Date(p.fecha_vencimiento).toISOString().slice(0,10),"2026-12-27");assert.equal(new Date(p.fecha_limite_reclamo).toISOString().slice(0,10),"2026-12-05");
   await db.query("insert into ac_factura_pagos(factura_id,monto_clp,fecha_pago,referencia,acreditado) values ($1,119000,'2026-12-05','TRANSFERENCIA',true)",[id(12)]);
   await assert.rejects(db.query("insert into ac_factura_pagos(factura_id,monto_clp,fecha_pago,referencia,acreditado) values ($1,1,'2026-12-05','EXCESO',true)",[id(12)]),/excede/);
  });
 }finally{await db.close()}
});
