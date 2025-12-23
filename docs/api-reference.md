# FB Content Blocker - API Reference

**Version:** 1.0.0 | **Last Updated:** 2025-12-23 | **Status:** Complete

## Table of Contents

1. [KeywordMatcher API](#keywordmatcher-api)
2. [Stats API](#stats-api)
3. [Migration API](#migration-api)
4. [Content Script API](#content-script-api)
5. [Popup API](#popup-api)
6. [Chrome Storage Schema](#chrome-storage-schema)
7. [Message Protocol](#message-protocol)

---

## KeywordMatcher API

**Location:** `/src/core/matcher.js` | **Status:** Production

### Class Definition

```javascript
class KeywordMatcher {
  constructor(keywords = [])
  compile()
  matches(text)
  update(keywords)
  get count()
}
```

### Methods

#### `constructor(keywords = [])`

Initializes a new KeywordMatcher instance and compiles keywords into a regex pattern.

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| keywords | Array | [] | Array of keyword strings or objects |

**Returns:** KeywordMatcher instance

**Example:**
```javascript
const matcher = new KeywordMatcher(['facebook', 'ads']);
```

**Implementation Note:**
- Accepts both string and object formats
- Automatically calls compile()
- Safe for 0 keywords (null regex)

---

#### `compile()`

Compiles keywords into a single regex pattern with word boundary support.

**Returns:** void

**Pattern Format:** `\b(?:keyword1|keyword2|...)\b`

**Flags:**
- `g` - global (find all matches)
- `i` - case-insensitive
- `u` - Unicode support

**Safety Limits:**
- Max 5000 keywords (configurable via MAX_KEYWORDS)
- Max 1MB pattern size (configurable via MAX_PATTERN_SIZE)

**Example:**
```javascript
const matcher = new KeywordMatcher(['spam']);
// Internal: compiledRegex = /\b(?:spam)\b/giu

matcher.update(['spam', 'ads']);
// Recompiles: /\b(?:spam|ads)\b/giu
```

**Error Handling:**
```javascript
// If keywords exceed limit:
console.warn('[FB Blocker] Keyword limit reached: 5000');

// If pattern too large:
console.error('[FB Blocker] Regex pattern too large');
this.compiledRegex = null; // Disabled
```

---

#### `matches(text)`

Tests if text contains any blocked keyword.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| text | string | Text to check for keyword matches |

**Returns:** `boolean` - true if match found, false otherwise

**Example:**
```javascript
const matcher = new KeywordMatcher(['spam']);

matcher.matches('I hate spam posts');      // true
matcher.matches('I read a book');          // false
matcher.matches('SPAM is everywhere');     // true (case-insensitive)
```

**Performance:** O(n) where n = text.length (single regex pass)

**Edge Cases:**
```javascript
matcher.matches(null);                     // false
matcher.matches('');                       // false
matcher.matches(undefined);                // false (implicit)

const emptyMatcher = new KeywordMatcher([]);
emptyMatcher.matches('any text');          // false
```

**Regex Reset:**
```javascript
// Resets lastIndex for global regex
this.compiledRegex.lastIndex = 0;
```

---

#### `update(keywords)`

Updates keywords and recompiles the regex pattern.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| keywords | Array | New keywords array |

**Returns:** void

**Example:**
```javascript
const matcher = new KeywordMatcher(['spam']);
console.log(matcher.count); // 1

matcher.update(['spam', 'ads', 'clickbait']);
console.log(matcher.count); // 3

matcher.update([]);
console.log(matcher.count); // 0
```

**Note:** Should be called when keywords change from storage

---

#### `count` (getter)

Returns the number of compiled keywords.

**Returns:** `number`

**Example:**
```javascript
const matcher = new KeywordMatcher(['a', 'b', 'c']);
console.log(matcher.count); // 3
```

**Usage in Content Script:**
```javascript
if (matcher.count === 0) {
  console.log('No keywords to match');
  return; // Skip filtering
}
```

---

## Stats API

**Location:** `/src/core/stats.js` | **Status:** Production

### Object Definition

```javascript
const Stats = {
  async increment()
  async get()
  async reset()
}
```

### Data Structure

```javascript
{
  today: number,              // Posts blocked today (resets at midnight)
  total: number,              // All-time blocked posts
  lastReset: "2025-12-23"    // ISO date of last daily reset
}
```

### Methods

#### `Stats.increment()`

Increments both daily and total blocked post counters.

**Parameters:** None

**Returns:** `Promise<{today: number, total: number}>`

**Example:**
```javascript
const stats = await Stats.increment();
console.log(`Blocked today: ${stats.today}, Total: ${stats.total}`);
// Blocked today: 5, Total: 42
```

**Behavior:**
- Increments `today` count by 1
- Increments `total` count by 1
- Checks if new day (ISO date comparison)
- Resets `today` to 0 if new day
- Updates `lastReset` to current ISO date
- Persists to `chrome.storage.local`

**Storage Operation:**
```javascript
const { stats = { today: 0, total: 0, lastReset: null } } =
  await chrome.storage.local.get('stats');

const today = new Date().toISOString().split('T')[0]; // "2025-12-23"

if (stats.lastReset !== today) {
  stats.today = 0;
  stats.lastReset = today;
}

stats.today++;
stats.total++;

await chrome.storage.local.set({ stats });
```

**Error Handling:**
```javascript
try {
  return await Stats.increment();
} catch (error) {
  console.error('[FB Blocker] Stats.increment error:', error);
  return { today: 0, total: 0 }; // Safe default
}
```

---

#### `Stats.get()`

Retrieves current statistics with automatic daily reset detection.

**Parameters:** None

**Returns:** `Promise<{today: number, total: number}>`

**Example:**
```javascript
const stats = await Stats.get();
console.log(`Today: ${stats.today}, Total: ${stats.total}`);
```

**Behavior:**
- Fetches stats from storage
- Compares `lastReset` with current ISO date
- Returns today count if same day
- Returns 0 if different day (reset pending)
- Returns total always

**Reset Detection Logic:**
```javascript
const today = new Date().toISOString().split('T')[0];

if (stats.lastReset !== today) {
  return { today: 0, total: stats.total }; // Today reset
} else {
  return { today: stats.today, total: stats.total };
}
```

---

#### `Stats.reset()`

Manually resets all statistics to zero.

**Parameters:** None

**Returns:** `Promise<void>`

**Example:**
```javascript
await Stats.reset();
console.log((await Stats.get()).total); // 0
```

**Storage Operation:**
```javascript
await chrome.storage.local.set({
  stats: { today: 0, total: 0, lastReset: null }
});
```

**Use Case:** Manual reset via future settings UI

---

## Migration API

**Location:** `/src/utils/migration.js` | **Status:** Production

### Object Definition

```javascript
const Migration = {
  async migrateV1ToV2()
  async getVersion()
}
```

### Methods

#### `Migration.migrateV1ToV2()`

Performs one-time migration from v1 to v2 data format.

**Parameters:** None

**Returns:** `Promise<{migrated: boolean, count: number}>`

**Example:**
```javascript
const result = await Migration.migrateV1ToV2();
if (result.migrated) {
  console.log(`Migrated ${result.count} keywords`);
}
```

**Behavior:**
1. Checks current version in `chrome.storage.sync`
2. If version === 2, returns (already migrated)
3. If no keywords, sets version to 2 and returns
4. Transforms v1 keywords to v2 format
5. Moves keywords from sync → local storage
6. Removes keywords from sync storage
7. Sets version = 2 in sync storage

**v1 Format:**
```javascript
// chrome.storage.sync
{
  version: undefined,
  enabled: true,
  keywords: ["facebook", "ads", ...]  // Plain strings
}
```

**v2 Format:**
```javascript
// chrome.storage.sync
{
  version: 2,
  enabled: true
}

// chrome.storage.local
{
  keywords: [
    {
      id: "uuid-1",
      text: "facebook",
      category: "default",
      isRegex: false,
      caseSensitive: false
    },
    ...
  ]
}
```

**Transformation Logic:**
```javascript
const newKeywords = oldKeywords.map(item => {
  // Handle if already object (partial migration)
  if (typeof item === 'object' && item.text) {
    return {
      id: item.id || crypto.randomUUID(),
      text: item.text,
      category: item.category || 'default',
      isRegex: item.isRegex || false,
      caseSensitive: item.caseSensitive || false
    };
  }

  // Transform plain string
  return {
    id: crypto.randomUUID(),
    text: String(item),
    category: 'default',
    isRegex: false,
    caseSensitive: false
  };
});
```

**Return Values:**
```javascript
// Already migrated
{ migrated: false, count: 0 }

// Successfully migrated
{ migrated: true, count: 42 }

// No v1 data found
{ migrated: false, count: 0 }

// Error occurred
{ migrated: false, count: 0, error: "message" }
```

**Logging:**
```javascript
// Success
console.log('[FB Blocker] Migrated 42 keywords from v1 to v2');

// Error
console.error('[FB Blocker] Migration error:', error);
```

---

#### `Migration.getVersion()`

Retrieves current data schema version.

**Parameters:** None

**Returns:** `Promise<number>` - version number (1 or 2)

**Example:**
```javascript
const version = await Migration.getVersion();
console.log(`Data version: ${version}`);
```

**Default Behavior:**
- Returns 1 if version key not found
- Returns 2 if successfully migrated
- Returns 1 on error (safe default)

---

## Content Script API

**Location:** `/content.js` | **Status:** Production

### Public Functions

#### `init()`

Main initialization function called on script load.

**Called:** Automatically at script end
**Flow:**
1. Run migration
2. Load settings
3. Setup DOM observer
4. Filter existing content
5. Attach event listeners

---

#### `loadSettings()`

Loads keywords and enabled state from storage.

**Returns:** `Promise<void>`

**Storage Access:**
```javascript
const [localData, syncData] = await Promise.all([
  chrome.storage.local.get('keywords'),
  chrome.storage.sync.get('enabled')
]);

const keywords = localData.keywords || [];
const enabled = syncData.enabled !== false;

matcher.update(keywords);
```

---

#### `filterContent()`

Scans DOM and hides posts matching keywords.

**Returns:** void

**Algorithm:**
```
1. Check if enabled and keywords exist
2. For each post selector:
   3. Get all matching posts: querySelectorAll(selector)
   4. For each post:
      5. Skip if already processed: data-fb-blocked
      6. Get text: post.textContent
      7. Test: matcher.matches(text)
      8. If match: hidePost(post)
```

**Post Selectors:**
```javascript
const postSelectors = [
  '[data-pagelet^="FeedUnit"]',              // Feed posts
  '[role="article"]',                        // Semantic posts
  'div[data-ad-preview="message"]',          // Ads
  '.x1yztbdb.x1n2onr6.xh8yej3.x1ja2u2z'    // Utility class
];
```

---

#### `hidePost(post)`

Hides a post and creates a placeholder with unhide button.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| post | HTMLElement | Post DOM element |

**Returns:** `Promise<void>`

**DOM Changes:**
```javascript
post.dataset.fbBlocked = 'true';
post.dataset.originalDisplay = post.style.display;
post.style.display = 'none';

// Create placeholder
const placeholder = document.createElement('div');
placeholder.className = 'fb-blocker-placeholder';
placeholder.innerHTML = `
  <span>Nội dung đã bị ẩn bởi FB Content Blocker</span>
  <button class="fb-blocker-show-btn">Hiện</button>
`;

// Insert placeholder before hidden post
post.parentNode.insertBefore(placeholder, post);

// Attach click handler to show button
placeholder.querySelector('.fb-blocker-show-btn')
  .addEventListener('click', () => {
    post.style.display = post.dataset.originalDisplay || '';
    post.dataset.fbBlocked = 'shown';
    placeholder.remove();
  });

// Increment stats
Stats.increment();
```

---

#### `resetHiddenPosts()`

Removes all placeholders and restores original post visibility.

**Returns:** void

**Operations:**
```javascript
// Remove all placeholders
document.querySelectorAll('.fb-blocker-placeholder')
  .forEach(el => el.remove());

// Restore hidden posts
document.querySelectorAll('[data-fb-blocked]')
  .forEach(post => {
    post.style.display = post.dataset.originalDisplay || '';
    delete post.dataset.fbBlocked;
    delete post.dataset.originalDisplay;
  });
```

**Trigger:** When keywords change or extension disabled

---

### Event Listeners

#### `chrome.runtime.onMessage`

Listens for messages from popup.

**Trigger:** `notifyContentScript()` in popup

**Message Format:**
```javascript
{
  action: "update"  // Keywords or settings changed
}
```

**Handler:**
```javascript
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'update') {
    loadSettings().then(() => {
      resetHiddenPosts();
      filterContent();
    });
  }
});
```

---

#### `chrome.storage.onChanged`

Listens for storage changes (automatic sync across tabs).

**Trigger:** Any storage.set() or storage.remove() call

**Handler:**
```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
  // Keywords changed (in local storage)
  if (areaName === 'local' && changes.keywords) {
    matcher.update(changes.keywords.newValue || []);
    resetHiddenPosts();
    filterContent();
  }

  // Enabled state changed (in sync storage)
  if (areaName === 'sync' && changes.enabled) {
    enabled = changes.enabled.newValue !== false;
    if (!enabled) {
      resetHiddenPosts();
    } else {
      filterContent();
    }
  }
});
```

---

#### `MutationObserver`

Monitors DOM for new posts (debounced).

**Configuration:**
```javascript
observer.observe(document.body, {
  childList: true,  // Watch for added/removed nodes
  subtree: true     // Watch entire subtree
});
```

**Debounce:**
- Delay: 300ms
- Prevents rapid refiltering
- Batches multiple DOM changes

**Callback:**
```javascript
const observer = new MutationObserver(() => {
  if (!enabled || matcher.count === 0) return;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    filterContent();
  }, DEBOUNCE_MS);
});
```

---

## Popup API

**Location:** `/popup.js` | **Status:** Production

### Initialization

#### `init()`

Main popup initialization on DOM load.

**Trigger:** `DOMContentLoaded` event

**Sequence:**
```javascript
async function init() {
  await loadKeywords();
  await loadEnabled();
  await loadStats();
  setupEventListeners();
}
```

---

### Keyword Management

#### `loadKeywords()`

Fetches keywords from storage and renders list.

**Returns:** `Promise<void>`

**Operation:**
```javascript
const { keywords = [] } = await chrome.storage.local.get('keywords');
renderKeywords(keywords);
```

---

#### `addKeyword()`

Adds a single keyword from input field.

**Returns:** `Promise<void>`

**Validation:**
- Non-empty input
- Not duplicate (case-insensitive)

**Storage:**
```javascript
keywords.push({
  id: crypto.randomUUID(),
  text: keyword,
  category: 'default',
  isRegex: false,
  caseSensitive: false
});

await chrome.storage.local.set({ keywords });
renderKeywords(keywords);
notifyContentScript();
```

---

#### `addKeywordsBulk()`

Adds multiple keywords from textarea (one per line).

**Parameters:** None (reads from `#bulk-input` textarea)

**Returns:** `Promise<void>`

**Processing:**
```javascript
const lines = textarea.value.split('\n').filter(line => line.trim());

let added = 0;
let duplicates = 0;

for (const line of lines) {
  const text = line.trim();

  if (existingTexts.has(text.toLowerCase())) {
    duplicates++;
    continue;
  }

  keywords.push({
    id: crypto.randomUUID(),
    text,
    category: 'default',
    isRegex: false,
    caseSensitive: false
  });

  existingTexts.add(text.toLowerCase());
  added++;
}

alert(`Đã thêm ${added} từ khóa. Bỏ qua ${duplicates} từ trùng lặp.`);
```

---

#### `deleteKeyword(id, index)`

Deletes a keyword by ID or index.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| id | string | Keyword UUID |
| index | number | Fallback array index |

**Returns:** `Promise<void>`

**Logic:**
```javascript
const idx = keywords.findIndex(kw => kw.id === id);
if (idx !== -1) {
  keywords.splice(idx, 1);
} else if (index >= 0 && index < keywords.length) {
  keywords.splice(index, 1);
}

await chrome.storage.local.set({ keywords });
renderKeywords(keywords);
notifyContentScript();
```

---

#### `renderKeywords(keywords)`

Renders keyword list in UI.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| keywords | Array | Keywords to render |

**Returns:** void

**HTML Generation:**
```javascript
const list = document.getElementById('keywords-list');
const countEl = document.getElementById('keyword-count');

countEl.textContent = keywords.length;

if (keywords.length === 0) {
  list.innerHTML = '<li class="empty-message">Chưa có từ khóa nào</li>';
  return;
}

list.innerHTML = keywords.map((keyword, index) => {
  const text = typeof keyword === 'string' ? keyword : keyword.text;
  const id = typeof keyword === 'object' ? keyword.id : index;
  return `
    <li>
      <span>${escapeHtml(text)}</span>
      <button class="delete-btn" data-id="${id}" data-index="${index}">Xóa</button>
    </li>
  `;
}).join('');

// Attach delete handlers
list.querySelectorAll('.delete-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    deleteKeyword(btn.dataset.id, parseInt(btn.dataset.index, 10));
  });
});
```

---

### Settings

#### `loadEnabled()`

Loads extension enabled/disabled state.

**Returns:** `Promise<void>`

```javascript
const { enabled = true } = await chrome.storage.sync.get('enabled');
document.getElementById('enabled-toggle').checked = enabled !== false;
```

---

#### `toggleEnabled()`

Toggles extension on/off.

**Returns:** `Promise<void>`

```javascript
const enabled = document.getElementById('enabled-toggle').checked;
await chrome.storage.sync.set({ enabled });
notifyContentScript();
```

---

### Statistics

#### `loadStats()`

Fetches and displays blocking statistics.

**Returns:** `Promise<void>`

**Logic:**
```javascript
const { stats = { today: 0, total: 0, lastReset: null } } =
  await chrome.storage.local.get('stats');

const today = new Date().toISOString().split('T')[0];
const todayCount = stats.lastReset === today ? stats.today : 0;

document.getElementById('today-count').textContent = todayCount;
document.getElementById('total-count').textContent = stats.total || 0;
```

---

### Import/Export

#### `exportKeywords()`

Exports keywords and stats as JSON file.

**Returns:** `Promise<void>`

**File Format:**
```javascript
{
  version: 2,
  exportedAt: "2025-12-23T10:30:00.000Z",
  keywords: [...],
  stats: {
    today: 5,
    total: 42,
    lastReset: "2025-12-23"
  }
}
```

**Download:**
```javascript
const data = { version: 2, exportedAt: new Date().toISOString(), ... };
const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);

const a = document.createElement('a');
a.href = url;
a.download = 'fb-blocker-keywords.json';
a.click();

URL.revokeObjectURL(url);
```

---

#### `handleImport(event)`

Imports keywords and stats from JSON file.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| event | Event | File input change event |

**Returns:** `Promise<void>`

**Validation Steps:**
1. File size <= 10MB
2. Valid JSON format
3. Keywords array present
4. Total <= 5000 keywords
5. Individual keyword length <= 500 chars

**Process:**
```javascript
const file = event.target.files[0];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

if (file.size > MAX_FILE_SIZE) {
  alert('File quá lớn! Giới hạn 10MB.');
  return;
}

const text = await file.text();
const data = JSON.parse(text);

// Validate structure
if (!data.keywords || !Array.isArray(data.keywords)) {
  throw new Error('Invalid format');
}

// Validate count
if (data.keywords.length > MAX_KEYWORDS) {
  alert(`Quá nhiều từ khóa! Giới hạn ${MAX_KEYWORDS}`);
  return;
}

// Merge with existing
const existing = (await chrome.storage.local.get('keywords')).keywords || [];

let added = 0, duplicates = 0;

for (const kw of data.keywords) {
  const text = typeof kw === 'string' ? kw : kw.text;
  if (!text || typeof text !== 'string') continue;

  const trimmed = text.trim().substring(0, MAX_KEYWORD_LENGTH);
  if (!trimmed) continue;

  if (existingTexts.has(trimmed.toLowerCase())) {
    duplicates++;
    continue;
  }

  existing.push({
    id: crypto.randomUUID(),
    text: trimmed,
    category: 'default',
    isRegex: false,  // Force safe value
    caseSensitive: false
  });

  added++;
}

await chrome.storage.local.set({ keywords: existing });
renderKeywords(existing);
notifyContentScript();

alert(`Đã nhập ${added} từ khóa. Bỏ qua ${duplicates} từ trùng lặp.`);
```

---

### Utilities

#### `notifyContentScript()`

Sends update message to content script on current tab.

**Returns:** `Promise<void>`

```javascript
async function notifyContentScript() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (tab?.url?.includes('facebook.com')) {
      chrome.tabs.sendMessage(tab.id, { action: 'update' })
        .catch(() => {}); // Tab may not have content script
    }
  } catch (error) {
    // Ignore errors
  }
}
```

---

#### `escapeHtml(text)`

Escapes HTML special characters.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| text | string | Text to escape |

**Returns:** `string` - Escaped HTML

**Implementation:**
```javascript
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

**Example:**
```javascript
escapeHtml('<script>alert("xss")</script>');
// Returns: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;
```

---

## Chrome Storage Schema

**Location:** Accessed via `chrome.storage.sync/local` API

### chrome.storage.sync

**Purpose:** Settings and metadata (synced across devices)

**Data:**
```typescript
interface SyncStorage {
  version?: number;      // Data schema version (1 or 2)
  enabled?: boolean;     // Extension enabled/disabled (default: true)
}
```

**Example:**
```javascript
// Set
await chrome.storage.sync.set({
  version: 2,
  enabled: true
});

// Get
const { version = 1, enabled = true } =
  await chrome.storage.sync.get(['version', 'enabled']);
```

**Limits:**
- 100KB total quota
- 8KB per key
- Synced automatically by Chrome

---

### chrome.storage.local

**Purpose:** Large data (keywords, statistics) local to device

**Data:**
```typescript
interface LocalStorage {
  keywords?: Array<{
    id: string;           // UUID
    text: string;         // Keyword text
    category?: string;    // "default" or other
    isRegex?: boolean;    // false in v1.0
    caseSensitive?: boolean;  // false in v1.0
  }>;

  stats?: {
    today: number;        // Posts blocked today
    total: number;        // All-time posts blocked
    lastReset?: string;   // ISO date "2025-12-23"
  };
}
```

**Example:**
```javascript
// Set
await chrome.storage.local.set({
  keywords: [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      text: 'facebook',
      category: 'default',
      isRegex: false,
      caseSensitive: false
    }
  ],
  stats: {
    today: 5,
    total: 42,
    lastReset: '2025-12-23'
  }
});

// Get
const { keywords = [], stats = null } =
  await chrome.storage.local.get(['keywords', 'stats']);
```

**Limits:**
- 5MB+ quota
- Device-only (not synced)
- Persists until user clears
- Fast access

---

## Message Protocol

### Content Script ↔ Popup Communication

**Direction:** Popup → Content Script (via chrome.tabs.sendMessage)

**Message:**
```typescript
interface UpdateMessage {
  action: "update";
  // No additional payload
  // Content script will fetch fresh data from storage
}
```

**Usage (Popup):**
```javascript
async function notifyContentScript() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (tab?.url?.includes('facebook.com')) {
    chrome.tabs.sendMessage(tab.id, { action: 'update' })
      .catch(() => {}); // Ignore if content script not loaded
  }
}
```

**Handler (Content Script):**
```javascript
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'update') {
    loadSettings().then(() => {
      resetHiddenPosts();
      filterContent();
    });
  }
});
```

---

### Storage Change Events

**Event:** `chrome.storage.onChanged`

**Listener (Content Script):**
```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.keywords) {
      matcher.update(changes.keywords.newValue || []);
      filterContent();
    }
    if (changes.stats) {
      // Stats updated externally
    }
  }

  if (areaName === 'sync') {
    if (changes.version) {
      // Version changed
    }
    if (changes.enabled) {
      enabled = changes.enabled.newValue !== false;
      // Refresh display
    }
  }
});
```

**Listener (Popup):**
```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.keywords) {
    renderKeywords(changes.keywords.newValue || []);
  }
  if (areaName === 'local' && changes.stats) {
    loadStats();
  }
});
```

---

## Error Handling Guide

### Storage Errors

```javascript
try {
  await chrome.storage.local.set({ keywords });
} catch (error) {
  console.error('[FB Blocker] Storage error:', error);

  if (error.message.includes('QUOTA_BYTES')) {
    // Storage quota exceeded
    alert('Storage quota exceeded. Please delete some keywords.');
  } else {
    // Other storage error
    alert('Error saving keywords. Please try again.');
  }
}
```

### Message Passing Errors

```javascript
// Content script may not be loaded on non-facebook.com tabs
chrome.tabs.sendMessage(tabId, { action: 'update' })
  .then(() => {
    console.log('[FB Blocker] Content script notified');
  })
  .catch((error) => {
    console.log('[FB Blocker] Content script not available:', error.message);
  });
