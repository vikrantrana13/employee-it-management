import {AuditLog} from './AuditLog.jsx';
import React, { useEffect, useState } from 'react';
import {Tickets} from './Tickets.jsx';
import { ApplicationAccess } from './ApplicationAccess.jsx';
import { Devices } from './Devices.jsx';
import { Employees } from './Employees.jsx';
import { keycloak, initializeAuth, authenticatedFetch } from './auth.js';

export function AccessPanel() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [workspace, setWorkspace] = useState(null);
  const [selectedWorkspace,setSelectedWorkspace] = useState(null);
  const activeWorkspace=selectedWorkspace || (profile?.roles.includes('admin')?'admin':profile?.roles.includes('it-support')?'support':'employee');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let mounted = true;
    keycloak.onAuthLogout = () => { if (mounted) { setProfile(null); setWorkspace(null); setSelectedWorkspace(null); } };
    initializeAuth().then(async authenticated => {
      if (authenticated) {
        const user = await authenticatedFetch('/api/me');
        if (mounted) setProfile(user);
      }
    }).catch(() => { if (mounted) setError('Could not verify your session. Check Keycloak and the API, then reload.'); })
      .finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);
  async function openWorkspace(name) {
    setBusy(true); setError(''); setWorkspace(null);
    try { setWorkspace(await authenticatedFetch(`/api/workspaces/${name}`)); setSelectedWorkspace(name); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function signIn() {
    try { await keycloak.login({ redirectUri: 'http://127.0.0.1:5173/' }); }
    catch { setError('Could not open sign in. Check Keycloak and reload.'); }
  }
  async function setupAuthenticator() {
    try { await keycloak.login({action:'CONFIGURE_TOTP',redirectUri:'http://127.0.0.1:5173/'}); }
    catch { setError('Could not open authenticator setup. Reload and try again.'); }
  }
  async function signOut() {
    try { await keycloak.logout({ redirectUri: 'http://127.0.0.1:5173/' }); }
    catch { setError('Sign out failed. Try again.'); }
  }
  return <section className="access-panel">
    <div className="access-heading"><div><div className="eyebrow">IDENTITY & ACCESS</div><h2>{profile ? `Welcome, ${profile.name || profile.username}` : 'Your workspace starts with sign in.'}</h2><p>{profile ? `Verified role: ${profile.roles.join(', ') || 'No application role assigned'}` : 'Use your employee account to access the tools available to your role.'}</p></div>
    {profile ? <button onClick={signOut}>Sign out</button> : <button onClick={signIn} disabled={!ready}>{ready ? 'Sign in with Keycloak →' : 'Checking session…'}</button>}</div>
    {profile && <div className="workspace-actions">
      <button disabled={busy} onClick={setupAuthenticator}>Set up authenticator</button>
      <a href="http://127.0.0.1:5174/" target="_blank" rel="noopener noreferrer">Open Knowledge Base ↗</a>
      {profile.roles.some(r => ['employee','it-support','admin'].includes(r)) && <button aria-pressed={activeWorkspace==='employee'} disabled={busy} onClick={() => openWorkspace('employee')}>Employee workspace</button>}
      {profile.roles.some(r => ['it-support','admin'].includes(r)) && <button aria-pressed={activeWorkspace==='support'} disabled={busy} onClick={() => openWorkspace('support')}>IT Support workspace</button>}
      {profile.roles.includes('admin') && <button aria-pressed={activeWorkspace==='admin'} disabled={busy} onClick={() => openWorkspace('admin')}>Admin workspace</button>}
      {profile.roles.includes('admin') && <button aria-pressed={activeWorkspace==='audit'} disabled={busy} onClick={() => openWorkspace('audit')}>Audit workspace</button>}
    </div>}
    <div aria-live="polite">{error && <p className="auth-error" role="alert">{error} <button onClick={() => location.reload()}>Reload</button></p>}{workspace && <div className="workspace-result"><h3>{workspace.title}</h3><p>{workspace.message}</p></div>}</div>
    {profile?.roles.includes('admin') && activeWorkspace==='audit' && <AuditLog/>}
    {profile?.roles.includes('admin') && activeWorkspace==='admin' && <><ApplicationAccess key="reviews" review/><Employees/></>}
    {profile && activeWorkspace==='employee' && <><Tickets key="my-tickets" profile={profile}/><ApplicationAccess key="requests"/><Devices key="mine"/></>}
    {profile?.roles.some(role=>['admin','it-support'].includes(role)) && activeWorkspace==='support' && <><Tickets key="ticket-queue" manage profile={profile}/><Devices key="inventory" manage/></>}
  </section>;
}
