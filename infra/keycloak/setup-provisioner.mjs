// One-time local setup. Runtime API uses client credentials, never the master password.
const origin='http://127.0.0.1:8080';
const login=await fetch(origin+'/realms/master/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({grant_type:'password',client_id:'admin-cli',username:'local-admin',password:process.env.KEYCLOAK_ADMIN_PASSWORD}),signal:AbortSignal.timeout(10000)});
if(!login.ok)throw new Error('Local bootstrap authentication failed');
const {access_token}=await login.json();
const base=origin+'/admin/realms/employee-it';
async function request(path,method='GET',body) {
  const response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${access_token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error(`Identity setup failed: ${method} ${path} (${response.status})`);
  return response.status===204||response.status===201?null:response.json();
}
const clientId=process.env.KEYCLOAK_SERVICE_CLIENT;
if(!clientId||!process.env.KEYCLOAK_SERVICE_SECRET)throw new Error('Configure service credentials in .env');
const definition={clientId,enabled:true,publicClient:false,serviceAccountsEnabled:true,standardFlowEnabled:false,directAccessGrantsEnabled:false,secret:process.env.KEYCLOAK_SERVICE_SECRET};
let [client]=await request('/clients?clientId='+encodeURIComponent(clientId));
if(!client){await request('/clients','POST',definition);[client]=await request('/clients?clientId='+encodeURIComponent(clientId));}
else await request('/clients/'+client.id,'PUT',definition);
const serviceUser=await request('/clients/'+client.id+'/service-account-user');
const [management]=await request('/clients?clientId=realm-management');
const roles=await Promise.all(['manage-users','view-users','view-realm'].map(name=>request('/clients/'+management.id+'/roles/'+name)));
await request(`/users/${serviceUser.id}/role-mappings/clients/${management.id}`,'POST',roles);
console.log('Provisioning service account configured. Secrets were not displayed.');
