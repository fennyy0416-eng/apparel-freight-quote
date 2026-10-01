const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
require('../src/quote-rules.js');
const tariffs = require('../src/tariffs.js');
const tax = require('../src/tax-engine.js');
const engine = require('../src/engine.js');
const d = {product:'Cotton shirts',weight:480,volume:26.5,cartons:100,pieces:1200,destination:'commercial',zip:'08817',origin:'Shanghai',ready:'2026-09-20'};
const x = {fobUnit:15,load:'LCL',containers:1,delivery:'transload',country:'China',entryDate:'2026-09-25',entries:1,taxTreatment:'standard',broker:'ours',tariff:{code:'6109.10.00',rate:'16.5%',section301:{rate:7.5,heading:'test fixture'}}};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('China 61/62 snapshot: duties and fees are complete',()=>{
 for(const code of ['6109.10.00','6205.20.20']){
  const r=tax.calculate(d,{...x,tariff:{...x.tariff,code}});
  assert.equal(r.complete,true);
  assert.deepEqual(r.rows.map(r=>r[2]),[2970,1350,2250,62.35,22.5]);
  close(r.total,6654.85);close(r.per,6654.85/1200);
 }
});
test('out-of-scope duties remain null, never a confirmed zero',()=>{
 for(const patch of [{country:'Vietnam'},{entryDate:'2026-09-18'},{taxTreatment:'review'},{tariff:{...x.tariff,code:'6302.10.00'}}]){
  const r=tax.calculate(d,{...x,...patch});
  assert.equal(r.complete,false);assert.equal(r.rows[0][2],null);
  assert.equal(r.rows[1][2],null);assert.equal(r.rows[2][2],null);
 }
});
test('UI shows unknown tax rows as pending confirmation',()=>{
 const context=vm.createContext({en:false,TaxEngine:tax,trade:x,t:(zh)=>zh,usd:n=>'$'+n,esc:String});
 const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8');
 const start=app.indexOf('function taxCostBlock('),end=app.indexOf('\nfunction resultPage',start);
 vm.runInContext(app.slice(start,end),context);
 const html=context.taxCostBlock({taxSummary:tax.calculate(d,{...x,country:'Vietnam'})});
 assert.equal((html.match(/待确认/g)||[]).length,5);
 assert.ok(!html.includes('<b>$0</b>'));
});
test('MPF equal-value entries use per-entry limits for both fiscal years',()=>{
 for(const [date,min,max] of [['2026-09-25',33.58,651.5],['2026-10-01',34.58,670.86]]){
  const mpf=(value,entries)=>tax.calculate({pieces:1},{...x,entryDate:date,fobUnit:value,entries}).rows[3][2];
  close(mpf(1000,2),min*2);close(mpf(1000000,2),max*2);
  close(mpf(100000,2),346.4);
  close(mpf(18000,2),Math.round(min*2*100)/100);
 }
});
test('LCL and FCL totals, goods value and per-piece reconcile across zones',()=>{
 for(const zip of ['92618','60601','08817'])for(const load of ['LCL','20GP','40GP','40HQ','45HQ','AUTO'])for(const volume of [0.5,26.5,60,125]){
  const shipment={...d,zip,volume};
  for(const p of engine.traditional(shipment,{...x,load,containers:2})){
   assert.ok(Number.isFinite(p.total));close(p.total,p.rows.reduce((sum,r)=>sum+(r[2]??0),0));
   close(p.landed,p.total+18000);close(p.per,p.landed/1200);
   if(p.loadPlan.load==='LCL')close(p.rows[0][2],Math.max(1,volume)*p.oceanRate);
  }
 }
 assert.deepEqual(engine.traditional(d,x).map(p=>p.rows[0][2]),[2252.5,3577.5,5035,5830]);
 assert.deepEqual(engine.traditional(d,{...x,load:'40HQ',containers:2}).map(p=>p.rows[0][2]),[7800,9750,11700,13650]);
});
test('route reorder and a fifth route keep independent rates; incomplete rates reject',()=>{
 const ctx=vm.createContext({FreightRules:globalThis.FreightRules,TaxEngine:tax});
 const code=fs.readFileSync(path.join(root,'src/engine.js'),'utf8').replace('const routes={','const routes=root.testRoutes={');
 vm.runInContext(code,ctx);
 const expected=new Map(ctx.QuoteEngine.traditional(d,x).map(p=>[p.id,p.total]));
 ctx.testRoutes.east.reverse();
 for(const p of ctx.QuoteEngine.traditional(d,x))close(p.total,expected.get(p.id));
 ctx.testRoutes.east.push({id:'fifth',zh:'测试',en:'Test',kgRate:5,min:10,max:20,lclPerCbm:300,fclMultiplier:2});
 close(ctx.QuoteEngine.traditional(d,x).at(-1).rows[0][2],7950);
 close(ctx.QuoteEngine.traditional(d,{...x,load:'40HQ'}).at(-1).rows[0][2],7800);
 delete ctx.testRoutes.east.at(-1).lclPerCbm;
 assert.throws(()=>ctx.QuoteEngine.traditional(d,x),/Missing route freight rates/);
});
test('ecommerce preserves explicit per-route kilogram prices',()=>{
 for(const [zip,rates] of [['92618',[2.2,2.8,3.6]],['60601',[2.8,3.4,4.2]],['08817',[2.9,3.2,3.8,4.6]]]){
  engine.ecommerce({...d,zip}).forEach((p,i)=>{close(p.rate,rates[i]);close(p.total,4426*rates[i]);});
 }
});
test('legacy dead tax/fees do not affect calculation or validation',()=>{
 assert.deepEqual(engine.traditional(d,{...x,tax:'invalid',fees:-1}),engine.traditional(d,x));
});
test('tariff rate parser distinguishes unknown rates and true duty free',()=>{
 assert.equal(tariffs.parseRate('Free'),0);assert.equal(tariffs.parseRate('16.5%'),16.5);
 assert.equal(tariffs.parseRate('20 cents/kg + 5%'),null);
 const data={records:[{code:'6109.10.00',description:'Cotton knit shirts'}]};
 assert.equal(tariffs.search(data,'610910').length,1);assert.equal(tariffs.search(data,'cotton shirts').length,1);
});

test('LA–NY trucking uses owner cost plus 10%, without charging direct NY or other lanes',()=>{
 const shipment={...d,volume:25,pieces:24000};
 const plans=engine.traditional(shipment,x);
 for(const p of plans.filter(p=>p.id!=='ny')){
  assert.equal(p.deliveryQuote.units,13);assert.equal(p.deliveryQuote.unitRate,385);
  assert.equal(p.deliveryQuote.total,5005);close(p.deliveryQuote.total/24000,5005/24000);
 }
 assert.equal(plans[0].deliveryQuote.unitRate,200);
 for(const volume of [60,120]){
  const p=engine.traditional({...shipment,volume},{...x,load:'AUTO'})[1];
  assert.equal(p.deliveryQuote.unitRate,9570);assert.equal(p.deliveryQuote.total,9570*volume/60);
 }
 for(const zip of ['92618','60601','33101'])assert.equal(engine.traditional({...shipment,zip},x)[1].deliveryQuote.lane,null);
 assert.equal(engine.traditional(shipment,{...x,load:'40HQ',delivery:'direct'})[1].deliveryQuote.lane,null);
});
