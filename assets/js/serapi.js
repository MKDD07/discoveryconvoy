/**
 * SerpAPI Integration — Travel Search Module
 * ===========================================
 * Fetches real-time travel data (flights, hotels, vacations, destinations)
 * via SerpAPI and renders dynamic results on index-6.html.
 *
 * SETUP:
 *  1. Replace SERP_API_KEY with your SerpAPI key.
 *     Get one at: https://serpapi.com/manage-api-key
 *  2. Because SerpAPI requires server-side requests (CORS), this module
 *     routes calls through a lightweight proxy endpoint at /api/serp-proxy
 *     — OR — uses the SerpAPI JSON endpoint directly for demo/localhost.
 *
 * TABS SUPPORTED:  home | flights | international | vacations
 */

const SerpAPI = (() => {
  // ── CONFIG ─────────────────────────────────────────────────────────────────
  const SERP_API_KEY   = '7f83c49c4ab7a773e871e42237fd4775f124a8abb77e148899d0bbad6d307d69';   // 🔑 Replace with your key
  const SERP_BASE_URL  = 'https://serpapi.com/search.json';
  // If you run a backend proxy, point this to your server route:
  const PROXY_URL      = null; // e.g. 'https://yourserver.com/api/serp'

  // ── PRIVATE HELPERS ────────────────────────────────────────────────────────

  /**
   * Core SerpAPI fetch via proxy (if set) or direct endpoint.
   * @param {Object} params  - SerpAPI query parameters
   */
  async function fetchSerp(params) {
    const query = new URLSearchParams({ ...params, api_key: SERP_API_KEY });
    let url = `${SERP_BASE_URL}?${query}`;
    if (!PROXY_URL) {
      url = `https://corsproxy.io/?` + encodeURIComponent(url);
    } else {
      url = `${PROXY_URL}?${query}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`SerpAPI error ${res.status}: ${res.statusText}`);
    return res.json();
  }

  // ── SECTION: HOME ──────────────────────────────────────────────────────────
  /**
   * Fetch top travel destinations / organic results for homepage.
   * @param {string} query  - e.g. "best travel destinations 2025"
   * @param {string} [gl]   - Country code (e.g. "us")
   * @param {string} [hl]   - Language code (e.g. "en")
   */
  async function searchHome(query = 'top travel destinations', gl = 'us', hl = 'en') {
    return fetchSerp({ engine: 'google', q: query, gl, hl, num: 10 });
  }

  // ── SECTION: FLIGHTS ───────────────────────────────────────────────────────
  /**
   * Search for flights using SerpAPI Google Flights engine.
   * @param {string} departure_id  - IATA airport code (e.g. "JFK")
   * @param {string} arrival_id    - IATA airport code (e.g. "LHR")
   * @param {string} outbound_date - "YYYY-MM-DD"
   * @param {string} [return_date] - "YYYY-MM-DD" for round trips
   * @param {string} [currency]    - e.g. "USD"
   * @param {string} [hl]
   */
  async function searchFlights({
    departure_id,
    arrival_id,
    outbound_date,
    return_date,
    currency = 'USD',
    hl       = 'en'
  }) {
    const params = {
      engine:         'google_flights',
      departure_id,
      arrival_id,
      outbound_date,
      currency,
      hl
    };
    if (return_date) params.return_date = return_date;
    return fetchSerp(params);
  }

  // ── SECTION: INTERNATIONAL ─────────────────────────────────────────────────
  /**
   * Search international travel results / destinations.
   * @param {string} destination  - e.g. "Japan travel guide"
   * @param {string} [gl]
   */
  async function searchInternational(destination, gl = 'us', hl = 'en') {
    return fetchSerp({
      engine: 'google',
      q:      `international travel ${destination}`,
      gl,
      hl,
      num:    10
    });
  }

  /**
   * Fetch Google Hotels for international destinations.
   * @param {string} q          - Destination name (e.g. "Paris France")
   * @param {string} check_in   - "YYYY-MM-DD"
   * @param {string} check_out  - "YYYY-MM-DD"
   * @param {number} [adults]
   * @param {string} [currency]
   */
  async function searchHotels({ q, check_in, check_out, adults = 2, currency = 'USD', hl = 'en' }) {
    return fetchSerp({
      engine:    'google_hotels',
      q,
      check_in_date:  check_in,
      check_out_date: check_out,
      adults,
      currency,
      hl
    });
  }

  // ── SECTION: VACATIONS ─────────────────────────────────────────────────────
  /**
   * Search vacation packages.
   * @param {string} query   - e.g. "Maldives vacation package"
   * @param {string} [gl]
   */
  async function searchVacations(query, gl = 'us', hl = 'en') {
    return fetchSerp({
      engine: 'google',
      q:      `vacation packages ${query}`,
      gl,
      hl,
      num:    10
    });
  }

  // ── RENDER HELPERS ─────────────────────────────────────────────────────────

  /**
   * Extract top organic results from a SerpAPI response.
   * @param {Object} data     - Raw SerpAPI JSON
   * @param {number} [max=6]
   * @returns {Array}         - Array of { title, link, snippet, thumbnail }
   */
  function extractOrganicResults(data, max = 4) {
    const results = data?.organic_results || [];
    return results.slice(0, max).map(r => ({
      title:     r.title     || '',
      link:      r.link      || '#',
      snippet:   r.snippet   || '',
      thumbnail: r.thumbnail || ''
    }));
  }

  /**
   * Extract best flight options from a Google Flights response.
   * @param {Object} data
   * @returns {Array}  - Array of { airline, price, duration, stops, departure, arrival }
   */
  function extractFlights(data, max = 4) {
    const flights = data?.best_flights || data?.other_flights || [];
    return flights.slice(0, max).map(f => {
      const seg = (f.flights || [])[0] || {};
      return {
        airline:    seg.airline              || f.airline_logo && 'Airline' || 'Unknown',
        logo:       seg.airline_logo         || f.airline_logo || '',
        price:      f.price                  || 'N/A',
        currency:   f.price_insights?.currency || 'USD',
        duration:   f.total_duration          || seg.duration || 0,
        stops:      f.layovers?.length        || 0,
        departure:  seg.departure_airport?.time || '',
        arrival:    seg.arrival_airport?.time   || '',
        from:       seg.departure_airport?.name || '',
        to:         seg.arrival_airport?.name   || ''
      };
    });
  }

  /**
   * Extract hotel results from a Google Hotels response.
   * @param {Object} data
   * @returns {Array}
   */
  function extractHotels(data, max = 4) {
    const hotels = data?.properties || [];
    return hotels.slice(0, max).map(h => ({
      name:       h.name       || '',
      rating:     h.overall_rating || 0,
      reviews:    h.reviews        || 0,
      price:      h.rate_per_night?.lowest || 'N/A',
      link:       h.link           || '#',
      thumbnail:  h.images?.[0]?.thumbnail || ''
    }));
  }

  // ── EXPORTS ────────────────────────────────────────────────────────────────
  return {
    searchHome,
    searchFlights,
    searchInternational,
    searchHotels,
    searchVacations,
    extractOrganicResults,
    extractFlights,
    extractHotels
  };
})();

window.SerpAPI = SerpAPI;

// ── CONTROLLER: ties SerpAPI + PexelsAPI to the DOM ─────────────────────────

const TravelSearch = (() => {
  // Active tab
  let currentTab = 'home';

  // DOM refs (populated on init)
  let searchInput, searchBtn, tabBtns, resultsContainer, loadingEl, errorEl;

  // Default fallback image used whenever a remote thumbnail fails to load
  const FALLBACK_IMG = 'assets/img/tour/default.jpg';

  /**
   * Attach a robust onerror fallback + no-referrer policy to any <img> tag markup.
   * Google/SerpAPI-hosted thumbnails frequently fail to load without
   * referrerpolicy="no-referrer" (hotlink protection), and can also 404/expire —
   * so every image gets both a referrer fix and a graceful fallback.
   */
  function imgAttrs(url, fallback = FALLBACK_IMG) {
    const safeUrl = url || fallback;
    return `src="${safeUrl}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${fallback}';"`;
  }

  // ── RENDER FUNCTIONS ───────────────────────────────────────────────────────

  function showLoading(msg = 'Searching…') {
    if (loadingEl) { loadingEl.style.display = 'flex'; loadingEl.querySelector('.ts-loading-text').textContent = msg; }
    if (resultsContainer) resultsContainer.innerHTML = '';
    if (errorEl)   errorEl.style.display = 'none';
  }

  function hideLoading() {
    if (loadingEl) loadingEl.style.display = 'none';
  }

  function showError(msg) {
    hideLoading();
    if (errorEl) { errorEl.style.display = 'flex'; errorEl.querySelector('.ts-error-text').textContent = msg; }
  }

  /**
   * Render generic card grid (organic results + pexels images).
   */
  async function renderOrganicGrid(results, pexelsQuery) {
    let images = [];
    try {
      if (window.PexelsAPI) {
        images = await window.PexelsAPI.getTravelImages(pexelsQuery, results.length || 4);
      }
    } catch (_) { /* images optional */ }

    if (!results.length) {
      resultsContainer.innerHTML = `<div class="ts-no-results"><p>No results found. Try a different search.</p></div>`;
      return;
    }

    const cards = results.slice(0, 4).map((r, i) => {
      const img    = images[i];
      const imgUrl = img ? img.url : FALLBACK_IMG;
      const imgAlt = img ? img.alt : r.title;
      return `
        <div class="ts-card wow fadeInUp" data-wow-duration=".9s" data-wow-delay="${0.1 + i * 0.1}s">
          <div class="ts-card-thumb">
            <img ${imgAttrs(imgUrl)} alt="${imgAlt}" loading="lazy">
          </div>
          <div class="ts-card-body">
            <h3 class="ts-card-title"><a href="${r.link}" target="_blank" rel="noopener">${r.title}</a></h3>
            <p class="ts-card-snippet">${r.snippet}</p>
            <a href="${r.link}" target="_blank" rel="noopener" class="ts-card-link">
              Explore <svg width="13" height="12" viewBox="0 0 13 12" fill="none"><path d="M11.49 5.89H.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.18 10.89S11.88 7.21 11.88 5.89C11.88 4.58 7.18.9 7.18.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>
          </div>
        </div>`;
    });

    resultsContainer.innerHTML = `<div class="ts-grid">${cards.join('')}</div>`;
    if (window.WOW) new WOW({ live: false }).init();
  }

  /**
   * Render flight results.
   */
  async function renderFlights(flights) {
    if (!flights.length) {
      resultsContainer.innerHTML = `<div class="ts-no-results"><p>No flights found. Try different dates or airports.</p></div>`;
      return;
    }

    const cards = flights.slice(0, 4).map((f, i) => {
      const durationH = Math.floor(f.duration / 60);
      const durationM = f.duration % 60;
      const stopLabel = f.stops === 0 ? 'Nonstop' : `${f.stops} stop${f.stops > 1 ? 's' : ''}`;
      const logoHtml  = f.logo ? `<img ${imgAttrs(f.logo, '')} alt="${f.airline}" class="ts-flight-logo" onerror="this.style.display='none';">` : `<span class="ts-flight-airline">${f.airline}</span>`;
      return `
        <div class="ts-flight-card wow fadeInUp" data-wow-duration=".9s" data-wow-delay="${0.1 + i * 0.1}s">
          <div class="ts-flight-header">
            ${logoHtml}
            <span class="ts-flight-stop ts-stop-${f.stops === 0 ? 'direct' : 'layover'}">${stopLabel}</span>
          </div>
          <div class="ts-flight-route">
            <div class="ts-flight-leg">
              <span class="ts-leg-time">${f.departure || '—'}</span>
              <span class="ts-leg-name">${f.from || 'Origin'}</span>
            </div>
            <div class="ts-flight-divider">
              <svg viewBox="0 0 80 20" fill="none"><path d="M0 10h75M65 3l10 7-10 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>${durationH}h ${durationM}m</span>
            </div>
            <div class="ts-flight-leg ts-leg-right">
              <span class="ts-leg-time">${f.arrival || '—'}</span>
              <span class="ts-leg-name">${f.to || 'Destination'}</span>
            </div>
          </div>
          <div class="ts-flight-footer">
            <span class="ts-flight-price">$${f.price}</span>
            <a href="#" class="ts-btn-book">Book Now</a>
          </div>
        </div>`;
    });

    resultsContainer.innerHTML = `<div class="ts-flight-grid">${cards.join('')}</div>`;
    if (window.WOW) new WOW({ live: false }).init();
  }

  /**
   * Render hotel / vacation package cards.
   */
  async function renderHotels(hotels, pexelsQuery) {
    let images = [];
    try {
      if (window.PexelsAPI) {
        images = await window.PexelsAPI.getTravelImages(pexelsQuery + ' hotel', hotels.length || 4);
      }
    } catch (_) {}

    if (!hotels.length) {
      resultsContainer.innerHTML = `<div class="ts-no-results"><p>No hotels found. Try a different destination.</p></div>`;
      return;
    }

    const cards = hotels.slice(0, 4).map((h, i) => {
      const img     = images[i];
      const imgUrl  = h.thumbnail || (img ? img.url : FALLBACK_IMG);
      const stars   = Math.round(h.rating);
      const starHtml = Array.from({ length: 5 }, (_, si) =>
        `<i class="fa${si < stars ? 's' : 'r'} fa-star"></i>`
      ).join('');
      return `
        <div class="ts-card wow fadeInUp" data-wow-duration=".9s" data-wow-delay="${0.1 + i * 0.1}s">
          <div class="ts-card-thumb">
            <img ${imgAttrs(imgUrl)} alt="${h.name}" loading="lazy">
            <span class="ts-card-badge">${h.price !== 'N/A' ? '$' + h.price + '/night' : 'See price'}</span>
          </div>
          <div class="ts-card-body">
            <h3 class="ts-card-title"><a href="${h.link}" target="_blank" rel="noopener">${h.name}</a></h3>
            <div class="ts-card-rating">
              <span class="ts-stars">${starHtml}</span>
              <span class="ts-reviews">(${h.reviews} reviews)</span>
            </div>
            <a href="${h.link}" target="_blank" rel="noopener" class="ts-card-link">
              View Deal <svg width="13" height="12" viewBox="0 0 13 12" fill="none"><path d="M11.49 5.89H.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.18 10.89S11.88 7.21 11.88 5.89C11.88 4.58 7.18.9 7.18.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>
          </div>
        </div>`;
    });

    resultsContainer.innerHTML = `<div class="ts-grid">${cards.join('')}</div>`;
    if (window.WOW) new WOW({ live: false }).init();
  }

  // ── SEARCH HANDLERS ────────────────────────────────────────────────────────

  async function doSearch() {
    const query = (searchInput?.value || '').trim();
    if (!query) return;

    showLoading('Finding the best results…');

    try {
      switch (currentTab) {
        // ── HOME ──────────────────────────────────────────────────────────────
        case 'home': {
          const data    = await SerpAPI.searchHome(query);
          const results = SerpAPI.extractOrganicResults(data, 4);
          await renderOrganicGrid(results, query + ' travel destination');
          break;
        }

        // ── FLIGHTS ───────────────────────────────────────────────────────────
        case 'flights': {
          // Parse "JFK to LHR" style queries into IATA codes
          const parts    = query.toUpperCase().match(/([A-Z]{3})\s+(?:TO|[-→])\s+([A-Z]{3})/);
          const depId    = parts?.[1] || 'JFK';
          const arrId    = parts?.[2] || 'LHR';
          const today    = new Date();
          const depDate  = today.toISOString().split('T')[0];
          const retDate  = new Date(today.setDate(today.getDate() + 7)).toISOString().split('T')[0];

          const data    = await SerpAPI.searchFlights({
            departure_id:  depId,
            arrival_id:    arrId,
            outbound_date: depDate,
            return_date:   retDate
          });
          const flights = SerpAPI.extractFlights(data, 4);
          await renderFlights(flights);
          break;
        }

        // ── INTERNATIONAL ─────────────────────────────────────────────────────
        case 'international': {
          const data    = await SerpAPI.searchInternational(query);
          const results = SerpAPI.extractOrganicResults(data, 4);
          await renderOrganicGrid(results, query + ' international travel');
          break;
        }

        // ── VACATIONS ─────────────────────────────────────────────────────────
        case 'vacations': {
          // Try hotel API first
          const today    = new Date();
          const checkIn  = today.toISOString().split('T')[0];
          const checkOut = new Date(today.setDate(today.getDate() + 5)).toISOString().split('T')[0];

          let hotels = [];
          try {
            const data = await SerpAPI.searchHotels({ q: query, check_in: checkIn, check_out: checkOut });
            hotels = SerpAPI.extractHotels(data, 4);
          } catch (_) {}

          if (hotels.length) {
            await renderHotels(hotels, query);
          } else {
            // Fallback to organic vacation search
            const data    = await SerpAPI.searchVacations(query);
            const results = SerpAPI.extractOrganicResults(data, 4);
            await renderOrganicGrid(results, query + ' vacation package');
          }
          break;
        }
      }
    } catch (err) {
      console.error('[TravelSearch]', err);
      showError('Could not load results. Please check your API keys or try again.');
    }

    hideLoading();
  }

  // ── INIT ───────────────────────────────────────────────────────────────────

  function init() {
    searchInput      = document.getElementById('ts-search-input');
    searchBtn        = document.getElementById('ts-search-btn');
    tabBtns          = document.querySelectorAll('.ts-tab-btn');
    resultsContainer = document.getElementById('ts-results');
    loadingEl        = document.getElementById('ts-loading');
    errorEl          = document.getElementById('ts-error');

    if (!searchBtn) return; // page doesn't have the search section

    // Tab switching
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        updatePlaceholder();
        if (resultsContainer) resultsContainer.innerHTML = '';
        if (errorEl) errorEl.style.display = 'none';
      });
    });

    // Search button
    searchBtn.addEventListener('click', doSearch);

    // Enter key
    if (searchInput) {
      searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') doSearch();
      });
    }

    // Load default home results on page load
    if (searchInput) {
      searchInput.value = 'best travel destinations 2025';
      doSearch();
    }
  }

  /** Update placeholder text based on active tab */
  function updatePlaceholder() {
    if (!searchInput) return;
    const placeholders = {
      home:          'Search destinations, attractions…',
      flights:       'Enter route, e.g. JFK to LHR',
      international: 'Search international destinations…',
      vacations:     'Search vacation packages, resorts…'
    };
    searchInput.placeholder = placeholders[currentTab] || 'Search…';
  }

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init, doSearch };
})();

window.TravelSearch = TravelSearch;