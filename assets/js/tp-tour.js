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
    { id: 'del-lhr', departure: 'DEL', arrival: 'LHR', cityDep: 'New Delhi', cityArr: 'London', defaultPrice: 48500, airline: 'Air India', badge: 'Hot Deal' },
    { id: 'bom-dxb', departure: 'BOM', arrival: 'DXB', cityDep: 'Mumbai', cityArr: 'Dubai', defaultPrice: 22400, airline: 'Emirates', badge: 'Top Seller' },
    { id: 'blr-sin', departure: 'BLR', arrival: 'SIN', cityDep: 'Bangalore', cityArr: 'Singapore', defaultPrice: 18900, airline: 'Singapore Air', badge: 'Best Rate' },
    { id: 'del-cdg', departure: 'DEL', arrival: 'CDG', cityDep: 'New Delhi', cityArr: 'Paris', defaultPrice: 52000, airline: 'Air France', badge: 'Recommended' }
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
          logo: flight.logo || '',
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
      logo: '',
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
         <div class="tp-tour-item mb-30">
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
               <h3 class="tp-tour-title fw-300 mb-10"><a href="${detailUrl}">${data.title || ''}</a></h3>
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
               <div class="tp-tour-footer">
                  <div class="tp-tour-price d-flex justify-content-between gap-2 align-items-center">
                     <div class="tp-tour-top-price">
                        <span class="tp-tour-prefix">From:</span>
                        <span class="tp-tour-old-price">₹${oldPriceVal.toLocaleString('en-IN')}</span>
                     </div>
                     <div class="tp-tour-bottom-price">
                        <span class="tp-tour-new-price fw-700">₹${priceVal.toLocaleString('en-IN')}</span>
                        <span class="tp-tour-suffix">/person</span>
                     </div>
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
      slidesPerView: 1.2,
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
        768:  { slidesPerView: 2, spaceBetween: 16 },
        992:  { slidesPerView: 3, spaceBetween: 18 },
        1200: { slidesPerView: 4, spaceBetween: 20 }
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
          const logoHtml = flightData.logo ? `<img ${imgAttrs(flightData.logo, '')} alt="${airline}" style="height: 24px; margin-right: 8px; vertical-align: middle; border-radius: 4px;" onerror="this.style.display='none';">` : `<i class="fa-solid fa-plane mr-5" style="color: var(--tp-theme-1);"></i>`;
          const badgeText = route.badge;
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
                     <span class="tp-flight-badge">${badgeText}</span>
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
          <div class="tp-tour-item mb-30" style="margin: 0; opacity: 0.6; filter: blur(2px);">
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