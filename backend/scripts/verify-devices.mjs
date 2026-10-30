// Explicit integration check: creates one labeled fixture device and leaves it retired with history.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../src/database.js';
import { inventoryService } from '../src/devices/service.js';
const pool=createDatabase();
try{
  const inventory=inventoryService(pool);
  const [employees]=await pool.query("SELECT id,keycloak_id FROM employees WHERE status='active' ORDER BY created_at LIMIT 1");
  if(!employees.length)throw new Error('Create an active fictional employee first.');
  const employee=employees[0];const suffix=Date.now();const input={asset_tag:'VERIFY-'+suffix,serial_number:'VERIFY-SERIAL-'+suffix,model:'Integration test laptop',location:'Test inventory',device_type:'laptop'};
  const device=await inventory.create(input,'integration-test');
  await assert.rejects(()=>inventory.create(input,'integration-test'),{status:409});
  await assert.rejects(()=>inventory.assign(device.id,randomUUID(),'integration-test'),{status:404});
  assert.equal((await inventory.list({search:input.asset_tag}))[0].status,'available');
  const concurrent=await Promise.allSettled([inventory.assign(device.id,employee.id,'integration-test'),inventory.assign(device.id,employee.id,'integration-test')]);
  assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(concurrent.find(x=>x.status==='rejected').reason.status,409);
  const [assignments]=await pool.execute('SELECT id FROM device_assignments WHERE active_device_id=?',[device.id]);assert.equal(assignments.length,1);
  assert.ok((await inventory.mine(employee.keycloak_id)).some(x=>x.id===device.id));
  assert.equal((await inventory.mine('different-user-subject')).length,0);
  await assert.rejects(()=>inventory.changeStatus(device.id,'retired','integration-test'),{status:409});
  await inventory.returnDevice(device.id,'maintenance','integration-test');
  await assert.rejects(()=>inventory.returnDevice(device.id,'available','integration-test'),{status:409});
  await assert.rejects(()=>inventory.assign(device.id,employee.id,'integration-test'),{status:409});
  assert.ok(!(await inventory.mine(employee.keycloak_id)).some(x=>x.id===device.id));
  await inventory.changeStatus(device.id,'available','integration-test');
  await inventory.assign(device.id,employee.id,'integration-test');
  await inventory.returnDevice(device.id,'available','integration-test');
  await inventory.changeStatus(device.id,'retired','integration-test');
  await assert.rejects(()=>inventory.assign(device.id,employee.id,'integration-test'),{status:409});
  const history=await inventory.history(device.id);
  assert.equal(history.filter(x=>x.action==='device_assigned').length,2);
  assert.equal(history.filter(x=>x.action.startsWith('returned_to_')).length,2);
  const [past]=await pool.execute('SELECT returned_at FROM device_assignments WHERE device_id=?',[device.id]);assert.equal(past.length,2);assert.ok(past.every(x=>x.returned_at));
  console.log('Live device checks passed: duplicate prevention, rollback, concurrent assignment, owner-only reads, return, maintenance, reassignment, retirement, and persisted history. One retired VERIFY device retained.');
}finally{await pool.end();}
