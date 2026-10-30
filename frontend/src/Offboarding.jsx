import React,{useEffect,useState} from 'react';
import {authenticatedFetch} from './auth.js';
export function Offboarding({employeeId,onClose,onChanged}){
  const [data,setData]=useState(null),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  async function refresh(){const result=await authenticatedFetch(`/api/employees/${employeeId}/offboarding`);setData(result);if(result.job)setReason(result.job.reason);}
  useEffect(()=>{refresh().catch(e=>setError(e.message));},[employeeId]);
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{const result=await authenticatedFetch(`/api/employees/${employeeId}/offboarding`,{method:'POST',body:JSON.stringify({reason})});setData(result);setMessage(result.message);await onChanged();}catch(e){setError(e.message);try{await refresh();await onChanged();}catch{}}finally{setBusy(false);}}
  return <section className="offboarding-panel"><div className="section-title"><h3>Employee offboarding</h3><button disabled={busy} onClick={onClose}>Close offboarding</button></div>{error&&<p className="auth-error" role="alert">{error}</p>}{!data?<p>Loading offboarding details…</p>:<>
    <h3>{data.employee.first_name} {data.employee.last_name}</h3><p>{data.employee.email}</p><p>Account status: <strong>{data.employee.status}</strong></p>
    <p>This removes portal access, disables the Keycloak account, ends its sessions, and revokes recorded application approvals. Physical device returns remain a separate IT task.</p>
    {data.employee.status!=='offboarded'&&<form onSubmit={submit}><label>Offboarding reason<textarea required minLength={10} maxLength={500} readOnly={!!data.job} value={reason} onChange={e=>setReason(e.target.value)}/></label><button disabled={busy}>{busy?'Removing access…':data.job?'Retry access removal':'Disable account and remove access'}</button></form>}
    <div aria-live="polite">{message&&<p className="result-message">{message}</p>}{data.job?.last_error&&<p className="auth-error">{data.job.last_error}</p>}</div>
    <h4>Devices awaiting return ({data.devices.length})</h4>{data.devices.length?<ul>{data.devices.map(d=><li key={d.id}>{d.asset_tag} · {d.model}</li>)}</ul>:<p>No assigned devices remain.</p>}
    <h4>Recorded application approvals</h4>{data.approvals.length?<ul>{data.approvals.map((a,i)=><li key={i}>{a.name} · {a.revoked_at?'Revoked':'Approved'}</li>)}</ul>:<p>No recorded approvals.</p>}
    <p>Open employee tickets: {data.openTickets}. These remain visible to IT Support.</p>{data.job&&<p className="list-note">Attempts: {data.job.attempts} · Started: {data.job.started_at}{data.job.completed_at?` · Completed: ${data.job.completed_at}`:''}</p>}
  </>}</section>;
}
