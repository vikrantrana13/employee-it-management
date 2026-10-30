# Milestone 4: device inventory and assignments

## Run

Run `npm run db:migrate` to add the device, assignment, and event tables while preserving existing records. Start the project normally. No additional packages or Keycloak configuration are needed.

- Admin: select **IT Support workspace** to manage devices; **Admin workspace** retains onboarding.
- IT Support: device inventory opens by default.
- Employee: **My devices** shows only equipment linked to that signed-in employee's Keycloak ID. Original demo accounts have no employee row and show an empty list.

## Workflow

Register equipment with a unique asset tag and serial, type, model, and storage location. Tags and serials are trimmed and normalized to uppercase. New equipment is Available. Assign it to an active employee. When returned, record a normal return (Available) or a return for repair (Maintenance). After repair, mark it Available. Retire unused equipment when it is no longer serviceable; this workflow does not reactivate retired devices. Retiring records does not delete history. Return an assigned device before changing its status.

Storage location is the inventory/return location, not live device tracking. This project does not install software, remotely control hardware, or act as an MDM tool.

## Permissions

| Action | Employee | IT Support | Admin |
|---|---|---|---|
| View own assigned devices | Yes | Yes | Yes |
| Register/list/filter inventory | No | Yes | Yes |
| Assign, return, maintain, retire | No | Yes | Yes |
| View device history | No | Yes | Yes |
| Create employees | No | No | Yes |

The assignment picker exposes only active employee names, email addresses, and IDs. It does not grant IT Support access to the Admin employee API. The employee API uses the verified token subject; passing another employee ID in a URL query cannot change whose devices are returned.

## Consistency and history

Every change runs in a MySQL transaction. Assignment locks the device row, validates and locks the active employee, creates the assignment, updates device status, and appends an event before committing. A generated unique index permits only one open assignment per device. Two simultaneous assignment attempts cannot both succeed. Returns close the assignment and update status/history together; repeated returns are rejected. Failed operations roll back.

Status and historical assignment records are separate: a laptop may have many past assignments, but only one current assignment. Parameterized SQL keeps user values separate from query syntax. Filters show the latest 100 matching devices; the picker shows up to 500 active employees, appropriate for this local lab. Search supports SQL LIKE wildcard matching.

## Exercise

1. Sign in as admin.demo and create an employee if needed.
2. Open IT Support workspace. Register a laptop with a unique tag and serial.
3. Assign it to the employee. Try assigning it a second time: the API rejects the conflict.
4. Sign in as that employee and inspect My devices.
5. Sign in as support.demo, record a return for repair, mark it Available, and inspect Device history.

Tickets, access requests, offboarding, MFA, and a second SSO app remain future milestones.

## Verification completed

17 automated tests and the frontend build passed. A live MySQL check confirmed unique identifiers, rollback after a missing employee, simultaneous assignment protection, own-device filtering, return/maintenance restrictions, reassignment, retirement and preserved history. Browser verification checked Admin registration/assignment, employee-owned device visibility, cross-user access denial, Support repair/return, continued Admin restrictions, and desktop/mobile layouts. Run `npm run verify:devices` to repeat the database check; it creates a labeled fixture and leaves it retired.
