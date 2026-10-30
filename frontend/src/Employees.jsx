import {Offboarding} from './Offboarding.jsx';
import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from './auth.js';
const empty={first_name:'',last_name:'',email:'',department:'',start_date:'',role:'employee',temporaryPassword:''};
export function Employees() {
  const [rows,setRows]=useState([]),[form,setForm]=useState(empty),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[retryId,setRetryId]=useState(null),[events,setEvents]=useState(null),[offboardingId,setOffboardingId]=useState(null);
  async function refresh(){const data=await authenticatedFetch('/api/employees');setRows(data.employees);}
  useEffect(()=>{refresh().catch(e=>setError(e.message));},[]);
  async function submit(e){
    e.preventDefault();setBusy(true);setError('');setMessage('');
    try {
      const result=await authenticatedFetch(retryId?`/api/employees/${retryId}/retry`:'/api/employees',{method:'POST',body:JSON.stringify(retryId?{temporaryPassword:form.temporaryPassword}:form)});
      setMessage(result.message);setForm(empty);setRetryId(null);await refresh();
    }catch(e){setError(e.message);try{await refresh();}catch{}}finally{setBusy(false);}
  }
  async function history(id){try{setEvents((await authenticatedFetch(`/api/employees/${id}/events`)).events);}catch(e){setError(e.message);}}
  return <section className="employees">
    <div className="section-title"><div><div className="eyebrow">ADMINISTRATION</div><h2>Employee onboarding</h2></div><button disabled={busy} onClick={()=>refresh().catch(e=>setError(e.message))}>Refresh list</button></div>
    <p>Create an account, assign its role, and track setup. Employees must change their temporary password at first login.</p>
    <form onSubmit={submit}><fieldset disabled={busy}><legend>{retryId?'Retry account setup':'New employee'}</legend><div className="employee-fields">
      {!retryId&&<>{[['first_name','First name',80],['last_name','Last name',80],['email','Email address',254],['department','Department',100],['start_date','Start date',10]].map(([key,label,max])=><label key={key}>{label}<input required maxLength={max} type={key==='email'?'email':key==='start_date'?'date':'text'} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}<label>Application role<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="employee">Employee</option><option value="it-support">IT Support</option></select></label></>}
      <label>Temporary password<input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={form.temporaryPassword} onChange={e=>setForm({...form,temporaryPassword:e.target.value})}/><small>12+ characters, uppercase, lowercase, and a number. Share securely.</small></label>
    </div><div className="form-actions"><button type="submit">{busy?'Setting up account…':retryId?'Retry setup':'Create employee'}</button>{retryId&&<button type="button" onClick={()=>{setRetryId(null);setForm(empty);}}>Cancel retry</button>}</div></fieldset></form>
    <div aria-live="polite">{error&&<p className="auth-error" role="alert">{error}</p>}{message&&<p className="result-message">{message}</p>}</div>
    <div className="employee-list"><h3>Employee directory <span>({rows.length})</span></h3><p className="list-note">Most recent 100 records. The original demo accounts are managed in Keycloak.</p>
    {rows.length===0?<p>No employees yet. Create the first employee above.</p>:rows.map(row=><article className="employee-row" key={row.id}><div><h3>{row.first_name} {row.last_name}</h3><p>{row.email}</p><small>{row.department} · {row.role} · Starts {row.start_date}</small><p className="login-name">Login: {row.username}</p></div><div className="employee-controls"><span className={'status-'+row.status}>{({active:'Account ready',failed:'Setup failed',pending:'Setup pending',offboarding:'Access blocked · retry needed',offboarded:'Offboarded'})[row.status]}</span>{['pending','failed'].includes(row.status)&&<button disabled={busy} onClick={()=>{setRetryId(row.id);setForm(empty);setMessage('');setError('');}}>Retry setup</button>}<button disabled={busy} onClick={()=>history(row.id)}>View history</button><button disabled={busy} onClick={()=>setOffboardingId(row.id)}>{row.status==='offboarded'?'View offboarding':row.status==='offboarding'?'Retry offboarding':'Offboard employee'}</button></div></article>)}
    </div>{offboardingId&&<Offboarding key={offboardingId} employeeId={offboardingId} onClose={()=>setOffboardingId(null)} onChanged={refresh}/>}{events&&<div className="history"><h3>Employee lifecycle history</h3><button onClick={()=>setEvents(null)}>Close history</button><ul>{events.map((event,i)=><li key={i}>{event.action.replaceAll('_',' ')} · {event.created_at} · Actor: {event.actor_id}</li>)}</ul></div>}
  </section>;
}
