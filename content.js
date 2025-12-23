/**
 * FB Content Blocker - Content Script
 * Filters Facebook posts containing blocked keywords
 */

// ============================================
// Debug Mode (set to true for troubleshooting)
// ============================================
const DEBUG = false;

// ============================================
// BUILT-IN SPONSORED/ADS DETECTION
// These are ALWAYS blocked regardless of user keywords
// ============================================
const BUILT_IN_ADS_PATTERNS = [
  // Vietnamese
  'Được tài trợ',
  'Đề xuất cho bạn',
  'Bài viết được tài trợ',
  'Nội dung được tài trợ',
  // English
  'Sponsored',
  'Suggested for you',
  'Paid partnership',
  // Common variations (no diacritics)
  'Duoc tai tro',
  'De xuat cho ban',
];

// Normalize text: remove diacritics for fuzzy matching
function normalizeText(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function debugLog(...args) {
  if (DEBUG) {
    console.log('[FB Blocker]', ...args);
  }
}

// ============================================
// Inline modules (no bundler for content script)
// ============================================

/**
 * KeywordMatcher - Regex-based keyword matching with word boundary support
 * Supports: plain keywords, regex patterns, whitelist
 */
const MAX_KEYWORDS = 5000;
const MAX_PATTERN_SIZE = 1024 * 1024; // 1MB regex pattern limit

class KeywordMatcher {
  constructor(keywords = [], whitelist = []) {
    this.keywords = keywords;
    this.whitelist = whitelist;
    this.compiledRegex = null;
    this.regexPatterns = [];
    this.whitelistRegex = null;
    this.compile();
  }

  compile() {
    this.compiledRegex = null;
    this.regexPatterns = [];
    this.whitelistRegex = null;

    if (this.keywords.length === 0) {
      return;
    }

    // Safety: Limit keywords
    const safeKeywords = this.keywords.slice(0, MAX_KEYWORDS);
    if (this.keywords.length > MAX_KEYWORDS) {
      console.warn(`[FB Blocker] Keyword limit: ${MAX_KEYWORDS}. Ignoring ${this.keywords.length - MAX_KEYWORDS} keywords.`);
    }

    // Separate regex and plain keywords
    const plainKeywords = [];
    for (const kw of safeKeywords) {
      const text = typeof kw === 'string' ? kw : kw.text;
      const isRegex = typeof kw === 'object' && kw.isRegex;

      if (isRegex) {
        try {
          this.regexPatterns.push(new RegExp(text, 'giu'));
        } catch (e) {
          console.warn(`[FB Blocker] Invalid regex: ${text}`);
        }
      } else {
        plainKeywords.push(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      }
    }

    // Compile plain keywords into single regex
    // Note: Using lookahead/lookbehind instead of \b for Vietnamese support
    // \b only works with ASCII word characters, not Vietnamese/Unicode
    // This approach: match keyword NOT preceded/followed by alphanumeric
    if (plainKeywords.length > 0) {
      // Pattern with Unicode-aware word boundaries
      // (?<![a-zA-Z0-9]) = not preceded by ASCII alphanumeric
      // (?![a-zA-Z0-9]) = not followed by ASCII alphanumeric
      const pattern = `(?<![a-zA-Z0-9])(?:${plainKeywords.join('|')})(?![a-zA-Z0-9])`;

      if (pattern.length > MAX_PATTERN_SIZE) {
        console.error('[FB Blocker] Pattern too large. Reduce keywords.');
      } else {
        this.compiledRegex = new RegExp(pattern, 'giu');
      }
    }

    // Compile whitelist
    if (this.whitelist.length > 0) {
      const whitelistTexts = this.whitelist.map(item => {
        const text = typeof item === 'string' ? item : item.text;
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      });
      this.whitelistRegex = new RegExp(`(?<![a-zA-Z0-9])(?:${whitelistTexts.join('|')})(?![a-zA-Z0-9])`, 'giu');
    }
  }

  matches(text) {
    if (!text) return false;
    if (!this.compiledRegex && this.regexPatterns.length === 0) return false;

    // Check whitelist first - if match, don't block
    if (this.whitelistRegex) {
      this.whitelistRegex.lastIndex = 0;
      if (this.whitelistRegex.test(text)) {
        return false;
      }
    }

    // Check plain keywords
    if (this.compiledRegex) {
      this.compiledRegex.lastIndex = 0;
      if (this.compiledRegex.test(text)) {
        return true;
      }
    }

    // Check regex patterns
    for (const re of this.regexPatterns) {
      re.lastIndex = 0;
      if (re.test(text)) {
        return true;
      }
    }

    return false;
  }

  update(keywords, whitelist = []) {
    this.keywords = keywords;
    this.whitelist = whitelist;
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

let matcher = new KeywordMatcher([], []);
let enabled = true;
let blockComments = true;
let showPlaceholder = true; // false = completely remove from DOM
let observer = null;
let debounceTimer = null;
const DEBOUNCE_MS = 150; // Reduced for faster response to new posts

// Text content cache for performance (WeakMap doesn't prevent GC of elements)
const textCache = new WeakMap();
const CACHE_TTL = 5000; // 5 seconds

function getCachedText(element) {
  const cached = textCache.get(element);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.text;
  }
  const text = element.textContent || '';
  textCache.set(element, { text, time: Date.now() });
  return text;
}

/**
 * Find the actual post container by traversing up the DOM
 * Only returns FeedUnit or article containers - safe approach
 */
function findPostContainer(element) {
  let current = element;
  let maxDepth = 50;

  while (current && current !== document.body && maxDepth > 0) {
    if (current.getAttribute) {
      const pagelet = current.getAttribute('data-pagelet');
      const role = current.getAttribute('role');

      // Primary: FeedUnit containers (most reliable for posts)
      if (pagelet && pagelet.startsWith('FeedUnit')) {
        return current;
      }

      // Secondary: article role (standard accessibility marker)
      if (role === 'article') {
        return current;
      }

      // Stop conditions - these are page-level containers
      if (pagelet === 'Feed' || role === 'feed' || role === 'main' ||
          role === 'navigation' || role === 'banner' || role === 'contentinfo') {
        break;
      }
    }

    current = current.parentElement;
    maxDepth--;
  }

  // No safe container found - return original element
  // Better to hide small text than entire page
  return element;
}

init().catch(err => console.error('[FB Blocker] Init failed:', err));

async function init() {
  debugLog('=== FB Content Blocker initializing ===');

  // Run migration first
  await Migration.migrateV1ToV2();

  await loadSettings();
  debugLog('Settings loaded:', { enabled, blockComments, keywordCount: matcher.count });

  setupObserver();
  filterContent();

  debugLog('=== Initialization complete ===');

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
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local') {
      if (changes.keywords || changes.whitelist) {
        const { keywords = [], whitelist = [] } = await chrome.storage.local.get(['keywords', 'whitelist']);
        matcher.update(keywords, whitelist);
        resetHiddenPosts();
        filterContent();
      }
    }
    if (areaName === 'sync') {
      if (changes.enabled) {
        enabled = changes.enabled.newValue !== false;
        if (!enabled) {
          resetHiddenPosts();
        } else {
          filterContent();
        }
      }
      if (changes.settings) {
        const settings = changes.settings.newValue || {};
        blockComments = settings.blockComments !== false;
        showPlaceholder = settings.showPlaceholder !== false;
        resetHiddenPosts();
        filterContent();
      }
    }
  });
}