```

### File Import Errors

```javascript
try {
  const text = await file.text();
  const data = JSON.parse(text);

  if (!data.keywords || !Array.isArray(data.keywords)) {
    throw new Error('Invalid keywords array');
  }
} catch (error) {
  console.error('[FB Blocker] Import error:', error);
  alert('Invalid JSON file. Please check the format.');
}
```

---

## Performance Characteristics

### Operation Timing

| Operation | Time | Notes |
|-----------|------|-------|
| Regex compilation (100 keywords) | ~10ms | One-time on init/update |
| Text matching (100 keywords) | ~0.1ms | Per post, single regex pass |
| DOM filtering (100 posts) | ~10ms | Total for all posts |
| Storage get/set | ~5ms | Depends on data size |
| Message passing | <1ms | IPC overhead |

### Memory Usage

| Component | Size | Notes |
|-----------|------|-------|
| 100 keywords | ~5KB | 50 bytes avg per keyword |
| Compiled regex | ~2KB | Pattern string + metadata |
| Per post placeholder | ~200 bytes | DOM + event listener |
| Total (100 keywords + 50 posts) | ~15KB | Negligible impact |

---

## Security Considerations

### Input Validation

- All user input must be escaped before DOM use
- All regex patterns must escape user input
- File imports must validate structure and size
- Keyword length limited to 500 characters

### Code Execution Prevention

- Never use `eval()` or `new Function()`
- Use `textContent` instead of `innerHTML` for untrusted content
- Force `isRegex: false` on imports (prevent regex injection)
- Use `crypto.randomUUID()` for IDs (secure)

---

## Future API Enhancements

### Planned (Phase 2+)

- Regex pattern support (opt-in with `isRegex: true`)
- Case-sensitive matching (`caseSensitive: true`)
- Categories API for keyword grouping
- Allowlist support
- Statistics export API
- Dark mode preference API

---

## Examples

### Example 1: Add and Block a Keyword

```javascript
// Popup: User adds keyword
const keyword = 'spam';
const { keywords = [] } = await chrome.storage.local.get('keywords');

