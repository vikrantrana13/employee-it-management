# Employee IT Onboarding & Access Management System

## Current milestone: authenticator MFA

Implemented: React portal, Express API, MySQL, Keycloak login, backend role checks, Admin employee creation, linked identity accounts, mandatory first-login password changes, failed-setup retries, onboarding history, device registration, assignment/return tracking, maintenance/retirement, and employee-only device views. Application requests, cancellation, Admin decisions, and approval records are also implemented. Approvals currently track decisions in this portal; external application provisioning is not connected. Support tickets now include private employee views, staff claiming, replies, resolutions, closing and reopening. Admin offboarding now blocks portal access, disables Keycloak accounts and sessions, revokes recorded approvals, cancels pending requests and supports failure recovery. Assigned devices remain outstanding until physically returned. Admin audit browsing now combines employee, device, access and ticket events with search, UTC date filters and pagination. A second Knowledge Base app now demonstrates SSO with its own OIDC client and protected guide API. Authenticator MFA is available through portal enrollment; the dedicated mfa.demo account must enroll on first login. MFA is not mandatory for all users. Services are local development only.

## Start

Requirements: Node.js 22.12+ within a supported release, npm, Docker Desktop with the engine running.

The assistant has already created a private `.env` with generated local credentials. Keep it. For a fresh clone only, copy `.env.example` to `.env` and replace every placeholder password and secret before starting.

```sh
npm install
npm run services:up
# Wait for Keycloak to finish starting before identity:setup.
npm run db:migrate
npm run identity:setup
npm run sso:setup
npm run mfa:setup
npm run dev
```

Open http://127.0.0.1:5173/ (use this exact host for Keycloak redirects). Sign in as `admin.demo`, `support.demo`, or `employee.demo`; initial demo password is KEYCLOAK_DEMO_PASSWORD in your private `.env`. Only Admin sees the employee onboarding form. Admin can open **IT Support workspace** for inventory; IT Support opens inventory by default. **Employee workspace** shows the signed-in employee’s own equipment. New employees can log in using their email and the temporary password you entered; Keycloak requires a password change.

The migrations and service-client setup preserve existing employee records. The realm import runs on first initialization only; see the identity guide before changing existing realm settings.

```sh
npm test
npm run build
```

Stop web/API with Ctrl+C. Stop containers with `npm run services:stop`. Both databases persist in Docker volumes. Changing `.env` alone does not change credentials already stored in MySQL or Keycloak. Do not delete volumes containing data you need.

## Structure

- frontend/: React portal, onboarding form, and device workspaces
- backend/: Express API, employee services, migrations and tests
- infra/keycloak/: realm template and provisioning-client setup
- demo-app/: Knowledge Base application on port 5174
- docs/: architecture and learning notes
- compose.yaml: MySQL and Keycloak local services

## Learn

- [Foundation: React -> API -> MySQL](docs/01-foundation.md)
- [Identity, roles and demo accounts](docs/02-identity.md)
- [Onboarding, recovery and setup](docs/03-onboarding.md)
- [Device inventory and assignments](docs/04-devices.md)
- [Application requests and approvals](docs/05-application-access.md)
- [IT support tickets](docs/06-tickets.md)
- [Offboarding and access removal](docs/07-offboarding.md)
- [Unified audit history](docs/08-audit.md)
- [Two-application SSO](docs/09-sso.md)
- [Authenticator MFA and recovery](docs/10-mfa.md)
- [Build roadmap](docs/roadmap.md)

## Verification

34 automated API/service tests passed. Browser checks verified Admin creation, duplicate rejection, onboarding history, new-employee login, mandatory password change, denied Admin access, and desktop/mobile layouts. A real MySQL/Keycloak recovery check verified that an incomplete setup cannot use app APIs, retries reuse the same identity, and concurrent retries return 409. Fictional Onboarding Demo and Recovery Demo records from verification remain in the local directory.

Device verification also covered concurrent assignment protection, duplicate identifiers, return/repair, reassignment, retirement, persistent history and cross-employee isolation. The browser checked Admin and IT Support workflows and desktop/mobile layout. Fictional LAB-UI devices and a retired VERIFY device remain in local inventory.

Run `npm run verify:devices` for the explicit live database check. It requires an active employee and creates one labeled test device, leaving it retired with history. It does not run as part of `npm test`.

Application access verification covered private history, duplicate requests, cancellations, Admin-only decisions, self-review denial, concurrent decisions, and persisted approval/events. Browser tests verified the employee/Admin workflow and responsive layout. Fictional access-test records remain; the verification-only application is disabled. `npm run verify:access` repeats the explicit live database check and creates its own labeled application fixture.

Ticket verification covered ownership, assignee-only resolution, simultaneous claims, valid transitions, and preserved replies/resolutions after reopening. Browser tests verified employee submission, Support handling, requester closure/reopening, private reads/replies and desktop/mobile layout. Fictional verification tickets remain. Run `npm run verify:tickets` to repeat the explicit database check; it creates one labeled ticket and leaves it closed with history.

Offboarding verification covered Keycloak failure/retry, recorded approval revocation, pending-request cancellation, support handover and preserved device assignments. Browser checks proved that a still-unexpired JWT is denied by the portal, the refresh token is rejected, fresh login is disabled, and onboarding retries cannot reactivate the account. Fictional offboarded accounts remain for inspection; one test laptop still awaits return. `npm run verify:offboarding` repeats the explicit local integration check using newly created fixtures.

The migration ledger records checksums and skips previously applied files. Add new migration files rather than changing existing applied migrations.

Audit verification read all 94 existing events across four sources without pagination gaps or duplicates. Run `npm run verify:audit` for a read-only database check. Open **Audit workspace** as Admin to explore the combined history.

Two-app SSO verification passed in both directions with distinct tokens sharing one identity/session. Open http://127.0.0.1:5174/ in the same browser after portal login. Sign-out is detected in the other app on reload; already-open tabs may retain access until refresh or token expiry. Application approvals do not gate this demonstration library.

For MFA practice, sign in as `mfa.demo` using the initial demo password from `.env` and scan the enrollment QR code with your authenticator. Existing users can select **Set up authenticator** in the portal. See the MFA guide for scope and lost-phone recovery.

Team Wiki now opens at http://127.0.0.1:5174/team-wiki/ from its approved-application launch link. It is a read-only sample handbook within the same demo frontend and OIDC client as Knowledge Base, not a third independent SSO application. Both enforce login, active employee status and roles; application approvals are still not enforced by their APIs. Reports Portal remains an unconnected catalog entry. Run `npm run sso:setup` to register the exact Wiki callback/logout URL in an existing realm.
