/**
 * Cloudflare Worker — Pexels + SerpAPI proxy + D1 Blog API
 *
 * Routes:
 *   /api/pexels/v1/*      -> https://api.pexels.com/v1/*        (photos)
 *   /api/pexels/videos/*  -> https://api.pexels.com/videos/*    (videos)
 *   /api/serp             -> https://serpapi.com/search.json    (SerpAPI)
 *   /api/posts            -> GET list posts, POST create post   (D1 blog)
 *   /api/posts/:slug      -> GET single post                    (D1 blog)
 *
 * Both proxies attach their respective secret keys server-side, so
 * neither key is ever sent to or stored in the browser.
 *
 * SETUP:
 *  1. In this Worker's dashboard: "Variables and secrets" -> + -> add:
 *       PEXELS_API_KEY
 *       SERP_API_KEY
 *     (or: npx wrangler secret put PEXELS_API_KEY
 *          npx wrangler secret put SERP_API_KEY)
 *  2. D1 database "my-blog-db" must be bound as `DB` in wrangler.toml
 *     (see [[d1_databases]] block).
 *  3. Deploy (push to the connected branch; Workers Builds runs
 *     `npx wrangler deploy` automatically).
 */

const PEXELS_PHOTO_HOST = 'https://api.pexels.com/v1';
const PEXELS_VIDEO_HOST = 'https://api.pexels.com/videos';
const SERP_HOST = 'https://serpapi.com/search.json';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // ── Blog routes (D1) ──────────────────────────────────────────────
    if (url.pathname === '/api/posts') {
      if (request.method === 'GET') return listPosts(env, url);
      if (request.method === 'POST') return createPost(request, env);
      return jsonError('Method not allowed', 405);
    }

    if (url.pathname.startsWith('/api/posts/')) {
      if (request.method !== 'GET') return jsonError('Method not allowed', 405);
      const slug = url.pathname.replace('/api/posts/', '');
      return getPost(slug, env);
    }

    // ── Everything else requires GET ────────────────────────────────
    if (request.method !== 'GET') {
      return jsonError('Only GET is supported', 405);
    }

    if (url.pathname.startsWith('/api/pexels/')) {
      return handlePexels(url, env);
    }

    if (url.pathname === '/api/serp') {
      return handleSerp(url, env);
    }

    return new Response('Not found', { status: 404 });
  }
};

// ── BLOG (D1) ────────────────────────────────────────────────────────────
async function listPosts(env, url) {
  if (!env.DB) return jsonError('Server misconfigured: DB binding is not set', 500);

  // Optional query params: ?status=published (default), ?category=Travel, ?featured=1
  const status = url.searchParams.get('status') || 'published';
  const category = url.searchParams.get('category');
  const featuredOnly = url.searchParams.get('featured') === '1';

  let query = `
    SELECT id, title, slug, excerpt, featured_image, featured_image_alt,
           category, tags, author_name, published_at, reading_time_minutes, is_featured
    FROM posts
    WHERE status = ?
  `;
  const params = [status];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (featuredOnly) {
    query += ' AND is_featured = 1';
  }

  query += ' ORDER BY published_at DESC';

  try {
    const { results } = await env.DB.prepare(query).bind(...params).all();
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
  } catch (err) {
    return jsonError(`DB query failed: ${err.message}`, 500);
  }
}