async function loadSettings() {
  try {
    const [localData, syncData] = await Promise.all([
      chrome.storage.local.get(['keywords', 'whitelist']),
      chrome.storage.sync.get(['enabled', 'settings'])
    ]);

    const keywords = localData.keywords || [];
    const whitelist = localData.whitelist || [];
    const settings = syncData.settings || {};

    enabled = syncData.enabled !== false;
    blockComments = settings.blockComments !== false;
    showPlaceholder = settings.showPlaceholder !== false; // default true

    debugLog('Keywords loaded:', keywords.map(k => typeof k === 'string' ? k : k.text));
    debugLog('Whitelist:', whitelist.map(w => typeof w === 'string' ? w : w.text));
    debugLog('Settings:', { enabled, blockComments, showPlaceholder });

    matcher.update(keywords, whitelist);
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

  debugLog('filterContent called', { enabled, keywordCount: matcher.count });

  try {
    // Facebook post selectors (updated for current FB DOM - Dec 2024)
    // Priority: most specific first, fallback to generic
    const postSelectors = [
      // Primary: Feed unit containers (most stable)
      '[data-pagelet^="FeedUnit"]',

      // Posts with role="article" (standard accessibility)
      '[role="article"]',

      // Sponsored/Ad posts
      '[data-pagelet*="FeedUnit"][data-pagelet*="Sponsored"]',
      'div[data-ad-preview="message"]',

      // Story containers in feed
      'div[data-pagelet="FeedUnit"] > div > div',

      // Generic post wrapper (FB uses nested divs with these patterns)
      'div[class*="x1yztbdb"][class*="x1n2onr6"]',

      // Fallback: any div with substantial content in feed area
      'div[data-pagelet="Feed"] div[dir="auto"]'
    ];

    // Filter posts
    let totalPosts = 0;
    let blockedPosts = 0;
    const processedContainers = new Set();

    // Method 1: Scan using selectors
    postSelectors.forEach((selector, idx) => {
      const posts = document.querySelectorAll(selector);
      if (posts.length > 0) {
        debugLog(`Selector ${idx} [${selector.substring(0, 30)}...] found ${posts.length} elements`);
      }
      totalPosts += posts.length;

      posts.forEach(post => {
        if (post.dataset.fbBlocked === 'true' || post.dataset.fbBlocked === 'shown') return;

        const text = getCachedText(post);

        if (matcher.matches(text)) {
          const postContainer = findPostContainer(post);
          if (postContainer.dataset.fbBlocked === 'true' || postContainer.dataset.fbBlocked === 'shown') return;
          if (processedContainers.has(postContainer)) return;

          processedContainers.add(postContainer);
          debugLog('>>> BLOCKING (selector):', postContainer.tagName, postContainer.getAttribute('data-pagelet') || postContainer.getAttribute('role'));
          hidePost(postContainer);
          blockedPosts++;
        }
      });
    });

    // Method 2: BUILT-IN ADS BLOCKING (always active)
    // Automatically blocks sponsored/suggested content without needing user keywords
    const allTextNodes = document.querySelectorAll('[dir="auto"], span, a');

    allTextNodes.forEach(node => {
      const text = node.textContent?.trim() || '';
      if (!text || text.length > 100) return; // Skip empty or too long

      // Normalize for fuzzy matching (removes diacritics)
      const normalizedText = normalizeText(text);

      // Check against built-in ads patterns
      for (const pattern of BUILT_IN_ADS_PATTERNS) {
        const normalizedPattern = normalizeText(pattern);

        // Match if text contains pattern (case-insensitive, diacritic-insensitive)
        if (normalizedText.includes(normalizedPattern) || text.includes(pattern)) {
          const postContainer = findPostContainer(node);

          if (postContainer.dataset.fbBlocked === 'true' || postContainer.dataset.fbBlocked === 'shown') return;
          if (processedContainers.has(postContainer)) return;

          // BLOCK IMMEDIATELY - no need to check user keywords for built-in patterns
          processedContainers.add(postContainer);
          debugLog('>>> BLOCKING (built-in ads):', text);
          hidePost(postContainer);
          blockedPosts++;
          return;
        }
      }

      // Also check user keywords (with fuzzy matching)
      if (matcher.count > 0 && matcher.matches(text)) {
        const postContainer = findPostContainer(node);
        if (postContainer.dataset.fbBlocked === 'true' || postContainer.dataset.fbBlocked === 'shown') return;
        if (processedContainers.has(postContainer)) return;

        processedContainers.add(postContainer);
        debugLog('>>> BLOCKING (user keyword):', text);
        hidePost(postContainer);
        blockedPosts++;
      }
    });

    debugLog(`=== Scan complete: ${totalPosts} posts, ${blockedPosts} blocked ===`);

    // Filter comments
    filterComments();
  } catch (error) {
    console.error('[FB Blocker] filterContent error:', error);
  }
}

function filterComments() {
  if (!enabled || !blockComments || matcher.count === 0) return;

  // Facebook comment selectors (updated for current FB DOM - Dec 2024)
  const commentSelectors = [
    // Comment body with ARIA label
    '[aria-label*="Comment"]',
    '[aria-label*="comment"]',

    // Comment test IDs (may change but stable for now)
    '[data-testid="UFI2Comment/body"]',
    '[data-testid*="comment"]',

    // Comment content containers
    'div[dir="auto"][class*="x1lliihq"]',
    'div[dir="auto"][class*="xzsf02u"]',

    // Nested comment text
    'ul[role="list"] div[dir="auto"]',

    // Reply containers
    'div[aria-label*="Reply"]',
    'div[aria-label*="reply"]'
  ];

  commentSelectors.forEach(selector => {
    const comments = document.querySelectorAll(selector);
    comments.forEach(comment => {
      // Skip if already processed
      if (comment.dataset.fbCommentBlocked === 'true' ||
          comment.dataset.fbCommentBlocked === 'shown') return;

      // Don't process if it's inside a hidden post
      if (comment.closest('[data-fb-blocked="true"]')) return;

      const text = getCachedText(comment);

      if (matcher.matches(text)) {
        hideComment(comment);
      }
    });
  });
}

async function hideComment(comment) {
  // Increment stats
  Stats.increment();

  // If showPlaceholder is false, completely remove from DOM
  if (!showPlaceholder) {
    comment.remove();
    return;
  }

  // Otherwise, hide with placeholder
  comment.dataset.fbCommentBlocked = 'true';
  comment.dataset.originalDisplay = comment.style.display;
  comment.style.display = 'none';

  // Create small inline placeholder for comments (no innerHTML for XSS safety)
  const placeholder = document.createElement('span');
  placeholder.className = 'fb-blocker-comment-placeholder';

  const textSpan = document.createElement('span');
  textSpan.className = 'fb-blocker-comment-text';
  textSpan.textContent = chrome.i18n.getMessage('commentHidden') || '[Comment hidden]';
  placeholder.appendChild(textSpan);

  const showBtn = document.createElement('button');
  showBtn.className = 'fb-blocker-comment-show';
  showBtn.textContent = chrome.i18n.getMessage('placeholderShow') || 'Show';
  showBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    comment.style.display = comment.dataset.originalDisplay || '';
    comment.dataset.fbCommentBlocked = 'shown';
    placeholder.remove();
  });
  placeholder.appendChild(showBtn);

  comment.parentNode.insertBefore(placeholder, comment);
}

