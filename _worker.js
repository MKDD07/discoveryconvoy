export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname.startsWith('/api/pexels/')) {
      const pexelsPath = url.pathname.replace('/api/pexels', '');
      const pexelsUrl = 'https://api.pexels.com' + pexelsPath + url.search;
      const res = await fetch(pexelsUrl, {
        headers: { Authorization: env.PEXELS_API_KEY }
      });
      return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (url.pathname.startsWith('/api/serp')) {
      const params = new URLSearchParams(url.search);
      params.set('api_key', env.SERP_API_KEY);
      const serpUrl = 'https://serpapi.com/search.json?' + params.toString();
      const res = await fetch(serpUrl);
      return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return env.ASSETS.fetch(request);
  }
}
