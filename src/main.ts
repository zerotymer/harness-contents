import { serve } from '@hono/node-server';
import { loadConfig } from './config.ts';
import { createApp } from './http/app.ts';
import { SERVICE_VERSION } from './version.ts';

const config = loadConfig();
const server = serve({ fetch: createApp().fetch, hostname: config.host, port: config.port }, (info) => {
  console.log(`hcs ${SERVICE_VERSION} listening on ${info.address}:${info.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
  });
}
