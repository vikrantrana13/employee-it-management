import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createDatabase} from '../src/database.js';
import {employeeRepository} from '../src/employees/repository.js';
import {onboardingService} from '../src/employees/service.js';
import {identityService} from '../src/employees/identity.js';
import {offboardingService} from '../src/offboarding/service.js';
import {accessService} from '../src/access/service.js';
import {inventoryService} from '../src/devices/service.js';
import {ticketService} from '../src/tickets/service.js';
const pool=createDatabase();
try{
 const identity=identityService({issuer:process.env.KEYCLOAK_ISSUER,clientId:process.env.KEYCLOAK_SERVICE_CLIENT,clientSecret:process.env.KEYCLOAK_SERVICE_SECRET});
 const onboarding=onboardingService(employeeRepository(pool),identity),access=accessService(pool),inventory=inventoryService(pool),tickets=ticketService(pool),suffix=Date.now();
 const password='OffboardA1!'+randomBytes(12).toString('hex'),actor={sub:'offboarding-verification-admin',name:'Verification Admin'};
 const created=await onboarding.create({first_name:'Offboarding',last_name:'Recovery Demo',email:'offboard-recovery-'+suffix+'@example.test',department:'IT — Offboarding verification',start_date:'2026-09-15',role:'it-support',temporaryPassword:password},actor.sub);assert.equal(created.employee.status,'active');const employee=created.employee;
 const grant=await access.create(employee.keycloak_id,{applicationId:'knowledge-base',reason:'Access used to verify offboarding revocation.'});await access.decide(grant.id,actor.sub,{decision:'approved',reason:'Approved for local offboarding verification.'});
 const pending=await access.create(employee.keycloak_id,{applicationId:'team-wiki',reason:'Pending request used to verify cancellation.'});
 const device=await inventory.create({asset_tag:'OFFBOARD-'+suffix,serial_number:'OFFBOARD-SERIAL-'+suffix,device_type:'laptop',model:'Offboarding verification laptop',location:'Test stockroom'},actor.sub);await inventory.assign(device.id,employee.id,actor.sub);
 const [others]=await pool.execute("SELECT keycloak_id FROM employees WHERE status='active' AND id<>? LIMIT 1",[employee.id]);
 let ticket;if(others.length){ticket=await tickets.create({sub:others[0].keycloak_id,name:'Verification Requester',roles:['employee']},{title:'Offboarding support handover test',description:'This fictional ticket verifies that support work is returned to the queue.',category:'other',priority:'low'});await tickets.transition(ticket.id,{sub:employee.keycloak_id,name:'Departing Support',roles:['it-support']},{action:'claim'});}
 let fail=true,unblock,startedSignal;const started=new Promise(resolve=>startedSignal=resolve);
 const service=offboardingService(pool,{deactivate:async e=>{if(fail)throw new Error('Simulated Keycloak outage');startedSignal();await new Promise(resolve=>unblock=resolve);return identity.deactivate(e);}});
 const first=await service.run(employee.id,actor,{reason:'Fictional employee leaving the test organization.'});assert.equal(first.employee.status,'offboarding');assert.equal(first.devices.length,1);assert.ok(first.approvals.every(a=>a.revoked_at));
 await assert.rejects(()=>onboarding.assertActive({sub:employee.keycloak_id,preferred_username:employee.username}),{status:403});
 await assert.rejects(()=>onboarding.retry(employee.id,password,actor.sub),{status:409});
 const [cancelled]=await pool.execute('SELECT status FROM access_requests WHERE id=?',[pending.id]);assert.equal(cancelled[0].status,'cancelled');
 if(ticket){const state=await tickets.detail(ticket.id,{sub:actor.sub,roles:['admin']});assert.equal(state.ticket.status,'open');assert.equal(state.ticket.assigned_to,null);}
 fail=false;const retry=service.run(employee.id,actor,{reason:'Fictional employee leaving the test organization.'});await started;
 try{await assert.rejects(()=>service.run(employee.id,actor,{reason:'Concurrent retry should not run.'}),{status:409});}finally{unblock();}
 const complete=await retry;assert.equal(complete.employee.status,'offboarded');assert.equal(complete.job.attempts,2);assert.equal(complete.devices.length,1);
 const repeated=await service.run(employee.id,actor,{reason:'Repeat request must not mutate state.'});assert.equal(repeated.job.attempts,2);
 const [events]=await pool.execute("SELECT id FROM access_events WHERE request_id=? AND action='approval_revoked'",[grant.id]);assert.equal(events.length,1);
 await assert.rejects(()=>onboarding.retry(employee.id,password,actor.sub),{status:409});
 console.log('Live offboarding passed: local block despite identity failure, approval revocation, request cancellation, support handover, retained device custody, retry/concurrency protection, verified Keycloak removal and no onboarding reactivation. Fictional offboarded employee/device retained.');
}finally{await pool.end();}
