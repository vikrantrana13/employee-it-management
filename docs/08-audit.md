# Unified audit history

Sign in as `admin.demo` and choose **Audit workspace**. Filter employee, device, application-access or ticket events, search actions/people/targets, or select a UTC date range. Apply filters updates the results; Reset clears them. Older/Newer events navigate 25 records at a time; Refresh latest returns to the newest records for the applied filters.

## Workflow and concepts

1. Existing operations record events in their own MySQL history tables.
2. React requests `GET /api/audit` with the applied filters and optional page cursor.
3. Express validates the Keycloak access token, checks employee status and requires the Admin role. Hiding a button is not the authorization boundary.
4. A read-only `UNION ALL` query combines the four histories into actor, action, target and timestamp fields. Bound parameters keep search text separate from SQL code. Search treats percent signs and underscores literally.
5. Results sort newest first. Source and numeric event ID break ties between events recorded in the same second. A base64url cursor carries the last timestamp/source/ID so the next page can fetch older records. It contains no credentials and is validated, not trusted as authorization.

The date range includes the entire end date. The local Docker MySQL server uses UTC; keep database session timestamps in UTC when deploying. There is no database migration or data copy for this screen.

## Scope and limitations

These are application operation events, not Keycloak login/security events or a tamper-proof compliance archive. The screen does not expose ticket reply bodies, passwords or tokens. Actor IDs remain visible even if no employee profile exists for an original demo account. Employee actor names and target labels come from current records; ticket actor names were captured with the event. This is not a historical snapshot of every profile field.

Pagination is a live view, not a frozen export. Newly recorded activity is available through Refresh latest. No edit/delete or export endpoint is provided. The union query is appropriate for this small local project; production volumes would need query measurement and indexing or a dedicated audit store.

## Verification

`npm test` covers filter validation, bound search inputs, cursor generation and anonymous/Employee/IT Support denial. `npm run verify:audit` performs read-only checks of all four real MySQL event sources, total coverage, ordering, pagination, literal searches and dates. Run it while no other workflow is writing events so the count comparison remains consistent. Browser checks cover Admin navigation, filtering, empty results, paging, role denial and mobile layout.
