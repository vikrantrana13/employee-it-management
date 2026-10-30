import React,{useEffect,useRef,useState} from 'react';
import {authenticatedFetch} from './auth.js';
const empty={source:'',search:'',from:'',to:''};
export function AuditLog(){
  const [draft,setDraft]=useState(empty),[filters,setFilters]=useState(empty),[pages,setPages]=useState(['']),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[refresh,setRefresh]=useState(0);
  const request=useRef(0),cursor=pages.at(-1);
  useEffect(()=>{
    const id=++request.current;
    setBusy(true);setError('');setData(null);
    const params=new URLSearchParams({...filters,cursor});
    authenticatedFetch(`/api/audit?${params}`).then(result=>{if(id===request.current)setData(result);}).catch(e=>{if(id===request.current)setError(e.message);}).finally(()=>{if(id===request.current)setBusy(false);});
    return ()=>{request.current++;};
  },[filters,cursor,refresh]);
  function field(name){return {value:draft[name],onChange:e=>setDraft({...draft,[name]:e.target.value})};}
  return <section className="audit-panel" aria-busy={busy}>
    <h2>Audit history</h2><p>Who changed what, and when. Times and date filters use UTC.</p>
    <form className="audit-filters" onSubmit={e=>{e.preventDefault();setFilters({...draft});setPages(['']);}}>
      <label>Event source<select aria-label="Event source" {...field('source')}><option value="">All sources</option>{['employee','device','access','ticket'].map(source=><option key={source} value={source}>{source}</option>)}</select></label>
      <label>Search<input aria-label="Search audit history" maxLength={100} placeholder="Action, person or target" {...field('search')}/></label>
      <label>From (UTC)<input aria-label="From (UTC)" type="date" {...field('from')}/></label>
      <label>To (UTC)<input aria-label="To (UTC)" type="date" min={draft.from||undefined} {...field('to')}/></label>
      <button disabled={busy}>Apply filters</button><button type="button" disabled={busy} onClick={()=>{setDraft(empty);setFilters({...empty});setPages(['']);}}>Reset</button>
    </form>
    <div className="audit-navigation"><span>Page {pages.length} · {data?.events.length??0} events</span><button disabled={busy} onClick={()=>{setPages(['']);setRefresh(n=>n+1);}}>Refresh latest</button></div>
    <div aria-live="polite">{busy&&<p>Loading history…</p>}{error&&<p role="alert" className="auth-error">{error}</p>}{data?.events.length===0&&<p>No events match these filters.</p>}</div>
    <div className="audit-events">{data?.events.map(event=><article className="audit-event" key={`${event.source}-${event.event_id}`}>
      <div><span className="badge">{event.source}</span><h3>{event.action.replaceAll('_',' ')}</h3><time dateTime={event.occurred_at.replace(' ','T')+'Z'}>{event.occurred_at} UTC</time></div>
      <div><strong>{event.target_label}</strong><small>Target ID: {event.target_id}</small><small>Actor: {event.actor_name||event.actor_id}</small>{event.actor_name&&<small>Actor ID: {event.actor_id}</small>}</div>
    </article>)}</div>
    <div className="audit-navigation"><button disabled={busy||pages.length===1} onClick={()=>setPages(p=>p.slice(0,-1))}>Newer events</button><button disabled={busy||!data?.nextCursor} onClick={()=>setPages(p=>[...p,data.nextCursor])}>Older events</button></div>
  </section>;
}
