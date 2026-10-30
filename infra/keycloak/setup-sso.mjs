import {readFile} from 'node:fs/promises';
const base='http://127.0.0.1:8080';
const response=await fetch(base+'/realms/master/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({grant_type:'password',client_id:'admin-cli',username:'local-admin',password:process.env.KEYCLOAK_ADMIN_PASSWORD}),signal:AbortSignal.timeout(10000)});
if(!response.ok)throw new Error('Local identity administrator authentication failed.');
const {access_token}=await response.json();
async function request(path,method='GET',body){
 const r=await fetch(base+'/admin/realms/employee-it'+path,{method,headers:{Authorization:`Bearer ${access_token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new Error(`SSO client setup failed (${r.status}).`);
 return r.status===204||r.status===201?null:r.json();
}
const realm=JSON.parse(await readFile(new URL('./employee-it-realm.json',import.meta.url),'utf8'));
const definition=realm.clients.find(c=>c.clientId==='employee-it-knowledge');
const [existing]=await request('/clients?clientId=employee-it-knowledge');
await request(existing?'/clients/'+existing.id:'/clients',existing?'PUT':'POST',definition);
console.log('Knowledge Base OIDC client configured with exact local redirects and PKCE S256.');
