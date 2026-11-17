import { manifest } from './manifest.mjs';

// No arbitrary URLs, methods, redirects, retries, triggers, or deployment endpoints.
export function readOnlyClient(context, baseUrl, apiKey) {
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
    throw new Error('N8N_BASE_URL must be HTTPS without credentials, query, or fragment.');
  }
  const root = base.href.replace(/\/$/, '');
  if (!apiKey) throw new Error('N8N_API_KEY is required; supply it through Codespaces secrets.');
  return Object.freeze({
    async get(path) {
      const allowed = path === `/workflows/${manifest.workflowId}` ||
        /^\/executions\/\d+\?includeData=true$/.test(path);
      if (!allowed) throw new Error('Read-only endpoint rejected.');
      let response;
      try {
        response = await context.get(`${root}/api/v1${path}`, {
          headers: { 'X-N8N-API-KEY': apiKey, Accept: 'application/json' },
          maxRedirects: 0, timeout: 30_000,
        });
      } catch {
        throw new Error('n8n GET failed. Check connectivity and credentials; request details are suppressed.');
      }
      if (response.status() !== 200) throw new Error(`n8n GET returned HTTP ${response.status()}.`);
      try { return await response.json(); }
      catch { throw new Error('n8n GET did not return JSON.'); }
    },
  });
}
