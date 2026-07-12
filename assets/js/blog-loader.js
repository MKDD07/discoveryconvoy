/**
 * Blog listing loader — fetches posts from the D1-backed Worker API
 * and renders them into the .tp-blog-list-wrap container, replacing
 * the single hardcoded card. Also builds pagination and the sidebar
 * tag cloud dynamically.
 *
 * Usage: include this script on blog-list.html before </body>:
 *   <script src="assets/js/blog-loader.js"></script>
 *
 * Requires these container elements to already exist in the HTML
 * (see markup notes below the code).
 */

const BLOG_API_BASE = 'https://discoveryconvoy.<subdomain>.workers.dev/api/posts';
const POSTS_PER_PAGE = 6;

document.addEventListener('DOMContentLoaded', () => {
  const cardContainer = document.getElementById('blog-list');
  if (!cardContainer) return; // not on the blog list page

  const params = new URLSearchParams(window.location.search);
  const page = parseInt(params.get('page') || '1', 10);
  const categoryFilter = params.get('category');

  loadBlogPosts(cardContainer, page, categoryFilter);
});

async function loadBlogPosts(cardContainer, page, categoryFilter) {
  cardContainer.innerHTML = '<p>Loading posts...</p>';

  try {
    const apiUrl = categoryFilter
      ? `${BLOG_API_BASE}?category=${encodeURIComponent(categoryFilter)}`
      : BLOG_API_BASE;

    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const posts = await res.json();

    // Fetch the full unfiltered set separately for sidebar widgets
    // (categories/tags/latest posts should reflect the whole blog,
    // not just the current filtered view)
    const allPosts = categoryFilter
      ? await fetch(BLOG_API_BASE).then(r => r.json())
      : posts;

    if (!posts.length) {
      cardContainer.innerHTML = '<p>No blog posts yet. Check back soon!</p>';
      return;
    }

    // Pagination (client-side slice — fine for a few dozen posts;
    // for hundreds of posts, add LIMIT/OFFSET to the Worker API instead)
    const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));
    const currentPage = Math.min(Math.max(page, 1), totalPages);
    const start = (currentPage - 1) * POSTS_PER_PAGE;
    const pagePosts = posts.slice(start, start + POSTS_PER_PAGE);

    cardContainer.innerHTML = pagePosts.map(renderBlogCard).join('');

    // Trigger Pexels loader to scan the newly injected <img data-pexels-*> tags.
    // The loader's MutationObserver should catch this automatically, but we
    // call init() explicitly to be safe (e.g. if the observer hasn't attached yet).
    if (window.PexelsLoader && typeof window.PexelsLoader.init === 'function') {
      window.PexelsLoader.init('#blog-list');
    }

    renderPagination(currentPage, totalPages);
    renderTagCloud(allPosts);
    renderCategories(allPosts);
    renderLatestPosts(allPosts);
  } catch (err) {
    console.error('Failed to load blog posts:', err);
    cardContainer.innerHTML = '<p>Could not load blog posts. Please try again later.</p>';
  }
}

function renderBlogCard(post) {
  const dateStr = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      })
    : '';

  const category = post.category || 'General';
  const postUrl = `blog-details.html?slug=${encodeURIComponent(post.slug)}`;

  // Image: use the post's own featured_image if set, otherwise fall back
  // to Pexels — searched by category/focus_keyword/title via the
  // Pexels Universal Media Loader (data-pexels-* attributes).
  const imgTag = post.featured_image
    ? `<img src="${escapeHtml(post.featured_image)}" alt="${escapeHtml(post.featured_image_alt || post.title)}">`
    : `<img
         data-pexels-query="${escapeHtml(post.focus_keyword || post.category || post.title)}"
         data-pexels-size="large"
         data-pexels-orientation="landscape"
         data-pexels-index="0"
         data-pexels-lazy="true"
         data-pexels-fallback="assets/img/blog/list/thumb-4.jpg"
         alt="${escapeHtml(post.title)}">`;

  return `
    <div class="tp-blog-item tp-blog-col-2 tp-blog-4-item mb-50">
      <div class="tp-blog-thumb fix">
        <a href="${postUrl}" class="d-inline-block">
          ${imgTag}
        </a>
      </div>
      <div class="tp-blog-content">
        <div class="tp-blog-meta-wrap d-flex flex-wrap align-items-center mb-15">
          <span class="tp-blog-category">${escapeHtml(category)}</span>
          <div class="tp-blog-meta">
            <span>${dateStr}</span>
          </div>
        </div>
        <h3 class="tp-blog-title fw-600 mb-5">
          <a href="${postUrl}">${escapeHtml(post.title)}</a>
        </h3>
        <p>${escapeHtml(post.excerpt || '')}</p>
        <a href="${postUrl}" class="tp-btn-solid">Learn more
          <i class="far fa-arrow-right ml-5"></i>
        </a>
      </div>
    </div>
  `;
}

