import { randomUUID } from 'node:crypto';
export function problem(status,message) { return Object.assign(new Error(message),{status}); }
export function validatePassword(value) {
  if(typeof value!=='string'||value.length<12||value.length>128||!/[A-Z]/.test(value)||!/[a-z]/.test(value)||!/[0-9]/.test(value))throw problem(400,'Temporary password must be 12–128 characters with uppercase, lowercase, and a number.');
  return value;
}
export function validateEmployee(body) {
  if(!body||typeof body!=='object'||Array.isArray(body))throw problem(400,'Employee details are required.');
  const limits={first_name:80,last_name:80,email:254,department:100,start_date:10};const data={};
  for(const [key,max] of Object.entries(limits)) {
    if(typeof body[key]!=='string'||!body[key].trim()||body[key].trim().length>max)throw problem(400,`Provide a valid ${key.replaceAll('_',' ')}.`);
    data[key]=body[key].trim();
  }
  data.email=data.email.toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))throw problem(400,'Provide a valid email address.');
  const date=new Date(data.start_date+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data.start_date)||!Number.isFinite(+date)||date.toISOString().slice(0,10)!==data.start_date||data.start_date<'2000-01-01'||data.start_date>'2100-12-31')throw problem(400,'Provide a valid start date between 2000 and 2100.');
  if(!['employee','it-support'].includes(body.role))throw problem(400,'Choose Employee or IT Support.');
  data.role=body.role;validatePassword(body.temporaryPassword);return data;
}
export function onboardingService(repository,identity) {
  async function provision(id,password,actor) {
    validatePassword(password);
    return repository.withLock(id,async locked=>{
      let employee=await locked.get();
      if(!employee)throw problem(404,'Employee not found.');
      if(['offboarding','offboarded'].includes(employee.status))throw problem(409,'Offboarded employees cannot be reactivated through an onboarding retry.');
      if(employee.status==='active')return {employee,message:'Employee is already active. No account changes were made.'};
      await locked.transition('pending',actor,'provisioning_started');
      try {
        const keycloakId=await identity.ensureUser(employee);
        await locked.link(keycloakId);
        await identity.configure(keycloakId,employee,password);
        await locked.transition('active',actor,'onboarding_completed');
        return {employee:await locked.get(),message:'Employee account is ready. Share the temporary password securely; they must change it at first login.'};
      }catch {
        await locked.transition('failed',actor,'provisioning_failed');
        return {employee:await locked.get(),message:'Employee record saved, but account setup is incomplete. Check Keycloak and retry this record with a temporary password.'};
      }
    });
  }
  return {
    async create(body,actor) {
      const data=validateEmployee(body);const id=randomUUID();
      try { await repository.insert({...data,id,username:'emp-'+id},actor); }
      catch(e) { if(e.code==='ER_DUP_ENTRY')throw problem(409,'An employee with this email already exists. Refresh the list and retry that record if setup failed.');throw e; }
      return provision(id,body.temporaryPassword,actor);
    },
    retry:provision,
    list:()=>repository.list(),
    async events(id) { if(!await repository.get(id))throw problem(404,'Employee not found.');return repository.events(id); },
    async assertActive(identity) {
      if(!identity.preferred_username?.startsWith('emp-'))return;
      const employee=await repository.byUsername(identity.preferred_username);
      if(!employee || employee.status!=='active'||employee.keycloak_id!==identity.sub)throw Object.assign(problem(403,'Your employee account is not active. Contact IT Support.'),{code:'employee_inactive'});
    },
  };
}
