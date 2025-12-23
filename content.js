/**
 * FB Content Blocker - Content Script
 * Filters Facebook posts containing blocked keywords
 */

// ============================================
// Inline modules (no bundler for content script)
// ============================================

/**
 * KeywordMatcher - Regex-based keyword matching with word boundary support
 */
const MAX_KEYWORDS = 5000;
const MAX_PATTERN_SIZE = 1024 * 1024; // 1MB regex pattern limit

class KeywordMatcher {
  constructor(keywords = []) {
    this.keywords = keywords;
    this.compiledRegex = null;
    this.compile();
  }

  compile() {
    if (this.keywords.length === 0) {
      this.compiledRegex = null;
      return;
    }

    // Safety: Limit keywords to prevent regex explosion
    const safeKeywords = this.keywords.slice(0, MAX_KEYWORDS);
    if (this.keywords.length > MAX_KEYWORDS) {
      console.warn(`[FB Blocker] Keyword limit reached: ${MAX_KEYWORDS}. Ignoring ${this.keywords.length - MAX_KEYWORDS} keywords.`);
    }

    const escaped = safeKeywords.map(kw => {
      const text = typeof kw === 'string' ? kw : kw.text;
      return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });

    const pattern = `\\b(?:${escaped.join('|')})\\b`;

    // Safety: Check pattern size
    if (pattern.length > MAX_PATTERN_SIZE) {
      console.error('[FB Blocker] Regex pattern too large. Reduce keywords.');
      this.compiledRegex = null;
      return;
    }

    this.compiledRegex = new RegExp(pattern, 'giu');
  }

  matches(text) {
    if (!this.compiledRegex || !text) return false;
    this.compiledRegex.lastIndex = 0;
    return this.compiledRegex.test(text);
  }

  update(keywords) {
    this.keywords = keywords;
    this.compile();
  }

  get count() {
    return this.keywords.length;
  }
}

/**
 * Stats - Blocking statistics tracker
 */
const Stats = {
  async increment() {
    try {
      const { stats = { today: 0, total: 0, lastReset: null } } =
        await chrome.storage.local.get('stats');

      const today = new Date().toISOString().split('T')[0];

      if (stats.lastReset !== today) {
        stats.today = 0;
        stats.lastReset = today;
      }

      stats.today++;
      stats.total++;

      await chrome.storage.local.set({ stats });
      return { today: stats.today, total: stats.total };
    } catch (error) {
      console.error('[FB Blocker] Stats.increment error:', error);
      return { today: 0, total: 0 };
    }
  }
};

/**
 * Migration - v1 to v2 data migration
 */
const Migration = {
  async migrateV1ToV2() {
    try {
      const syncData = await chrome.storage.sync.get(['keywords', 'version', 'enabled']);

      if (syncData.version === 2) {
        return { migrated: false, count: 0 };
      }

      const oldKeywords = syncData.keywords || [];
      if (oldKeywords.length === 0 && !syncData.keywords) {
        await chrome.storage.sync.set({ version: 2 });
        return { migrated: false, count: 0 };
      }

      const newKeywords = oldKeywords.map(text => {
        if (typeof text === 'object' && text.text) {
          return {
            id: text.id || crypto.randomUUID(),
            text: text.text,
            category: text.category || 'default',
            isRegex: text.isRegex || false,
            caseSensitive: text.caseSensitive || false
          };
        }

        return {
          id: crypto.randomUUID(),
          text: String(text),
          category: 'default',
          isRegex: false,
          caseSensitive: false
        };
      });

      await chrome.storage.local.set({ keywords: newKeywords });
      await chrome.storage.sync.set({ version: 2, enabled: syncData.enabled !== false });
      await chrome.storage.sync.remove('keywords');

      console.log(`[FB Blocker] Migrated ${newKeywords.length} keywords from v1 to v2`);
      return { migrated: true, count: newKeywords.length };
    } catch (error) {
      console.error('[FB Blocker] Migration error:', error);
      return { migrated: false, count: 0 };
    }
  }
};

// ============================================
// Main content script logic
// ============================================

let matcher = new KeywordMatcher([]);
let enabled = true;
let observer = null;
let debounceTimer = null;
const DEBOUNCE_MS = 300;

init();

async function init() {
  // Run migration first
  await Migration.migrateV1ToV2();

  await loadSettings();
  setupObserver();
  filterContent();

  // Listen for updates from popup
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'update') {
      loadSettings().then(() => {
        resetHiddenPosts();
        filterContent();
      });
    }
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.keywords) {
      matcher.update(changes.keywords.newValue || []);
      resetHiddenPosts();
      filterContent();
    }
    if (areaName === 'sync' && changes.enabled) {
      enabled = changes.enabled.newValue !== false;
      if (!enabled) {
        resetHiddenPosts();
      } else {
        filterContent();
      }
    }
  });
}

async function loadSettings() {
  try {
    const [localData, syncData] = await Promise.all([
      chrome.storage.local.get('keywords'),
      chrome.storage.sync.get('enabled')
    ]);

    const keywords = localData.keywords || [];
    enabled = syncData.enabled !== false;

    matcher.update(keywords);
  } catch (error) {
    console.error('[FB Blocker] loadSettings error:', error);
  }
}

function setupObserver() {
  observer = new MutationObserver(() => {
    if (!enabled || matcher.count === 0) return;

    // Debounce filter calls for performance
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      filterContent();
    }, DEBOUNCE_MS);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function filterContent() {
  if (!enabled || matcher.count === 0) return;

  // Facebook post selectors (multiple fallbacks)
  const postSelectors = [
    '[data-pagelet^="FeedUnit"]',
    '[role="article"]',
    'div[data-ad-preview="message"]',
    '.x1yztbdb.x1n2onr6.xh8yej3.x1ja2u2z'
  ];

  postSelectors.forEach(selector => {
    const posts = document.querySelectorAll(selector);
    posts.forEach(post => {
      if (post.dataset.fbBlocked === 'true' || post.dataset.fbBlocked === 'shown') return;

      const text = post.textContent || '';

      if (matcher.matches(text)) {
        hidePost(post);
      }
    });
  });
}

async function hidePost(post) {
  post.dataset.fbBlocked = 'true';
  post.dataset.originalDisplay = post.style.display;
  post.style.display = 'none';

  // Increment stats
  Stats.increment();

  // Create placeholder
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
  // Remove all placeholders
  document.querySelectorAll('.fb-blocker-placeholder').forEach(el => el.remove());

  // Reset blocked posts
  document.querySelectorAll('[data-fb-blocked]').forEach(post => {
    post.style.display = post.dataset.originalDisplay || '';
    delete post.dataset.fbBlocked;
    delete post.dataset.originalDisplay;
  });
}
