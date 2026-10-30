import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createDatabase} from '../src/database.js';
import {ticketService} from '../src/tickets/service.js';
const pool=createDatabase();
try{
  const service=ticketService(pool);const [employees]=await pool.query("SELECT keycloak_id FROM employees WHERE status='active' ORDER BY created_at LIMIT 1");if(!employees.length)throw new Error('Create an active fictional employee first.');
  const owner={sub:employees[0].keycloak_id,name:'Verification requester',roles:['employee']},stranger={sub:'unrelated-user',roles:['employee']},staffA={sub:'verify-support-a',name:'Verification Support A',roles:['it-support']},staffB={sub:'verify-support-b',name:'Verification Support B',roles:['it-support']};
  const input={title:'Verification: recurring Wi-Fi issue',description:'Local test ticket for permissions, concurrent claiming and resolution history.',category:'network',priority:'normal'};
  await assert.rejects(()=>service.create(stranger,input),{status:403});await assert.rejects(()=>service.create(owner,{...input,deviceId:randomUUID()}),{status:400});
  const ticket=await service.create(owner,input);
  await assert.rejects(()=>service.detail(ticket.id,stranger),{status:404});await assert.rejects(()=>service.comment(ticket.id,stranger,{body:'Unauthorized reply'}),{status:404});
  await assert.rejects(()=>service.list(stranger,{scope:'queue'}),{status:403});
  await assert.rejects(()=>service.transition(ticket.id,owner,{action:'claim'}),{status:403});
  const attempts=await Promise.allSettled([service.transition(ticket.id,staffA,{action:'claim'}),service.transition(ticket.id,staffB,{action:'claim'})]);
  assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);assert.equal(attempts.find(x=>x.status==='rejected').reason.status,409);
  const state=(await service.detail(ticket.id,owner)).ticket;const winner=state.assigned_to===staffA.sub?staffA:staffB,loser=winner===staffA?staffB:staffA;
  await assert.rejects(()=>service.transition(ticket.id,loser,{action:'resolve',note:'Unauthorized resolution attempt.'}),{status:403});
  await service.comment(ticket.id,winner,{body:'Checked driver settings and gathered connection logs.'});
  await service.transition(ticket.id,winner,{action:'resolve',note:'Updated the driver and verified a stable connection.'});
  await assert.rejects(()=>service.transition(ticket.id,winner,{action:'close'}),{status:403});
  await service.transition(ticket.id,owner,{action:'close'});await assert.rejects(()=>service.comment(ticket.id,owner,{body:'Reply on a closed ticket'}),{status:409});
  await service.transition(ticket.id,owner,{action:'reopen',note:'The issue returned during the next connection test.'});
  const reopened=await service.detail(ticket.id,owner);assert.equal(reopened.ticket.assigned_to,null);assert.equal(reopened.ticket.resolution,null);assert.ok(reopened.events.some(x=>x.action==='ticket_resolved'&&x.body.includes('driver')));
  await service.transition(ticket.id,winner,{action:'claim'});await service.transition(ticket.id,winner,{action:'resolve',note:'Adjusted the access point configuration and retested.'});await service.transition(ticket.id,owner,{action:'close'});
  const final=await service.detail(ticket.id,owner);assert.equal(final.ticket.status,'closed');assert.equal(final.events.filter(x=>x.action==='ticket_claimed').length,2);assert.equal(final.events.filter(x=>x.action==='ticket_resolved').length,2);
  assert.ok(!(await service.list(stranger,{scope:'mine'})).some(x=>x.id===ticket.id));
  console.log('Live ticket checks passed: device ownership, private reads/replies, concurrent claims, assignee-only resolution, close/reopen rules, retained history and atomic transitions. One closed verification ticket retained.');
}finally{await pool.end();}
