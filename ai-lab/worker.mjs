/** Private Workers AI wiring smoke lab. No public inference or member endpoints. */
const healthHeaders={
  'Cache-Control':'no-store',
  'X-Robots-Tag':'noindex, nofollow',
  'X-Content-Type-Options':'nosniff'
};
export default {
  async fetch(_request, _env){
    // Not a user-facing API; forbid ALL external AI consumption while Starry ID is unavailable.
    return new Response('Not found',{status:404,headers:healthHeaders});
  }
};
/**
 * AI binding is attached by Cloudflare script metadata (name: AI, type: ai).
 * Actual synthetic inference is verified through authenticated Cloudflare account AI API.
 * Real consumer/web access must pass Starry ID, permission and quota before any AI.run().
 */