let keywords = [];
let enabled = true;
let observer = null;

init();

async function init() {
  await loadSettings();
  setupObserver();
  filterContent();

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'update') {
      loadSettings().then(() => {
        resetHiddenPosts();
        filterContent();
      });
    }
  });
}

async function loadSettings() {
  const result = await chrome.storage.sync.get(['keywords', 'enabled']);
  keywords = result.keywords || [];
  enabled = result.enabled !== false;
}

function setupObserver() {
  observer = new MutationObserver((mutations) => {
    if (enabled && keywords.length > 0) {
      filterContent();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function filterContent() {
  if (!enabled || keywords.length === 0) return;

  // Tìm các bài post trên Facebook
  const postSelectors = [
    '[data-pagelet^="FeedUnit"]',
    '[role="article"]',
    'div[data-ad-preview="message"]',
    '.x1yztbdb.x1n2onr6.xh8yej3.x1ja2u2z'
  ];

  postSelectors.forEach(selector => {
    const posts = document.querySelectorAll(selector);
    posts.forEach(post => {
      if (post.dataset.fbBlocked === 'true') return;

      const text = post.textContent.toLowerCase();
      const shouldBlock = keywords.some(keyword =>
        text.includes(keyword.toLowerCase())
      );

      if (shouldBlock) {
        hidePost(post);
      }
    });
  });
}

function hidePost(post) {
  post.dataset.fbBlocked = 'true';
  post.dataset.originalDisplay = post.style.display;
  post.style.display = 'none';

  // Tạo placeholder
  const placeholder = document.createElement('div');
  placeholder.className = 'fb-blocker-placeholder';
  placeholder.innerHTML = `
    <span>Nội dung đã bị ẩn bởi FB Content Blocker</span>
    <button class="fb-blocker-show-btn">Hiện</button>
  `;

  placeholder.querySelector('.fb-blocker-show-btn').addEventListener('click', () => {
    post.style.display = post.dataset.originalDisplay || '';
    post.dataset.fbBlocked = 'shown';
    placeholder.remove();
  });

  post.parentNode.insertBefore(placeholder, post);
}

function resetHiddenPosts() {
  // Xóa tất cả placeholder
  document.querySelectorAll('.fb-blocker-placeholder').forEach(el => el.remove());

  // Reset các post đã ẩn
  document.querySelectorAll('[data-fb-blocked]').forEach(post => {
    post.style.display = post.dataset.originalDisplay || '';
    delete post.dataset.fbBlocked;
    delete post.dataset.originalDisplay;
  });
}
