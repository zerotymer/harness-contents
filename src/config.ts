/** Runtime configuration read from environment variables (spec §3). */
export interface Config {
  host: string;
  port: number;
}

const DEFAULT_BIND = '127.0.0.1:7878';

/**
 * Parses `HCS_BIND` ("host:port", default `127.0.0.1:7878`).
 * Binding beyond loopback happens only when set explicitly.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const bind = env.HCS_BIND?.trim() || DEFAULT_BIND;
  const sep = bind.lastIndexOf(':');
  if (sep <= 0) throw new Error(`HCS_BIND must be "host:port", got "${bind}"`);
  const host = bind.slice(0, sep).replace(/^\[(.*)\]$/, '$1');
  const port = Number(bind.slice(sep + 1));
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`HCS_BIND has an invalid port: "${bind}"`);
  }
  return { host, port };
}
