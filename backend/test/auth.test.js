import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import { createApp } from '../src/app.js';
import { createTokenVerifier } from '../src/auth.js';

const issuer = 'http://identity.test/realms/employee-it';
const audience = 'employee-it-api';
const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = await exportJWK(publicKey);
const verifyToken = createTokenVerifier({ issuer, audience, keySet: createLocalJWKSet({ keys: [{ ...jwk, kid: 'test', alg: 'RS256' }] }) });
async function token(roles = ['employee'], overrides = {}, signingKey = privateKey) {
  return new SignJWT({ typ: 'Bearer', realm_access: { roles }, sub: 'demo-user', iss: issuer, aud: audience, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+300, ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' }).sign(signingKey);
}
async function withApi(run) {
  const server = createApp({ checkDatabase: async () => {}, verifyToken }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const request = (path, jwt) => fetch(`http://127.0.0.1:${server.address().port}${path}`, { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} });
  try { await run(request); } finally { await new Promise(resolve => server.close(resolve)); }
}
test('all protected endpoints reject missing or malformed credentials', async () => {
  await withApi(async request => {
    for (const path of ['/api/team-wiki','/api/knowledge-base','/api/me','/api/workspaces/employee','/api/workspaces/support','/api/workspaces/admin']) {
      assert.equal((await request(path)).status,401);
      assert.equal((await request(path,'not-a-token')).status,401);
    }
  });
});
test('real signed tokens enforce the complete role matrix', async () => {
  await withApi(async request => {
    for (const [role, statuses] of [['employee',[200,403,403]],['it-support',[200,200,403]],['admin',[200,200,200]],['unrelated',[403,403,403]]]) {
      const jwt=await token([role]);
      for (const [i, workspace] of ['employee','support','admin'].entries()) assert.equal((await request(`/api/workspaces/${workspace}`,jwt)).status,statuses[i],`${role}: ${workspace}`);
    }
  });
});
test('rejects wrong issuer, audience, expired tokens, missing subject and ID tokens', async () => {
  await withApi(async request => {
    for (const claims of [{iss:'http://attacker.test'},{aud:'another-api'},{exp:1},{sub:undefined},{typ:'ID'}]) {
      assert.equal((await request('/api/me',await token(['admin'],claims))).status,401);
    }
  });
});
test('rejects tokens signed by a different key', async () => {
  const other = await generateKeyPair('RS256');
  await withApi(async request => assert.equal((await request('/api/me',await token(['admin'],{},other.privateKey))).status,401));
});
test('profile exposes only application roles, not token contents', async () => {
  await withApi(async request => {
    const response=await request('/api/me',await token(['employee','offline_access']));
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.deepEqual(await response.json(),{id:'demo-user',roles:['employee']});
  });
});

test('Knowledge Base requires an application role and the API audience',async()=>{
 await withApi(async request=>{
  for(const role of ['employee','it-support','admin','unrelated']){
   const response=await request('/api/knowledge-base',await token([role],{azp:'employee-it-knowledge'}));
   assert.equal(response.status,role==='unrelated'?403:200);
   if(response.ok){assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).guides.length,3);}
  }
  assert.equal((await request('/api/knowledge-base',await token(['employee'],{aud:'employee-it-knowledge'}))).status,401);
 });
});
test('Knowledge Base denies an inactive employee before returning guides',async()=>{
 const server=createApp({verifyToken,onboarding:{assertActive:async()=>{throw Object.assign(new Error('Employee is inactive'),{status:403,code:'employee_inactive'});}}}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 try{
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/knowledge-base`,{headers:{Authorization:`Bearer ${await token()}`}});
  assert.equal(response.status,403);const body=await response.json();assert.equal(body.code,'employee_inactive');assert.equal(body.guides,undefined);
 }finally{await new Promise(r=>server.close(r));}
});

test('Team Wiki serves protected handbook content and denies unrelated roles',async()=>{
 await withApi(async request=>{
  for(const role of ['employee','it-support','admin','unrelated']){
   const response=await request('/api/team-wiki',await token([role]));
   assert.equal(response.status,role==='unrelated'?403:200);
   if(response.ok){assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).guides[0].id,'first-day');}
  }
 });
});
