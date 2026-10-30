import { randomUUID } from 'node:crypto';
import { problem } from '../employees/service.js';
import { validateId } from '../devices/service.js';
export function validateReason(value){
  if(typeof value!=='string'||value.trim().length<10||value.trim().length>500)throw problem(400,'Provide a reason between 10 and 500 characters.');return value.trim();
}
export function validateApplication(id){if(typeof id!=='string'||!/^[a-z0-9-]{1,40}$/.test(id))throw problem(400,'Select a valid application.');return id;}
export function accessService(pool){
  async function tx(run){const db=await pool.getConnection();try{await db.beginTransaction();const result=await run(db);await db.commit();return result;}catch(e){await db.rollback();if(e.code==='ER_DUP_ENTRY')throw problem(409,'A pending request or approval already exists. Refresh before retrying.');throw e;}finally{db.release();}}
  async function event(db,id,actor,action){await db.execute('INSERT INTO access_events (request_id,actor_id,action) VALUES (?,?,?)',[id,actor,action]);}
  async function lockRequest(db,id){
    validateId(id);const [found]=await db.execute('SELECT employee_id FROM access_requests WHERE id=?',[id]);if(!found[0])throw problem(404,'Request not found.');
    // Match offboarding's lock order: employee first, then requests/approvals.
    await db.execute('SELECT id FROM employees WHERE id=? FOR UPDATE',[found[0].employee_id]);
    const [rows]=await db.execute('SELECT * FROM access_requests WHERE id=? FOR UPDATE',[id]);if(!rows[0])throw problem(404,'Request not found.');return rows[0];
  }
  return {
    async catalog(){const [rows]=await pool.query('SELECT id,name,description FROM applications WHERE enabled=TRUE ORDER BY name');return rows;},
    async mine(subject){
      const [employees]=await pool.execute("SELECT id,first_name,last_name FROM employees WHERE keycloak_id=? AND status='active'",[subject]);
      if(!employees[0])return {employee:null,requests:[],access:[]};
      const id=employees[0].id;
      const [requests]=await pool.execute('SELECT r.*,a.name AS application_name FROM access_requests r JOIN applications a ON a.id=r.application_id WHERE r.employee_id=? ORDER BY r.created_at DESC,r.id DESC LIMIT 100',[id]);
      const [access]=await pool.execute('SELECT g.application_id,g.approved_at,a.name AS application_name FROM application_access g JOIN applications a ON a.id=g.application_id WHERE g.employee_id=? AND NOT EXISTS (SELECT 1 FROM application_revocations v WHERE v.employee_id=g.employee_id AND v.application_id=g.application_id)',[id]);
      return {employee:employees[0],requests,access};
    },
    async create(subject,input){
      const app=validateApplication(input?.applicationId),reason=validateReason(input?.reason);
      return tx(async db=>{
        const [employees]=await db.execute("SELECT id FROM employees WHERE keycloak_id=? AND status='active' FOR UPDATE",[subject]);
        if(!employees[0])throw problem(403,'Complete employee onboarding before requesting applications.');const employee=employees[0].id;
        const [apps]=await db.execute('SELECT id FROM applications WHERE id=? AND enabled=TRUE FOR UPDATE',[app]);if(!apps[0])throw problem(404,'Application is unavailable.');
        const [approved]=await db.execute('SELECT employee_id FROM application_access WHERE employee_id=? AND application_id=?',[employee,app]);if(approved.length)throw problem(409,'This application is already approved for you.');
        const [pending]=await db.execute("SELECT id FROM access_requests WHERE employee_id=? AND application_id=? AND status='pending'",[employee,app]);if(pending.length)throw problem(409,'You already have a pending request for this application.');
        const id=randomUUID();await db.execute('INSERT INTO access_requests (id,employee_id,application_id,reason,requested_by) VALUES (?,?,?,?,?)',[id,employee,app,reason,subject]);
        await event(db,id,subject,'request_submitted');return {id,message:'Access request submitted for Admin review.'};
      });
    },
    async queue(status='pending'){
      if(typeof status!=='string'||!['pending','approved','rejected','cancelled','all'].includes(status))throw problem(400,'Invalid request status.');
      const [rows]=await pool.execute(`SELECT r.*,a.name AS application_name,e.first_name,e.last_name,e.email FROM access_requests r
        JOIN applications a ON a.id=r.application_id JOIN employees e ON e.id=r.employee_id WHERE (?='all' OR r.status=?) ORDER BY r.created_at DESC,r.id DESC LIMIT 100`,[status,status]);return rows;
    },
    async decide(id,actor,input){
      if(!['approved','rejected'].includes(input?.decision))throw problem(400,'Choose Approve or Reject.');const reason=validateReason(input?.reason);
      return tx(async db=>{
        const request=await lockRequest(db,id);
        if(request.requested_by===actor)throw problem(403,'You cannot review your own access request.');
        if(request.status!=='pending')throw problem(409,'This request has already been decided. Refresh the queue.');
        const [employees]=await db.execute('SELECT status FROM employees WHERE id=? FOR UPDATE',[request.employee_id]);
        if(input.decision==='approved'){
          if(employees[0]?.status!=='active')throw problem(409,'Only active employees can receive approval.');
          const [apps]=await db.execute('SELECT enabled FROM applications WHERE id=? FOR UPDATE',[request.application_id]);if(!apps[0]?.enabled)throw problem(409,'Application is unavailable.');
          await db.execute('INSERT INTO application_access (employee_id,application_id,source_request_id,approved_by) VALUES (?,?,?,?)',[request.employee_id,request.application_id,id,actor]);
        }
        await db.execute('UPDATE access_requests SET status=?,reviewed_by=?,decision_reason=?,decided_at=CURRENT_TIMESTAMP WHERE id=?',[input.decision,actor,reason,id]);
        await event(db,id,actor,'request_'+input.decision);return {message:'Request '+input.decision+'.'};
      });
    },
    async cancel(id,subject){return tx(async db=>{
      const request=await lockRequest(db,id);if(request.requested_by!==subject)throw problem(404,'Request not found.');
      if(request.status!=='pending')throw problem(409,'Only pending requests can be cancelled.');
      await db.execute("UPDATE access_requests SET status='cancelled',decided_at=CURRENT_TIMESTAMP WHERE id=?",[id]);await event(db,id,subject,'request_cancelled');return {message:'Request cancelled.'};
    });},
  };
}
