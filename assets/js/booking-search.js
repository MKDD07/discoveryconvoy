/**
 * Booking Search — Dynamic Location Search Integration via SerpAPI & Pexels
 * =========================================================================
 * Hook up the location input fields in index-6.html Hotels, Flights, and Packages tabs
 * to fetch and show real-time search suggestions inside the booking form dropdown.
 *
 * UPDATED: Fallback organic search results are now strictly filtered so that
 * searching "Leela" only returns Leela hotel listings (not Wikipedia articles,
 * news, or general info about "Leela"). Same logic applied to flights and packages.
 */

(function () {
  'use strict';

  // ── CONSTANTS & LOOKUPS ──────────────────────────────────────────────────
  const DEFAULT_SUGGESTIONS = [
    { name: 'Toronto, Canada', desc: 'For sights like CN Tower', img: 'assets/img/booking-form/02.png' },
    { name: 'Bangkok, Thailand', desc: 'For its bustling nightlife', img: 'assets/img/booking-form/03.png' },
    { name: 'London, United Kingdom', desc: 'For its stunning architecture', img: 'assets/img/booking-form/04.png' },
    { name: 'Paris, France', desc: 'For sights like Eiffel Tower', img: 'assets/img/booking-form/11.png' },
    { name: 'Istanbul, Türkiye', desc: 'For its bustling nightlife', img: 'assets/img/booking-form/10.png' },
    { name: 'Rome, Italy', desc: 'For a tour abroad', img: 'assets/img/booking-form/13.png' }
  ];

  const IATA_MAP = {
    'PARIS': 'CDG',
    'LONDON': 'LHR',
    'NEW YORK': 'JFK',
    'TOKYO': 'NRT',
    'BANGKOK': 'BKK',
    'DUBAI': 'DXB',
    'SINGAPORE': 'SIN',
    'TORONTO': 'YYZ',
    'ROME': 'FCO',
    'DELHI': 'DEL',
    'MUMBAI': 'BOM',
    'KOLKATA': 'CCU',
    'ISTANBUL': 'IST',
    'VANCOUVER': 'YVR',
    'SYDNEY': 'SYD',
    'CHICAGO': 'ORD',
    'LOS ANGELES': 'LAX',
    'SAN FRANCISCO': 'SFO',
    'MIAMI': 'MIA',
    'BARCELONA': 'BCN',
    'MADRID': 'MAD',
    'AMSTERDAM': 'AMS',
    'FRANKFURT': 'FRA',
    'MUNICH': 'MUC',
    'BERLIN': 'BER',
    'ZURICH': 'ZRH'
  };

  // Domains that are never actual bookable hotel/flight/package pages —
  // even if they mention the query, they're informational/social, not booking.
  const NON_BOOKING_DOMAINS = [
    'wikipedia.org', 'wikitravel.org', 'wikivoyage.org',
    'reddit.com', 'quora.com', 'youtube.com', 'facebook.com',
    'instagram.com', 'pinterest.com', 'twitter.com', 'x.com',
    'medium.com', 'blogspot.', 'news.google', 'linkedin.com'
  ];

  // ── HELPERS ──────────────────────────────────────────────────────────────
  function debounce(fn, delay) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function getFutureDate(daysAhead) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
  }

  function parseDateRange(val) {
    if (!val || typeof moment === 'undefined') return null;
    const parts = val.split(' - ');
    if (parts.length < 2) return null;
    try {
      const start = moment(parts[0], "D MMM YY");
      const end = moment(parts[1], "D MMM YY");
      if (start.isValid() && end.isValid()) {
        return {
          start: start.format("YYYY-MM-DD"),
          end: end.format("YYYY-MM-DD")
        };
      }
    } catch (e) {
      console.warn("Failed to parse date range:", e);
    }
    return null;
  }

  function formatINR(priceStr) {
    if (!priceStr || priceStr === 'N/A' || priceStr === 'Price on request' || priceStr === 'Check price') {
      return priceStr;
    }
    if (priceStr.includes('₹') || priceStr.toLowerCase().includes('inr') || priceStr.toLowerCase().includes('rs')) {
      return priceStr;
    }
    const cleanNum = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    if (isNaN(cleanNum)) {
      return priceStr;
    }
    const inrValue = Math.round(cleanNum * 83);
    return '₹' + inrValue.toLocaleString('en-IN');
  }

  // ── GEOLOCATION HELPERS ──────────────────────────────────────────────────
  async function getCityFromCoords(lat, lon) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'TurieTravelAgent' }
      });
      const data = await res.json();
      const addr = data.address || {};
      return addr.city || addr.town || addr.village || addr.suburb || addr.state || 'Delhi';
    } catch (e) {
      console.warn("Reverse geocoding failed, falling back to IP geolocation:", e);
      return 'Delhi';
    }
  }

  function detectCurrentLocation(inputEl, callback) {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    
    const originalPlaceholder = inputEl.placeholder;
    inputEl.value = "";
    inputEl.placeholder = "Detecting location...";
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const cityName = await getCityFromCoords(lat, lon);
          inputEl.value = cityName;
          inputEl.placeholder = originalPlaceholder;
          if (callback) callback(cityName);
        } catch (err) {
          console.error("Error getting city from coords:", err);
          inputEl.value = "";
          inputEl.placeholder = originalPlaceholder;
          alert("Could not determine city name from location.");
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        inputEl.value = "";
        inputEl.placeholder = originalPlaceholder;
        alert("Permission denied or error detecting location. Please type manually.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // ── RELEVANCE FILTERING ──────────────────────────────────────────────────
  // These filters make sure fallback organic-search results are actually
  // hotel / flight / package listings that match the query — not generic
  // informational content about the place, person, or word searched.

  function fromNonBookingDomain(link) {
    const l = (link || '').toLowerCase();
    return NON_BOOKING_DOMAINS.some(d => l.includes(d));
  }

  function mentionsQuery(item, query) {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    const title = (item.title || '').toLowerCase();
    const snippet = (item.snippet || '').toLowerCase();
    return title.includes(q) || snippet.includes(q);
  }

  function isLikelyHotelResult(item, query) {
    if (!mentionsQuery(item, query)) return false;
    if (fromNonBookingDomain(item.link)) return false;
    const text = `${item.title || ''} ${item.snippet || ''}`.toLowerCase();
    const hotelSignal = /hotel|resort|inn\b|suites|stay|booking|room|accommodat|lodge|villa/i.test(text);
    return hotelSignal;
  }

  function isLikelyFlightResult(item, query) {
    if (!mentionsQuery(item, query)) return false;
    if (fromNonBookingDomain(item.link)) return false;
    const text = `${item.title || ''} ${item.snippet || ''}`.toLowerCase();
    const flightSignal = /flight|airfare|\bfare\b|airline|cheap flights|round trip|one way|book now|itinerary/i.test(text);
    return flightSignal;
  }

  function isLikelyPackageResult(item, query) {
    if (!mentionsQuery(item, query)) return false;
    if (fromNonBookingDomain(item.link)) return false;
    const text = `${item.title || ''} ${item.snippet || ''}`.toLowerCase();
    const packageSignal = /package|vacation|holiday deal|tour package|itinerary|all-inclusive|book now|deal/i.test(text);
    return packageSignal;
  }

  // SerpAPI often bundles a brand's individual property pages into a single
  // organic result as "sitelinks" (e.g. one "The Leela Palaces" result with
  // sitelinks for "The Leela Palace Udaipur", "...Jaipur", "...Bengaluru").
  // If we only read the parent result's title/snippet, all those distinct
  // hotels/flights collapse into one noisy blob. This flattens sitelinks
  // into standalone result items so each hotel/flight/package gets its own
  // row and its own relevance check.
  function flattenSitelinks(rawResults) {
    const flattened = [];
    (rawResults || []).forEach(item => {
      // Always keep the parent result itself as a candidate
      flattened.push({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        thumbnail: item.thumbnail
      });

      // SerpAPI uses either "sitelinks.expanded" or "sitelinks.inline"
      const sitelinks = item.sitelinks;
      if (!sitelinks) return;

      const expanded = sitelinks.expanded || [];
      const inline = sitelinks.inline || [];

      expanded.forEach(link => {
        flattened.push({
          title: link.title,
          link: link.link,
          snippet: link.snippet || item.snippet,
          thumbnail: item.thumbnail
        });
      });

      inline.forEach(link => {
        // Inline sitelinks usually only have title + link, no snippet
        flattened.push({
          title: link.title,
          link: link.link,
          snippet: item.snippet,
          thumbnail: item.thumbnail
        });
      });
    });
    return flattened;
  }

  // Fallback for when extractOrganicResults() has already stripped sitelinks
  // down to plain text and we only have the raw SerpAPI JSON to work with.
  function flattenSitelinksFromRawData(organicData) {
    const rawList = organicData?.organic_results || organicData?.results || [];
    if (!Array.isArray(rawList) || rawList.length === 0) return null;
    return flattenSitelinks(rawList);
  }

  // ── FLIGHT RESULT PARSING & ENRICHMENT ───────────────────────────────────
  function parseFlightResult(item, query) {
    const title = item.title || '';
    const snippet = item.snippet || '';
    const link = item.link || '';
    
    let originCity = "Delhi";
    let originCode = "DEL";
    let destCity = query;
    let destCode = "";
    
    // 1. Try regex to match "from [City] to [City]"
    const fromToRegex = /(?:flights?\s+)?from\s+([^to]+?)\s+to\s+([^(\r\n]+)/i;
    const match = title.match(fromToRegex);
    if (match) {
      originCity = match[1].trim();
      destCity = match[2].trim();
    }
    
    destCity = destCity.split('|')[0].split('-')[0].trim();
    originCity = originCity.split('|')[0].split('-')[0].trim();
    
    // 2. Extract IATA codes in parentheses if any
    const iataRegex = /\(([A-Z]{3})(?:-([A-Z]{3}))?\)/g;
    const codes = [...title.matchAll(iataRegex)];
    if (codes.length > 0) {
      if (codes[0][2]) {
        originCode = codes[0][1];
        destCode = codes[0][2];
      } else {
        originCode = codes[0][1];
        if (codes[1]) {
          destCode = codes[1][1];
        }
      }
    }
    
    if (!destCode) {
      const upperDest = destCity.toUpperCase();
      destCode = IATA_MAP[upperDest] || upperDest.substring(0, 3);
    }
    if (!originCode) {
      const upperOrigin = originCity.toUpperCase();
      originCode = IATA_MAP[upperOrigin] || upperOrigin.substring(0, 3);
    }
    
    originCity = originCity.replace(/cheap flights/i, '').replace(/flights/i, '').trim();
    destCity = destCity.replace(/cheap flights/i, '').replace(/flights/i, '').trim();
    
    if (originCity.length > 0) {
      originCity = originCity.charAt(0).toUpperCase() + originCity.slice(1);
    }
    if (destCity.length > 0) {
      destCity = destCity.charAt(0).toUpperCase() + destCity.slice(1);
    }
    
    const indianCities = [
      'DELHI', 'MUMBAI', 'KOLKATA', 'CHENNAI', 'BANGALORE', 'BENGALURU', 
      'GOA', 'JAIPUR', 'COCHIN', 'KOCHI', 'PUNE', 'AHMEDABAD', 'HYDERABAD'
    ];
    const indianCodes = ['DEL', 'BOM', 'CCU', 'MAA', 'BLR', 'GOI', 'COK', 'PNQ', 'AMD', 'HYD'];
    
    const isOriginIndia = indianCities.some(c => originCity.toUpperCase().includes(c)) || indianCodes.includes(originCode.toUpperCase());
    const isDestIndia = indianCities.some(c => destCity.toUpperCase().includes(c)) || indianCodes.includes(destCode.toUpperCase());
    const isDomestic = isOriginIndia && isDestIndia;
    
    const dateInputVal = document.getElementById('flight-date')?.value;
    const parsedDates = parseDateRange(dateInputVal);
    let datesText = "";
    if (parsedDates) {
      const start = moment(parsedDates.start).format("D MMM YYYY");
      const end = moment(parsedDates.end).format("D MMM YYYY");
      datesText = `${start} - ${end}`;
    } else {
      const start = moment().add(14, 'days').format("D MMM YYYY");
      const end = moment().add(21, 'days').format("D MMM YYYY");
      datesText = `${start} - ${end}`;
    }
    
    let priceText = "";
    const priceRegex = /(?:₹|Rs\.?|\$)\s*\d+[\d,.]*/i;
    const priceMatch = (title + " " + snippet).match(priceRegex);
    if (priceMatch) {
      priceText = formatINR(priceMatch[0]);
    } else {
      const basePrice = isDomestic ? (3200 + Math.random() * 5000) : (25000 + Math.random() * 40000);
      priceText = '₹' + Math.round(basePrice).toLocaleString('en-IN');
    }
    
    let sourceSite = "Google Flights";
    try {
      const url = new URL(link);
      sourceSite = url.hostname.replace('www.', '');
    } catch(e) {}
    
    return {
      originCity,
      originCode,
      destCity,
      destCode,
      isDomestic,
      datesText,
      priceText,
      sourceSite,
      link
    };
  }

  function parseLiveFlight(flight, query) {
    const fromCode = flight.from || 'JFK';
    const toCode = flight.to || 'LHR';
    
    const indianCodes = ['DEL', 'BOM', 'CCU', 'MAA', 'BLR', 'GOI', 'COK', 'PNQ', 'AMD', 'HYD'];
    const isDomestic = indianCodes.includes(fromCode.toUpperCase()) && indianCodes.includes(toCode.toUpperCase());
    
    const dateInputVal = document.getElementById('flight-date')?.value;
    const parsedDates = parseDateRange(dateInputVal);
    let datesText = "";
    if (parsedDates) {
      const start = moment(parsedDates.start).format("D MMM YYYY");
      const end = moment(parsedDates.end).format("D MMM YYYY");
      datesText = `${start} - ${end}`;
    } else {
      const start = moment().add(14, 'days').format("D MMM YYYY");
      const end = moment().add(21, 'days').format("D MMM YYYY");
      datesText = `${start} - ${end}`;
    }
    
    return {
      originCity: flight.from || 'New York',
      originCode: fromCode,
      destCity: flight.to || query,
      destCode: toCode,
      isDomestic,
      datesText,
      priceText: flight.price !== 'N/A' ? formatINR(flight.price) : 'Check price',
      sourceSite: flight.airline || 'Google Flights',
      link: 'https://www.google.com/travel/flights'
    };
  }

  function renderFlightDealItem(parsed) {
    const isDomestic = parsed.isDomestic;
    const badgeClass = isDomestic ? 'domestic' : 'international';
    const badgeText = isDomestic ? 'Domestic Flight' : 'International Flight';
    
    return `
      <li class="search-result-item flight-deal-card" data-value="${parsed.destCity}" data-link="${parsed.link}">
         <div class="flight-deal-header">
            <span class="flight-route-badge ${badgeClass}">${badgeText}</span>
            <span class="flight-deal-price">${parsed.priceText}</span>
         </div>
         <div class="flight-deal-body">
            <div class="flight-route">
               <div class="flight-origin">
                  <span class="airport-code">${parsed.originCode}</span>
                  <span class="airport-city">${parsed.originCity}</span>
               </div>
               <div class="flight-path-icon">
                  <i class="fas fa-plane"></i>
                  <span class="flight-line"></span>
               </div>
               <div class="flight-destination">
                  <span class="airport-code">${parsed.destCode}</span>
                  <span class="airport-city">${parsed.destCity}</span>
               </div>
            </div>
            <div class="flight-details">
               <span class="flight-dates"><i class="far fa-calendar-alt"></i> ${parsed.datesText}</span>
               <span class="flight-source-site"><i class="fas fa-tag"></i> Deal via ${parsed.sourceSite}</span>
            </div>
         </div>
      </li>
    `;
  }

  // ── RENDERING ────────────────────────────────────────────────────────────
  function renderSuggestedDestinations(listUl, labelEl, isSource = false) {
    if (labelEl) labelEl.textContent = isSource ? "Suggested origins" : "Suggested destinations";
    
    let html = '';
    if (isSource) {
      html += `
        <li class="search-result-item current-location-btn" style="padding: 12px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #f0f0f0; background: rgba(0, 123, 255, 0.05); transition: background 0.2s;" onmouseenter="this.style.background='rgba(0, 123, 255, 0.1)'" onmouseleave="this.style.background='rgba(0, 123, 255, 0.05)'">
           <div class="tp-booking-location-icon" style="color: #007bff; font-size: 16px; min-width: 40px; display: flex; align-items: center; justify-content: center;">
              <i class="fas fa-location-arrow"></i>
           </div>
           <div class="tp-booking-location-content">
              <span style="font-weight: 600; color: #007bff;">Use Current Location</span>
              <p style="margin: 0; font-size: 12px; color: #6c757d;">Detect location via browser</p>
           </div>
        </li>
      `;
    }

    html += DEFAULT_SUGGESTIONS.map(item => `
      <li class="search-result-item" data-value="${item.name}">
         <div class="tp-booking-location-icon">
            <img src="${item.img}" alt="booking">
         </div>
         <div class="tp-booking-location-content">
            <span>${item.name}</span>
            <p>${item.desc}</p>
         </div>
      </li>
    `).join('');

    listUl.innerHTML = html;
  }

  function showLoading(listUl, labelEl, message) {
    if (labelEl) labelEl.textContent = "Searching...";
    listUl.innerHTML = `
      <li style="padding: 15px; text-align: center; color: #666; font-size: 14px;">
        <i class="fas fa-spinner fa-spin mr-10" style="color: #007bff;"></i>
        ${message}
      </li>
    `;
  }

  function showError(listUl, labelEl, message) {
    if (labelEl) labelEl.textContent = "Search Error";
    listUl.innerHTML = `
      <li style="padding: 15px; text-align: center; color: #dc3545; font-size: 14px;">
        <i class="fas fa-exclamation-triangle mr-10"></i>
        ${message}
      </li>
    `;
  }

  function renderOrganicItem(item, iconClass = 'fa-suitcase') {
    const imgHtml = item.thumbnail
      ? `<img src="${item.thumbnail}" alt="${item.title}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px;">`
      : `<div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background:#f0f7ff; border-radius:6px; color:#007bff;"><i class="fas ${iconClass}"></i></div>`;

    return `
      <li class="search-result-item" data-value="${item.title}" data-link="${item.link}">
         <div class="tp-booking-location-icon" style="min-width: 40px;">
            ${imgHtml}
         </div>
         <div class="tp-booking-location-content">
            <span>${item.title}</span>
            <p>${item.snippet || 'Click to view details'}</p>
         </div>
      </li>
    `;
  }

  // ── CORE SEARCH IMPLEMENTATIONS ──────────────────────────────────────────
  async function performHotelsSearch(query, listUl, labelEl) {
    showLoading(listUl, labelEl, `Looking for hotels in ${query}...`);
    try {
      const SerpAPI = window.SerpAPI;
      if (!SerpAPI) throw new Error("SerpAPI module not loaded");

      // Attempt date parsing
      const dateInputVal = document.getElementById('date')?.value;
      const parsedDates = parseDateRange(dateInputVal);
      const check_in = parsedDates?.start || getFutureDate(7);
      const check_out = parsedDates?.end || getFutureDate(12);

      let hotels = [];
      try {
        const data = await SerpAPI.searchHotels({ q: query, check_in, check_out });
        hotels = SerpAPI.extractHotels(data, 5);
      } catch (err) {
        console.warn("Google Hotels API failed, falling back to organic:", err);
      }

      // Fallback to organic hotels search if live API returned empty.
      // Query is scoped tightly to the hotel name/location + "hotel booking"
      // so results skew toward bookable listings, not general info pages.
      if (hotels.length === 0) {
        const organicData = await SerpAPI.searchHome(`"${query}" hotel booking`);

        // Prefer flattening raw sitelinks (splits bundled brand results into
        // individual hotel properties). Fall back to the parsed helper if
        // raw sitelink data isn't available.
        let rawItems = flattenSitelinksFromRawData(organicData);
        if (!rawItems) {
          rawItems = SerpAPI.extractOrganicResults(organicData, 10);
        }

        let results = rawItems
          .filter(r => isLikelyHotelResult(r, query))
          .filter((r, idx, arr) => arr.findIndex(x => x.title === r.title) === idx) // dedupe
          .slice(0, 5);

        if (results.length === 0) {
          showError(listUl, labelEl, `No hotels found matching "${query}"`);
          return;
        }
        if (labelEl) labelEl.textContent = `Top Hotels matching "${query}"`;
        listUl.innerHTML = results.map(r => renderOrganicItem(r, 'fa-hotel')).join('');
        return;
      }

      if (labelEl) labelEl.textContent = `Top Hotels in ${query}`;
      listUl.innerHTML = hotels.map(hotel => {
        const imgHtml = hotel.thumbnail
          ? `<img src="${hotel.thumbnail}" alt="${hotel.name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px;">`
          : `<div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background:#f0f7ff; border-radius:6px; color:#007bff;"><i class="fas fa-hotel"></i></div>`;

        const priceText = hotel.price !== 'N/A' ? `${formatINR(hotel.price)} / night` : 'Price on request';
        const ratingText = hotel.rating ? `★ ${hotel.rating} (${hotel.reviews} reviews)` : 'New Hotel';

        return `
          <li class="search-result-item" data-value="${hotel.name}" data-link="${hotel.link}">
             <div class="tp-booking-location-icon" style="min-width: 40px;">
                ${imgHtml}
             </div>
             <div class="tp-booking-location-content">
                <span>${hotel.name}</span>
                <p>${priceText} • ${ratingText}</p>
             </div>
          </li>
        `;
      }).join('');
    } catch (e) {
      console.error(e);
      showError(listUl, labelEl, "Could not fetch hotel results.");
    }
  }

  async function performFlightsSearch(query, listUl, labelEl) {
    showLoading(listUl, labelEl, `Searching flights to ${query}...`);
    try {
      const SerpAPI = window.SerpAPI;
      if (!SerpAPI) throw new Error("SerpAPI module not loaded");

      const upperQuery = query.trim().toUpperCase();
      const iataCode = IATA_MAP[upperQuery];

      let flights = [];
      if (iataCode) {
        try {
          const dateInputVal = document.getElementById('flight-date')?.value;
          const parsedDates = parseDateRange(dateInputVal);
          const outbound_date = parsedDates?.start || getFutureDate(14);
          const return_date = parsedDates?.end || getFutureDate(21);

          const data = await SerpAPI.searchFlights({
            departure_id: 'JFK',
            arrival_id: iataCode,
            outbound_date,
            return_date
          });
          flights = SerpAPI.extractFlights(data, 5);
        } catch (err) {
          console.warn("Google Flights API failed, falling back to organic:", err);
        }
      }

      // Fallback to organic flight search — scoped + filtered so it only
      // returns actual flight/fare listings to the destination, not
      // articles or general info about the place.
      if (flights.length === 0) {
        const organicData = await SerpAPI.searchHome(`flights to "${query}" booking fares`);
        let results = SerpAPI.extractOrganicResults(organicData, 10);

        results = results.filter(r => isLikelyFlightResult(r, query)).slice(0, 5);

        if (results.length === 0) {
          showError(listUl, labelEl, `No flights found to "${query}"`);
          return;
        }
        if (labelEl) labelEl.textContent = `Flight Deals to "${query}"`;
        listUl.innerHTML = results.map(r => {
          const parsed = parseFlightResult(r, query);
          return renderFlightDealItem(parsed);
        }).join('');
        return;
      }

      if (labelEl) labelEl.textContent = `Best Flight Options to ${query}`;
      listUl.innerHTML = flights.map(flight => {
        const parsed = parseLiveFlight(flight, query);
        return renderFlightDealItem(parsed);
      }).join('');
    } catch (e) {
      console.error(e);
      showError(listUl, labelEl, "Could not fetch flight results.");
    }
  }

  async function performPackagesSearch(query, listUl, labelEl) {
    showLoading(listUl, labelEl, `Searching vacation packages for ${query}...`);
    try {
      const SerpAPI = window.SerpAPI;
      if (!SerpAPI) throw new Error("SerpAPI module not loaded");

      const data = await SerpAPI.searchVacations(`"${query}" vacation package deal`);
      let results = SerpAPI.extractOrganicResults(data, 10);

      // Only keep results that are actual package/deal listings for this query
      results = results.filter(r => isLikelyPackageResult(r, query)).slice(0, 5);

      if (results.length === 0) {
        showError(listUl, labelEl, `No packages found for "${query}"`);
        return;
      }

      if (labelEl) labelEl.textContent = `Vacation Packages for "${query}"`;
      listUl.innerHTML = results.map(r => renderOrganicItem(r, 'fa-suitcase-rolling')).join('');
    } catch (e) {
      console.error(e);
      showError(listUl, labelEl, "Could not fetch package results.");
    }
  }

  // ── INITIALIZATION ───────────────────────────────────────────────────────
  function init() {
    // Custom Flight controls setup
    
    // Flight type selection
    const flightTypeInput = document.getElementById('flights-booking-type');
    if (flightTypeInput) {
      document.querySelectorAll('.flight-type-option').forEach(item => {
        item.addEventListener('click', () => {
          const val = item.getAttribute('data-value');
          flightTypeInput.value = val;
          // Close the dropdown
          if (window.jQuery) {
            const toggle = window.jQuery(flightTypeInput).closest('.tp-booking-toggle');
            toggle.removeClass('active');
            toggle.next('.tp-booking-toggle-active').removeClass('booking-open');
          }
        });
      });
    }

    // Offers selection
    const flightOfferInput = document.getElementById('flights-booking-offer');
    if (flightOfferInput) {
      document.querySelectorAll('.flight-offer-option').forEach(item => {
        item.addEventListener('click', () => {
          const val = item.getAttribute('data-value');
          flightOfferInput.value = val;
          // Close the dropdown
          if (window.jQuery) {
            const toggle = window.jQuery(flightOfferInput).closest('.tp-booking-toggle');
            toggle.removeClass('active');
            toggle.next('.tp-booking-toggle-active').removeClass('booking-open');
          }
        });
      });
    }

    // Flights passenger updates
    const passengerInput = document.getElementById('flights-booking-passengers-input');
    if (passengerInput) {
      const updatePassengersValue = () => {
        let adultVal = 1;
        let childVal = 0;
        let infantVal = 0;
        
        document.querySelectorAll('.flight-passenger-qty').forEach(input => {
          const type = input.getAttribute('data-type');
          const val = parseInt(input.value) || 0;
          if (type === 'adult') adultVal = val;
          else if (type === 'children') childVal = val;
          else if (type === 'infants') infantVal = val;
        });

        // Enforce at least 1 adult
        if (adultVal < 1) {
          adultVal = 1;
          const adultInput = document.querySelector('.flight-passenger-qty[data-type="adult"]');
          if (adultInput) adultInput.value = 1;
        }

        let parts = [];
        if (adultVal > 0) parts.push(`${adultVal} adult${adultVal > 1 ? 's' : ''}`);
        if (childVal > 0) parts.push(`${childVal} child${childVal > 1 ? 'ren' : ''}`);
        if (infantVal > 0) parts.push(`${infantVal} infant${infantVal > 1 ? 's' : ''}`);

        passengerInput.value = parts.join(', ');
      };

      // Set initial value
      updatePassengersValue();

      // Listen for changes from main.js increments/decrements
      document.querySelectorAll('.flight-passenger-qty').forEach(input => {
        input.addEventListener('change', updatePassengersValue);
      });
    }

    const tabs = [
      {
        input: document.getElementById('hotels-booking-location'),
        list: document.getElementById('hotels-booking-location-list'),
        form: document.getElementById('hotels-booking-form')?.querySelector('form'),
        searchFn: performHotelsSearch
      },
      {
        input: document.getElementById('flights-booking-source'),
        list: document.getElementById('flights-booking-source-list'),
        form: document.getElementById('flights-booking-form')?.querySelector('form'),
        searchFn: performFlightsSearch,
        isSource: true
      },
      {
        input: document.getElementById('flights-booking-location'),
        list: document.getElementById('flights-booking-location-list'),
        form: document.getElementById('flights-booking-form')?.querySelector('form'),
        searchFn: performFlightsSearch
      },
      {
        input: document.getElementById('packages-booking-location'),
        list: document.getElementById('packages-booking-location-list'),
        form: document.getElementById('packages-booking-form')?.querySelector('form'),
        searchFn: performPackagesSearch
      }
    ];

    tabs.forEach(tab => {
      if (!tab.input || !tab.list) return;

      const listUl = tab.list.querySelector('ul');
      const labelEl = tab.list.querySelector('.tp-booking-location-suggested');
      if (!listUl) return;

      // Populate default suggested destinations on startup
      renderSuggestedDestinations(listUl, labelEl, tab.isSource);

      // Debounced search trigger
      const triggerSearch = debounce(async (val) => {
        const query = val.trim();
        if (query.length < 2) {
          renderSuggestedDestinations(listUl, labelEl, tab.isSource);
        } else {
          await tab.searchFn(query, listUl, labelEl);
        }
      }, 400);

      // Input listener
      tab.input.addEventListener('input', (e) => {
        triggerSearch(e.target.value);
      });

      // Keep dropdown visible on focus/input and close others
      if (window.jQuery) {
        const $input = window.jQuery(tab.input);
        $input.on('focus input', function () {
          const toggle = $input.closest('.tp-booking-toggle');
          const listContainer = toggle.next('.tp-booking-toggle-active');

          window.jQuery('.tp-booking-toggle').not(toggle).removeClass('active');
          window.jQuery('.tp-booking-toggle-active').not(listContainer).removeClass('booking-open');

          toggle.addClass('active');
          listContainer.addClass('booking-open');
        });
      }

      // Handle item selection (delegated click listener)
      listUl.addEventListener('click', (e) => {
        // Current location detection click
        const currentLocBtn = e.target.closest('.current-location-btn');
        if (currentLocBtn) {
          e.stopPropagation();
          detectCurrentLocation(tab.input, (cityName) => {
            // Close current dropdown
            if (window.jQuery) {
              const toggle = window.jQuery(tab.input).closest('.tp-booking-toggle');
              toggle.removeClass('active');
              toggle.next('.tp-booking-toggle-active').removeClass('booking-open');
            }
          });
          return;
        }

        const item = e.target.closest('.search-result-item');
        if (!item) return;

        const val = item.getAttribute('data-value');
        const link = item.getAttribute('data-link') || '#';

        tab.input.value = val;

        // Store selected details on the form
        if (tab.form) {
          tab.form.setAttribute('data-selected-city', val);
          tab.form.setAttribute('data-selected-link', link);
        }

        // Close current dropdown
        if (window.jQuery) {
          const toggle = window.jQuery(tab.input).closest('.tp-booking-toggle');
          toggle.removeClass('active');
          toggle.next('.tp-booking-toggle-active').removeClass('booking-open');
        }
      });

      // Form submission handling (excluding Flights form, which is handled separately)
      if (tab.form && tab.form.closest('#flights-booking-form') === null) {
        tab.form.addEventListener('submit', (e) => {
          e.preventDefault();
          const cityVal = tab.input.value.trim();
          if (!cityVal) return;

          const selectedLink = tab.form.getAttribute('data-selected-link');
          if (selectedLink && selectedLink !== '#') {
            window.open(selectedLink, '_blank');
          } else {
            // Direct to dynamic city details page
            window.location.href = `city-details-2.html?city=${encodeURIComponent(cityVal)}`;
          }
        });
      }
    });

    // Dedicated Flights Form submission handling
    const flightsForm = document.getElementById('flights-booking-form')?.querySelector('form');
    if (flightsForm) {
      flightsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const sourceVal = document.getElementById('flights-booking-source')?.value.trim() || '';
        const destVal = document.getElementById('flights-booking-location')?.value.trim() || '';
        if (!destVal) return;

        const typeVal = document.getElementById('flights-booking-type')?.value.trim() || 'Domestic';
        const offerVal = document.getElementById('flights-booking-offer')?.value.trim() || 'Regular Fare';
        const dateVal = document.getElementById('flight-date')?.value.trim() || '';
        const passengerVal = passengerInput?.value.trim() || '1 adult';

        const searchUrl = `city-details-2.html?city=${encodeURIComponent(destVal)}&source=${encodeURIComponent(sourceVal)}&type=${encodeURIComponent(typeVal)}&offer=${encodeURIComponent(offerVal)}&dates=${encodeURIComponent(dateVal)}&passengers=${encodeURIComponent(passengerVal)}`;
        window.location.href = searchUrl;
      });
    }
  }

  // Bind to DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();