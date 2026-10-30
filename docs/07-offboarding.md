# Milestone 7: employee offboarding and access removal

Run `npm run db:migrate`. The migration runner now records completed files with checksums and prevents simultaneous migration runs. Existing replay-safe migrations are recorded on adoption. Add a new migration instead of editing an applied one.

## Use

Sign in as admin.demo, open Admin workspace, find an employee and click Offboard employee. Review the named employee, provide a reason and choose Disable account and remove access. If identity removal needs retry, the employee stays blocked in this portal and the retry action remains available. The original demo accounts have no employee records and are outside this workflow. Self-offboarding is blocked.

## Ordered flow

1. Acquire the same per-employee lock used by onboarding, preventing an onboarding retry from racing offboarding.
2. In one local transaction, set employee status to offboarding, revoke recorded approvals, cancel pending requests, and return any in-progress support tickets assigned to that employee to the unassigned queue.
3. Commit. Subsequent authenticated API requests for this employee are denied by the existing database status check, even when their JWT has not expired.
4. Disable the matching Keycloak account, end its sessions, and verify disabled status and an empty session list. No unrelated account is selected by email.
5. Mark offboarded and record completion. If Keycloak cannot be verified, retain offboarding status and the job for retry.

The API checks local employee status on requests. It cannot erase data already displayed or downloaded, and does not cancel requests already in progress before the local block commits. The frontend clears its session on the next employee-inactive response. Raw JWTs remain cryptographically valid until expiry, but the portal's status gate denies them. Other applications need their own access checks; the second SSO app is not implemented yet.

## What is preserved

Employee records, original approval decisions and revocation records, ticket conversations, and device assignment history remain. Devices remain assigned until IT records physical return in the inventory workflow. Offboarding completion means access removal, not equipment recovery. The summary lists outstanding devices and open employee tickets. Original requester tickets stay available to IT Support.

Completed offboarding retries are harmless and do not repeat identity operations. Onboarding retry cannot reactivate an offboarded account. Rehire/reactivation, external SaaS revocation, and automated email are outside this milestone.

Keycloak reference: https://www.keycloak.org/docs-api/latest/rest-api/index.html

## Verification completed

28 automated tests and the frontend build passed. A live MySQL/Keycloak test simulated identity failure, verified the local block, retried safely, checked concurrent-retry rejection, preserved a device assignment and returned a departing support employee's ticket to the queue. Browser verification created and offboarded its own fictional account while it was logged in: the original JWT still passed signature/expiry verification but received employee_inactive on portal APIs; refresh was rejected and a fresh login was denied. The frontend cleared its session on its next API call. Onboarding retry returned 409. Desktop/mobile layout and migration rerun checks passed.

`npm run verify:offboarding` repeats the live check and retains its labeled offboarded employee/device records.
