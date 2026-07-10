/**
 * ============================================================================
 *  Pexels Universal Media Loader  (Photos + Videos, single script)
 * ============================================================================
 *
 * Auto-loads Pexels photos/videos into <img> and <video> tags using
 * data-attributes. No dependencies. Include once, it self-inits on DOM ready.
 *
 * ----------------------------------------------------------------------------
 * SETUP
 * ----------------------------------------------------------------------------
 * 1. Get a free key: https://www.pexels.com/api/  (200 req/hr, 20,000 req/mo)
 * 2. Set PEXELS_API_KEY below.
 * 3. Drop this script anywhere; it scans the DOM automatically on load and
 *    also watches for elements added later (MutationObserver).
 * 4. To trigger manually instead of relying on auto-scan:
 *      PexelsLoader.init();               // scan whole document
 *      PexelsLoader.init('#gallery');     // scan a container
 *      PexelsLoader.load(elementRef);     // load a single element
 *
 * ----------------------------------------------------------------------------
 * DATA ATTRIBUTES  (put these directly on <img> or <video>)
 * ----------------------------------------------------------------------------
 *  data-pexels-query          Search term. e.g. data-pexels-query="tokyo night streets"
 *  data-pexels-id              Load an exact photo/video by ID (skips search entirely)
 *  data-pexels-type            "photo" | "video"  — optional, auto-detected from tag
 *                               (<img> = photo, <video> = video) unless overridden
 *  data-pexels-index           Which result to pick from search results (0 = first). Default 0
 *  data-pexels-orientation     "landscape" | "portrait" | "square"   (search filter)
 *  data-pexels-color           e.g. "red", "blue", "#ffffff"          (photo search filter)
 *  data-pexels-locale          e.g. "en-US"                            (search filter)
 *  data-pexels-cache           "false" to bypass the in-memory cache for this element
 *  data-pexels-fallback        Fallback URL used if the API call fails
 *  data-pexels-alt             Overrides alt text (else uses Pexels photographer credit)
 *  data-pexels-lazy            "true" → only fetch/load when scrolled near viewport
 *
 *  --- Photo-only ---
 *  data-pexels-size            "tiny" | "small" | "medium" | "large" | "large2x"
 *                               | "original" | "portrait" | "landscape" | "square"
 *                               Default "large"
 *
 *  --- Video-only ---
 *  data-pexels-video-quality   "hd" | "sd" | "uhd"   Default "hd"
 *                               (picks the closest available file if exact match missing)
 *  data-pexels-poster          "auto" → sets <video poster> from Pexels' own thumbnail
 *                               (no extra API call — it's included in the video response)
 *  data-pexels-autoplay        "true"/"false" — also force-sets muted + playsinline,
 *                               required by browsers for autoplay to work
 *  data-pexels-muted           "true"/"false"  (default true if autoplay is true)
 *  data-pexels-loop            "true"/"false"
 *  data-pexels-controls        "true"/"false"
 *
 * ----------------------------------------------------------------------------
 * EVENTS  (listen on the element itself)
 * ----------------------------------------------------------------------------
 *  'pexels:loaded'   detail: { element, type, data }   — fired after src is set
 *  'pexels:error'    detail: { element, error }         — fired on failure
 *
 * ----------------------------------------------------------------------------
 * EXAMPLE
 * ----------------------------------------------------------------------------
 *  <img
 *    data-pexels-query="tokyo adventure"
 *    data-pexels-size="large"
 *    data-pexels-orientation="landscape"
 *    data-pexels-index="0"
 *    data-pexels-lazy="true"
 *    data-pexels-fallback="/img/placeholder.jpg"
 *    alt="Tokyo Adventure">
 *
 *  <video
 *    data-pexels-query="tokyo night city"
 *    data-pexels-video-quality="hd"
 *    data-pexels-poster="auto"
 *    data-pexels-autoplay="true"
 *    data-pexels-loop="true"
 *    data-pexels-lazy="true"
 *    playsinline></video>
 *
 * See example-usage.html for a full runnable example.
 * ============================================================================
 */

