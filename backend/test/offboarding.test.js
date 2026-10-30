import test from 'node:test';
import assert from 'node:assert/strict';
import {validateOffboardingReason,assertOffboardingTarget} from '../src/offboarding/service.js';
import {onboardingService} from '../src/employees/service.js';
import {createApp} from '../src/app.js';
test('offboarding requires a reason and blocks self-offboarding',()=>{
  assert.throws(()=>validateOffboardingReason('short'),{status:400});assert.throws(()=>validateOffboardingReason('x'.repeat(501)),{status:400});
  assert.throws(()=>assertOffboardingTarget({keycloak_id:'self'},{sub:'self'}),{status:403});assert.throws(()=>assertOffboardingTarget(null,{sub:'admin'}),{status:404});
});
test('onboarding retries never reactivate offboarding or offboarded employees',async()=>{
  for(const status of ['offboarding','offboarded']){
    let changed=false;const repo={withLock:async(_id,run)=>run({get:async()=>({status}),transition:async()=>{changed=true;}})};
    const service=onboardingService(repo,{});await assert.rejects(()=>service.retry('id','Temporary12345','admin'),{status:409});assert.equal(changed,false);
  }
});
test('old token identities remain blocked after local offboarding starts',async()=>{
  for(const status of ['offboarding','offboarded']){
    const service=onboardingService({byUsername:async()=>({status,keycloak_id:'old-subject'})},{});
    await assert.rejects(()=>service.assertActive({sub:'old-subject',preferred_username:'emp-existing'}),{status:403,code:'employee_inactive'});
  }
});
test('offboarding API denies Employee and IT Support before mutation',async()=>{
  let calls=0;const app=createApp({checkDatabase:async()=>{},verifyToken:async role=>({sub:role,realm_access:{roles:[role]}}),onboarding:{assertActive:async()=>{}},offboarding:{summary:async()=>{calls++;},run:async()=>{calls++;}}});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  try{for(const role of ['employee','it-support'])for(const method of ['GET','POST'])assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/api/employees/id/offboarding`,{method,headers:{Authorization:`Bearer ${role}`}})).status,403);assert.equal(calls,0);}
  finally{await new Promise(resolve=>server.close(resolve));}
});
