# Milestone 2: login and API permissions

## Start and demo accounts

Run `npm install`, `npm run services:up`, and `npm run dev` from the project root. Keycloak can take a minute to start. Use exactly http://127.0.0.1:5173/ (localhost is a different origin).

Sign in as `employee.demo`, `support.demo`, or `admin.demo`. All three local-only test accounts initially use the value of KEYCLOAK_DEMO_PASSWORD in your private root `.env`. Open the file locally to copy that value; do not commit it or share it. These are fictional accounts with example.test addresses.

Keycloak console: http://127.0.0.1:8080/admin/ — username `local-admin`, password from KEYCLOAK_ADMIN_PASSWORD. This bootstrap identity is separate from the application's admin.demo account.

The realm is imported only on the first start. Editing the import JSON or changing the demo password variable does not update an existing realm. Make deliberate changes in the console and maintain the import for fresh environments. Do not delete persistent volumes to apply routine changes.

## What happens during sign in

1. React redirects to Keycloak. The password is entered at Keycloak, never handled by our API.
2. Authorization Code flow with PKCE (S256) returns a short-lived code to the exact registered portal URL.
3. The browser adapter exchanges the code using its verifier. A public React application has no client secret.
4. Tokens stay in memory, not localStorage. Before API requests the adapter refreshes an expiring token.
5. Express verifies the JWT signature using Keycloak's published keys, expected issuer, API audience, RS256 algorithm, expiry, required claims, and access-token type.
6. Only verified token roles determine API access. Hiding a UI button is a convenience, not authorization.

## Permission matrix

| Endpoint | Employee | IT Support | Admin |
|---|---|---|---|
| /api/me | Yes | Yes | Yes |
| /api/workspaces/employee | Yes | Yes | Yes |
| /api/workspaces/support | No | Yes | Yes |
| /api/workspaces/admin | No | No | Yes |

No token or invalid token returns 401. A valid identity without a required role receives 403. Workspace endpoints currently confirm access; employee CRUD, device records, tickets, and audit storage come in later milestones.

## Practice

Sign in with each account, open the permitted workspaces, sign out, and switch users. Watch `/api/me` and workspace responses in browser developer tools. Never copy tokens into screenshots or logs.

## Boundaries

Keycloak runs in development mode with its own persistent development database. This is for local learning; production needs a supported external database, HTTPS and production configuration. The MySQL volume from milestone 1 is preserved.

MFA and a second SSO application are not implemented yet. This milestone establishes OIDC login, not proof of SSO across two apps. Session revocation and immediate API access removal are offboarding work: an already issued JWT can remain valid until expiry (currently five minutes). Role changes also take effect on newly issued tokens. Do not claim immediate revocation yet.

Official reference: https://www.keycloak.org/securing-apps/javascript-adapter

## Later milestones

The boundaries above describe milestone 2. Offboarding is now implemented; see [offboarding](07-offboarding.md). Two-app SSO is now verified; see [SSO](09-sso.md) for current setup and logout behavior.
