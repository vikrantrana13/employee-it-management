# Milestone 3: employee account onboarding

## Setup

From the project root, with Docker running:

```sh
npm run services:up
npm run db:migrate
npm run identity:setup
npm run dev
```

Run identity:setup after Keycloak finishes starting. It uses the local bootstrap credentials once to configure a dedicated confidential service client. The runtime uses client credentials with realm-management user-management permissions, not the master admin password. This is a powerful backend secret: it stays in .env, never in React. The setup script can be rerun; it preserves employee accounts. If bootstrap credentials have been retired, use an authorized Keycloak administrator to configure the service instead.

## Use

Sign in as admin.demo. Enter first name, last name, email, department, start date, Employee or IT Support role, and a temporary password (12–128 characters, uppercase, lowercase, number). The employee must change that password on first login. No email is sent and no SMTP is configured. Share credentials securely yourself for this local lab. Login supports email or the generated immutable emp-UUID username. Demo accounts are not employee records.

Admin is the only role allowed to list/create/retry onboarding or view its history. Application Admin creation is intentionally outside this form. The latest 100 employees are shown.

## Flow and failure recovery

1. Validate input and reserve a unique normalized email in MySQL. Record actor and onboarding request in the same transaction.
2. Acquire a per-employee MySQL advisory lock, preventing concurrent provisioning attempts for the same employee.
3. Find or create a disabled Keycloak user using the record's random immutable username. Never attach an unrelated account merely because its email matches.
4. Save the Keycloak user ID; set a temporary password, assign the selected role, and enable the account.
5. Mark the record active and append the completion event atomically in MySQL.

Passwords are neither stored in our tables nor returned by the API. On failure the record remains visible with a retry action. Supply a temporary password again when retrying. Retrying an active record does not reset its password or create another account. If the network response is lost, refresh the directory before retrying. If the API process crashes, a pending record is recoverable by retry.

MySQL and Keycloak cannot share one transaction. The API additionally denies managed emp- accounts unless their matching MySQL record is active, so a failure after Keycloak enables an account still blocks application API access. This check is for provisioned accounts; the original demo identities remain separate. This is not yet an offboarding implementation.

## Concepts

- Database constraints: unique email and Keycloak ID prevent duplicate records.
- Parameterized SQL: input values are bound separately from SQL syntax.
- Client credentials: a backend service authenticates without a human login.
- Recovery key: an immutable username lets retries find the same account after an uncertain response.
- Local transactions: employee status and its history event commit together.
- Advisory lock: serializes setup for one employee without holding an open transaction during network calls.

History covers onboarding events only; complete application audit logging, device assignments, tickets, email invitations, MFA and offboarding are later milestones.

Reference: https://www.keycloak.org/docs-api/latest/rest-api/index.html

## Verification completed

The frontend build and 13 automated tests passed. Browser verification covered new account creation, persisted history, duplicate email rejection, mandatory password change, employee login, denied Admin access, and responsive layout. Live recovery verification simulated a lost response after Keycloak account enablement: MySQL marked failure, app access was blocked, and retry reused the same identity. A competing retry was rejected with 409. Fictional verification records are retained in the directory.
