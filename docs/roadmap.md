# Build roadmap

1. Foundation: React -> Express -> MySQL, with working status and failure states.
2. Identity: Keycloak in Docker, realm and clients, OIDC authorization code flow with PKCE, backend token validation (signature, issuer, audience, expiry), Employee / IT Support / Admin roles enforced by the API.
3. Employee onboarding: database migrations, employee profiles, Keycloak account creation, reliable handling of partial failures between identity and application data.
4. Operations: device inventory and assignments, access requests/approvals, ticket ownership and status transitions. These are inventory records, not remote device management.
5. SSO and offboarding: second demo application, account disabling, session revocation, device returns; test existing access tokens as well as new login attempts. Session revocation alone may not invalidate already issued JWTs; define and verify API-side access removal behavior.
6. Audit and verification: record actor, action, target and timestamp without passwords/tokens, test role boundaries and document support cases.
7. AWS: EC2, RDS, S3, CloudFront, HTTPS, secrets, monitoring and CI/CD after local functionality works.

Only describe completed, verified milestones as completed on a resume.
