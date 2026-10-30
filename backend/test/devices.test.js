import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDevice, validateId } from '../src/devices/service.js';
import { createApp } from '../src/app.js';

const input={asset_tag:' lab-01 ',serial_number:' abc123 ',model:'ThinkPad',location:'Bangalore',device_type:'laptop'};
test('device validation normalizes identifiers and rejects invalid records',()=>{
  const data=validateDevice(input);assert.equal(data.asset_tag,'LAB-01');assert.equal(data.serial_number,'ABC123');
  for(const change of [{asset_tag:'bad tag'},{serial_number:''},{model:''},{location:'x'.repeat(101)},{device_type:'unknown'}])assert.throws(()=>validateDevice({...input,...change}),{status:400});
  assert.throws(()=>validateId("' OR 1=1"),{status:400});
});
async function withApi(run){
  const calls=[];
  const inventory={};
  for(const method of ['list','mine','assignees','create','assign','returnDevice','changeStatus','history'])inventory[method]=async(...args)=>{calls.push({method,args});return method==='mine'?[{asset_tag:'MY-DEVICE'}]:[];};
  const app=createApp({checkDatabase:async()=>{},verifyToken:async role=>({sub:role+'-subject',realm_access:{roles:[role]}}),inventory});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const request=(role,method,path,body)=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{...(role?{Authorization:`Bearer ${role}`}:{}) ,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  try{await run(request,calls);}finally{await new Promise(resolve=>server.close(resolve));}
}
test('device management rejects anonymous and employee requests before touching inventory',async()=>{
  await withApi(async(request,calls)=>{
    for(const role of [null,'employee'])for(const [method,path]of [['GET','/api/devices'],['GET','/api/devices/assignees'],['POST','/api/devices'],['POST','/api/devices/id/assign'],['POST','/api/devices/id/return'],['PATCH','/api/devices/id/status'],['GET','/api/devices/id/history']]){
      assert.equal((await request(role,method,path)).status,role?403:401);
    }
    assert.equal(calls.length,0);
  });
});
test('own-device lookup uses token identity and ignores a supplied employee ID',async()=>{
  await withApi(async(request,calls)=>{
    const response=await request('employee','GET','/api/devices/mine?employeeId=someone-else&subject=admin');
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    assert.deepEqual(calls,[{method:'mine',args:['employee-subject']}]);
  });
});
test('IT Support and Admin can manage devices using their authenticated actor ID',async()=>{
  await withApi(async(request,calls)=>{
    for(const role of ['it-support','admin']){
      assert.equal((await request(role,'GET','/api/devices')).status,200);
      assert.equal((await request(role,'GET','/api/devices/assignees')).status,200);
      assert.equal((await request(role,'POST','/api/devices',input)).status,201);
      assert.equal((await request(role,'POST','/api/devices/device-id/assign',{employeeId:'employee-id',actor:'forged'})).status,200);
      assert.equal((await request(role,'POST','/api/devices/device-id/return',{status:'available'})).status,200);
      assert.equal((await request(role,'PATCH','/api/devices/device-id/status',{status:'maintenance'})).status,200);
      assert.equal((await request(role,'GET','/api/devices/device-id/history')).status,200);
    }
    assert.deepEqual(calls.filter(x=>x.method==='assign').map(x=>x.args),[['device-id','employee-id','it-support-subject'],['device-id','employee-id','admin-subject']]);
  });
});
