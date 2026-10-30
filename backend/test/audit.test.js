import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFilters,auditService} from '../src/audit/service.js';
import {createApp} from '../src/app.js';
test('audit rejects invalid dates, sources, nested inputs and malformed cursors',()=>{
 for(const query of [{from:'2026-02-30'},{from:'2026-09-10',to:'2026-09-09'},{source:'unknown'},{search:['x']},{cursor:'bad'},{search:'a'.repeat(101)},{extra:'x'}])assert.throws(()=>validateFilters(query),{status:400});
 assert.equal(validateFilters({from:'2024-02-29',search:' laptop '}).search,'laptop');
});
test('audit binds search input and uses a numeric tie breaker with a bounded page',async()=>{
 let captured;
 const rows=Array.from({length:26},(_,i)=>({source:'ticket',event_id:String(100-i),occurred_at:'2026-09-10 12:00:00'}));
 const service=auditService({query:async q=>{captured=q;return [rows];}});
 const page=await service.list({search:"%' OR 1=1 --"});
 assert.equal(page.events.length,25);assert.ok(!captured.sql.includes("OR 1=1"));assert.equal(captured.values[0],"%' OR 1=1 --");
 assert.deepEqual(validateFilters({cursor:page.nextCursor}).after,['2026-09-10 12:00:00','ticket','76']);
 await service.list({cursor:page.nextCursor});assert.ok(captured.sql.includes('CAST(? AS UNSIGNED)'));
});
test('audit denies anonymous, employee and support reads and permits only Admin',async()=>{
 let calls=0;
 const app=createApp({audit:{list:async()=>{calls++;return {events:[],nextCursor:null};}},verifyToken:async role=>({sub:'demo',realm_access:{roles:[role]}})});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
 const url=`http://127.0.0.1:${server.address().port}`;
 for(const [role,status] of [['',401],['employee',403],['it-support',403],['admin',200]]){
 const res=await fetch(url+'/api/audit',{headers:role?{authorization:`Bearer ${role}`}:{}});assert.equal(res.status,status);
 if(status===200)assert.equal(res.headers.get('cache-control'),'no-store');
 }
 assert.equal(calls,1);
 }finally{await new Promise(r=>server.close(r));}
});
