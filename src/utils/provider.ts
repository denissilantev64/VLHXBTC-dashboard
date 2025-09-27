import { JsonRpcProvider, Network } from 'ethers';
import { ARBITRUM_RPC } from '../config.js';
import { logger } from './log.js';
import { initGlobalProxy } from './proxy.js';

export interface ProviderEntry {
  url: string;
  provider: JsonRpcProvider;
}

export function createProvider(url: string): JsonRpcProvider {
  const network = Network.from(42161);
  return new JsonRpcProvider(url, network, { staticNetwork: network });
}

export function buildProviderSequence(): ProviderEntry[] {
  initGlobalProxy();
  logger.info(`Using RPC endpoint ${ARBITRUM_RPC}`);
  return [{ url: ARBITRUM_RPC, provider: createProvider(ARBITRUM_RPC) }];
}
