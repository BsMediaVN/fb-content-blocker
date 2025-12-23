/**
 * FB Content Blocker - Popup Script
 * Handles keyword management, import/export, and stats display
 */

document.addEventListener('DOMContentLoaded', init);

// i18n helper function
function getMessage(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || key;
}

// Apply i18n to all elements with data-i18n attributes
function applyI18n() {
  // Text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const msg = getMessage(key);
    if (msg) el.textContent = msg;
  });

  // Placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const msg = getMessage(key);
    if (msg) el.placeholder = msg;
  });
}

async function init() {
  applyI18n();
  await loadKeywords();
  await loadEnabled();
  await loadStats();
  setupEventListeners();
}

// Category labels for display - using i18n
function getCategoryLabel(category) {
  const labels = {
    default: getMessage('categoryDefault'),
    spam: getMessage('categorySpam'),
    ads: getMessage('categoryAds'),
    politics: getMessage('categoryPolitics'),
    other: getMessage('categoryOther')
  };
  return labels[category] || category;
}

// Current filter state
let currentSearch = '';
let currentCategory = '';

function setupEventListeners() {
  // Single keyword add
  document.getElementById('add-btn').addEventListener('click', addKeyword);
  document.getElementById('keyword-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addKeyword();
  });

  // Toggle extension
  document.getElementById('enabled-toggle').addEventListener('change', toggleEnabled);

  // Bulk add toggle
  document.getElementById('toggle-bulk-btn').addEventListener('click', () => {
    document.getElementById('bulk-container').classList.toggle('hidden');
  });

  // Bulk add
  document.getElementById('bulk-add-btn').addEventListener('click', addKeywordsBulk);

  // Import/Export
  document.getElementById('export-btn').addEventListener('click', exportKeywords);
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', handleImport);

  // Search and filter
  document.getElementById('search-input').addEventListener('input', debounce((e) => {
    currentSearch = e.target.value.toLowerCase();
    loadKeywords();
  }, 200));

  document.getElementById('category-filter').addEventListener('change', (e) => {
    currentCategory = e.target.value;
    loadKeywords();
  });
}

// Debounce utility
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ============================================
// Stats
// ============================================

async function loadStats() {
  try {
    const { stats = { today: 0, total: 0, lastReset: null } } =
      await chrome.storage.local.get('stats');

    const today = new Date().toISOString().split('T')[0];
    const todayCount = stats.lastReset === today ? stats.today : 0;

    document.getElementById('today-count').textContent = todayCount;
    document.getElementById('total-count').textContent = stats.total || 0;
  } catch (error) {
    console.error('[FB Blocker] loadStats error:', error);
  }
}

// ============================================
// Keywords CRUD
// ============================================

async function loadKeywords() {
  try {
    const { keywords = [] } = await chrome.storage.local.get('keywords');
    renderKeywords(keywords);
  } catch (error) {
    console.error('[FB Blocker] loadKeywords error:', error);
    renderKeywords([]);
  }
}

async function loadEnabled() {
  try {
    const { enabled = true } = await chrome.storage.sync.get('enabled');
    document.getElementById('enabled-toggle').checked = enabled !== false;
  } catch (error) {
    console.error('[FB Blocker] loadEnabled error:', error);
  }
}

function renderKeywords(keywords) {
  const list = document.getElementById('keywords-list');
  const countEl = document.getElementById('keyword-count');

  // Filter keywords based on search and category
  let filtered = keywords;

  if (currentSearch) {
    filtered = filtered.filter(kw => {
      const text = typeof kw === 'string' ? kw : kw.text;
      return text.toLowerCase().includes(currentSearch);
    });
  }

  if (currentCategory) {
    filtered = filtered.filter(kw => {
      const cat = typeof kw === 'object' ? (kw.category || 'default') : 'default';
      return cat === currentCategory;
    });
  }

  countEl.textContent = keywords.length;

  if (filtered.length === 0) {
    if (keywords.length === 0) {
      list.innerHTML = `<li class="empty-message">${getMessage('emptyKeywords')}</li>`;
    } else {
      list.innerHTML = `<li class="empty-message">${getMessage('noMatch')}</li>`;
    }
    return;
  }

  list.innerHTML = filtered.map((keyword, index) => {
    const text = typeof keyword === 'string' ? keyword : keyword.text;
    const id = typeof keyword === 'object' ? keyword.id : index;
    const category = typeof keyword === 'object' ? (keyword.category || 'default') : 'default';
    const categoryLabel = getCategoryLabel(category);

    return `
      <li>
        <span>${escapeHtml(text)}</span>
        <span class="category-badge ${category}">${categoryLabel}</span>
        <button class="delete-btn" data-id="${id}" data-index="${index}">${getMessage('btnDelete')}</button>
      </li>
    `;
  }).join('');

  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const index = parseInt(btn.dataset.index, 10);
      deleteKeyword(id, index);
    });
  });
}

async function addKeyword() {
  const input = document.getElementById('keyword-input');
  const categoryInput = document.getElementById('category-input');
  const keyword = input.value.trim();
  const category = categoryInput.value || 'default';

  if (!keyword) return;

  try {
    const { keywords = [] } = await chrome.storage.local.get('keywords');

    // Check duplicate
    const exists = keywords.some(kw =>
      (typeof kw === 'string' ? kw : kw.text).toLowerCase() === keyword.toLowerCase()
    );

    if (exists) {
      alert(getMessage('alertDuplicate'));
      return;
    }

    keywords.push({
      id: crypto.randomUUID(),
      text: keyword,
      category: category,
      isRegex: false,
      caseSensitive: false
    });

    await chrome.storage.local.set({ keywords });
    input.value = '';
    renderKeywords(keywords);
    notifyContentScript();
  } catch (error) {
    console.error('[FB Blocker] addKeyword error:', error);
    alert(getMessage('alertAddError'));
  }
}

