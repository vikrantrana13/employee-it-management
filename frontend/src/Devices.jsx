import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from './auth.js';
const empty={asset_tag:'',serial_number:'',device_type:'laptop',model:'',location:'Bangalore office'};
export function Devices({manage=false}){
  const [devices,setDevices]=useState([]),[employees,setEmployees]=useState([]),[form,setForm]=useState(empty),[search,setSearch]=useState(''),[status,setStatus]=useState(''),[selected,setSelected]=useState({}),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState(''),[history,setHistory]=useState(null);
  async function refresh(){
    const data=await authenticatedFetch(manage?'/api/devices?'+new URLSearchParams({search,status}):'/api/devices/mine');setDevices(data.devices);
    if(manage)setEmployees((await authenticatedFetch('/api/devices/assignees')).employees);
  }
  useEffect(()=>{refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
  async function action(path,body,method='POST'){
    setBusy(true);setError('');setMessage('');
    try{const data=await authenticatedFetch(path,{method,body:JSON.stringify(body)});setMessage(data.message||'Device registered.');await refresh();return true;}
    catch(e){setError(e.message);try{await refresh();}catch{}return false;}finally{setBusy(false);}
  }
  async function add(event){event.preventDefault();if(await action('/api/devices',form))setForm(empty);}
  async function filter(event){event.preventDefault();setBusy(true);setError('');try{await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function showHistory(device){setError('');try{setHistory({tag:device.asset_tag,events:(await authenticatedFetch(`/api/devices/${device.id}/history`)).events});}catch(e){setError(e.message);}}
  return <section className="device-panel">
    <div className="section-title"><div><div className="eyebrow">{manage?'IT OPERATIONS':'YOUR EQUIPMENT'}</div><h2>{manage?'Device inventory & assignments':'My devices'}</h2></div><button disabled={busy} onClick={filter}>Refresh devices</button></div>
    <p>{manage?'Register equipment, assign it to an active employee, and record its return.':'Equipment currently assigned to your employee account. Contact IT Support for a return or repair.'}</p>
    {manage&&<details className="device-create" open><summary>Register a device</summary><form onSubmit={add}><fieldset disabled={busy}><div className="employee-fields">
      {[['asset_tag','Asset tag',40],['serial_number','Serial number',100],['model','Model',120],['location','Storage location',100]].map(([key,label,max])=><label key={key}>{label}<input required maxLength={max} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}
      <label>Device type<select value={form.device_type} onChange={e=>setForm({...form,device_type:e.target.value})}>{['laptop','desktop','monitor','phone','accessory'].map(type=><option key={type} value={type}>{type}</option>)}</select></label>
    </div><div className="form-actions"><button type="submit">{busy?'Working…':'Register device'}</button></div></fieldset></form></details>}
    {manage&&<form className="device-filters" onSubmit={filter}><label>Search inventory<input placeholder="Asset tag, serial, or model" maxLength={100} value={search} onChange={e=>setSearch(e.target.value)}/></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{['available','assigned','maintenance','retired'].map(s=><option key={s} value={s}>{s}</option>)}</select></label><button disabled={busy}>Apply filters</button></form>}
    <div aria-live="polite">{error&&<p className="auth-error" role="alert">{error}</p>}{message&&<p className="result-message">{message}</p>}</div>
    {manage&&<p className="list-note">Showing up to 100 matching devices. Assignment choices include up to 500 active employees.</p>}
    {loading?<p>Loading devices…</p>:devices.length===0?<p>{manage?'No matching devices. Register equipment above or change the filters.':'No devices assigned yet.'}</p>:<div className="device-list">{devices.map(device=><article className="device-card" key={device.id}>
      <div className="device-card-heading"><div><span className="asset-tag">{device.asset_tag}</span><h3>{device.model}</h3><p>{device.device_type} · Serial: {device.serial_number}</p><small>Storage location: {device.location}</small>{device.first_name&&<p>Assigned to {device.first_name} {device.last_name}<br/><small>{device.email}</small></p>}{!manage&&<p>Assigned on {device.assigned_at}</p>}</div><span className={'device-status '+device.status}>{device.status}</span></div>
      {manage&&<div className="device-actions">
        {device.status==='available'&&<form className="assign-form" onSubmit={e=>{e.preventDefault();action(`/api/devices/${device.id}/assign`,{employeeId:selected[device.id]});}}><label>Assign {device.asset_tag} to<select required disabled={busy} value={selected[device.id]||''} onChange={e=>setSelected({...selected,[device.id]:e.target.value})}><option value="">Select active employee</option>{employees.map(employee=><option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name} — {employee.email}</option>)}</select></label><button disabled={busy||!employees.length} type="submit">Assign device</button></form>}
        <div className="device-buttons">
          {device.status==='assigned'&&<><button disabled={busy} onClick={()=>action(`/api/devices/${device.id}/return`,{status:'available'})}>Record return</button><button disabled={busy} onClick={()=>action(`/api/devices/${device.id}/return`,{status:'maintenance'})}>Return for repair</button></>}
          {device.status==='available'&&<button disabled={busy} onClick={()=>action(`/api/devices/${device.id}/status`,{status:'maintenance'},'PATCH')}>Mark for maintenance</button>}
          {device.status==='maintenance'&&<button disabled={busy} onClick={()=>action(`/api/devices/${device.id}/status`,{status:'available'},'PATCH')}>Mark available</button>}
          {['available','maintenance'].includes(device.status)&&<button className="quiet" disabled={busy} onClick={()=>action(`/api/devices/${device.id}/status`,{status:'retired'},'PATCH')}>Retire device</button>}
          <button className="quiet" disabled={busy} onClick={()=>showHistory(device)}>Device history</button>
        </div>
      </div>}
    </article>)}</div>}
    {history&&<div className="history"><h3>History · {history.tag}</h3><button onClick={()=>setHistory(null)}>Close device history</button><ul>{history.events.map((event,i)=><li key={i}>{event.action.replaceAll('_',' ')}{event.first_name?` · ${event.first_name} ${event.last_name}`:''} · {event.created_at}</li>)}</ul></div>}
  </section>;
}
