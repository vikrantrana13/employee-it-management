const sources = ['employee','device','access','ticket'];
const bad = message => Object.assign(new Error(message), {status:400});
function date(value) {
  return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
}
export function validateFilters(query={}) {
  for(const key of Object.keys(query))if(!['source','search','from','to','cursor'].includes(key)||typeof query[key]!=='string')throw bad('Invalid audit filter.');
  const {source='',search='',from='',to='',cursor=''}=query;
  if(source&&!sources.includes(source))throw bad('Invalid event source.');
  if(search.length>100)throw bad('Search must be 100 characters or fewer.');
  if((from&&!date(from))||(to&&!date(to))||(from&&to&&from>to))throw bad('Use a valid date range.');
  let after=null;
  if(cursor){
    try{
      if(cursor.length>500)throw Error();
      after=JSON.parse(Buffer.from(cursor,'base64url').toString());
      if(!Array.isArray(after)||after.length!==3||typeof after[0]!=='string'||!/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(after[0])||!date(after[0].slice(0,10))||after[0].slice(11)>'23:59:59'||!sources.includes(after[1])||typeof after[2]!=='string'||!/^\d{1,19}$/.test(after[2]))throw Error();
    }catch{throw bad('Invalid audit page. Refresh the results.');}
  }
  return {source,search:search.trim(),from,to,after};
}
const union = `
SELECT 'employee' source, e.id event_id,e.action,e.actor_id,e.created_at occurred_at,
CONCAT(a.first_name,' ',a.last_name) actor_name,p.id target_id,CONCAT(p.first_name,' ',p.last_name,' · ',p.email) target_label
FROM onboarding_events e JOIN employees p ON p.id=e.employee_id LEFT JOIN employees a ON a.keycloak_id=e.actor_id
UNION ALL
SELECT 'device',e.id,e.action,e.actor_id,e.created_at,CONCAT(a.first_name,' ',a.last_name),d.id,CONCAT(d.asset_tag,' · ',d.model)
FROM device_events e JOIN devices d ON d.id=e.device_id LEFT JOIN employees a ON a.keycloak_id=e.actor_id
UNION ALL
SELECT 'access',e.id,e.action,e.actor_id,e.created_at,CONCAT(a.first_name,' ',a.last_name),r.id,CONCAT(app.name,' · ',p.first_name,' ',p.last_name)
FROM access_events e JOIN access_requests r ON r.id=e.request_id JOIN applications app ON app.id=r.application_id JOIN employees p ON p.id=r.employee_id LEFT JOIN employees a ON a.keycloak_id=e.actor_id
UNION ALL
SELECT 'ticket',e.id,e.action,e.actor_id,e.created_at,e.actor_name,t.id,CONCAT('IT-',t.ticket_number,' · ',t.title)
FROM ticket_events e JOIN tickets t ON t.id=e.ticket_id`;
export function auditService(pool) {
  return {async list(query){
    const {source,search,from,to,after}=validateFilters(query);
    const where=[],values=[];
    if(source){where.push('source=?');values.push(source);}
    if(search){where.push("LOCATE(LOWER(?),LOWER(CONCAT_WS(' ',action,actor_id,actor_name,target_id,target_label)))>0");values.push(search);}
    if(from){where.push('occurred_at>=?');values.push(from);}
    if(to){where.push('occurred_at<DATE_ADD(?,INTERVAL 1 DAY)');values.push(to);}
    if(after){where.push('(occurred_at,source,event_id)<(?,?,CAST(? AS UNSIGNED))');values.push(...after);}
    const [rows]=await pool.query({sql:`SELECT source,CAST(event_id AS CHAR) event_id,action,actor_id,actor_name,target_id,target_label,DATE_FORMAT(occurred_at,'%Y-%m-%d %H:%i:%s') occurred_at FROM (${union}) history ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY occurred_at DESC,source DESC,history.event_id DESC LIMIT 26`,values,timeout:5000});
    const events=rows.slice(0,25),last=events.at(-1);
    return {events,nextCursor:rows.length>25?Buffer.from(JSON.stringify([last.occurred_at,last.source,last.event_id])).toString('base64url'):null};
  }};
}
