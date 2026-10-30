# Milestone 5: application requests and approvals

Run `npm run db:migrate` to add the application catalog, request, approval, and event tables. The migration preserves data and seeds three demo applications: Knowledge Base, Team Wiki, and Reports Portal. No external account is created and no email is sent.

## Try it

1. Sign in with an employee created through onboarding. Original demo identities do not have employee records and cannot submit requests.
2. In Employee workspace, select an application and explain the business need (10–500 characters).
3. Sign in as admin.demo. Admin workspace shows the pending review queue. Enter a decision reason and approve or reject.
4. The employee can refresh to see the decision. Approved requests appear under Approved applications. Pending requests can be cancelled by their requester.

Approvals in this milestone are records in our portal. They do not yet grant access in another application, install software, or assign Keycloak application roles. The second-app SSO milestone will enforce application access using these approvals. Current identity roles (Employee, IT Support, Admin) remain unchanged.

## Rules

- Requests use the verified token's subject to find the active employee, never an employee ID supplied by the browser.
- Only Admin can read the review queue and approve/reject. Admin cannot approve or reject their own request.
- One pending request per employee/application. Already approved applications cannot be requested again.
- Decisions require a reason. Request/approval/history writes are one transaction. Row locks and uniqueness constraints prevent double decisions and duplicate approval rows.
- Only pending requests can be decided or cancelled. A rejected/cancelled request may be submitted again as a new record.
- Requesters see only their own history. Admin sees the latest 100 requests matching the selected status. Complete approval revocation belongs to a later access-removal/offboarding milestone.

## Concepts

The catalog describes what can be requested. A request captures an employee's business reason. An approval records an Admin decision. Event records preserve who submitted, decided or cancelled. Keeping these separate supports retries, review history, and future offboarding without overwriting earlier decisions.

## Verification

20 automated tests and the frontend build passed. The browser verified request submission, duplicate rejection, cancellation, Admin approval/rejection, employee decision visibility, denied review access, cross-user isolation, and desktop/mobile layout. Live database checks verified simultaneous requests/decisions, self-review denial, cancellation ownership, resubmission after rejection, and unique approval records. `npm run verify:access` repeats that database check using a labeled application that is disabled afterward.
