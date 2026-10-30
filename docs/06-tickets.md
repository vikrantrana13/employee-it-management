# Milestone 6: IT support tickets

Run `npm run db:migrate` to add ticket and event tables. Existing records are preserved.

## Workflow

An onboarded employee opens Employee workspace, enters a title, description, category and priority, and optionally links a device currently assigned to them. The ticket starts Open. IT Support opens its queue, selects the ticket and uses Assign to me, which moves it to In progress. The assigned support person (or Admin) documents a resolution. The requester confirms the fix and closes it. The requester or Admin can reopen resolved/closed tickets with a reason, returning them to the unassigned Open queue.

Both employee and support can add replies before closure. Earlier resolutions and replies remain in history after reopening. Demo staff accounts may work the queue without employee records; raising a ticket requires a completed employee profile.

## Permissions and consistency

- Employees list/read/reply only to their own tickets. Unauthorized ticket IDs return 404.
- IT Support and Admin can read the queue and all ticket histories.
- Only IT Support/Admin may claim. Only the assignee/Admin may resolve.
- Only the requester/Admin may close or reopen. Replies to closed tickets are blocked.
- The requester and staff identity come from the verified token, not request fields.
- Optional device references must belong to the requester at creation time.
- Row locks prevent competing claims/transitions from both succeeding. Ticket changes and history events commit together.

The list supports status, title/number search, and staff assignment filters; it shows the most recent 100 matches. Events store the actor name at action time for readable history. Reopening clears the current resolution/assignee, while earlier history remains.

## Exercise

Create an employee, raise a network issue, sign in as support.demo, claim it, reply with diagnostic steps, resolve it, and sign back in as the employee to close it. Reopen it to practise repeat incidents. Use a second employee to confirm that guessing a ticket ID cannot expose another person's conversation.

This is a local help desk workflow. Email notifications, attachments, SLA timers, escalation and staff reassignment are not implemented. Offboarding and a second SSO application remain future work.

## Verification completed

24 automated tests and the frontend build passed. Real MySQL tests covered invalid device ownership, private reads/replies, concurrent claiming, assignee-only resolution, requester/Admin closure/reopening, and history preservation. Browser checks verified the complete employee/Support workflow and responsive layout. One fictional browser ticket remains reopened so you can explore the queue; the database verification ticket is closed. `npm run verify:tickets` repeats the database check with a new labeled fixture.
