import {randomUUID} from 'node:crypto';
import {problem} from '../employees/service.js';
import {validateId} from '../devices/service.js';
export function textField(value,min,max,label){if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)throw problem(400,`${label} must be ${min}–${max} characters.`);return value.trim();}
export function validateTicket(input){
  const title=textField(input?.title,5,120,'Title'),description=textField(input?.description,20,4000,'Description');
  if(!['hardware','software','network','access','other'].includes(input.category))throw problem(400,'Choose a valid ticket category.');
  if(!['low','normal','high'].includes(input.priority))throw problem(400,'Choose Low, Normal, or High priority.');
  const deviceId=input.deviceId||null;if(deviceId)validateId(deviceId);
  return {title,description,category:input.category,priority:input.priority,deviceId};
}
export const isStaff=actor=>actor.roles.some(r=>['admin','it-support'].includes(r));
export function assertTicketRead(ticket,actor){if(!ticket||(!isStaff(actor)&&ticket.requester_sub!==actor.sub))throw problem(404,'Ticket not found.');}
export function assertTransition(ticket,actor,action){
  assertTicketRead(ticket,actor);const admin=actor.roles.includes('admin');
  if(['claim','resolve'].includes(action)&&!isStaff(actor))throw problem(403,'Only IT Support or Admin can perform this action.');
  if(['close','reopen'].includes(action)&&ticket.requester_sub!==actor.sub&&!admin)throw problem(403,'Only the requester or Admin can close or reopen this ticket.');
  if(action==='claim'&&!(ticket.status==='open'&&!ticket.assigned_to))throw problem(409,'This ticket has already been claimed or is no longer open.');
  if(action==='resolve'){
    if(ticket.status!=='in_progress')throw problem(409,'Claim an open ticket before resolving it.');
    if(ticket.assigned_to!==actor.sub&&!admin)throw problem(403,'Only the assigned support person or Admin can resolve this ticket.');
  }
  if(action==='close'&&ticket.status!=='resolved')throw problem(409,'Only resolved tickets can be closed.');
  if(action==='reopen'&&!['resolved','closed'].includes(ticket.status))throw problem(409,'Only resolved or closed tickets can be reopened.');
}
export function ticketService(pool){
  async function tx(run){const db=await pool.getConnection();try{await db.beginTransaction();const result=await run(db);await db.commit();return result;}catch(e){await db.rollback();throw e;}finally{db.release();}}
  async function read(db,id,actor,lock=false){validateId(id);const [rows]=await db.execute('SELECT * FROM tickets WHERE id=?'+(lock?' FOR UPDATE':''),[id]);assertTicketRead(rows[0],actor);return rows[0];}
  async function event(db,id,actor,action,body=null){await db.execute('INSERT INTO ticket_events (ticket_id,actor_id,actor_name,action,body) VALUES (?,?,?,?,?)',[id,actor.sub,(actor.name||actor.sub).slice(0,160),action,body]);}
  return {
    async create(actor,input){const data=validateTicket(input);return tx(async db=>{
      const [employees]=await db.execute("SELECT id FROM employees WHERE keycloak_id=? AND status='active' FOR UPDATE",[actor.sub]);if(!employees[0])throw problem(403,'Complete employee onboarding before raising a ticket.');
      if(data.deviceId){const [devices]=await db.execute('SELECT device_id FROM device_assignments WHERE active_device_id=? AND employee_id=?',[data.deviceId,employees[0].id]);if(!devices[0])throw problem(400,'Choose a device currently assigned to you.');}
      const id=randomUUID();await db.execute('INSERT INTO tickets (id,employee_id,requester_sub,title,description,category,priority,device_id) VALUES (?,?,?,?,?,?,?,?)',[id,employees[0].id,actor.sub,data.title,data.description,data.category,data.priority,data.deviceId]);
      await event(db,id,actor,'ticket_opened');const [rows]=await db.execute('SELECT ticket_number FROM tickets WHERE id=?',[id]);return {id,ticket_number:rows[0].ticket_number,message:'Ticket submitted to IT Support.'};
    });},
    async list(actor,{status='all',search='',assigned='all',scope='mine'}={}){
      if(!['all','open','in_progress','resolved','closed'].includes(status)||typeof search!=='string'||search.length>100||!['all','mine','unassigned'].includes(assigned)||!['mine','queue'].includes(scope))throw problem(400,'Invalid ticket filter.');
      if(scope==='queue'&&!isStaff(actor))throw problem(403,'Only IT Support or Admin can view the queue.');
      const query='%'+search.trim()+'%';const [rows]=await pool.execute(`SELECT t.id,t.ticket_number,t.title,t.category,t.priority,t.status,t.requester_sub,t.assigned_to,t.assigned_name,t.created_at,t.updated_at,e.first_name,e.last_name
        FROM tickets t JOIN employees e ON e.id=t.employee_id WHERE (?='queue' OR t.requester_sub=?) AND (?='all' OR t.status=?)
        AND (?='all' OR (?='mine' AND t.assigned_to=?) OR (?='unassigned' AND t.assigned_to IS NULL)) AND (t.title LIKE ? OR CAST(t.ticket_number AS CHAR) LIKE ?)
        ORDER BY t.updated_at DESC,t.ticket_number DESC LIMIT 100`,[scope,actor.sub,status,status,assigned,assigned,actor.sub,assigned,query,query]);return rows;
    },
    async detail(id,actor){const ticket=await read(pool,id,actor);const [events]=await pool.execute('SELECT actor_name,action,body,created_at FROM ticket_events WHERE ticket_id=? ORDER BY id',[id]);return {ticket,events};},
    async comment(id,actor,input){const body=textField(input?.body,1,2000,'Reply');return tx(async db=>{const ticket=await read(db,id,actor,true);if(ticket.status==='closed')throw problem(409,'Reopen the ticket before adding a reply.');await event(db,id,actor,'reply_added',body);await db.execute('UPDATE tickets SET updated_at=CURRENT_TIMESTAMP WHERE id=?',[id]);return {message:'Reply added.'};});},
    async transition(id,actor,input){
      const action=input?.action;if(!['claim','resolve','close','reopen'].includes(action))throw problem(400,'Choose a valid ticket action.');
      const note=['resolve','reopen'].includes(action)?textField(input?.note,10,2000,action==='resolve'?'Resolution':'Reopen reason'):null;
      return tx(async db=>{
        const ticket=await read(db,id,actor,true);assertTransition(ticket,actor,action);
        if(action==='claim')await db.execute("UPDATE tickets SET status='in_progress',assigned_to=?,assigned_name=? WHERE id=?",[actor.sub,(actor.name||actor.sub).slice(0,160),id]);
        if(action==='resolve')await db.execute("UPDATE tickets SET status='resolved',resolution=?,resolved_at=CURRENT_TIMESTAMP WHERE id=?",[note,id]);
        if(action==='close')await db.execute("UPDATE tickets SET status='closed',closed_at=CURRENT_TIMESTAMP WHERE id=?",[id]);
        if(action==='reopen')await db.execute("UPDATE tickets SET status='open',assigned_to=NULL,assigned_name=NULL,resolution=NULL,resolved_at=NULL,closed_at=NULL WHERE id=?",[id]);
        await event(db,id,actor,'ticket_'+({claim:'claimed',resolve:'resolved',close:'closed',reopen:'reopened'}[action]),note);
        return {message:({claim:'Ticket assigned to you.',resolve:'Resolution recorded. The requester can confirm and close the ticket.',close:'Ticket closed.',reopen:'Ticket reopened for IT Support.'}[action])};
      });
    },
  };
}
