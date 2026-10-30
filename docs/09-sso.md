# Two-application single sign-on

## Try it

1. Start Docker services as usual. Run `npm run sso:setup` once for an existing realm, then `npm run dev` to start the API and both web apps. If the portal/API are already running, use `npm run dev:knowledge` to start only the new app.
2. Open http://127.0.0.1:5173/ and sign in with a demo account.
3. Choose **Open Knowledge Base**, or open http://127.0.0.1:5174/ in the same browser profile. It loads the support guides without asking for the password again.
4. Sign out of the Knowledge Base and reload the portal. The portal is now signed out. Repeat in the opposite direction to see that the shared session works from either app.

## How it works

The portal and Knowledge Base are separate React applications on different ports. Their public OIDC clients are `employee-it-portal` and `employee-it-knowledge`, in the same `employee-it` realm. Each client permits only its exact local callback/logout URL and origin, uses authorization code flow with PKCE S256, and disables implicit flow and password grants. No client secret belongs in either browser app.

When the second application starts, `check-sso` redirects to Keycloak. Keycloak recognizes the existing browser session and returns an authorization code to that app. The adapter exchanges the code and its PKCE verifier for a new set of tokens. The applications do not copy tokens to each other. Tokens stay in memory, not localStorage/sessionStorage. Inspecting token metadata during verification showed the same subject and session ID, but different authorized-party client IDs and different tokens.

Both clients request the shared `employee-it-api` audience. Express validates the signature, issuer, audience, token type and expiry, then checks the employee's active status and role. `GET /api/knowledge-base` returns the guides only for Employee, IT Support or Admin. The guide content comes from the API rather than being embedded in the public page bundle. This demo intentionally shares a backend; it is not a second independently deployed backend service.

## SSO, authorization and logout

SSO answers which employee is signed in. RBAC answers whether their role can read the library. The application approval ledger is not connected to this library: all three application roles can read it without a catalog approval. Do not describe this as external application provisioning.

Sign out ends the shared Keycloak browser session. These local apps disable the session-status iframe; an already-open tab may retain its displayed data and valid access token until a refresh attempt, expiry or reload. We verified that reloading the other app after logout requires sign-in again. This is not an assertion of immediate cross-tab JWT revocation. Offboarding independently denies managed employees through the shared API active-status guard, even with an unexpired token. Previously read information cannot be erased from a user's browser by offboarding.

## Configuration and verification

`infra/keycloak/setup-sso.mjs` creates or updates only the Knowledge Base client in an existing local realm. It preserves employee records and other clients. The realm import also contains the new client for a fresh installation. Run `npm run sso:setup` again when changing this client; restarting a container does not reimport an existing realm.

`npm test` passes 33 tests, including Knowledge Base role/audience enforcement and denial of inactive employees. `npm run build` builds both applications. Browser verification covered SSO in both directions, same identity/session with separate tokens, absence of token storage, logout followed by reload, and desktop/mobile layout. Test browser contexts used the original employee.demo account and were signed out afterward.

Official adapter documentation: https://www.keycloak.org/securing-apps/javascript-adapter
