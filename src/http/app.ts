import { Hono } from 'hono';
import { SERVICE_VERSION } from '../version.ts';

/** Builds the HTTP application. Entry points (REST, MCP, web UI API) are mounted here. */
export function createApp(): Hono {
  const app = new Hono();

  // Unauthenticated health check (spec §6-1).
  app.get('/health', (c) => c.json({ status: 'ok', version: SERVICE_VERSION }));

  return app;
}
