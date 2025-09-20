import { JsonRpcProvider, Network } from 'ethers';
import { ARBITRUM_RPC, ARBITRUM_RPC_FALLBACKS } from '../config.js';
import { logger } from './log.js';
import { initGlobalProxy } from './proxy.js';

export function createProvider(url: string): JsonRpcProvider {
  const network = Network.from(42161);
  return new JsonRpcProvider(url, network, { staticNetwork: network });
}

export function getProviderUrls(): string[] {
  const urls = [ARBITRUM_RPC, ...ARBITRUM_RPC_FALLBACKS];
  const unique = Array.from(new Set(urls.filter((u) => u && u.length > 0)));
  return unique;
}

export function buildProviderSequence(): JsonRpcProvider[] {
  initGlobalProxy();
  const urls = getProviderUrls();
  if (urls.length === 0) {
    throw new Error('No RPC URLs configured');
  }
  return urls.map((url) => {
    logger.info(`Using RPC endpoint ${url}`);
    return createProvider(url);
  });
}