async function hidePost(post) {
  // Increment stats
  Stats.increment();

  // If showPlaceholder is false, completely remove from DOM
  if (!showPlaceholder) {
    post.remove();
    return;
  }

  // Otherwise, hide with placeholder
  post.dataset.fbBlocked = 'true';
  post.dataset.originalDisplay = post.style.display;
  post.style.display = 'none';

  // Create placeholder (no innerHTML for XSS safety)
  const placeholder = document.createElement('div');
  placeholder.className = 'fb-blocker-placeholder';

  const textSpan = document.createElement('span');
  textSpan.textContent = chrome.i18n.getMessage('placeholderHidden') || 'Content hidden by FB Content Blocker';
  placeholder.appendChild(textSpan);

  const showBtn = document.createElement('button');
  showBtn.className = 'fb-blocker-show-btn';
  showBtn.textContent = chrome.i18n.getMessage('placeholderShow') || 'Show';
  showBtn.addEventListener('click', () => {
    post.style.display = post.dataset.originalDisplay || '';
    post.dataset.fbBlocked = 'shown';
    placeholder.remove();
  });
  placeholder.appendChild(showBtn);

  post.parentNode.insertBefore(placeholder, post);
}

function resetHiddenPosts() {
  // Remove all post placeholders
  document.querySelectorAll('.fb-blocker-placeholder').forEach(el => el.remove());

  // Remove all comment placeholders
  document.querySelectorAll('.fb-blocker-comment-placeholder').forEach(el => el.remove());

  // Reset blocked posts
  document.querySelectorAll('[data-fb-blocked]').forEach(post => {
    post.style.display = post.dataset.originalDisplay || '';
    delete post.dataset.fbBlocked;
    delete post.dataset.originalDisplay;
  });

  // Reset blocked comments
  document.querySelectorAll('[data-fb-comment-blocked]').forEach(comment => {
    comment.style.display = comment.dataset.originalDisplay || '';
    delete comment.dataset.fbCommentBlocked;
    delete comment.dataset.originalDisplay;
  });
}
