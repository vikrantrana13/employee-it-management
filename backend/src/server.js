import {auditService} from './audit/service.js';
import {offboardingService} from './offboarding/service.js';
import {ticketService} from './tickets/service.js';
import { accessService } from './access/service.js';
import { inventoryService } from './devices/service.js';
import { createDatabase } from './database.js';
import { employeeRepository } from './employees/repository.js';
import { onboardingService } from './employees/service.js';
import { identityService } from './employees/identity.js';
import { createApp } from './app.js';
import { createTokenVerifier } from './auth.js';

const pool = createDatabase();
const identity = identityService({issuer:process.env.KEYCLOAK_ISSUER,clientId:process.env.KEYCLOAK_SERVICE_CLIENT,clientSecret:process.env.KEYCLOAK_SERVICE_SECRET});
const onboarding = onboardingService(employeeRepository(pool),identity);
const verifyToken = createTokenVerifier({ issuer: process.env.KEYCLOAK_ISSUER, audience: process.env.KEYCLOAK_AUDIENCE });
const app = createApp({ audit: auditService(pool), offboarding: offboardingService(pool,identity), tickets: ticketService(pool), access: accessService(pool), inventory: inventoryService(pool), onboarding, verifyToken, checkDatabase: () => pool.query({ sql: 'SELECT 1', timeout: 3000 }) });
const port = Number(process.env.API_PORT || 4000);
const server = app.listen(port, '127.0.0.1', error => { if(error) { console.error('API could not start:',error.code); process.exit(1); } console.log(`API: http://127.0.0.1:${port}`); });
async function shutdown() {
  server.close(async () => { await pool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
