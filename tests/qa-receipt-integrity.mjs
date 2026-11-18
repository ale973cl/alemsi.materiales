import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {validateReceiptDraft} from '../src/lib/receipt-validation.ts';
import {receiptTransactionsEnabled} from '../src/lib/receipt-transactions.ts';
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const line={material_id:id(10),received_qty:2,actual_unit_net:100};
const draft={documentType:'Factura',folio:'123',date:'2026-11-17',net:200,vat:38,total:238,lines:[line],withOrder:false,reason:'Compra urgente'};
test('validación manual y OCR rechaza errores antes de persistir',()=>{
 assert.equal(validateReceiptDraft(draft).length,1);
 for(const change of [{date:'2026-02-30'},{total:239.1},{net:NaN},{lines:[line,line]},{lines:[{...line,received_qty:-1}]},{lines:[{...line,actual_unit_net:Infinity}]},{lines:[{...line,received_qty:'2'}]},{lines:[]},{reason:'x'}])assert.throws(()=>validateReceiptDraft({...draft,...change}));
});
test('piloto requiere activación y rechaza Production',()=>{
 assert.equal(receiptTransactionsEnabled({}),false);
 assert.equal(receiptTransactionsEnabled({ALEMSI_RECEIPT_V2:'1',VERCEL_ENV:'preview'}),true);
 assert.throws(()=>receiptTransactionsEnabled({ALEMSI_RECEIPT_V2:'1',VERCEL_ENV:'production'}));
});
test('PostgreSQL: registro, RUT único, cotejo, reintento, permisos y rollback',async t=>{
 const db=new PGlite();
 try{
 await db.exec(await readFile(new URL('./fixtures/receipt-schema.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261118011206_receipt_integrity_v2.sql',import.meta.url),'utf8'));
 await db.query(`insert into user_profiles values ($1,'Finanzas',true,'QA','qa@example.test'),($2,'Bodega',true,'QA','qa@example.test'),($3,'Supervisora',true,'QA','qa@example.test'),($4,'Gerencia',true,'QA','qa@example.test')`,[id(1),id(2),id(3),id(4)]);
 await db.query(`insert into suppliers values ($1,'Ficticio','76.123.456-0',true),($2,'Mismo emisor','76123456-0',true)`,[id(20),id(21)]);
 await db.query(`insert into materials(id) values ($1),($2)`,[id(10),id(11)]);
 const login=async n=>{await db.exec('reset role');await db.query(`select set_config('test.uid',$1,false)`,[id(n)]);await db.exec('set role authenticated');};
 const document={supplier_id:id(20),document_type:'Factura',document_folio:'ABC-123',document_date:'2026-11-17',document_net:200,vat_amount:38,document_total:238,no_oc_reason:'Compra urgente'};
 const register=async(d=document,lines=[line])=>(await db.query('select register_receipt_v2($1::jsonb,$2::jsonb) id',[JSON.stringify(d),JSON.stringify(lines)])).rows[0].id;
 const reconcile=async r=>(await db.query('select reconcile_receipt_v2($1) result',[r])).rows[0].result;
 const count=async table=>Number((await db.query(`select count(*) n from ${table}`)).rows[0].n);
 await login(1);
 let receipt;
 await t.test('registro no genera stock y rechaza duplicado entre proveedores con igual RUT',async()=>{
  receipt=await register();assert.equal(await count('inventory_movements'),0);
  assert.equal(await register(),receipt);
  await assert.rejects(register({...document,supplier_id:id(21),document_folio:' abc-123 '}),/contenido diferente/i);
  assert.equal(await count('receipts'),1);
 });
 await t.test('no acepta mismo documento con cantidades distintas ni stock antes del cotejo',async()=>{
  await assert.rejects(register({...document,document_net:300,vat_amount:57,document_total:357},[{...line,received_qty:3}]),/contenido diferente/);
  await login(2);
  const rl=(await db.query('select id from receipt_lines where receipt_id=$1',[receipt])).rows[0].id;
  await assert.rejects(db.query(`insert into inventory_movements(material_id,receipt_line_id,movement_type,quantity,signed_quantity,created_by) values($1,$2,'receipt',2,2,$3)`,[id(10),rl,id(2)]),/validada/);
  await assert.rejects(db.query('update receipts set inventory_posted=true where id=$1',[receipt]),/Solo Finanzas/);
  await login(1);
 });
 await t.test('cotejo financiero produce un único movimiento y conserva precio',async()=>{
  assert.equal((await reconcile(receipt)).status,'Confirmada sin OC');
  assert.equal(await count('inventory_movements'),1);
  assert.equal(Number((await db.query('select current_net_price from materials where id=$1',[id(10)])).rows[0].current_net_price),100);
  assert.equal((await reconcile(receipt)).alreadyPosted,true);assert.equal(await count('inventory_movements'),1);
 });
 await t.test('documento confirmado y líneas quedan protegidos',async()=>{
  await assert.rejects(db.query('update receipts set document_net=1 where id=$1',[receipt]),/regularización/);
  await assert.rejects(db.query('update receipt_lines set received_qty=999 where receipt_id=$1',[receipt]),/confirmado/);
 });
 await t.test('fallo al guardar líneas revierte cabecera y auditoría',async()=>{
  await db.exec('reset role');
  await db.exec(`create function test_fail_line() returns trigger language plpgsql as $$ begin raise exception 'fallo simulado'; end $$; create trigger test_fail_line before insert on receipt_lines for each row execute function test_fail_line();`);
  await login(1);const before=await count('receipts');
  await assert.rejects(register({...document,document_folio:'FAIL-LINE'}),/fallo simulado/);
  assert.equal(await count('receipts'),before);
  await db.exec('reset role');await db.exec('drop trigger test_fail_line on receipt_lines');await login(1);
 });
 await t.test('fallo en último paso del cotejo revierte stock, precio y estado',async()=>{
  const r=await register({...document,document_folio:'FAIL-AUDIT',document_net:400,vat_amount:76,document_total:476},[{...line,actual_unit_net:200}]);
  await db.exec('reset role');await db.exec(`create function test_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'auditoría fallida'; end $$; create trigger test_fail_audit before insert on activity_log for each row execute function test_fail_audit();`);
  await login(1);const before=await count('inventory_movements');
  await assert.rejects(reconcile(r),/auditoría fallida/);
  assert.equal(await count('inventory_movements'),before);
  assert.equal(Number((await db.query('select current_net_price from materials where id=$1',[id(10)])).rows[0].current_net_price),100);
  assert.equal((await db.query('select inventory_posted from receipts where id=$1',[r])).rows[0].inventory_posted,false);
  await db.exec('reset role');await db.exec('drop trigger test_fail_audit on activity_log');await login(1);
  assert.equal((await reconcile(r)).alreadyPosted,false);
 });
 await t.test('Bodega recibe, Finanzas coteja; perfil ajeno y usuario inactivo se rechazan',async()=>{
  await login(2);const r=await register({...document,document_folio:'BODEGA'});
  await assert.rejects(reconcile(r),/No autorizado/);
  await login(3);await assert.rejects(register({...document,document_folio:'DENIED'}),/No autorizado/);
  await login(1);await reconcile(r);
  await db.exec('reset role');await db.query('update user_profiles set active=false where id=$1',[id(3)]);
  await login(3);await assert.rejects(reconcile(r),/No autorizado/);
 });
 await t.test('Gerencia registra y coteja con RLS sin privilegios elevados',async()=>{
  await login(4);const r=await register({...document,document_folio:'GERENCIA'});assert.equal((await reconcile(r)).ok,true);
 });
 await t.test('OC parcial cierra incompleta y rechaza material/cantidad ajenos',async()=>{
  await db.exec('reset role');
  await db.query(`insert into purchase_orders values ($1,$2,'Emitida',400)`,[id(30),id(20)]);
  await db.query(`insert into purchase_order_lines values ($1,$2,$3,4,100)`,[id(31),id(30),id(10)]);
  await login(2);
  const doc={...document,purchase_order_id:id(30),document_folio:'OC-1',document_net:400,vat_amount:76,document_total:476};
  await assert.rejects(register(doc,[{...line,material_id:id(11),purchase_order_line_id:id(31)}]),/ajeno/);
  const r=await register(doc,[{...line,purchase_order_line_id:id(31)}]);
  await login(1);const result=await reconcile(r);assert.equal(result.status,'Con diferencia');assert.equal(result.orderStatus,'Cerrada incompleta');assert.equal(Number(result.outstanding),2);
 });
 await t.test('reintento multílínea es estable y una edición del borrador lo invalida',async()=>{
  await login(1);
  const doc={...document,document_folio:'MULTI'};
  const lines=[{...line,received_qty:1},{...line,material_id:id(11),received_qty:1}];
  const r=await register(doc,lines);assert.equal(await register(doc,lines),r);
  await db.query('update receipt_lines set actual_unit_net=101 where receipt_id=$1 and material_id=$2',[r,id(11)]);
  await assert.rejects(register(doc,lines),/contenido diferente/);
 });
 await t.test('anónimo no puede ejecutar ninguna RPC del piloto',async()=>{
  await db.exec('reset role');await db.exec('set role anon');
  await assert.rejects(register({...document,document_folio:'ANON'}),/permission denied/);
  await assert.rejects(reconcile(receipt),/permission denied/);
 });
 }finally{await db.close();}
});
