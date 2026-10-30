import {problem} from '../employees/service.js';
import {validateId} from '../devices/service.js';
export function validateOffboardingReason(reason){if(typeof reason!=='string'||reason.trim().length<10||reason.trim().length>500)throw problem(400,'Provide an offboarding reason between 10 and 500 characters.');return reason.trim();}
export function assertOffboardingTarget(employee,actor){if(!employee)throw problem(404,'Employee not found.');if(employee.keycloak_id===actor.sub)throw problem(403,'You cannot offboard your own account.');}
export function offboardingService(pool,identity){
  async function summary(db,id){
    validateId(id);const [employees]=await db.execute('SELECT id,first_name,last_name,email,status,keycloak_id,username FROM employees WHERE id=?',[id]);if(!employees[0])throw problem(404,'Employee not found.');
    const [jobs]=await db.execute('SELECT * FROM offboarding_jobs WHERE employee_id=?',[id]);
    const [devices]=await db.execute('SELECT d.id,d.asset_tag,d.model FROM devices d JOIN device_assignments a ON a.active_device_id=d.id WHERE a.employee_id=?',[id]);
    const [approvals]=await db.execute('SELECT a.name,v.revoked_at FROM application_access g JOIN applications a ON a.id=g.application_id LEFT JOIN application_revocations v ON v.employee_id=g.employee_id AND v.application_id=g.application_id WHERE g.employee_id=?',[id]);
    const [tickets]=await db.execute("SELECT COUNT(*) AS count FROM tickets WHERE employee_id=? AND status IN ('open','in_progress')",[id]);
    return {employee:employees[0],job:jobs[0]||null,devices,approvals,openTickets:tickets[0].count};
  }
  return {
    summary:id=>summary(pool,id),
    async run(id,actor,input){
      validateId(id);const reason=validateOffboardingReason(input?.reason);const db=await pool.getConnection();let locked=false;
      try{
        const [lock]=await db.execute('SELECT GET_LOCK(?,0) AS acquired',['onboard:'+id]);
        if(lock[0].acquired!==1)throw problem(409,'An employee setup or offboarding operation is already running. Refresh before retrying.');locked=true;
        let employee;
        await db.beginTransaction();
        try{
          const [rows]=await db.execute('SELECT * FROM employees WHERE id=? FOR UPDATE',[id]);employee=rows[0];assertOffboardingTarget(employee,actor);
          if(employee.status==='offboarded'){await db.commit();return {...await summary(db,id),message:'Access removal is already complete. No changes were made.'};}
          const retry=employee.status==='offboarding';
          await db.execute("UPDATE employees SET status='offboarding' WHERE id=?",[id]);
          await db.execute('INSERT INTO offboarding_jobs (employee_id,reason,requested_by,attempts) VALUES (?,?,?,1) ON DUPLICATE KEY UPDATE attempts=attempts+1,last_error=NULL',[id,reason,actor.sub]);
          await db.execute('INSERT INTO onboarding_events (employee_id,actor_id,action) VALUES (?,?,?)',[id,actor.sub,retry?'offboarding_retried':'offboarding_requested']);
          const [grants]=await db.execute('SELECT g.application_id,g.source_request_id FROM application_access g LEFT JOIN application_revocations v ON v.employee_id=g.employee_id AND v.application_id=g.application_id WHERE g.employee_id=? AND v.employee_id IS NULL FOR UPDATE',[id]);
          for(const grant of grants){
            await db.execute('INSERT INTO application_revocations (employee_id,application_id,source_request_id,revoked_by) VALUES (?,?,?,?)',[id,grant.application_id,grant.source_request_id,actor.sub]);
            await db.execute('INSERT INTO access_events (request_id,actor_id,action) VALUES (?,?,?)',[grant.source_request_id,actor.sub,'approval_revoked']);
          }
          const [pending]=await db.execute("SELECT id FROM access_requests WHERE employee_id=? AND status='pending' FOR UPDATE",[id]);
          for(const request of pending){
            await db.execute("UPDATE access_requests SET status='cancelled',decision_reason='Employee offboarding',reviewed_by=?,decided_at=CURRENT_TIMESTAMP WHERE id=?",[actor.sub,request.id]);
            await db.execute('INSERT INTO access_events (request_id,actor_id,action) VALUES (?,?,?)',[request.id,actor.sub,'cancelled_for_offboarding']);
          }
          if(employee.keycloak_id){
            const [assigned]=await db.execute("SELECT id FROM tickets WHERE assigned_to=? AND status='in_progress' FOR UPDATE",[employee.keycloak_id]);
            for(const ticket of assigned){await db.execute("UPDATE tickets SET status='open',assigned_to=NULL,assigned_name=NULL WHERE id=?",[ticket.id]);await db.execute('INSERT INTO ticket_events (ticket_id,actor_id,actor_name,action,body) VALUES (?,?,?,?,?)',[ticket.id,actor.sub,(actor.name||actor.sub).slice(0,160),'support_offboarded','Returned to the support queue because the assignee was offboarded.']);}
          }
          await db.commit();
        }catch(e){await db.rollback();throw e;}
        // The local gate is committed before any network operation. Identity failures cannot restore access.
        try{
          await identity.deactivate(employee);
          await db.beginTransaction();
          try{
            await db.execute("UPDATE employees SET status='offboarded' WHERE id=?",[id]);
            await db.execute("UPDATE offboarding_jobs SET state='completed',last_error=NULL,completed_at=CURRENT_TIMESTAMP WHERE employee_id=?",[id]);
            await db.execute('INSERT INTO onboarding_events (employee_id,actor_id,action) VALUES (?,?,?)',[id,actor.sub,'offboarding_completed']);await db.commit();
          }catch(e){await db.rollback();throw e;}
          return {...await summary(db,id),message:'Portal access removed. Keycloak account disabled and sessions ended. Record any physical device returns separately.'};
        }catch{
          await db.execute("UPDATE offboarding_jobs SET last_error='Identity removal needs verification. Check Keycloak and retry.' WHERE employee_id=?",[id]);
          await db.execute('INSERT INTO onboarding_events (employee_id,actor_id,action) VALUES (?,?,?)',[id,actor.sub,'offboarding_needs_retry']);
          return {...await summary(db,id),message:'Portal access is blocked and recorded approvals are revoked. Keycloak removal is not yet verified; retry when the identity service is available.'};
        }
      }finally{try{if(locked)await db.execute('SELECT RELEASE_LOCK(?)',['onboard:'+id]);}finally{db.release();}}
    },
  };
}