async function getPost(slug, env) {
  if (!env.DB) return jsonError('Server misconfigured: DB binding is not set', 500);

  try {
    const post = await env.DB
      .prepare('SELECT * FROM posts WHERE slug = ?')
      .bind(slug)
      .first();

    if (!post) return jsonError('Post not found', 404);

    // Increment view count (fire and forget, don't block the response)
    env.DB.prepare('UPDATE posts SET views = views + 1 WHERE slug = ?').bind(slug).run();

    return new Response(JSON.stringify(post), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
  } catch (err) {
    return jsonError(`DB query failed: ${err.message}`, 500);
  }
}

async function createPost(request, env) {
  if (!env.DB) return jsonError('Server misconfigured: DB binding is not set', 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const {
    title, slug, content,
    excerpt = null,
    content_format = 'markdown',
    featured_image = null,
    featured_image_alt = null,
    featured_image_caption = null,
    category = null,
    tags = null,
    author_name = 'Admin',
    author_url = null,
    meta_title = null,
    meta_description = null,
    canonical_url = null,
    robots_directive = 'index, follow',
    og_title = null,
    og_description = null,
    og_image = null,
    twitter_card_type = 'summary_large_image',
    focus_keyword = null,
    reading_time_minutes = null,
    status = 'draft',
    is_featured = 0
  } = body;

  if (!title || !slug || !content) {
    return jsonError('title, slug, and content are required', 400);
  }

  // If publishing immediately, stamp published_at now
  const published_at = status === 'published' ? new Date().toISOString() : null;

  try {
    await env.DB.prepare(`
      INSERT INTO posts (
        title, slug, excerpt, content, content_format,
        featured_image, featured_image_alt, featured_image_caption,
        category, tags, author_name, author_url,
        meta_title, meta_description, canonical_url, robots_directive,
        og_title, og_description, og_image, twitter_card_type,
        focus_keyword, reading_time_minutes,
        status, published_at, is_featured
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      title, slug, excerpt, content, content_format,
      featured_image, featured_image_alt, featured_image_caption,
      category, tags, author_name, author_url,
      meta_title, meta_description, canonical_url, robots_directive,
      og_title, og_description, og_image, twitter_card_type,
      focus_keyword, reading_time_minutes,
      status, published_at, is_featured
    ).run();

    return new Response(JSON.stringify({ success: true, slug, status }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
  } catch (err) {
    return jsonError(`DB insert failed: ${err.message}`, 500);
  }
}

// ── PEXELS ────────────────────────────────────────────────────────────────
async function handlePexels(url, env) {
  const apiKey = env.PEXELS_API_KEY;
  if (!apiKey) {
    return jsonError('Server misconfigured: PEXELS_API_KEY is not set', 500);
  }

  // "/api/pexels/v1/search"          -> ['v1', 'search']
  // "/api/pexels/v1/photos/123"      -> ['v1', 'photos', '123']
  // "/api/pexels/videos/search"      -> ['videos', 'search']
  // "/api/pexels/videos/videos/456"  -> ['videos', 'videos', '456']
  const segments = url.pathname.replace('/api/pexels/', '').split('/').filter(Boolean);
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
  url.searchParams.forEach((value, key) => upstreamUrl.searchParams.set(key, value));

  try {
    const upstreamRes = await fetch(upstreamUrl.toString(), {
      headers: { Authorization: apiKey },
      cf: { cacheTtl: 3600, cacheEverything: true }
    });
    return relay(upstreamRes);
  } catch (err) {
    return jsonError(`Upstream fetch failed: ${err.message}`, 502);
  }
}

// ── SERPAPI ───────────────────────────────────────────────────────────────
async function handleSerp(url, env) {
  const apiKey = env.SERP_API_KEY;
  if (!apiKey) {
    return jsonError('Server misconfigured: SERP_API_KEY is not set', 500);
  }

  const upstreamUrl = new URL(SERP_HOST);
  // Forward every param the client sent (engine, q, gl, hl, num,
  // departure_id, arrival_id, outbound_date, return_date, currency,
  // check_in_date, check_out_date, adults, etc.)
  url.searchParams.forEach((value, key) => upstreamUrl.searchParams.set(key, value));
  // Attach the secret key server-side — never present in the client request
  upstreamUrl.searchParams.set('api_key', apiKey);

  try {
    const upstreamRes = await fetch(upstreamUrl.toString(), {
      cf: { cacheTtl: 900, cacheEverything: true } // SerpAPI results change more often than stock photos
    });
    return relay(upstreamRes);
  } catch (err) {
    return jsonError(`Upstream fetch failed: ${err.message}`, 502);
  }
}

// ── SHARED HELPERS ───────────────────────────────────────────────────────
async function relay(upstreamRes) {
  const body = await upstreamRes.text();
  return new Response(body, {
    status: upstreamRes.status,
    headers: {
      'Content-Type': upstreamRes.headers.get('Content-Type') || 'application/json',
      'Cache-Control': 'public, max-age=900',
      ...corsHeaders()
    }
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

/**
 * IF your frontend is hosted on a different domain than this Worker,
 * update the base URLs in your client scripts:
 *
 *  pexels-loader.js:
 *    const PHOTO_BASE = 'https://discoveryconvoy.<subdomain>.workers.dev/api/pexels/v1';
 *    const VIDEO_BASE = 'https://discoveryconvoy.<subdomain>.workers.dev/api/pexels/videos';
 *
 *  serp module (fetchSerp):
 *    const res = await fetch(`https://discoveryconvoy.<subdomain>.workers.dev/api/serp?${query}`);
 *
 *  blog module:
 *    const res = await fetch('https://discoveryconvoy.<subdomain>.workers.dev/api/posts');
 */