function renderPagination(currentPage, totalPages) {
  const nav = document.querySelector('.tp-pagination nav ul');
  if (!nav) return;

  if (totalPages <= 1) {
    document.querySelector('.tp-pagination').style.display = 'none';
    return;
  }

  let html = '';

  html += `
    <li>
      <a href="?page=${Math.max(1, currentPage - 1)}" class="tp-pagination-prev prev page-numbers">
        <i class="far fa-chevron-left"></i>
      </a>
    </li>
  `;

  for (let i = 1; i <= totalPages; i++) {
    if (i === currentPage) {
      html += `<li><span class="current">${i}</span></li>`;
    } else {
      html += `<li><a href="?page=${i}">${i}</a></li>`;
    }
  }

  html += `
    <li>
      <a href="?page=${Math.min(totalPages, currentPage + 1)}" class="next page-numbers">
        <i class="far fa-chevron-right"></i>
      </a>
    </li>
  `;

  nav.innerHTML = html;
}

function renderTagCloud(posts) {
  const tagContainer = document.getElementById('blog-tags') || document.querySelector('.tagcloud');
  if (!tagContainer) return;

  // Collect unique tags from all posts (comma-separated field)
  const tagSet = new Set();
  posts.forEach(post => {
    if (!post.tags) return;
    post.tags.split(',').forEach(t => {
      const trimmed = t.trim();
      if (trimmed) tagSet.add(trimmed);
    });
  });

  if (tagSet.size === 0) return; // leave existing static tags if no data

  tagContainer.innerHTML = Array.from(tagSet)
    .map(tag => `<a href="blog-list.html?tag=${encodeURIComponent(tag)}">${escapeHtml(tag)}</a>`)
    .join('');
}

function renderCategories(posts) {
  const container = document.getElementById('blog-categories');
  if (!container) return;

  // Count posts per category
  const counts = {};
  posts.forEach(post => {
    const cat = post.category || 'General';
    counts[cat] = (counts[cat] || 0) + 1;
  });

  if (Object.keys(counts).length === 0) return;

  container.innerHTML = Object.entries(counts)
    .sort((a, b) => b[1] - a[1]) // most posts first
    .map(([cat, count]) => `
      <li>
        <a href="blog-list.html?category=${encodeURIComponent(cat)}">
          ${escapeHtml(cat)}<span>${count}</span>
        </a>
      </li>
    `)
    .join('');
}

function renderLatestPosts(posts) {
  const container = document.getElementById('blog-latest-posts');
  if (!container) return;

  // Sort by published date, take top 4
  const latest = [...posts]
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
    .slice(0, 4);

  if (latest.length === 0) return;

  container.innerHTML = latest.map(post => {
    const postUrl = `blog-details.html?slug=${encodeURIComponent(post.slug)}`;
    const dateStr = post.published_at
      ? new Date(post.published_at).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric'
        })
      : '';
    const thumb = post.featured_image || 'assets/img/blog/list/thumb-4.jpg';

    return `
      <div class="sidebar-latest-post d-flex align-items-center mb-20">
        <div class="sidebar-latest-post-thumb mr-15">
          <a href="${postUrl}">
            <img src="${escapeHtml(thumb)}" alt="${escapeHtml(post.title)}" width="70" height="70" style="object-fit:cover;">
          </a>
        </div>
        <div class="sidebar-latest-post-content">
          <span class="sidebar-latest-post-date">${dateStr}</span>
          <h4 class="sidebar-latest-post-title fs-16 fw-500 mb-0">
            <a href="${postUrl}">${escapeHtml(post.title)}</a>
          </h4>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}