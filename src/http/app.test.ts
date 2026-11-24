import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SERVICE_VERSION } from '../version.ts';
import { createApp } from './app.ts';

test('GET /health returns status and version without auth', async () => {
  const res = await createApp().request('/health');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok', version: SERVICE_VERSION });
});

test('unknown paths return 404', async () => {
  const res = await createApp().request('/nope');
  assert.equal(res.status, 404);
});
