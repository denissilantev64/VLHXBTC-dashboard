import { bootstrap } from 'global-agent';

let initialized = false;

export function initGlobalProxy(): void {
  if (initialized) {
    return;
  }
  const proxyUrl =
    process.env.GLOBAL_AGENT_HTTPS_PROXY ?? process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? '';
  if (!proxyUrl) {
    initialized = true;
    return;
  }
  if (!process.env.GLOBAL_AGENT_HTTPS_PROXY) {
    process.env.GLOBAL_AGENT_HTTPS_PROXY = proxyUrl;
  }
  bootstrap();
  initialized = true;
}
