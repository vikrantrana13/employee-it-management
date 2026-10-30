import assert from 'node:assert/strict';
import {createDatabase} from '../src/database.js';
import {accessService} from '../src/access/service.js';
const pool=createDatabase(),applicationId='verify-'+Date.now();let added=false;
try{
 const [rows]=await pool.query("SELECT keycloak_id FROM employees WHERE status='active' ORDER BY created_at LIMIT 1");if(!rows.length)throw new Error('Create a fictional active employee first.');const subject=rows[0].keycloak_id;
 await pool.execute('INSERT INTO applications (id,name,description) VALUES (?,?,?)',[applicationId,'Verification application','Internal workflow test fixture.']);added=true;
 const service=accessService(pool),input={applicationId,reason:'Needed for workflow verification.'};
 await assert.rejects(()=>service.create('unlinked-demo',input),{status:403});
 const initial=await Promise.allSettled([service.create(subject,input),service.create(subject,input)]);
 assert.equal(initial.filter(x=>x.status==='fulfilled').length,1);assert.equal(initial.find(x=>x.status==='rejected').reason.status,409);
 const first=initial.find(x=>x.status==='fulfilled').value;
 await assert.rejects(()=>service.decide(first.id,subject,{decision:'approved',reason:'Self approval must be denied.'}),{status:403});
 await assert.rejects(()=>service.cancel(first.id,'different-subject'),{status:404});
 await service.cancel(first.id,subject);await assert.rejects(()=>service.cancel(first.id,subject),{status:409});
 const second=await service.create(subject,input);await service.decide(second.id,'verification-admin',{decision:'rejected',reason:'Rejected to verify the decision path.'});
 const third=await service.create(subject,input);
 const decisions=await Promise.allSettled([service.decide(third.id,'verification-admin',{decision:'approved',reason:'Approved after reviewing the business need.'}),service.decide(third.id,'another-admin',{decision:'rejected',reason:'Concurrent decision must be rejected.'})]);
 assert.equal(decisions.filter(x=>x.status==='fulfilled').length,1);assert.equal(decisions.find(x=>x.status==='rejected').reason.status,409);
 const [final]=await pool.execute('SELECT status FROM access_requests WHERE id=?',[third.id]);
 if(final[0].status==='rejected'){const fourth=await service.create(subject,input);await service.decide(fourth.id,'verification-admin',{decision:'approved',reason:'Approved to verify the access record.'});}
 const own=await service.mine(subject);assert.equal(own.access.filter(x=>x.application_id===applicationId).length,1);
 await assert.rejects(()=>service.create(subject,input),{status:409});assert.equal((await service.mine('different-subject')).requests.length,0);
 const [events]=await pool.execute('SELECT v.action FROM access_events v JOIN access_requests r ON r.id=v.request_id WHERE r.application_id=?',[applicationId]);assert.ok(events.some(x=>x.action==='request_approved'));assert.ok(events.some(x=>x.action==='request_rejected'));assert.ok(events.some(x=>x.action==='request_cancelled'));
 console.log('Live access checks passed: concurrent request/decision protection, self-review denial, ownership, cancellation, rejection, resubmission, unique approval and persistent events. Verification catalog item disabled afterward.');
}finally{if(added)await pool.execute('UPDATE applications SET enabled=FALSE WHERE id=?',[applicationId]);await pool.end();}