const PexelsLoader = (() => {
  // ── CONFIG ─────────────────────────────────────────────────────────────
  let PEXELS_API_KEY = 'y6WP5reQNH7abdL2uzdLTyV8pq0kMmF3CHf7ZNkiHo98DXIvORUOBSfi'; // 🔑 replace with your key
  const PHOTO_BASE = 'https://api.pexels.com/v1';
  const VIDEO_BASE = 'https://api.pexels.com/videos';

  const cache = new Map();      // dedupes identical in-flight/completed requests
  let observer = null;          // shared IntersectionObserver for lazy loading
  let mutObserver = null;       // watches for dynamically added elements

  // ── CORE FETCH ─────────────────────────────────────────────────────────
  async function fetchPexels(base, endpoint, params = {}) {
    const url = new URL(base + endpoint);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });

    const res = await fetch(url.toString(), {
      headers: { Authorization: PEXELS_API_KEY }
    });
    if (!res.ok) throw new Error(`Pexels API error ${res.status}: ${res.statusText}`);
    return res.json();
  }

  function cacheKey(el) {
    const d = el.dataset;
    return [
      d.pexelsType || el.tagName, d.pexelsQuery || '', d.pexelsId || '',
      d.pexelsSize || '', d.pexelsVideoQuality || '', d.pexelsOrientation || '',
      d.pexelsColor || '', d.pexelsLocale || '', d.pexelsIndex || '0'
    ].join('|');
  }

  // ── PHOTO HELPERS ──────────────────────────────────────────────────────
  function photoUrlAtSize(photo, size = 'large') {
    return photo?.src?.[size] || photo?.src?.original || '';
  }

  async function resolvePhoto(el) {
    const d = el.dataset;
    if (d.pexelsId) {
      return fetchPexels(PHOTO_BASE, `/photos/${d.pexelsId}`);
    }
    const data = await fetchPexels(PHOTO_BASE, '/search', {
      query: d.pexelsQuery,
      orientation: d.pexelsOrientation,
      color: d.pexelsColor,
      locale: d.pexelsLocale,
      per_page: 15
    });
    const idx = parseInt(d.pexelsIndex || '0', 10);
    const photo = data.photos?.[idx];
    if (!photo) throw new Error(`No photo result for "${d.pexelsQuery}" at index ${idx}`);
    return photo;
  }

  // ── VIDEO HELPERS ──────────────────────────────────────────────────────
  function bestVideoFile(files, quality = 'hd') {
    if (!files?.length) return null;
    const rank = { uhd: 3, hd: 2, sd: 1 };
    const target = rank[quality] || 2;
    // exact quality match, widest first
    const exact = files.filter(f => f.quality === quality).sort((a, b) => b.width - a.width);
    if (exact.length) return exact[0];
    // else closest quality by rank distance, widest first
    const sorted = [...files].sort((a, b) => {
      const distA = Math.abs((rank[a.quality] || 0) - target);
      const distB = Math.abs((rank[b.quality] || 0) - target);
      return distA - distB || b.width - a.width;
    });
    return sorted[0];
  }

  async function resolveVideo(el) {
    const d = el.dataset;
    if (d.pexelsId) {
      return fetchPexels(VIDEO_BASE, `/videos/${d.pexelsId}`);
    }
    const data = await fetchPexels(VIDEO_BASE, '/search', {
      query: d.pexelsQuery,
      orientation: d.pexelsOrientation,
      locale: d.pexelsLocale,
      per_page: 15
    });
    const idx = parseInt(d.pexelsIndex || '0', 10);
    const video = data.videos?.[idx];
    if (!video) throw new Error(`No video result for "${d.pexelsQuery}" at index ${idx}`);
    return video;
  }

  // ── APPLY TO ELEMENT ───────────────────────────────────────────────────
  function applyPhoto(el, photo) {
    const size = el.dataset.pexelsSize || 'large';
    el.src = photoUrlAtSize(photo, size);
    el.alt = el.dataset.pexelsAlt || el.alt || `Photo by ${photo.photographer} on Pexels`;
  }

  function applyVideo(el, video) {
    const quality = el.dataset.pexelsVideoQuality || 'hd';
    const file = bestVideoFile(video.video_files, quality);
    if (!file) throw new Error('No playable video file found');

    el.src = file.link;

    if (el.dataset.pexelsPoster === 'auto' && video.image) {
      el.poster = video.image;
    }

    const flag = (name, def = false) => {
      const v = el.dataset[name];
      return v === undefined ? def : v === 'true';
    };

    const autoplay = flag('pexelsAutoplay', false);
    el.autoplay = autoplay;
    el.muted = flag('pexelsMuted', autoplay); // browsers require muted for autoplay
    el.loop = flag('pexelsLoop', false);
    el.controls = flag('pexelsControls', !autoplay);
    if (autoplay) el.setAttribute('playsinline', ''); // iOS requirement

    if (autoplay) {
      // load() ensures new src is picked up before play() on some browsers
      el.load();
      el.play().catch(() => {}); // ignore autoplay-block errors
    }
  }

  // ── LOAD ONE ELEMENT ───────────────────────────────────────────────────
  async function load(el) {
    if (!el || el.dataset.pexelsLoaded === 'true') return;

    const isVideo = (el.dataset.pexelsType || el.tagName.toLowerCase()) === 'video'
      || el.tagName === 'VIDEO';
    const useCache = el.dataset.pexelsCache !== 'false';
    const key = cacheKey(el);

    try {
      let dataPromise;
      if (useCache && cache.has(key)) {
        dataPromise = cache.get(key);
      } else {
        dataPromise = isVideo ? resolveVideo(el) : resolvePhoto(el);
        if (useCache) cache.set(key, dataPromise);
      }

      const data = await dataPromise;
      isVideo ? applyVideo(el, data) : applyPhoto(el, data);

      el.dataset.pexelsLoaded = 'true';
      el.dispatchEvent(new CustomEvent('pexels:loaded', {
        detail: { element: el, type: isVideo ? 'video' : 'photo', data }
      }));
    } catch (err) {
      if (useCache) cache.delete(key);
      const fallback = el.dataset.pexelsFallback;
      if (fallback) el.src = fallback;
      el.dispatchEvent(new CustomEvent('pexels:error', { detail: { element: el, error: err } }));
      console.error('[PexelsLoader]', err.message, el);
    }
  }

  // ── LAZY LOADING (shared IntersectionObserver) ────────────────────────
  function ensureObserver() {
    if (observer) return observer;
    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          load(entry.target);
        }
      });
    }, { rootMargin: '200px' }); // start loading a bit before it's visible
    return observer;
  }

  // ── SCAN & INIT ─────────────────────────────────────────────────────────
  function scan(root = document) {
    const els = root.querySelectorAll(
      '[data-pexels-query]:not([data-pexels-loaded]), [data-pexels-id]:not([data-pexels-loaded])'
    );
    els.forEach(el => {
      if (el.dataset.pexelsLazy === 'true') {
        ensureObserver().observe(el);
      } else {
        load(el);
      }
    });
  }

  function init(root) {
    const target = typeof root === 'string' ? document.querySelector(root) : (root || document);
    if (!target) return;
    scan(target);

    // watch for elements added later (e.g. dynamic cards, infinite scroll)
    if (!mutObserver) {
      mutObserver = new MutationObserver(muts => {
        muts.forEach(m => {
          m.addedNodes.forEach(node => {
            if (node.nodeType !== 1) return;
            if (node.dataset && (node.dataset.pexelsQuery || node.dataset.pexelsId)) scan(node.parentNode || document);
            else if (node.querySelector) scan(node);
          });
        });
      });
      mutObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function setApiKey(key) {
    PEXELS_API_KEY = key;
  }

  // ── AUTO-INIT ──────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }

  // ── EXPORTS ────────────────────────────────────────────────────────────
  return { init, load, setApiKey, scan };
})();

window.PexelsLoader = PexelsLoader;
