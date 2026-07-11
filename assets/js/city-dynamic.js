/**
 * City Dynamic — Reads ?city= from URL and populates city-details-2.html
 * ======================================================================
 * 1. Updates breadcrumb title with city name
 * 2. Fetches Pexels banner image for the city
 * 3. Replaces all tour card images with Pexels images for that city
 * 4. Searches hotels via SerpAPI for that city
 */

(function () {
  'use strict';

  // ── Read city from URL ──────────────────────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  const city = params.get('city');
  if (!city) return; // no city param, keep static content

  const cityName = decodeURIComponent(city);

  // ── 1. Update breadcrumb title ──────────────────────────────────────────
  const breadcrumbTitle = document.querySelector('.tp-breadcrumb-title');
  if (breadcrumbTitle) {
    breadcrumbTitle.textContent = cityName;
  }

  // ── 2. Update page <title> ─────────────────────────────────────────────
  document.title = cityName + ' — Turie Travel';

  // ── 3. Fetch Pexels banner image ───────────────────────────────────────
  async function loadBannerImage() {
    try {
      const photos = await PexelsAPI.searchPhotos(cityName + ' travel landscape', 1);
      if (photos.length > 0) {
        const bannerUrl = PexelsAPI.getPhotoUrl(photos[0], 'large2x');
        const breadcrumbArea = document.querySelector('.tp-breadcrumb-area');
        if (breadcrumbArea && bannerUrl) {
          breadcrumbArea.style.backgroundImage = 'url(' + bannerUrl + ')';
          breadcrumbArea.setAttribute('data-background', bannerUrl);
        }
      }
    } catch (err) {
      console.warn('[CityDynamic] Banner image fetch failed:', err);
    }
  }

  // ── 4. Replace tour card images with Pexels images ─────────────────────
  async function loadCardImages() {
    try {
      const cards = document.querySelectorAll('.tp-tour-item');
      if (cards.length === 0) return;

      const photos = await PexelsAPI.searchPhotos(cityName + ' tourism', cards.length);
      cards.forEach(function (card, i) {
        const photo = photos[i] || photos[0];
        if (!photo) return;

        const imgUrl = PexelsAPI.getPhotoUrl(photo, 'large');
        const thumbUrl = PexelsAPI.getPhotoUrl(photo, 'medium');

        // Main card image
        const imgEl = card.querySelector('.tp-tour-thumb img');
        if (imgEl && imgUrl) {
          imgEl.src = imgUrl;
          imgEl.alt = cityName + ' tour';
        }

        // Popup image link
        const popupLink = card.querySelector('.popup-image');
        if (popupLink && imgUrl) {
          popupLink.href = imgUrl;
        }
      });

      // Reinitialize Magnific Popup for dynamic images
      if (window.jQuery && window.jQuery.fn.magnificPopup) {
        window.jQuery('.popup-image').magnificPopup({
          type: 'image',
          gallery: { enabled: true }
        });
      }
    } catch (err) {
      console.warn('[CityDynamic] Card images fetch failed:', err);
    }
  }

  // ── 5. Search hotels via SerpAPI ───────────────────────────────────────
  async function loadHotels() {
    try {
      if (typeof SerpAPI === 'undefined') {
        console.warn('[CityDynamic] SerpAPI not available');
        return;
      }

      const CACHE_KEY = 'city_hotels_' + cityName.toLowerCase().replace(/\s+/g, '_');
      const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

      let hotels = [];

      // Check cache first
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < CACHE_TTL) {
          hotels = parsed.data;
        }
      }

      // Fetch if not cached
      if (hotels.length === 0) {
        const data = await SerpAPI.searchHotels(cityName);
        hotels = SerpAPI.extractHotels(data, 8);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: hotels }));
      }

      if (hotels.length === 0) return;

      // Find or create hotels container
      renderHotelsSection(hotels);
    } catch (err) {
      console.warn('[CityDynamic] Hotels fetch failed:', err);
    }
  }

  function renderHotelsSection(hotels) {
    // Insert hotels section after the category city area
    const categoryArea = document.querySelector('.tp-category-city-area');
    if (!categoryArea) return;

    // Check if we already injected
    if (document.getElementById('city-dynamic-hotels')) return;

    const section = document.createElement('div');
    section.id = 'city-dynamic-hotels';
    section.className = 'pt-80 pb-80';
    section.style.background = '#f8f9fa';

    let hotelCards = '';
    hotels.forEach(function (hotel) {
      const stars = '★'.repeat(Math.round(hotel.rating || 0));
      const rawPrice = hotel.price || '';
      const usdNum = parseFloat(rawPrice.replace(/[^0-9.]/g, ''));
      const price = !isNaN(usdNum) ? Math.round(usdNum * 83) : 0;
      const oldPrice = Math.round(price * 1.3);
      const priceText = price > 0 ? '₹' + price.toLocaleString('en-IN') : rawPrice || 'N/A';
      const thumbnail = hotel.thumbnail || 'assets/img/tour/city/card/card.jpg';

      const hotelDetailUrl = 'tour-details-3.html?title=' + encodeURIComponent(hotel.name || '') + 
                             '&location=' + encodeURIComponent(cityName) + 
                             '&rating=' + (hotel.rating || 4.5) + 
                             '&reviews=' + (hotel.reviews || 0) + 
                             '&price=' + price + 
                             '&oldPrice=' + oldPrice + 
                             '&image=' + encodeURIComponent(thumbnail) + 
                             '&map=' + encodeURIComponent(hotel.link || '#');

      hotelCards += '\
        <div class="col-xl-3 col-lg-4 col-md-6 mb-30">\
          <div class="tp-tour-item" style="border-radius:16px; overflow:hidden; background:#fff; box-shadow:0 4px 20px rgba(0,0,0,0.08);">\
            <div class="tp-tour-thumb p-relative fix">\
              <a href="' + hotelDetailUrl + '" class="image">\
                <img src="' + thumbnail + '" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=\'assets/img/tour/city/card/card.jpg\';" alt="' + (hotel.name || 'Hotel') + '" style="width:100%; height:220px; object-fit:cover;">\
              </a>\
            </div>\
            <div class="tp-tour-content" style="padding:20px;">\
              <h3 class="tp-tour-title fw-500 mb-10" style="font-size:16px;">\
                <a href="' + hotelDetailUrl + '">' + (hotel.name || 'Hotel') + '</a>\
              </h3>\
              <div class="tp-tour-meta d-flex align-items-center mb-10">\
                <span style="color:#FFC418; font-size:14px; margin-right:8px;">' + stars + '</span>\
                <span class="tp-tour-review-score tp-ff-inter" style="font-size:13px;">(' + (hotel.reviews || 0) + ' reviews)</span>\
              </div>\
              <div class="tp-tour-footer d-flex justify-content-between align-items-center">\
                <div class="tp-tour-price">\
                  <span class="tp-tour-new-price fw-700" style="font-size:18px;">' + priceText + '</span>\
                  <span class="tp-tour-suffix" style="font-size:12px; color:#999;">/night</span>\
                </div>\
                <a href="' + hotelDetailUrl + '" class="tp-btn-sm fw-500 tp-ff-inter">View Hotel</a>\
              </div>\
            </div>\
          </div>\
        </div>';
    });

    section.innerHTML = '\
      <div class="container">\
        <div class="row mb-40">\
          <div class="col-12">\
            <div class="tp-about-section-title p-relative pb-20">\
              <span class="tp-section-5-subtitle fw-700 d-flex align-items-center mb-15">\
                <i class="fa-solid fa-hotel mr-5" style="color: #FFC418;"></i>\
                Hotels in ' + cityName + '\
              </span>\
              <h2 class="tp-section-title fw-600">Where to Stay</h2>\
            </div>\
          </div>\
        </div>\
        <div class="row">' + hotelCards + '</div>\
      </div>';

    categoryArea.parentNode.insertBefore(section, categoryArea.nextSibling);

    // Reinitialize WOW.js
    if (window.WOW) {
      new WOW({ live: false }).init();
    }
  }

  // ── 6. Update tour heading to show city name ───────────────────────────
  function updateTourHeading() {
    const headings = document.querySelectorAll('.tp-tour-details-title');
    headings.forEach(function (h) {
      if (h.textContent.includes('Tours in')) {
        h.textContent = h.textContent.replace(/Tours in \w+/, 'Tours in ' + cityName);
      }
    });
    // Also update "Showing X tours" text
    const filterResults = document.querySelectorAll('.tp-tour-filter-result');
    filterResults.forEach(function (el) {
      if (el.textContent.includes('Showing')) {
        // keep as is
      }
    });
  }

  // ── INIT ───────────────────────────────────────────────────────────────
  function init() {
    updateTourHeading();
    loadBannerImage();
    loadCardImages();
    loadHotels();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
