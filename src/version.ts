import pkg from '../package.json' with { type: 'json' };

/** Service version, taken from package.json. */
export const SERVICE_VERSION: string = pkg.version;
