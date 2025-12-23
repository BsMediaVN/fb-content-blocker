/**
 * FB Content Blocker - Options Page Script
 * Advanced settings, whitelist management, regex support
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

const VALID_CATEGORIES = ['default', 'spam', 'ads', 'politics', 'other'];

// Current filter state
let currentSearch = '';
let currentCategory = '';
let allKeywords = [];

async function init() {
  applyI18n();
  await loadStats();
  await loadSettings();
  await loadKeywords();
  await loadWhitelist();
  setupEventListeners();
}

function setupEventListeners() {
  // Settings toggles
  document.getElementById('enabled-toggle').addEventListener('change', saveSettings);
  document.getElementById('block-comments-toggle').addEventListener('change', saveSettings);
  document.getElementById('case-sensitive-toggle').addEventListener('change', saveSettings);
  document.getElementById('show-placeholder-toggle').addEventListener('change', saveSettings);

  // Add keyword
  document.getElementById('add-btn').addEventListener('click', addKeyword);
  document.getElementById('keyword-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addKeyword();
  });

  // Search and filter
  document.getElementById('search-input').addEventListener('input', debounce((e) => {
    currentSearch = e.target.value.toLowerCase();
    renderKeywords();
  }, 200));

  document.getElementById('category-filter').addEventListener('change', (e) => {
    currentCategory = e.target.value;
    renderKeywords();
  });

  // Whitelist
  document.getElementById('add-whitelist-btn').addEventListener('click', addWhitelistItem);
  document.getElementById('whitelist-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addWhitelistItem();
  });

  // Import/Export
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', handleImport);
  document.getElementById('reset-stats-btn').addEventListener('click', resetStats);
}

// ============================================
// Stats
// ============================================

async function loadStats() {
  try {
    const [localData, syncData] = await Promise.all([
      chrome.storage.local.get(['stats', 'keywords', 'whitelist']),
      chrome.storage.sync.get('enabled')
    ]);

    const stats = localData.stats || { today: 0, total: 0, lastReset: null };
    const keywords = localData.keywords || [];
    const whitelist = localData.whitelist || [];

    const today = new Date().toISOString().split('T')[0];
    const todayCount = stats.lastReset === today ? stats.today : 0;

    document.getElementById('today-count').textContent = todayCount;
    document.getElementById('total-count').textContent = stats.total || 0;
    document.getElementById('keyword-count').textContent = keywords.length;
    document.getElementById('whitelist-count').textContent = whitelist.length;
  } catch (error) {
    console.error('[FB Blocker] loadStats error:', error);
  }
}

async function resetStats() {
  if (!confirm(getMessage('optionsResetConfirm'))) return;

  try {
    await chrome.storage.local.set({
      stats: { today: 0, total: 0, lastReset: null }
    });
    await loadStats();
    alert(getMessage('optionsResetSuccess'));
  } catch (error) {
    console.error('[FB Blocker] resetStats error:', error);
    alert(getMessage('optionsResetError'));
  }
}

// ============================================
// Settings
// ============================================

async function loadSettings() {
  try {
    const { settings = {} } = await chrome.storage.sync.get('settings');
    const { enabled = true } = await chrome.storage.sync.get('enabled');

    document.getElementById('enabled-toggle').checked = enabled !== false;
    document.getElementById('block-comments-toggle').checked = settings.blockComments !== false;
    document.getElementById('case-sensitive-toggle').checked = settings.caseSensitive === true;
    document.getElementById('show-placeholder-toggle').checked = settings.showPlaceholder !== false;
  } catch (error) {
    console.error('[FB Blocker] loadSettings error:', error);
  }
}

async function saveSettings() {
  try {
    const enabled = document.getElementById('enabled-toggle').checked;
    const blockComments = document.getElementById('block-comments-toggle').checked;
    const caseSensitive = document.getElementById('case-sensitive-toggle').checked;
    const showPlaceholder = document.getElementById('show-placeholder-toggle').checked;

    await chrome.storage.sync.set({
      enabled,
      settings: { blockComments, caseSensitive, showPlaceholder }
    });

    notifyContentScript();
  } catch (error) {
    console.error('[FB Blocker] saveSettings error:', error);
  }
}

// ============================================
// Keywords CRUD
// ============================================

async function loadKeywords() {
  try {
    const { keywords = [] } = await chrome.storage.local.get('keywords');
    allKeywords = keywords;
    renderKeywords();
  } catch (error) {
    console.error('[FB Blocker] loadKeywords error:', error);
  }
}

function renderKeywords() {
  const tbody = document.getElementById('keywords-tbody');

  // Filter
  let filtered = allKeywords;

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

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="4">${allKeywords.length === 0 ? getMessage('emptyKeywords') : getMessage('noMatch')}</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((kw, index) => {
    const text = typeof kw === 'string' ? kw : kw.text;
    const id = typeof kw === 'object' ? kw.id : index;
    const category = typeof kw === 'object' ? (kw.category || 'default') : 'default';
    const isRegex = typeof kw === 'object' && kw.isRegex;
    const categoryLabel = getCategoryLabel(category);

    return `
      <tr>
        <td>${escapeHtml(text)}</td>
        <td><span class="category-badge ${category}">${categoryLabel}</span></td>
        <td>${isRegex ? '<span class="regex-badge">REGEX</span>' : '-'}</td>
        <td>
          <button class="btn small danger" onclick="deleteKeyword('${id}', ${index})">${getMessage('btnDelete')}</button>
        </td>
      </tr>
    `;
  }).join('');

  // Update count
  document.getElementById('keyword-count').textContent = allKeywords.length;
}

async function addKeyword() {
  const input = document.getElementById('keyword-input');
  const categoryInput = document.getElementById('category-input');
  const isRegexInput = document.getElementById('is-regex-input');

  const text = input.value.trim();
  const category = categoryInput.value || 'default';
  const isRegex = isRegexInput.checked;

  if (!text) return;

  // Validate regex if enabled
  if (isRegex) {
    if (typeof RegexValidator !== 'undefined') {
      const result = RegexValidator.validate(text);
      if (!result.valid) {
        alert(getMessage('alertInvalidRegex', [result.error]));
        return;
      }
    } else {
      try {
        new RegExp(text);
      } catch (e) {
        alert(getMessage('alertInvalidRegex', [e.message]));
        return;
      }
    }
  }

  try {
    const { keywords = [] } = await chrome.storage.local.get('keywords');

    // Check duplicate
    const exists = keywords.some(kw =>
      (typeof kw === 'string' ? kw : kw.text).toLowerCase() === text.toLowerCase()
    );

    if (exists) {
      alert(getMessage('alertDuplicate'));
      return;
    }

    keywords.push({
      id: crypto.randomUUID(),
      text,
      category,
      isRegex,
      caseSensitive: false
    });

    await chrome.storage.local.set({ keywords });
    input.value = '';
    isRegexInput.checked = false;
    allKeywords = keywords;
    renderKeywords();
    notifyContentScript();
  } catch (error) {
    console.error('[FB Blocker] addKeyword error:', error);
    alert(getMessage('alertAddError'));
  }
}

window.deleteKeyword = async function(id, index) {
  try {
    const { keywords = [] } = await chrome.storage.local.get('keywords');

    const idx = keywords.findIndex(kw => kw.id === id);
    if (idx !== -1) {
      keywords.splice(idx, 1);
    } else if (index >= 0 && index < keywords.length) {
      keywords.splice(index, 1);
    }

    await chrome.storage.local.set({ keywords });
    allKeywords = keywords;
    renderKeywords();
    notifyContentScript();
  } catch (error) {
    console.error('[FB Blocker] deleteKeyword error:', error);
  }
};

// ============================================
// Whitelist
// ============================================

async function loadWhitelist() {
  try {
    const { whitelist = [] } = await chrome.storage.local.get('whitelist');
    renderWhitelist(whitelist);
  } catch (error) {
    console.error('[FB Blocker] loadWhitelist error:', error);
  }
}

function renderWhitelist(whitelist) {
  const container = document.getElementById('whitelist-tags');
  document.getElementById('whitelist-count').textContent = whitelist.length;

  if (whitelist.length === 0) {
    container.innerHTML = `<span style="color: #65676b; font-size: 13px;">${getMessage('emptyWhitelist')}</span>`;
    return;
  }

  container.innerHTML = whitelist.map((item, index) => {
    const text = typeof item === 'string' ? item : item.text;
    const id = typeof item === 'object' ? item.id : index;
    return `
      <span class="whitelist-tag">
        ${escapeHtml(text)}
        <button onclick="deleteWhitelistItem('${id}', ${index})">&times;</button>
      </span>
    `;
  }).join('');
}

async function addWhitelistItem() {
  const input = document.getElementById('whitelist-input');
  const text = input.value.trim();

  if (!text) return;

  try {
    const { whitelist = [] } = await chrome.storage.local.get('whitelist');

    // Check duplicate
    const exists = whitelist.some(item =>
      (typeof item === 'string' ? item : item.text).toLowerCase() === text.toLowerCase()
    );

    if (exists) {
      alert(getMessage('alertWhitelistDuplicate'));
      return;
    }

    whitelist.push({
      id: crypto.randomUUID(),
      text
    });

    await chrome.storage.local.set({ whitelist });
    input.value = '';
    renderWhitelist(whitelist);
    notifyContentScript();
  } catch (error) {
    console.error('[FB Blocker] addWhitelistItem error:', error);
    alert(getMessage('alertWhitelistError'));
  }
}

window.deleteWhitelistItem = async function(id, index) {
  try {
    const { whitelist = [] } = await chrome.storage.local.get('whitelist');

    const idx = whitelist.findIndex(item => item.id === id);
    if (idx !== -1) {
      whitelist.splice(idx, 1);
    } else if (index >= 0 && index < whitelist.length) {
      whitelist.splice(index, 1);
    }

    await chrome.storage.local.set({ whitelist });
    renderWhitelist(whitelist);
    notifyContentScript();
  } catch (error) {
    console.error('[FB Blocker] deleteWhitelistItem error:', error);
  }
};

// ============================================
// Import/Export
// ============================================

async function exportData() {
  try {
    const [localData, syncData] = await Promise.all([
      chrome.storage.local.get(['keywords', 'whitelist', 'stats']),
      chrome.storage.sync.get(['enabled', 'settings'])
    ]);

    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      keywords: localData.keywords || [],
      whitelist: localData.whitelist || [],
      stats: localData.stats || {},
      settings: {
        enabled: syncData.enabled,
        ...syncData.settings
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'fb-blocker-backup.json';
    a.click();

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[FB Blocker] exportData error:', error);
    alert('Lỗi khi xuất dữ liệu!');
  }
}

async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    alert('File quá lớn! Giới hạn 10MB.');
    event.target.value = '';
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid format');
    }

    // Import keywords
    if (data.keywords && Array.isArray(data.keywords)) {
      const { keywords: existing = [] } = await chrome.storage.local.get('keywords');
      const MAX_KEYWORDS = 5000;
      const MAX_KEYWORD_LENGTH = 500;

      const existingTexts = new Set(existing.map(kw =>
        (typeof kw === 'string' ? kw : kw.text).toLowerCase()
      ));

      let added = 0;
      for (const kw of data.keywords) {
        if (existing.length >= MAX_KEYWORDS) break;

        const text = typeof kw === 'string' ? kw : kw.text;
        if (!text || typeof text !== 'string') continue;

        const trimmedText = text.trim().substring(0, MAX_KEYWORD_LENGTH);
        if (!trimmedText || existingTexts.has(trimmedText.toLowerCase())) continue;

        // Validate category
        let category = 'default';
        if (typeof kw === 'object' && kw.category && VALID_CATEGORIES.includes(kw.category)) {
          category = kw.category;
        }

        existing.push({
          id: crypto.randomUUID(),
          text: trimmedText,
          category: category,
          isRegex: false,
          caseSensitive: false
        });
        existingTexts.add(trimmedText.toLowerCase());
        added++;
      }

      await chrome.storage.local.set({ keywords: existing });
      allKeywords = existing;
      renderKeywords();
    }

    // Import whitelist
    if (data.whitelist && Array.isArray(data.whitelist)) {
      const { whitelist: existing = [] } = await chrome.storage.local.get('whitelist');

      const existingTexts = new Set(existing.map(item =>
        (typeof item === 'string' ? item : item.text).toLowerCase()
      ));

      for (const item of data.whitelist) {
        const text = typeof item === 'string' ? item : item.text;
        if (!text || existingTexts.has(text.toLowerCase())) continue;

        existing.push({ id: crypto.randomUUID(), text });
        existingTexts.add(text.toLowerCase());
      }

      await chrome.storage.local.set({ whitelist: existing });
      renderWhitelist(existing);
    }

    // Import settings
    if (data.settings) {
      await chrome.storage.sync.set({
        enabled: data.settings.enabled !== false,
        settings: {
          blockComments: data.settings.blockComments !== false,
          caseSensitive: data.settings.caseSensitive === true
        }
      });
      await loadSettings();
    }

    await loadStats();
    notifyContentScript();
    alert(getMessage('alertImportSuccess'));
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
    const tabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { action: 'update' }).catch(() => {});
    }
  } catch (error) {
    // Ignore
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
