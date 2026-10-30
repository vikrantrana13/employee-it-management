import Keycloak from 'keycloak-js';
export const keycloak = new Keycloak({ url: 'http://127.0.0.1:8080', realm: 'employee-it', clientId: 'employee-it-portal' });
let initialization;
export function initializeAuth() {
  initialization ||= keycloak.init({ onLoad: 'check-sso', pkceMethod: 'S256', checkLoginIframe: false, redirectUri: 'http://127.0.0.1:5173/' });
  return initialization;
}
export async function authenticatedFetch(path, options = {}) {
  if (!keycloak.authenticated) throw new Error('Please sign in.');
  try { await keycloak.updateToken(30); }
  catch { keycloak.clearToken(); throw new Error('Your session expired. Sign in again.'); }
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers, Authorization: `Bearer ${keycloak.token}` }, signal: AbortSignal.timeout(60000) });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 || data.code === 'employee_inactive') keycloak.clearToken();
    throw new Error(data.error || 'Unable to load workspace.');
  }
  return data;
}
