# Milestone 1: understand the foundation

## Request flow

Browser (React on port 5173) -> Vite development proxy -> Express API (port 4000) -> MySQL (host port 3307 -> container port 3306).

React renders the interface. Clicking Check connection calls `/api/ready` with fetch. Vite forwards `/api` requests to Express so the browser uses one origin during development. Express runs `SELECT 1` through a mysql2 connection pool and returns JSON. React updates its state to display the real response. Credentials remain in the backend environment; they never enter the frontend bundle.

`/api/health` proves the API process can respond. `/api/ready` proves it can also query MySQL; it returns HTTP 503 when the database is unavailable. A running process and a ready application are different things.

Docker Compose runs MySQL with a persistent named volume. The API uses a dedicated database user, not root. `.env` supplies local settings and passwords and is ignored by Git. `.env.example` documents settings without real secrets. npm workspaces manage frontend and backend dependencies under one lockfile.

## Exercise

1. Run the project and inspect the `/api/ready` response in browser developer tools > Network.
2. Run `npm run db:stop`, then click Check connection: API should remain connected while MySQL becomes unavailable.
3. Run `npm run db:up` and check again: MySQL should recover without restarting the API.
4. Explain why the browser must not connect directly to MySQL.

## Troubleshooting

- Docker socket/daemon error: start Docker Desktop and wait for its engine.
- MySQL unavailable: run `docker compose ps` and `docker compose logs --tail=50 mysql`; check `.env` matches the initialized database credentials.
- API unavailable: check the backend terminal and that port 4000 is free.
- Port in use: stop the conflicting service, or change API_PORT/DB_PORT in `.env` and restart services. Vite deliberately fails if 5173 is occupied.
- npm test uses temporary localhost ports. Readiness tests inject a database failure; the live readiness endpoint is the separate real MySQL integration check.

## References

- https://vite.dev/guide/
- https://expressjs.com/en/starter/installing.html
- https://sidorares.github.io/node-mysql2/docs
