// 20 destinations — edit freely. `label` is what shows on the card,
// `query` is what gets sent to Pexels (kept separate so you can tune
// search terms without changing the display name), `link` is the
// detail-page URL for that card.
const DESTINATIONS = [
  { label: 'Shibuya Crossing',   query: 'Shibuya crossing Tokyo',       link: 'city-details-2.html' },
  { label: 'Eiffel Tower',       query: 'Eiffel Tower Paris',           link: 'city-details-2.html' },
  { label: 'Santorini',          query: 'Santorini Greece',             link: 'city-details-2.html' },
  { label: 'Machu Picchu',       query: 'Machu Picchu Peru',            link: 'city-details-2.html' },
  { label: 'Bali Rice Terraces', query: 'Bali rice terraces',           link: 'city-details-2.html' },
  { label: 'Grand Canyon',       query: 'Grand Canyon Arizona',         link: 'city-details-2.html' },
  { label: 'Great Wall of China',query: 'Great Wall of China',          link: 'city-details-2.html' },
  { label: 'Petra',              query: 'Petra Jordan',                 link: 'city-details-2.html' },
  { label: 'Venice Canals',      query: 'Venice canals Italy',          link: 'city-details-2.html' },
  { label: 'Dubai Skyline',      query: 'Dubai skyline',                link: 'city-details-2.html' },
  { label: 'Taj Mahal',          query: 'Taj Mahal India',              link: 'city-details-2.html' },
  { label: 'Sydney Opera House', query: 'Sydney Opera House',           link: 'city-details-2.html' },
  { label: 'Iceland Waterfalls', query: 'Iceland waterfall landscape',  link: 'city-details-2.html' },
  { label: 'Amalfi Coast',       query: 'Amalfi Coast Italy',           link: 'city-details-2.html' },
  { label: 'Kyoto Temples',      query: 'Kyoto temple Japan',           link: 'city-details-2.html' },
  { label: 'New York City',      query: 'New York City skyline',        link: 'city-details-2.html' },
  { label: 'Cape Town',          query: 'Cape Town Table Mountain',     link: 'city-details-2.html' },
  { label: 'Swiss Alps',         query: 'Swiss Alps mountains',         link: 'city-details-2.html' },
  { label: 'Maldives',           query: 'Maldives overwater bungalow',  link: 'city-details-2.html' },
  { label: 'Marrakech',          query: 'Marrakech Morocco',            link: 'city-details-2.html' },
];
 
const FALLBACK_IMG = 'https://images.pexels.com/photos/2325446/pexels-photo-2325446.jpeg?auto=compress&cs=tinysrgb&w=800';
 
function cardMarkup(dest, imgUrl, photographer) {
  return `
    <div class="swiper-slide">
      <div class="tp-tour-dayfilter-item tp-destination-one-item tp-destination-4-item p-relative">
        <div class="tp-destination-one-thumb tp-tour-dayfilter-thumb p-relative fix">
          <img class="w-100" src="${imgUrl}" alt="${dest.label}" loading="lazy">
          ${photographer ? `<span class="credit">Photo: ${photographer}</span>` : ''}
          <div class="tp-destination-one-content tp-destination-content">
            <div class="tp-destination-one-left">
              <h2 class="tp-destination-title common-underline mb-0"><a href="${dest.link}">${dest.label}</a></h2>
            </div>
            <div class="tp-bounce">
              <a href="${dest.link}" class="tp-destination-two-btn">
                <svg width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.4922 5.8927H0.900117" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M7.17626 10.8854C7.17626 10.8854 11.8838 7.20828 11.8838 5.89264C11.8838 4.57699 7.17618 0.900024 7.17618 0.900024" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span></span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}
 
function skeletonMarkup(dest) {
  return `
    <div class="swiper-slide" data-slot="${dest.label}">
      <div class="tp-tour-dayfilter-item tp-destination-one-item tp-destination-4-item p-relative">
        <div class="tp-destination-one-thumb tp-tour-dayfilter-thumb p-relative fix skeleton">
          <img class="w-100" src="${FALLBACK_IMG}" alt="${dest.label} loading">
          <div class="tp-destination-one-content tp-destination-content">
            <div class="tp-destination-one-left">
              <h2 class="tp-destination-title common-underline mb-0"><a href="${dest.link}">${dest.label}</a></h2>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}
 
async function renderDestinations() {
  const grid = document.getElementById('destination-grid');
 
  // 1. Paint instantly with skeleton/fallback images so layout doesn't jump.
  grid.innerHTML = DESTINATIONS.map(skeletonMarkup).join('');
 
  // 2. Batch-fetch one image per destination from Pexels (respects rate limits
  //    better than 20 separate awaited calls in sequence).
  const queries = DESTINATIONS.map(d => d.query);
  let imageMap = {};
  try {
    imageMap = await PexelsAPI.getBatchImages(queries, 1);
  } catch (err) {
    console.error('Pexels batch fetch failed:', err);
  }
 
  // 3. Swap each card in place once its image resolves.
  DESTINATIONS.forEach(dest => {
    const slot = grid.querySelector(`[data-slot="${CSS.escape(dest.label)}"]`);
    if (!slot) return;
    const results = imageMap[dest.query] || [];
    const img = results[0];
    const imgUrl = img ? img.url : FALLBACK_IMG;
    const credit = img ? img.photographer : '';
    slot.outerHTML = cardMarkup(dest, imgUrl, credit);
  });
 
  // 4. Init Swiper once slides are in place (5 breakpoints max: xs/sm/md/lg/xl).
  new Swiper('#destination-swiper', {
    slidesPerView: 1,
    spaceBetween: 15,
    loop: true,
    pagination: { el: '.swiper-pagination', clickable: true },
    navigation: {
      prevEl: '.destination-prev',
      nextEl: '.destination-next',
    },
    breakpoints: {
      480:  { slidesPerView: 2, spaceBetween: 8 },
      768:  { slidesPerView: 3, spaceBetween: 12 },
      1024: { slidesPerView: 4, spaceBetween: 12 },
      1280: { slidesPerView: 5, spaceBetween: 15 }
    }
  });
}
 
renderDestinations();
