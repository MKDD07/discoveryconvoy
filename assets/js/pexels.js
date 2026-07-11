/**
 * Cloudflare Pages Function
 * File location: /functions/api/pexels/[[path]].js
 *
 * Catches ANY request under /api/pexels/*  (e.g. /api/pexels/v1/search,
 * /api/pexels/v1/photos/123, /api/pexels/videos/search,
 * /api/pexels/videos/videos/456) and proxies it to the real Pexels API,
 * attaching your secret API key server-side so it's never exposed to
 * the browser.
 *
 * This means your existing pexels-loader.js does NOT need to change —
 * it already calls these exact relative paths.
 *
 * SETUP:
 *  1. In the Cloudflare dashboard: Pages project → Settings → Environment
 *     variables → add PEXELS_API_KEY (as a "Secret", for both
 *     Production and Preview environments).
 *  2. Push this file to your repo at functions/api/pexels/[[path]].js
 *     (must be at the repo root's /functions folder, not inside your
 *     public/build output folder).
 *  3. Cloudflare Pages auto-detects it on the next deploy. No wrangler.toml
 *     needed for Pages Functions.
 */

const PEXELS_PHOTO_HOST = 'https://api.pexels.com/v1';
const PEXELS_VIDEO_HOST = 'https://api.pexels.com/videos';

export async function onRequest(context) {
  const { request, env, params } = context;

  // Handle CORS preflight (harmless to keep even if same-origin)
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  if (request.method !== 'GET') {
    return jsonError('Only GET is supported', 405);
  }

  const apiKey = env.PEXELS_API_KEY;
  if (!apiKey) {
    return jsonError('Server misconfigured: PEXELS_API_KEY is not set', 500);
  }

  // params.path is an array of the segments AFTER /api/pexels/
  // e.g. /api/pexels/v1/search              -> ['v1', 'search']
  //      /api/pexels/v1/photos/123          -> ['v1', 'photos', '123']
  //      /api/pexels/videos/search          -> ['videos', 'search']
  //      /api/pexels/videos/videos/456      -> ['videos', 'videos', '456']
  const segments = params.path || [];
  const [section, ...rest] = segments;

  let upstreamBase;
  if (section === 'v1') {
    upstreamBase = PEXELS_PHOTO_HOST;
  } else if (section === 'videos') {
    upstreamBase = PEXELS_VIDEO_HOST;
  } else {
    return jsonError(`Unknown Pexels route: /${segments.join('/')}`, 404);
  }

  const upstreamUrl = new URL(`${upstreamBase}/${rest.join('/')}`);

  // Forward all query params (query, orientation, color, locale, per_page, etc.)
  const incomingUrl = new URL(request.url);
  incomingUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value);
  });

  try {
    const upstreamRes = await fetch(upstreamUrl.toString(), {
      headers: { Authorization: apiKey },
      cf: {
        // Edge-cache successful Pexels responses for an hour to save on
        // your rate limit (200 req/hr, 20,000 req/mo)
        cacheTtl: 3600,
        cacheEverything: true
      }
    });

    const body = await upstreamRes.text();

    return new Response(body, {
      status: upstreamRes.status,
      headers: {
        'Content-Type': upstreamRes.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'public, max-age=3600',
        ...corsHeaders()
      }
    });
  } catch (err) {
    return jsonError(`Upstream fetch failed: ${err.message}`, 502);
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}
