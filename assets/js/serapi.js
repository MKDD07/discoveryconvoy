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
      const logoHtml  = f.logo ? `<img src="${f.logo}" alt="${f.airline}" class="ts-flight-logo" style="height: 24px; margin-right: 8px; vertical-align: middle; border-radius: 4px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';"><span class="ts-flight-airline" style="display: none;">${f.airline}</span>` : `<span class="ts-flight-airline">${f.airline}</span>`;
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

// ── POPULAR HOTELS SYSTEM (SWIPER-TABBED) ─────────────────────────────────────
const PopularPackages = (() => {
  const INTL_LOCATIONS = [
    { id: 'london', name: 'London', query: 'London, UK', pexelsQuery: 'London hotel luxury', isIndia: false },
    { id: 'bangkok', name: 'Bangkok', query: 'Bangkok, Thailand', pexelsQuery: 'Bangkok hotel luxury', isIndia: false },
    { id: 'dubai', name: 'Dubai', query: 'Dubai, UAE', pexelsQuery: 'Dubai hotel resort luxury', isIndia: false },
    { id: 'paris', name: 'Paris', query: 'Paris, France', pexelsQuery: 'Paris hotel luxury', isIndia: false },
    { id: 'tokyo', name: 'Tokyo', query: 'Tokyo, Japan', pexelsQuery: 'Tokyo hotel luxury', isIndia: false },
    { id: 'singapore', name: 'Singapore', query: 'Singapore', pexelsQuery: 'Singapore hotel luxury resort', isIndia: false }
  ];

  const INDIA_LOCATIONS = [
    { id: 'agra', name: 'Agra', query: 'Agra, India', pexelsQuery: 'Agra Taj Mahal hotel', isIndia: true },
    { id: 'jaipur', name: 'Jaipur', query: 'Jaipur, India', pexelsQuery: 'Jaipur heritage hotel palace', isIndia: true },
    { id: 'kerala', name: 'Kerala', query: 'Kerala, India', pexelsQuery: 'Kerala resort houseboat', isIndia: true },
    { id: 'goa', name: 'Goa', query: 'Goa, India', pexelsQuery: 'Goa beach hotel resort', isIndia: true },
    { id: 'varanasi', name: 'Varanasi', query: 'Varanasi, India', pexelsQuery: 'Varanasi hotel Ganges', isIndia: true },
    { id: 'ladakh', name: 'Ladakh', query: 'Ladakh, India', pexelsQuery: 'Ladakh hotel mountain', isIndia: true }
  ];

  const HOTEL_NAMES = [
    "Grand Plaza Hotel", "The Ritz Carlton", "Hilton Riverside", 
    "Sheraton Grand Resort", "Four Seasons Oasis", "InterContinental Palace",
    "St. Regis Luxury Suite", "Hyatt Regency Tower", "Marriott Executive Stay",
    "Shangri-La Royal Sanctuary"
  ];

  // Number of hotel/package cards to render per destination
  const CARDS_PER_LOCATION = 4;

  const FLIGHT_ROUTES = [
    { id: 'del-lhr', departure: 'DEL', arrival: 'LHR', cityDep: 'New Delhi', cityArr: 'London', defaultPrice: 48500, airline: 'Air India', logo: 'https://www.gstatic.com/flights/airline_logos/70px/AI.png', badge: 'Hot Deal' },
    { id: 'bom-dxb', departure: 'BOM', arrival: 'DXB', cityDep: 'Mumbai', cityArr: 'Dubai', defaultPrice: 22400, airline: 'Emirates', logo: 'https://www.gstatic.com/flights/airline_logos/70px/EK.png', badge: 'Top Seller' },
    { id: 'blr-sin', departure: 'BLR', arrival: 'SIN', cityDep: 'Bangalore', cityArr: 'Singapore', defaultPrice: 18900, airline: 'Singapore Air', logo: 'https://www.gstatic.com/flights/airline_logos/70px/SQ.png', badge: 'Best Rate' },
    { id: 'del-cdg', departure: 'DEL', arrival: 'CDG', cityDep: 'New Delhi', cityArr: 'Paris', defaultPrice: 52000, airline: 'Air France', logo: 'https://www.gstatic.com/flights/airline_logos/70px/AF.png', badge: 'Recommended' }
  ];

  // Default fallback image whenever a remote thumbnail fails to load or is missing
  const FALLBACK_IMG = 'assets/img/tour/01.jpg';

  /**
   * Build safe <img> attributes: forces no-referrer (Google/SerpAPI-hosted
   * thumbnails are hotlink-protected and silently fail without this) and
   * swaps to a local fallback image on any load error (404, expired URL, etc).
   */
  function imgAttrs(url, fallback = FALLBACK_IMG) {
    const safeUrl = url || fallback;
    return `src="${safeUrl}" referrerpolicy="no-referrer" loading="lazy" onerror="this.onerror=null;this.src='${fallback}';"`;
  }

  async function fetchCachedFlight(route) {
    const cacheKey = `serp_flights_${route.id}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.price === 'number' && !isNaN(parsed.price)) {
          // If cached flight has no logo but the route object defines a static fallback logo, update it
          if (!parsed.logo && route.logo) {
            parsed.logo = route.logo;
            localStorage.setItem(cacheKey, JSON.stringify(parsed));
          }
          return parsed;
        }
      } catch (e) {}
    }

    try {
      const today = new Date();
      const outboundDate = new Date(today.setDate(today.getDate() + 7)).toISOString().split('T')[0];
      
      const data = await SerpAPI.searchFlights({
        departure_id: route.departure,
        arrival_id: route.arrival,
        outbound_date: outboundDate,
        currency: 'INR'
      });
      const extracted = SerpAPI.extractFlights(data, 1);
      if (extracted && extracted.length > 0) {
        const flight = extracted[0];
        let finalPrice = typeof flight.price === 'number' ? flight.price : parseInt(String(flight.price).replace(/[^0-9]/g, ''), 10);
        if (isNaN(finalPrice)) {
          finalPrice = route.defaultPrice;
        }
        const flightResult = {
          airline: flight.airline || route.airline,
          logo: flight.logo || route.logo || '',
          price: finalPrice,
          duration: flight.duration || 540,
          stops: flight.stops || 0
        };
        localStorage.setItem(cacheKey, JSON.stringify(flightResult));
        return flightResult;
      }
    } catch (err) {
      console.error(`Failed to fetch flight for ${route.id}:`, err);
    }

    const fallbackResult = {
      airline: route.airline,
      logo: route.logo || '',
      price: route.defaultPrice,
      duration: 540,
      stops: 0
    };
    return fallbackResult;
  }

  async function fetchCachedHotels(location) {
    const cacheKey = `serp_hotels_${location.id}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(item => item && typeof item.price === 'number' && !isNaN(item.price) && typeof item.oldPrice === 'number' && !isNaN(item.oldPrice))) {
          return parsed.slice(0, CARDS_PER_LOCATION);
        }
        localStorage.removeItem(cacheKey); // Discard invalid/stale legacy cache
      } catch (e) {
        console.error("Cache parsing error:", e);
      }
    }

    try {
      const today = new Date();
      today.setDate(today.getDate() + 7);
      const checkIn = today.toISOString().split('T')[0];
      const checkOut = new Date(today.setDate(today.getDate() + 5)).toISOString().split('T')[0];

      const data = await SerpAPI.searchHotels({
        q: location.query,
        check_in: checkIn,
        check_out: checkOut
      });
      
      const properties = data?.properties || [];
      if (properties && properties.length > 0) {
        const list = properties.slice(0, CARDS_PER_LOCATION).map((h, i) => {
          const name = h.name || `${location.name} ${HOTEL_NAMES[i % HOTEL_NAMES.length]}`;
          let rawPrice = h.rate_per_night?.lowest;
          let price = 120 + (i * 15);
          let isRawINR = false;

          if (rawPrice) {
            const rawStr = rawPrice.toString();
            if (rawStr.includes('₹') || rawStr.includes('Rs') || rawStr.includes('INR')) {
              isRawINR = true;
            }
            const parsedNum = parseFloat(rawStr.replace(/[^0-9.]/g, ''));
            if (!isNaN(parsedNum)) {
              price = parsedNum;
            }
          }

          // Convert to INR if the raw input was in USD (or is a low value)
          let priceInINR = price;
          if (!isRawINR) {
            if (price < 2000) {
              priceInINR = price * 83; // 83 INR per USD
            }
          }

          const rating = h.overall_rating || 4.5;
          const reviews = h.reviews || 88;
          
          // discount percentage between 15% and 40%
          const discountPercent = Math.floor(Math.random() * (40 - 15 + 1)) + 15;
          const oldPriceInINR = Math.round(priceInINR * (1 + discountPercent / 100));
          
          return {
            title: name,
            location: location.name,
            rating: parseFloat(rating),
            reviews: reviews,
            duration: "3 days",
            groupSize: "2-6",
            price: Math.round(priceInINR),
            oldPrice: Math.round(oldPriceInINR),
            discount: discountPercent,
            video: 'https://www.youtube.com/watch?v=tffjAlDbBGU',
            map: h.gps_coordinates ? `https://www.google.com/maps/search/?api=1&query=${h.gps_coordinates.latitude},${h.gps_coordinates.longitude}` : `https://maps.google.com/?q=${encodeURIComponent(name)}`,
            link: h.link || 'tour-details-3.html',
            thumbnail: h.images?.[0]?.thumbnail || ''
          };
        });
        localStorage.setItem(cacheKey, JSON.stringify(list));
        return list;
      }
    } catch (err) {
      console.warn(`SerpAPI fetch failed for hotels in ${location.name}, generating fallback data.`, err);
    }

    // Generate fallback data if SerpAPI fails
    const hashBase = location.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const list = Array.from({ length: CARDS_PER_LOCATION }, (_, i) => {
      const hotelName = `${location.name} ${HOTEL_NAMES[i % HOTEL_NAMES.length]}`;
      const priceUSD = 110 + (hashBase % 150) + i * 25;
      const priceInINR = priceUSD * 83;
      
      const discountPercent = Math.floor(Math.random() * (40 - 15 + 1)) + 15;
      const oldPriceInINR = Math.round(priceInINR * (1 + discountPercent / 100));

      return {
        title: hotelName,
        location: location.name,
        rating: parseFloat((4.4 + (i % 7) * 0.1).toFixed(1)),
        reviews: 50 + (hashBase % 200) + i * 12,
        duration: `${(i % 3) + 2} days`,
        groupSize: `2-${(i % 4) + 4}`,
        price: Math.round(priceInINR),
        oldPrice: Math.round(oldPriceInINR),
        discount: discountPercent,
        video: 'https://www.youtube.com/watch?v=tffjAlDbBGU',
        map: `https://maps.google.com/?q=${encodeURIComponent(hotelName)}`,
        link: 'tour-details-3.html',
        thumbnail: ''
      };
    });
    localStorage.setItem(cacheKey, JSON.stringify(list));
    return list;
  }

  function renderCardMarkup(data, imageUrl) {
    const starHtml = Array.from({ length: 5 }, (_, i) => {
      const active = i < Math.round(data.rating || 4.5);
      return `<span><i class="fa-solid fa-star" style="color: ${active ? '#FFC418' : '#e0e0e0'}"></i></span>`;
    }).join('');

    const priceVal = (data.price !== null && data.price !== undefined && !isNaN(data.price)) ? Number(data.price) : 0;
    const oldPriceVal = (data.oldPrice !== null && data.oldPrice !== undefined && !isNaN(data.oldPrice)) ? Number(data.oldPrice) : Math.round(priceVal * 1.3);
    const discountVal = (data.discount !== null && data.discount !== undefined && !isNaN(data.discount)) ? Number(data.discount) : 25;
    const reviewsVal = (data.reviews !== null && data.reviews !== undefined && !isNaN(data.reviews)) ? Number(data.reviews) : 0;
    const groupSizeStr = typeof data.groupSize === 'string' && data.groupSize.includes('-') ? data.groupSize : '2-6';

    const detailUrl = `tour-details-3.html?title=${encodeURIComponent(data.title || '')}&location=${encodeURIComponent(data.location || '')}&rating=${data.rating || 4.5}&reviews=${reviewsVal}&price=${priceVal}&oldPrice=${oldPriceVal}&discount=${discountVal}&duration=${encodeURIComponent(data.duration || '3 days')}&groupSize=${encodeURIComponent(groupSizeStr)}&image=${encodeURIComponent(imageUrl)}&map=${encodeURIComponent(data.map || '#')}&video=${encodeURIComponent(data.video || '')}`;

    return `
      <div class="swiper-slide">
         <div class="tp-tour-item mb-30" style="margin: 0 10px;">
            <div class="tp-tour-thumb p-relative fix">
               <a href="${detailUrl}" class="image">
                  <img ${imgAttrs(imageUrl)} alt="${data.title || ''}" style="height: 250px; object-fit: cover; width: 100%;">
               </a>
               <span class="tp-tour-wishlist">
                  <i class="fa-regular fa-heart"></i>
               </span>
               <div class="tp-tour-badge">
                  <span class="discount tp-ff-inter fw-700">- ${discountVal}% Off</span>
               </div>
               <div class="tp-tour-media-meta">
                  <a class="popup-image" href="${imageUrl}">
                     <i class="fa-regular fa-image"></i>
                  </a>
                  <a class="popup-video" href="${data.video || 'https://www.youtube.com/watch?v=tffjAlDbBGU'}">
                     <i class="fa-regular fa-square-play"></i>
                  </a>
                  <a href="${data.map || '#'}" target="_blank">
                     <i class="fa-regular fa-map"></i>
                  </a>
               </div>
            </div>
            <div class="tp-tour-content">
               <div class="tp-tour-meta d-flex align-items-center">
                  <div class="tp-tour-review mr-5">
                     ${starHtml}
                  </div>
                  <span class="tp-tour-review-score tp-ff-inter">(${reviewsVal.toString().padStart(2, '0')} Reviews)</span>
               </div>
               <h3 class="tp-tour-title fw-500 mb-10"><a href="${detailUrl}">${data.title || ''}</a></h3>
               <div class="tp-tour-info">
                  <span>
                     <i class="fa-solid fa-location-dot"></i>
                     ${data.location || ''}
                  </span>
                  <span>
                     <i class="fa-regular fa-clock"></i>
                     ${data.duration || '3 days'}
                  </span>
                  <span>
                     <i class="fa-solid fa-users"></i>
                     <span>${groupSizeStr.split('-')[0]}</span>-<span>${groupSizeStr.split('-')[1]}</span> user
                  </span>
               </div>
               <div class="tp-tour-footer d-flex justify-content-between gap-2 align-items-center">
                  <div class="tp-tour-price">
                     <div class="tp-tour-top-price">
                        <span class="tp-tour-prefix">From:</span>
                        <span class="tp-tour-old-price">₹${oldPriceVal.toLocaleString('en-IN')}</span>
                     </div>
                     <div class="tp-tour-bottom-price">
                        <span class="tp-tour-new-price fw-700">₹${priceVal.toLocaleString('en-IN')}</span>
                        <span class="tp-tour-suffix">/person</span>
                     </div>
                  </div>
                  <div class="tp-tour-btn">
                     <a href="${detailUrl}" class="tp-btn-sm fw-500 tp-ff-inter">Book A tour</a>
                  </div>
               </div>
            </div>
         </div>
      </div>
    `;
  }

  const swipers = {};

  function initSwiper(locId) {
    if (swipers[locId]) {
      swipers[locId].update();
      return;
    }

    swipers[locId] = new Swiper(`#${locId}-swiper`, {
      slidesPerView: 1,
      spaceBetween: 20,
      loop: true,
      observer: true,
      observeParents: true,
      navigation: {
        prevEl: `.${locId}-prev`,
        nextEl: `.${locId}-next`,
      },
      breakpoints: {
        480:  { slidesPerView: 1, spaceBetween: 15 },
        768:  { slidesPerView: 2, spaceBetween: 20 },
        992:  { slidesPerView: 3, spaceBetween: 24 },
        1200: { slidesPerView: 4, spaceBetween: 30 }
      }
    });
  }

  async function renderPackages() {
    const ALL_LOCATIONS = [...INTL_LOCATIONS, ...INDIA_LOCATIONS];

    // Render flight deals dynamically
    const flightDealsGrid = document.getElementById('tp-flight-deals-grid');
    if (flightDealsGrid) {
      // First show skeleton loaders for flights
      flightDealsGrid.innerHTML = FLIGHT_ROUTES.map((route, i) => `
        <div class="col-xl-3 col-lg-4 col-md-6 loading-skeleton" style="animation-delay: ${i * 0.1}s">
          <div class="tp-flight-card mb-30" style="height: 250px; background: #e0e0e0; opacity: 0.6; filter: blur(2px);"></div>
        </div>
      `).join('');

      // Fetch flight data in parallel
      const flightPromises = FLIGHT_ROUTES.map(async (route) => {
        const flightData = await fetchCachedFlight(route);
        return { route, flightData };
      });

      Promise.all(flightPromises).then(results => {
        flightDealsGrid.innerHTML = results.map(({ route, flightData }) => {
          const airline = flightData.airline;
          const logoHtml = flightData.logo ? `<img src="${flightData.logo}" alt="${airline}" style="height: 24px; margin-right: 8px; vertical-align: middle; border-radius: 4px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';"><i class="fa-solid fa-plane mr-5" style="color: var(--tp-theme-1); display: none;"></i>` : `<i class="fa-solid fa-plane mr-5" style="color: var(--tp-theme-1);"></i>`;
          const badgeText = route.badge;
          const badgeClassMap = { 'Hot Deal': 'badge-hot-deal', 'Top Seller': 'badge-top-seller', 'Best Rate': 'badge-best-rate', 'Recommended': 'badge-recommended' };
          const badgeClass = badgeClassMap[badgeText] || '';
          const priceText = `₹${flightData.price.toLocaleString('en-IN')}`;
          
          const durationH = Math.floor(flightData.duration / 60);
          const durationM = flightData.duration % 60;
          const durationStr = `${durationH}h ${durationM}m (${flightData.stops === 0 ? 'Direct' : flightData.stops + ' Stop'})`;

          return `
            <div class="col-xl-3 col-lg-4 col-md-6 wow fadeInUp" data-wow-duration=".9s" data-wow-delay=".3s">
               <div class="tp-flight-card">
                  <div class="tp-flight-logo-area">
                     <span class="tp-flight-airline">
                        ${logoHtml}
                        ${airline}
                     </span>
                     <span class="tp-flight-badge ${badgeClass}">${badgeText}</span>
                  </div>
                  <div class="tp-flight-route">
                     <div class="tp-flight-airport text-start">
                        <span class="tp-flight-code">${route.departure}</span>
                        <span class="tp-flight-city">${route.cityDep}</span>
                     </div>
                     <div class="tp-flight-duration-line">
                        <i class="fa-solid fa-plane"></i>
                        <span class="tp-flight-duration-text">${durationStr}</span>
                     </div>
                     <div class="tp-flight-airport text-end">
                        <span class="tp-flight-code">${route.arrival}</span>
                        <span class="tp-flight-city">${route.cityArr}</span>
                     </div>
                  </div>
                  <div class="tp-flight-meta">
                     <span>Round Trip</span>
                     <div class="tp-flight-price-wrap">
                        <span class="tp-tour-new-price fw-700 fs-18">${priceText}</span>
                     </div>
                  </div>
                  <a href="#" class="tp-btn-sm w-100 text-center mt-15 d-block" onclick="bookMockFlight('${route.departure} to ${route.arrival}')">Book Flight</a>
               </div>
            </div>
          `;
        }).join('');

        if (window.WOW) {
          new WOW({ live: false }).init();
        }
      }).catch(err => {
        console.error("Error rendering dynamic flights:", err);
      });
    }

    // Render skeleton loaders for layout stability
    ALL_LOCATIONS.forEach(loc => {
      const grid = document.getElementById(`${loc.id}-grid`);
      if (!grid) return;
      grid.innerHTML = Array.from({ length: CARDS_PER_LOCATION }, (_, i) => `
        <div class="swiper-slide loading-skeleton" style="animation-delay: ${i * 0.1}s">
          <div class="tp-tour-item mb-30" style="margin: 0 10px; opacity: 0.6; filter: blur(2px);">
            <div class="tp-tour-thumb p-relative fix" style="height: 250px; background: #e0e0e0;"></div>
            <div class="tp-tour-content" style="background: #f5f5f5; height: 180px;"></div>
          </div>
        </div>
      `).join('');
    });

    // Fetch images and hotel details for all locations in parallel
    const hotelPromises = ALL_LOCATIONS.map(async (loc) => {
      let pexelsImgs = [];
      try {
        if (window.PexelsAPI) {
          pexelsImgs = await window.PexelsAPI.getTravelImages(loc.pexelsQuery, CARDS_PER_LOCATION);
        }
      } catch (e) {
        console.error("Pexels failed for " + loc.name, e);
      }
      
      const hotelsData = await fetchCachedHotels(loc);
      return { loc, hotelsData, pexelsImgs };
    });

    const results = await Promise.all(hotelPromises);

    // Populate each grid
    results.forEach(({ loc, hotelsData, pexelsImgs }) => {
      const grid = document.getElementById(`${loc.id}-grid`);
      if (!grid) return;

      grid.innerHTML = hotelsData.slice(0, CARDS_PER_LOCATION).map((hotel, i) => {
        const imgUrl = hotel.thumbnail || pexelsImgs[i % (pexelsImgs.length || 1)]?.url || FALLBACK_IMG;
        return renderCardMarkup(hotel, imgUrl);
      }).join('');
    });

    // Initialize swiper for default active tabs (London for International, Agra for India)
    initSwiper('london');
    initSwiper('agra');

    // Hook into Bootstrap tab events to initialize or update swipers dynamically on tab change
    const tabEl = document.querySelectorAll('a[data-bs-toggle="tab"]');
    tabEl.forEach(tab => {
      tab.addEventListener('shown.bs.tab', (event) => {
        const targetId = event.target.getAttribute('href').replace('#', '').replace('-tab', '');
        initSwiper(targetId);
      });
    });

    // Reinitialize Magnific Popup for dynamic items
    if (window.jQuery && window.jQuery.fn.magnificPopup) {
      window.jQuery('.popup-image').magnificPopup({
        type: 'image',
        gallery: { enabled: true }
      });
      window.jQuery('.popup-video').magnificPopup({
        type: 'iframe'
      });
    }

    // Reinitialize WOW.js animations
    if (window.WOW) {
      new WOW({ live: false }).init();
    }
  }

  function init() {
    renderPackages();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init, renderPackages, fetchCachedHotels, renderCardMarkup };
})();

window.PopularPackages = PopularPackages;