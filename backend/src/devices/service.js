import { randomUUID } from 'node:crypto';
import { problem } from '../employees/service.js';

export function validateDevice(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw problem(400,'Device details are required.');
  const result={};
  for(const [field,max] of Object.entries({asset_tag:40,serial_number:100,model:120,location:100})) {
    if(typeof input[field]!=='string'||!input[field].trim()||input[field].trim().length>max||/[\x00-\x1f]/.test(input[field]))throw problem(400,`Provide a valid ${field.replaceAll('_',' ')}.`);
    result[field]=input[field].trim();
  }
  result.asset_tag=result.asset_tag.toUpperCase();result.serial_number=result.serial_number.toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(result.asset_tag))throw problem(400,'Asset tag must be 2–40 letters, numbers, hyphens, or underscores.');
  if(!['laptop','desktop','monitor','phone','accessory'].includes(input.device_type))throw problem(400,'Choose a supported device type.');
  result.device_type=input.device_type;return result;
}
export function validateId(id) {
  if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw problem(400,'Invalid record ID.');
  return id;
}
export function inventoryService(pool) {
  async function transaction(action) {
    const db=await pool.getConnection();
    try { await db.beginTransaction();const result=await action(db);await db.commit();return result; }
    catch(e){await db.rollback();if(e.code==='ER_DUP_ENTRY')throw problem(409,'The asset tag, serial number, or active assignment already exists. Refresh before retrying.');throw e;}
    finally{db.release();}
  }
  async function lockDevice(db,id){
    validateId(id);const [rows]=await db.execute('SELECT * FROM devices WHERE id=? FOR UPDATE',[id]);
    if(!rows[0])throw problem(404,'Device not found.');return rows[0];
  }
  async function event(db,id,actor,action,employee=null){await db.execute('INSERT INTO device_events (device_id,actor_id,action,employee_id) VALUES (?,?,?,?)',[id,actor,action,employee]);}
  return {
    async create(input,actor){
      const data=validateDevice(input),id=randomUUID();
      return transaction(async db=>{
        await db.execute('INSERT INTO devices (id,asset_tag,serial_number,device_type,model,location) VALUES (?,?,?,?,?,?)',[id,data.asset_tag,data.serial_number,data.device_type,data.model,data.location]);
        await event(db,id,actor,'device_registered');return {id,...data,status:'available'};
      });
    },
    async list({search='',status=''}={}){
      if(typeof search!=='string'||search.length>100||typeof status!=='string'||!['','available','assigned','maintenance','retired'].includes(status))throw problem(400,'Invalid device filter.');
      const query='%'+search.trim()+'%';
      const [rows]=await pool.execute(`SELECT d.*, a.employee_id, a.assigned_at, e.first_name, e.last_name, e.email
        FROM devices d LEFT JOIN device_assignments a ON a.active_device_id=d.id LEFT JOIN employees e ON e.id=a.employee_id
        WHERE (?='' OR d.status=?) AND (d.asset_tag LIKE ? OR d.serial_number LIKE ? OR d.model LIKE ?)
        ORDER BY d.created_at DESC,d.id DESC LIMIT 100`,[status,status,query,query,query]);return rows;
    },
    async assignees(){const [rows]=await pool.query("SELECT id,first_name,last_name,email FROM employees WHERE status='active' ORDER BY first_name,last_name,id LIMIT 500");return rows;},
    async mine(subject){
      const [rows]=await pool.execute(`SELECT d.id,d.asset_tag,d.serial_number,d.device_type,d.model,d.location,d.status,a.assigned_at
        FROM devices d JOIN device_assignments a ON a.active_device_id=d.id JOIN employees e ON e.id=a.employee_id
        WHERE e.keycloak_id=? AND e.status='active' ORDER BY a.assigned_at DESC`,[subject]);return rows;
    },
    async assign(id,employeeId,actor){
      validateId(employeeId);
      return transaction(async db=>{
        const device=await lockDevice(db,id);
        if(device.status!=='available')throw problem(409,'Only available devices can be assigned. Refresh the inventory.');
        const [employees]=await db.execute('SELECT id,status FROM employees WHERE id=? FOR UPDATE',[employeeId]);
        if(!employees[0])throw problem(404,'Employee not found.');
        if(employees[0].status!=='active')throw problem(409,'Complete employee onboarding before assigning a device.');
        await db.execute('INSERT INTO device_assignments (id,device_id,employee_id,assigned_by) VALUES (?,?,?,?)',[randomUUID(),id,employeeId,actor]);
        await db.execute("UPDATE devices SET status='assigned' WHERE id=?",[id]);
        await event(db,id,actor,'device_assigned',employeeId);return {message:'Device assigned to employee.'};
      });
    },
    async returnDevice(id,nextStatus,actor){
      if(!['available','maintenance'].includes(nextStatus))throw problem(400,'Return the device to Available or Maintenance.');
      return transaction(async db=>{
        const device=await lockDevice(db,id);
        if(device.status!=='assigned')throw problem(409,'This device has no current assignment. Refresh the inventory.');
        const [rows]=await db.execute('SELECT id,employee_id FROM device_assignments WHERE active_device_id=? FOR UPDATE',[id]);
        if(!rows[0])throw problem(409,'Assignment record is missing. Contact the administrator.');
        await db.execute('UPDATE device_assignments SET returned_at=CURRENT_TIMESTAMP,returned_by=?,return_status=? WHERE id=?',[actor,nextStatus,rows[0].id]);
        await db.execute('UPDATE devices SET status=? WHERE id=?',[nextStatus,id]);
        await event(db,id,actor,'returned_to_'+nextStatus,rows[0].employee_id);return {message:'Return recorded. Device is '+nextStatus+'.'};
      });
    },
    async changeStatus(id,status,actor){
      if(!['available','maintenance','retired'].includes(status))throw problem(400,'Choose Available, Maintenance, or Retired.');
      return transaction(async db=>{
        const device=await lockDevice(db,id);
        if(device.status==='assigned')throw problem(409,'Record the employee return before changing device status.');
        if(device.status==='retired')throw problem(409,'Retired devices cannot be changed in this workflow.');
        if(device.status===status)return {message:'Device is already '+status+'.'};
        await db.execute('UPDATE devices SET status=? WHERE id=?',[status,id]);
        await event(db,id,actor,'marked_'+status);return {message:'Device marked '+status+'.'};
      });
    },
    async history(id){
      validateId(id);const [devices]=await pool.execute('SELECT id FROM devices WHERE id=?',[id]);if(!devices[0])throw problem(404,'Device not found.');
      const [rows]=await pool.execute(`SELECT v.action,v.actor_id,v.created_at,e.first_name,e.last_name
        FROM device_events v LEFT JOIN employees e ON e.id=v.employee_id WHERE v.device_id=? ORDER BY v.id DESC`,[id]);return rows;
    },
  };
}
