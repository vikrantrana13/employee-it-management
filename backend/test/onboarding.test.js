import test from 'node:test';
import assert from 'node:assert/strict';
import { onboardingService, validateEmployee } from '../src/employees/service.js';
import { createApp } from '../src/app.js';

const input={first_name:'Test',last_name:'Employee',email:' TEST@example.test ',department:'IT',start_date:'2026-09-15',role:'employee',temporaryPassword:'Temporary12345!'};
function fixture() {
  const rows=new Map();let configured=0;let created=0;let shouldFail=false;const identities=new Map();const events=[];
  const repository={
    async insert(e){if([...rows.values()].some(x=>x.email===e.email))throw Object.assign(new Error(),{code:'ER_DUP_ENTRY'});rows.set(e.id,{...e,status:'pending'});},
    async get(id){return rows.get(id);},async list(){return [...rows.values()];},async byUsername(name){return [...rows.values()].find(x=>x.username===name);},
    async events(){return events;},
    async withLock(id,run){return run({get:async()=>rows.get(id),link:async key=>{rows.get(id).keycloak_id=key;},transition:async(status,_actor,action)=>{rows.get(id).status=status;events.push(action);}});},
  };
  const identity={async ensureUser(e){if(!identities.has(e.username)){identities.set(e.username,'kc-'+e.id);created++;}return identities.get(e.username);},async configure(){configured++;if(shouldFail)throw new Error('Simulated connection failure');}};
  return {service:onboardingService(repository,identity),fail:value=>{shouldFail=value;},counts:()=>({created,configured}),events};
}
test('validates normalized email, real dates, roles and password before saving',()=>{
  assert.equal(validateEmployee(input).email,'test@example.test');
  for(const change of [{role:'admin'},{start_date:'2026-02-30'},{email:'invalid'},{temporaryPassword:'short'},{first_name:''}])assert.throws(()=>validateEmployee({...input,...change}),{status:400});
});
test('creates a linked active employee without persisting the password',async()=>{
  const f=fixture();const result=await f.service.create(input,'admin-id');
  assert.equal(result.employee.status,'active');assert.ok(result.employee.keycloak_id);
  assert.ok(!JSON.stringify(await f.service.list()).includes(input.temporaryPassword));
  assert.deepEqual(f.events,['provisioning_started','onboarding_completed']);
});
test('failure after user creation is recoverable without duplicate identities',async()=>{
  const f=fixture();f.fail(true);const first=await f.service.create(input,'admin-id');
  assert.equal(first.employee.status,'failed');
  await assert.rejects(()=>f.service.assertActive({preferred_username:first.employee.username,sub:first.employee.keycloak_id}),{status:403});
  f.fail(false);const retry=await f.service.retry(first.employee.id,input.temporaryPassword,'admin-id');
  assert.equal(retry.employee.status,'active');assert.equal(f.counts().created,1);
  await f.service.assertActive({preferred_username:retry.employee.username,sub:retry.employee.keycloak_id});
  await f.service.retry(first.employee.id,input.temporaryPassword,'admin-id');
  assert.equal(f.counts().configured,2,'Retry of active record must not reset credentials');
});
test('duplicate email is rejected before another identity is created',async()=>{
  const f=fixture();await f.service.create(input,'admin-id');
  await assert.rejects(()=>f.service.create({...input,email:'test@example.test'},'admin-id'),{status:409});
  assert.equal(f.counts().created,1);
});
test('missing and mismatched managed identities cannot access the application',async()=>{
  const f=fixture();await assert.rejects(()=>f.service.assertActive({preferred_username:'emp-missing',sub:'x'}),{status:403});
  const {employee}=await f.service.create(input,'admin-id');
  await assert.rejects(()=>f.service.assertActive({preferred_username:employee.username,sub:'other-user'}),{status:403});
});
test('employee endpoints deny non-admin access before invoking onboarding',async()=>{
  let calls=0;
  const app=createApp({checkDatabase:async()=>{},verifyToken:async role=>({sub:'demo',realm_access:{roles:[role]}}),onboarding:{assertActive:async()=>{},list:async()=>{calls++;return [];},create:async()=>{calls++;},retry:async()=>{calls++;},events:async()=>{calls++;}}});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  try{
    for(const role of ['employee','it-support'])for(const [method,path]of [['GET','/api/employees'],['POST','/api/employees'],['POST','/api/employees/id/retry'],['GET','/api/employees/id/events']]){
      const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{Authorization:`Bearer ${role}`}});assert.equal(response.status,403);
    }
    assert.equal(calls,0);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
