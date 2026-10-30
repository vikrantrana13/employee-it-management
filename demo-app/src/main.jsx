import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Keycloak from 'keycloak-js';
import './style.css';
const wiki=location.pathname==='/team-wiki/';
const appName=wiki?'Team Wiki':'Knowledge Base';
const redirectUri=wiki?'http://127.0.0.1:5174/team-wiki/':'http://127.0.0.1:5174/';
document.title='Employee IT · '+appName;
const identity=new Keycloak({url:'http://127.0.0.1:8080',realm:'employee-it',clientId:'employee-it-knowledge'});
let initialization;
function App(){
 const [ready,setReady]=useState(false),[signedIn,setSignedIn]=useState(false),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){
  setBusy(true);setError('');
  try{
   await identity.updateToken(30);
   const res=await fetch(wiki?'/api/team-wiki':'/api/knowledge-base',{headers:{Authorization:`Bearer ${identity.token}`},signal:AbortSignal.timeout(10000)}),body=await res.json();
   if(!res.ok){if(res.status===401||body.code==='employee_inactive')identity.clearToken();throw new Error(body.error||'Unable to load guides.');}
   setData(body);
  }catch(e){setData(null);setError(e.message||'Session check failed. Please sign in again.');if(!identity.authenticated)setSignedIn(false);}
  finally{setBusy(false);}
 }
 useEffect(()=>{
  identity.onAuthLogout=()=>{setSignedIn(false);setData(null);};
  identity.onAuthRefreshError=()=>identity.clearToken();
  initialization ||= identity.init({onLoad:'check-sso',pkceMethod:'S256',checkLoginIframe:false,redirectUri});
  initialization.then(authenticated=>{setSignedIn(authenticated);if(authenticated)return load();}).catch(()=>setError('Cannot connect to sign in. Check the local identity service and reload.')).finally(()=>setReady(true));
 },[]);
 async function signIn(){try{await identity.login({redirectUri});}catch{setError('Could not open sign in. Reload and try again.');}}
 async function signOut(){try{await identity.logout({redirectUri});}catch{setError('Sign out failed. Try again.');}}
 return <main><header><a className="brand" href={wiki?'/team-wiki/':'/'}>ei<span>{appName}</span></a><a href="http://127.0.0.1:5173/">Employee IT portal ↗</a></header>
  <section className="hero"><span className="eyebrow">{wiki?'EMPLOYEE IT / TEAM HANDBOOK':'EMPLOYEE IT / SUPPORT GUIDES'}</span><h1>{wiki?<>Your team.<br/>On the same page.</>:<>A little help.<br/>A smoother day.</>}</h1><p>{wiki?'A sample handbook for getting started, working with IT and caring for company equipment.':'Practical first steps for common workplace IT issues.'}</p></section>
  <section className="session"><div><h2>{data?`Welcome, ${data.name}`:signedIn?'Your employee session':'Your guides start with sign in.'}</h2><p>{signedIn?'Your identity is verified through Employee IT.':'Already signed in to the portal? Your existing session can open this app too.'}</p></div>{signedIn?<button onClick={signOut}>Sign out</button>:<button disabled={!ready} onClick={signIn}>{ready?'Sign in with Keycloak':'Checking session…'}</button>}</section>
  {error&&<p className="error" role="alert">{error} <button onClick={()=>location.reload()}>Reload</button></p>}
  {signedIn&&<div className="section-heading"><h2>{wiki?'Team handbook':'Support library'}</h2><button disabled={busy} onClick={load}>{busy?'Loading…':'Refresh guides'}</button></div>}
  <div className="guides">{data?.guides.map((guide,i)=><article key={guide.id}><span className="number">0{i+1} / {guide.category}</span><h2>{guide.title}</h2><ol>{guide.steps.map(step=><li key={step}>{step}</li>)}</ol></article>)}</div>
  <footer>Local SSO demonstration · Available to Employee, IT Support and Admin roles.<br/>Application approval records do not control access to this demo library.</footer>
 </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
