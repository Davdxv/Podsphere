import Arweave from 'arweave';
import { ApiConfig } from '../interfaces';
import { usingArLocal } from './utils';

declare global {
  interface Window {
    arApi: Arweave;
  }
}

const TX_BASE_URL : Readonly<string> = 'https://arweave.net/';

const ARLOCAL_CONFIG : Readonly<ApiConfig> = Object.freeze({
  host: 'localhost',
  port: 1984,
  protocol: 'http',
  timeout: 20000,
  logging: true,
});

const MAINNET_CONFIG : Readonly<ApiConfig> = Object.freeze({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
  timeout: 20000,
  logging: true, // TODO: switch to false in production?
});

const INITIAL_CONFIG = usingArLocal() ? ARLOCAL_CONFIG : MAINNET_CONFIG;

const client = Arweave.init(INITIAL_CONFIG);
if (typeof window !== 'undefined') window.arApi = client;

export default client;

/** @returns The `ApiConfig` currently being used with the Arweave client */
export function getApiConfig() : Readonly<ApiConfig> {
  const cfg : ApiConfig = client.getConfig().api;
  return cfg.host && cfg.port && cfg.protocol ? Object.freeze(cfg) : INITIAL_CONFIG;
}

export function formatArweaveUrl(path = '') : string {
  return `${TX_BASE_URL}${path}`;
}