async function addKeywordsBulk() {
  const textarea = document.getElementById('bulk-input');
  const categoryInput = document.getElementById('category-input');
  const lines = textarea.value.split('\n').filter(line => line.trim());
  const category = categoryInput.value || 'default';

  if (lines.length === 0) return;

  try {
    const { keywords = [] } = await chrome.storage.local.get('keywords');
    const existingTexts = new Set(keywords.map(kw =>
      (typeof kw === 'string' ? kw : kw.text).toLowerCase()
    ));

    let added = 0;
    let duplicates = 0;

    for (const line of lines) {
      const text = line.trim();
      if (!text) continue;

      if (existingTexts.has(text.toLowerCase())) {
        duplicates++;
        continue;
      }

      keywords.push({
        id: crypto.randomUUID(),
        text,
        category: category,
        isRegex: false,
        caseSensitive: false
      });
      existingTexts.add(text.toLowerCase());
      added++;
    }

    await chrome.storage.local.set({ keywords });
    textarea.value = '';
    renderKeywords(keywords);
    notifyContentScript();

    let msg = getMessage('alertBulkAdded', [added.toString()]);
    if (duplicates > 0) {
      msg += ' ' + getMessage('alertDuplicatesSkipped', [duplicates.toString()]);
    }
    alert(msg);
  } catch (error) {
    console.error('[FB Blocker] addKeywordsBulk error:', error);
    alert(getMessage('alertAddError'));
  }
}

async function deleteKeyword(id, index) {
  try {
    const { keywords = [] } = await chrome.storage.local.get('keywords');

    // Try to delete by id first, fallback to index
    const idx = keywords.findIndex(kw => kw.id === id);
    if (idx !== -1) {
      keywords.splice(idx, 1);
    } else if (index >= 0 && index < keywords.length) {
      keywords.splice(index, 1);
    }

    await chrome.storage.local.set({ keywords });
    renderKeywords(keywords);
    notifyContentScript();
  } catch (error) {
    console.error('[FB Blocker] deleteKeyword error:', error);
  }
}

async function toggleEnabled() {
  try {
    const enabled = document.getElementById('enabled-toggle').checked;
    await chrome.storage.sync.set({ enabled });
    notifyContentScript();
  } catch (error) {
    console.error('[FB Blocker] toggleEnabled error:', error);
  }
}

// ============================================
// Import/Export
// ============================================

async function exportKeywords() {
  try {
    const { keywords = [] } = await chrome.storage.local.get('keywords');
    const { stats = { today: 0, total: 0 } } = await chrome.storage.local.get('stats');

    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      keywords,
      stats
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'fb-blocker-keywords.json';
    a.click();

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[FB Blocker] exportKeywords error:', error);
    alert(getMessage('alertExportError'));
  }
}

async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Security: File size limit (10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    alert(getMessage('alertFileTooLarge'));
    event.target.value = '';
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Security: Validate structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid format: not an object');
    }

    if (!data.keywords || !Array.isArray(data.keywords)) {
      throw new Error('Invalid format: keywords array not found');
    }

    // Security: Keyword count limit
    const MAX_KEYWORDS = 5000;
    if (data.keywords.length > MAX_KEYWORDS) {
      alert(getMessage('alertTooManyKeywords', [MAX_KEYWORDS.toString()]));
      event.target.value = '';
      return;
    }

    const { keywords: existing = [] } = await chrome.storage.local.get('keywords');

    // Check total limit
    if (existing.length + data.keywords.length > MAX_KEYWORDS) {
      alert(getMessage('alertTotalExceedsLimit', [MAX_KEYWORDS.toString(), existing.length.toString()]));
      event.target.value = '';
      return;
    }
    const existingTexts = new Set(existing.map(kw =>
      (typeof kw === 'string' ? kw : kw.text).toLowerCase()
    ));

    let added = 0;
    let duplicates = 0;

    const MAX_KEYWORD_LENGTH = 500;
    for (const kw of data.keywords) {
      const text = typeof kw === 'string' ? kw : kw.text;
      if (!text || typeof text !== 'string') continue;

      // Security: Validate keyword length
      const trimmedText = text.trim().substring(0, MAX_KEYWORD_LENGTH);
      if (!trimmedText) continue;

      if (existingTexts.has(trimmedText.toLowerCase())) {
        duplicates++;
        continue;
      }

      existing.push({
        id: crypto.randomUUID(),
        text: trimmedText,
        category: 'default',
        isRegex: false, // Security: Force false to prevent regex injection
        caseSensitive: false
      });
      existingTexts.add(trimmedText.toLowerCase());
      added++;
    }

    await chrome.storage.local.set({ keywords: existing });
    renderKeywords(existing);
    notifyContentScript();

    let msg = getMessage('alertImported', [added.toString()]);
    if (duplicates > 0) {
      msg += ' ' + getMessage('alertDuplicatesSkipped', [duplicates.toString()]);
    }
    alert(msg);

    // Reset file input
    event.target.value = '';
  } catch (error) {
    console.error('[FB Blocker] handleImport error:', error);
    alert(getMessage('alertImportError'));
    event.target.value = '';
  }
}

// ============================================
// Utilities
// ============================================

async function notifyContentScript() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.includes('facebook.com')) {
      chrome.tabs.sendMessage(tab.id, { action: 'update' }).catch(() => {});
    }
  } catch (error) {
    // Ignore - tab might not be facebook
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
