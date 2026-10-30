import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

async function withServer(checkDatabase, run) {
  const server = createApp({ checkDatabase }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('readiness confirms a successful database query', async () => {
  let called = false;
  await withServer(async () => { called = true; }, async url => {
    const res = await fetch(`${url}/api/ready`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).database, 'connected');
    assert.equal(called, true);
  });
});
test('database failure returns 503 without exposing internal errors; liveness remains healthy', async () => {
  await withServer(async () => { throw new Error('private-database-details'); }, async url => {
    const res = await fetch(`${url}/api/ready`);
    assert.equal(res.status, 503);
    const body = await res.text();
    assert.ok(!body.includes('private-database-details'));
    assert.equal((await fetch(`${url}/api/health`)).status, 200);
  });
});
