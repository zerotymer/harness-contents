import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from './config.ts';

test('defaults to loopback 127.0.0.1:7878', () => {
  assert.deepEqual(loadConfig({}), { host: '127.0.0.1', port: 7878 });
});

test('parses HCS_BIND including IPv6', () => {
  assert.deepEqual(loadConfig({ HCS_BIND: '0.0.0.0:8080' }), { host: '0.0.0.0', port: 8080 });
  assert.deepEqual(loadConfig({ HCS_BIND: '[::1]:9000' }), { host: '::1', port: 9000 });
});

test('rejects malformed HCS_BIND', () => {
  assert.throws(() => loadConfig({ HCS_BIND: 'localhost' }));
  assert.throws(() => loadConfig({ HCS_BIND: 'localhost:http' }));
  assert.throws(() => loadConfig({ HCS_BIND: 'localhost:70000' }));
});
