export function identityService({ issuer, clientId, clientSecret }) {
  const base=issuer.replace('/realms/','/admin/realms/');
  let cached;
  async function accessToken() {
    if(cached && cached.expires>Date.now()+30000)return cached.token;
    const res=await fetch(`${issuer}/protocol/openid-connect/token`,{method:'POST',body:new URLSearchParams({grant_type:'client_credentials',client_id:clientId,client_secret:clientSecret}),signal:AbortSignal.timeout(5000)});
    if(!res.ok)throw new Error('Identity service authentication failed');
    const data=await res.json();cached={token:data.access_token,expires:Date.now()+data.expires_in*1000};return cached.token;
  }
  async function request(path,method='GET',body) {
    const res=await fetch(base+path,{method,headers:{Authorization:`Bearer ${await accessToken()}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
    if(!res.ok) { if(res.status===401)cached=null;const e=new Error('Identity operation failed');e.identityStatus=res.status;throw e; }
    return res.status===204?null:res;
  }
  async function find(username) { return (await (await request('/users?exact=true&username='+encodeURIComponent(username))).json())[0]; }
  return {
    async ensureUser(employee) {
      let user=await find(employee.username);
      if(!user) {
        try {
          await request('/users','POST',{username:employee.username,email:employee.email,firstName:employee.first_name,lastName:employee.last_name,enabled:false,emailVerified:false});
        }catch(e){ if(e.identityStatus!==409)throw e; }
        user=await find(employee.username);
      }
      // The random immutable username is the recovery key. Never adopt an account by email.
      if(!user || user.email?.toLowerCase()!==employee.email || (employee.keycloak_id && employee.keycloak_id!==user.id))throw new Error('Identity account collision');
      return user.id;
    },
    async deactivate(employee) {
      let user;
      if(employee.keycloak_id){
        try{user=await (await request('/users/'+encodeURIComponent(employee.keycloak_id))).json();}
        catch(e){if(e.identityStatus===404)return {absent:true};throw e;}
      }else user=await find(employee.username);
      if(!user)return {absent:true};
      if(user.username!==employee.username||(employee.keycloak_id&&user.id!==employee.keycloak_id))throw new Error('Identity account mismatch');
      await request('/users/'+user.id,'PUT',{enabled:false});
      await request('/users/'+user.id+'/logout','POST');
      const current=await (await request('/users/'+user.id)).json();
      const sessions=await (await request('/users/'+user.id+'/sessions')).json();
      if(current.enabled||sessions.length)throw new Error('Identity removal could not be verified');
      return {keycloakId:user.id};
    },
    async configure(id,employee,password) {
      await request('/users/'+id,'PUT',{enabled:false});
      await request('/users/'+id+'/reset-password','PUT',{type:'password',value:password,temporary:true});
      const role=await (await request('/roles/'+encodeURIComponent(employee.role))).json();
      await request('/users/'+id+'/role-mappings/realm','POST',[role]);
      await request('/users/'+id,'PUT',{enabled:true});
    },
  };
}
