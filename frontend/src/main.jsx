import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { AccessPanel } from './AccessPanel.jsx';

const modules = [
  ['01', 'Employee onboarding', 'Account creation, role assignment, retries, and setup history.'],
  ['02', 'Devices & inventory', 'Track equipment assignments and returns.'],
  ['03', 'Application access', 'Request and review access to workplace applications.'],
  ['04', 'IT support tickets', 'Capture issues and document their resolution.'],
  ['05', 'Employee offboarding', 'Disable accounts and verify access removal.'],
  ['06', 'Audit history', 'A record of who changed what, and when.'],
];
function App() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState('Not checked yet');
  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch('/api/ready', { signal: AbortSignal.timeout(7000) });
      const data = await response.json();
      if (!response.ok && response.status !== 503) throw new Error('Unexpected API response');
      setStatus(data);
    } catch {
      setStatus({ api: 'unavailable', database: 'unknown', message: 'Cannot reach the API. Check that the backend is running.' });
    } finally {
      setChecked(new Date().toLocaleTimeString());
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, []);
  return <div className="layout">
    <aside><a className="brand" href="/">ei<span>Employee IT</span></a><div className="workspace">LOCAL WORKSPACE</div><div className="selected">◈ &nbsp; Overview</div><div className="aside-note">Your people.<br/>Their tools.<br/>One workspace.<p>Development environment</p></div></aside>
    <main><header><span>Workspace / Overview</span><span className="badge">Milestone 10 · Authenticator MFA</span></header>
      <section className="hero"><div><div className="eyebrow">EMPLOYEE OPERATIONS</div><h1>A better start.<br/>A smoother workday.</h1><p>Employee IT Onboarding & Access Management System</p></div><div className="hero-mark" aria-hidden="true">↗</div></section>
      <AccessPanel/>
      <section className="connection" aria-live="polite"><div><h2>Workspace connection</h2><p>{status?.status === 'ready' ? 'Your portal, API, and database are connected.' : status?.message || 'Checking the local services…'}</p><small>Last checked: {checked}</small></div><button onClick={refresh} disabled={loading}>{loading ? 'Checking…' : 'Check connection ↻'}</button></section>
      <div className="services">{[['React portal', 'connected'], ['Express API', status?.api], ['MySQL database', status?.database]].map(([name, value]) => <div className="service" key={name}><span>{name}</span><strong className={value === 'connected' ? 'good' : 'pending'}><i/>{value || 'checking'}</strong></div>)}</div>
      <section className="roadmap"><div className="section-title"><h2>What we’re building</h2><span>Planned modules</span></div><div className="grid">{modules.map(([number, name, description]) => <article key={number}><div className="card-top"><span>{number}</span><small>{number === '01' ? 'Available for Admin' : number === '02' ? 'Available for IT' : number === '03' ? 'Requests & approvals' : number === '04' ? 'Available' : number === '05' || number === '06' ? 'Available for Admin' : 'Planned'}</small></div><h3>{name}</h3><p>{description}</p></article>)}</div></section>
      <footer>Local development · Onboarding, devices, application approvals, and support tickets are active. Employee offboarding and audit history are available for Admin.</footer>
    </main>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
