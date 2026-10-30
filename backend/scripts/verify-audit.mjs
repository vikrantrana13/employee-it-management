import assert from 'node:assert/strict';
import {createDatabase} from '../src/database.js';
import {auditService} from '../src/audit/service.js';
const pool=createDatabase(),service=auditService(pool);
try{
 const all=[];let cursor='';
 do{const page=await service.list({cursor});all.push(...page.events);cursor=page.nextCursor;}while(cursor);
 const [[counts]]=await pool.query('SELECT (SELECT COUNT(*) FROM onboarding_events)+(SELECT COUNT(*) FROM device_events)+(SELECT COUNT(*) FROM access_events)+(SELECT COUNT(*) FROM ticket_events) total');
 assert.equal(all.length,Number(counts.total));assert.equal(new Set(all.map(e=>e.source+e.event_id)).size,all.length);
 for(let i=1;i<all.length;i++){
 const a=all[i-1],b=all[i];assert.ok(a.occurred_at>b.occurred_at||(a.occurred_at===b.occurred_at&&(a.source>b.source||(a.source===b.source&&BigInt(a.event_id)>BigInt(b.event_id)))));
 }
 for(const source of ['employee','device','access','ticket']){const page=await service.list({source});assert.ok(page.events.length);assert.ok(page.events.every(e=>e.source===source));}
 assert.equal((await service.list({search:"%' OR 1=1 --"})).events.length,0);
 if(all.length){const day=all[0].occurred_at.slice(0,10);assert.ok((await service.list({from:day,to:day})).events.every(e=>e.occurred_at.startsWith(day)));}
 console.log(`Audit verification passed: ${all.length} events, all four sources, pagination, literal search and UTC dates. No records changed.`);
}finally{await pool.end();}
