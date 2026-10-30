import { createRemoteJWKSet, jwtVerify } from 'jose';

export function createTokenVerifier({ issuer, audience, keySet }) {
  if (!issuer || !audience) throw new Error('Configure KEYCLOAK_ISSUER and KEYCLOAK_AUDIENCE');
  const keys = keySet || createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`));
  return async token => {
    const { payload } = await jwtVerify(token, keys, {
      issuer, audience, algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat'],
    });
    if (payload.typ !== 'Bearer') throw new Error('An access token is required');
    return payload;
  };
}
export function authentication(verifyToken) {
  return async (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') || '');
    if (!match) return res.status(401).json({ error: 'Sign in to continue.' });
    try {
      req.identity = await verifyToken(match[1]);
      const roles = req.identity.realm_access?.roles;
      req.roles = Array.isArray(roles) ? roles.filter(role => ['employee', 'it-support', 'admin'].includes(role)) : [];
      next();
    } catch {
      res.status(401).json({ error: 'Your session is invalid or expired. Sign in again.' });
    }
  };
}
export function requireRoles(...allowed) {
  return (req, res, next) => {
    if (!req.roles?.some(role => allowed.includes(role))) return res.status(403).json({ error: 'Your role does not have access to this workspace.' });
    next();
  };
}
