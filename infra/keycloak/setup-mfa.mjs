const origin='http://127.0.0.1:8080';
const response=await fetch(origin+'/realms/master/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({grant_type:'password',client_id:'admin-cli',username:'local-admin',password:process.env.KEYCLOAK_ADMIN_PASSWORD}),signal:AbortSignal.timeout(10000)});
if(!response.ok)throw new Error('Local identity administrator authentication failed.');
const {access_token}=await response.json();
async function request(path,method='GET',body){
 const r=await fetch(origin+'/admin/realms/employee-it'+path,{method,headers:{Authorization:`Bearer ${access_token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new Error(`MFA setup failed (${r.status}).`);
 return r.status===204||r.status===201?null:r.json();
}
const realm=await request('');
const actions=await request('/authentication/required-actions');
if(!actions.some(a=>a.alias==='CONFIGURE_TOTP'&&a.enabled))throw new Error('Enable the Configure OTP required action before continuing.');
const flow=await request('/authentication/flows/'+encodeURIComponent(realm.browserFlow)+'/executions');
if(!flow.some(e=>e.providerId==='auth-otp-form'&&['REQUIRED','ALTERNATIVE'].includes(e.requirement)))throw new Error('The browser flow must support OTP authentication.');
if(realm.otpPolicyType!=='totp')throw new Error('This demonstration requires a time-based OTP policy.');
let [user]=await request('/users?exact=true&username=mfa.demo');
if(!user){
 if(!process.env.KEYCLOAK_DEMO_PASSWORD)throw new Error('Configure KEYCLOAK_DEMO_PASSWORD.');
 await request('/users','POST',{username:'mfa.demo',firstName:'MFA',lastName:'Demo',email:'mfa.demo@example.test',emailVerified:true,enabled:true,requiredActions:['CONFIGURE_TOTP'],credentials:[{type:'password',value:process.env.KEYCLOAK_DEMO_PASSWORD,temporary:false}]});
 [user]=await request('/users?exact=true&username=mfa.demo');
}
const role=await request('/roles/employee');
await request('/users/'+user.id+'/role-mappings/realm','POST',[role]);
const credentials=await request('/users/'+user.id+'/credentials');
if(!credentials.some(c=>c.type==='otp'))await request('/users/'+user.id,'PUT',{requiredActions:[...new Set([...(user.requiredActions||[]),'CONFIGURE_TOTP'])]});
console.log('MFA demo ready. Existing authenticators/passwords preserved. OTP: '+realm.otpPolicyDigits+' digits, '+realm.otpPolicyPeriod+' seconds.');
