import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReason,validateApplication } from '../src/access/service.js';
import { createApp } from '../src/app.js';
test('application request validation requires a meaningful bounded reason and a valid catalog ID',()=>{
  assert.equal(validateReason('  Required for support work.  '),'Required for support work.');
  for(const value of [null,'short','x'.repeat(501)])assert.throws(()=>validateReason(value),{status:400});
  assert.throws(()=>validateApplication('../admin'),{status:400});
});
async function withApi(run){
  const calls=[];const access={};
  for(const name of ['catalog','mine','create','cancel','queue','decide'])access[name]=async(...args)=>{calls.push({name,args});return [];};
  const app=createApp({checkDatabase:async()=>{},verifyToken:async role=>({sub:role+'-subject',realm_access:{roles:[role]}}),access});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const request=(role,method,path,body)=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{...(role?{Authorization:`Bearer ${role}`}:{}) ,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  try{await run(request,calls);}finally{await new Promise(resolve=>server.close(resolve));}
}
test('only Admin can review or decide; anonymous users cannot submit requests',async()=>{
  await withApi(async(request,calls)=>{
    for(const role of ['employee','it-support']){
      assert.equal((await request(role,'GET','/api/access/review')).status,403);
      assert.equal((await request(role,'POST','/api/access/requests/id/decision',{decision:'approved'})).status,403);
    }
    assert.equal((await request(null,'POST','/api/access/requests',{})).status,401);assert.equal(calls.length,0);
    assert.equal((await request('admin','GET','/api/access/review')).status,200);
  });
});
test('own request reads and cancellations use verified identity, not supplied identity',async()=>{
  await withApi(async(request,calls)=>{
    assert.equal((await request('employee','GET','/api/access/mine?subject=other')).status,200);
    assert.equal((await request('employee','POST','/api/access/requests/id/cancel',{subject:'other'})).status,200);
    assert.deepEqual(calls,[{name:'mine',args:['employee-subject']},{name:'cancel',args:['id','employee-subject']}]);
  });
});