keywords.push({
  id: crypto.randomUUID(),
  text: keyword,
  category: 'default',
  isRegex: false,
  caseSensitive: false
});

await chrome.storage.local.set({ keywords });

// Content script: Detects storage change
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.keywords) {
    matcher.update(changes.keywords.newValue);
    filterContent(); // Posts with "spam" now hidden
  }
});
```

### Example 2: Export and Import Keywords

```javascript
// Export
const { keywords, stats } = await chrome.storage.local.get(['keywords', 'stats']);
const data = { version: 2, keywords, stats, exportedAt: new Date().toISOString() };
const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'fb-blocker-keywords.json';
a.click();

// Import
const file = document.getElementById('import-file').files[0];
const text = await file.text();
const data = JSON.parse(text);
// Validate and merge
await chrome.storage.local.set({ keywords: data.keywords });
```

### Example 3: Check Disabled Status

```javascript
// Content script: Check if extension is disabled
const { enabled = true } = await chrome.storage.sync.get('enabled');

if (!enabled) {
  console.log('[FB Blocker] Extension disabled');
  resetHiddenPosts();
  observer.disconnect();
  return;
}

// Enable filtering
filterContent();
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-23 | Initial release - Complete API documentation |

---

## Support & Debugging

**Check Storage State:**
```javascript
chrome.storage.local.get(null, (all) => console.log('Local:', all));
chrome.storage.sync.get(null, (all) => console.log('Sync:', all));
```

**Monitor Storage Changes:**
```javascript
chrome.storage.onChanged.addListener((changes, area) => {
  console.log(`[${area}] Changed:`, changes);
});
```

**Test KeywordMatcher:**
```javascript
const matcher = new KeywordMatcher(['test', 'keywords']);
console.log(matcher.matches('This is a test'));      // true
console.log(matcher.matches('Nothing here'));        // false
console.log(matcher.count);                          // 2
```
