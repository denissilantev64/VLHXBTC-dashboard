import { bootstrap } from 'global-agent';
import { logger } from './log.js';

let initialized = false;

export function initGlobalProxy(): void {
  if (initialized) {
    return;
  }
  const httpProxy = process.env.GLOBAL_AGENT_HTTP_PROXY ?? process.env.HTTP_PROXY ?? '';
  const httpsProxy = process.env.GLOBAL_AGENT_HTTPS_PROXY ?? process.env.HTTPS_PROXY ?? '';
  let proxyUrl = httpProxy || httpsProxy;
  if (!proxyUrl) {
    initialized = true;
    return;
  }
  let parsed: URL | null = null;
  try {
    parsed = new URL(proxyUrl);
  } catch (error) {
    logger.warn(`Skipping proxy bootstrap due to invalid proxy URL: ${(error as Error).message}`);
    initialized = true;
    return;
  }
  if (parsed.protocol !== 'http:' && httpProxy && proxyUrl !== httpProxy) {
    try {
      const httpParsed = new URL(httpProxy);
      if (httpParsed.protocol === 'http:') {
        proxyUrl = httpProxy;
        parsed = httpParsed;
      }
    } catch (error) {
      logger.warn(`Ignoring invalid HTTP proxy URL: ${(error as Error).message}`);
    }
  }
  if (!parsed || parsed.protocol !== 'http:') {
    logger.warn(`Skipping proxy bootstrap due to unsupported proxy protocol: ${proxyUrl}`);
    initialized = true;
    return;
  }
  if (!process.env.GLOBAL_AGENT_HTTP_PROXY) {
    process.env.GLOBAL_AGENT_HTTP_PROXY = proxyUrl;
  }
  if (!process.env.GLOBAL_AGENT_HTTPS_PROXY) {
    process.env.GLOBAL_AGENT_HTTPS_PROXY = proxyUrl;
  }
  bootstrap();
  initialized = true;
}
