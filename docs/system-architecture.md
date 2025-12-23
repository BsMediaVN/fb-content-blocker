# FB Content Blocker - System Architecture

**Version:** 1.0.0 | **Last Updated:** 2025-12-23 | **Phase:** 1 - Core Implementation

## System Overview

FB Content Blocker is a Chrome Extension (Manifest V3) that provides keyword-based content filtering for Facebook. The system consists of three main components: a popup UI for user interaction, a content script for DOM filtering, and a storage layer for persistence.

```
┌──────────────────────────────────────────────────────────────┐
│                    Chrome Browser                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              FB Content Blocker Extension              │  │
│  │                                                        │  │
│  │  ┌──────────────┐         ┌──────────────────────┐   │  │
│  │  │  POPUP UI    │         │  CONTENT SCRIPT      │   │  │
│  │  │              │         │                      │   │  │
│  │  │ • Add        │         │ • MutationObserver   │   │  │
│  │  │ • Delete     │◄──────► │ • Keyword Matching   │   │  │
│  │  │ • Import     │  Msg    │ • DOM Filtering      │   │  │
│  │  │ • Export     │         │ • Stats Tracking     │   │  │
│  │  │ • Statistics │         │                      │   │  │
│  │  └──────────────┘         └──────────────────────┘   │  │
│  │         ▲                          ▲                  │  │
│  │         │         Storage Listener │                  │  │
│  │         └──────────┬───────────────┘                  │  │
│  │                    │                                  │  │
│  │  ┌─────────────────▼──────────────────────────────┐  │  │
│  │  │        Chrome Storage API (Local/Sync)         │  │  │
│  │  │  ├─ sync: settings, version, enabled           │  │  │
│  │  │  └─ local: keywords, statistics                │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                          │                                    │
│            ┌─────────────▼──────────────┐                    │
│            │   facebook.com (Target)    │                    │
│            │  • Feed posts              │                    │
│            │  • Content hidden/shown    │                    │
│            └─────────────────────────────┘                    │
└──────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Popup UI Layer (`popup.html`, `popup.js`, `popup.css`)

**Responsibility:** User interface for extension settings and keyword management

**Scope:**
- Keyword CRUD operations (create, read, update, delete)
- Import/Export JSON data
- Enable/disable extension
- Display statistics

**Design:**
- Single-page popup (no routing)
- Event-driven (user interactions trigger state updates)
- Real-time stats display
- Responsive 400x600px layout

**Architecture Pattern:**
```
User Action
    ↓
Event Listener
    ↓
Handler Function
    ↓
Chrome Storage Update
    ↓
notifyContentScript()
    ↓
Content Script Reloads
```

**Key Functions:**
```javascript
// Event setup
setupEventListeners()

// CRUD operations
loadKeywords()
addKeyword()
deleteKeyword()
addKeywordsBulk()
renderKeywords()

// Settings
loadEnabled()
toggleEnabled()

// Data I/O
exportKeywords()
handleImport()

// Notifications
notifyContentScript()
```

---

### 2. Content Script Layer (`content.js`)

**Responsibility:** Facebook feed filtering and DOM manipulation

**Execution Context:**
- Runs in `document_idle` (after DOM fully loaded)
- Has access to Facebook's DOM
- Can read/modify page content
- Cannot access popup directly (uses chrome.runtime.sendMessage)

**Scope:**
- Monitor DOM changes with MutationObserver
- Regex-based keyword matching
- Hide/show posts with placeholders
- Track blocking statistics
- Perform v1→v2 data migration

**Initialization Sequence:**
```
Extension Load
    ↓
content.js Execute
    ↓
Migration.migrateV1ToV2()
    ↓
loadSettings() [load keywords + enabled state]
    ↓
setupObserver() [attach MutationObserver]
    ↓
filterContent() [scan existing DOM]
    ↓
Listen for storage.onChanged
Listen for runtime.onMessage
```

**Core Classes & Objects:**

1. **KeywordMatcher**
   - Compiles keywords into regex pattern
   - Performs word boundary matching
   - Case-insensitive, Unicode support
   - O(n) text scanning performance

2. **Stats**
   - Tracks daily + total blocked posts
   - Auto-resets at midnight (ISO date)
   - Persists to chrome.storage.local

3. **Migration**
   - One-time v1→v2 upgrade
   - Transforms keyword format
   - Moves data from sync→local storage
   - Sets version flag

**Core Functions:**

```javascript
// Initialization
async init()
async loadSettings()
function setupObserver()

// DOM filtering
function filterContent()
async function hidePost(post)
function resetHiddenPosts()
```

---

### 3. Storage Layer

**Chrome Storage Architecture:**

| Aspect | sync | local | session |
|--------|------|-------|---------|
| **Capacity** | 100KB total | 5MB+ | 1MB |
| **Scope** | Cross-device | Device only | Runtime only |
| **Use Case** | Settings | Large data | State (unused v1) |
| **Persistence** | Yes | Yes | No (auto-clear) |

**Schema Design:**

**chrome.storage.sync (Settings):**
```javascript
{
  version: 2,              // Data schema version
  enabled: true,           // Extension enabled/disabled
}
```

**chrome.storage.local (Data):**
```javascript
{
  keywords: [
    {
      id: "550e8400-e29b-41d4-a716-446655440000",
      text: "keyword",
      category: "default",
      isRegex: false,
      caseSensitive: false
    }
  ],
  stats: {
    today: 5,              // Blocked posts today
    total: 42,             // All-time blocked
    lastReset: "2025-12-23" // ISO date for daily reset
  }
}
```

**Migration Path (v1→v2):**

```
v1 State:
chrome.storage.sync = {
  version: undefined,
  enabled: true,
  keywords: ["facebook", "ads", ...]  // plain strings
}

    ↓ Migration.migrateV1ToV2()

v2 State:
chrome.storage.sync = {
  version: 2,
  enabled: true
  // keywords REMOVED
}

chrome.storage.local = {
  keywords: [
    { id: uuid(), text: "facebook", ... },
    ...
  ]
}
```

---

## Data Flow Architecture

### Flow 1: User Adds a Keyword

```
popup.js
├─ User clicks "Add" button
├─ addKeyword()
├─ Fetch existing keywords from chrome.storage.local
├─ Validate: not duplicate, valid input
├─ Append new keyword object
├─ chrome.storage.local.set({ keywords })
│
└─ chrome.storage.onChanged fires
   └─ content.js (if on facebook.com)
      ├─ matcher.update(newKeywords)
      ├─ resetHiddenPosts()
      └─ filterContent()
```

### Flow 2: MutationObserver Detects New Posts

```
Facebook Feed (DOM changes)
    ↓
MutationObserver fires
    ↓
content.js setupObserver() callback
    ├─ Check: enabled && matcher.count > 0
    ├─ Clear debounce timer
    ├─ Set new 300ms debounce timer
    └─ Timer expires
       ├─ filterContent()
       ├─ Query all post selectors
       ├─ For each post:
       │  ├─ Get textContent
       │  ├─ matcher.matches(text)
       │  ├─ If match: hidePost()
       │  │  ├─ Set display: none
       │  │  ├─ Stats.increment()
       │  │  └─ Insert placeholder button
       │  └─ Else: mark as processed
       └─ Done
```

### Flow 3: User Imports Keywords

```
popup.js
├─ User selects JSON file
├─ handleImport()
├─ Validate file:
│  ├─ Size < 10MB
│  ├─ Valid JSON structure
│  └─ keywords array present
├─ Validate each keyword:
│  ├─ String type
│  ├─ Length < 500 chars
│  └─ Not duplicate
├─ Transform to v2 format
├─ Fetch existing keywords
├─ Merge (existing + new)
├─ chrome.storage.local.set({ keywords })
│
└─ Chrome storage fires onChanged
   └─ content.js reloads + refilters
```

### Flow 4: Extension Enable/Disable

```
popup.js
├─ User toggles enabled checkbox
├─ toggleEnabled()
├─ chrome.storage.sync.set({ enabled: true/false })
│
└─ Chrome storage fires onChanged
   └─ content.js
      ├─ If enabled: filterContent()
      └─ If disabled: resetHiddenPosts()
```

---

## Message Passing Protocol

### Message Types

**Popup → Content Script (chrome.tabs.sendMessage)**
```javascript
// Type: UPDATE - Keywords or settings changed
{
  action: "update"
  // No data - content script refetches from storage
}
```

**Content Script → Popup (via Storage)**
```
// No direct message
// Popup listens to chrome.storage.onChanged
// Updates stats & keyword list in real-time
```

**Cross-Tab Synchronization**
```javascript
// Via chrome.storage
// All tabs with facebook.com will see storage changes
// Due to chrome.storage.onChanged listener
// They'll independently refetch & refilter
```

---

## DOM Filtering Strategy

### Post Selector Fallbacks

Facebook's DOM structure changes frequently. System uses multiple selectors with fallback:

```javascript
const postSelectors = [
  '[data-pagelet^="FeedUnit"]',              // 2024+ structure
  '[role="article"]',                        // Semantic HTML fallback
  'div[data-ad-preview="message"]',          // Sponsored content
  '.x1yztbdb.x1n2onr6.xh8yej3.x1ja2u2z'    // Utility class fallback
];
```

### Post Blocking Flow

```
For each selector:
├─ querySelectorAll(selector)
└─ For each matched post:
   ├─ Check data-fb-blocked (avoid reprocessing)
   ├─ Extract textContent
   ├─ matcher.matches(text)
   ├─ If match:
   │  ├─ Set display: none
   │  ├─ Store original display in data attribute
   │  ├─ Create placeholder div
   │  ├─ Add "Show" button with click handler
   │  ├─ Insert before hidden post
   │  └─ Set data-fb-blocked="true"
   │
   └─ If no match: mark as processed (optional)
```

### State Machine

```
Post States:
├─ Initial state: no data-fb-blocked attribute
│  └─ First time: check if should hide
│
├─ data-fb-blocked="true": post is hidden
│  └─ User can click "Show" button
│
└─ data-fb-blocked="shown": user revealed post
   └─ Won't hide again until page reload
```

---

## Performance Considerations

### Regex Compilation

**Cost:** ~10ms per 100 keywords (one-time on init/update)
```javascript
const pattern = `\\b(?:${escaped.join('|')})\\b`;
this.compiledRegex = new RegExp(pattern, 'giu');
```

**Optimization:** Compile once on keywords change, reuse for all text scans

### Text Matching

**Cost:** ~0.1ms per post (single regex pass)
```javascript
this.compiledRegex.test(text); // O(n) where n = text length
```

**Optimization:** Word boundary `\b` enables regex engine to skip irrelevant matches

### DOM Filtering

**Cost:** ~10ms per 100 posts (loop + regex tests)
```javascript
posts.forEach(post => {
  if (matcher.matches(post.textContent)) hidePost(post);
});
```

**Optimization:**
- Debounce at 300ms (only run once per 300ms of mutations)
- Skip already-processed posts (data-fb-blocked check)
- Use efficient selectors

### Memory Profile

```
100 keywords:
├─ Keywords array: ~5KB (50 bytes avg × 100)
├─ Compiled regex: ~2KB
├─ Per post placeholder: ~200 bytes
└─ Total: ~7KB base + 200 bytes per hidden post
```

---

## Error Handling Strategy

### Try-Catch Pattern

**All async operations wrapped:**
```javascript
async function operation() {
  try {
    await somePromise();
    return result;
  } catch (error) {
    console.error('[FB Blocker] operation error:', error);
    return defaultSafeValue; // Never throw
  }
}
```

### Graceful Degradation

| Error | Behavior |
|-------|----------|
| Storage read fails | Use empty defaults (keywords=[]) |
| Regex compilation fails | Set matcher to null, extension disabled |
| MutationObserver error | Log error, stop monitoring (safe) |
| File import invalid | Show alert, reject file, no corruption |

### Logging

**All errors prefixed with [FB Blocker]:**
```javascript
console.error('[FB Blocker] loadSettings error:', error);
console.warn('[FB Blocker] Keyword limit reached: 5000');
console.log('[FB Blocker] Migration successful: 42 keywords');
```

---

## Security Architecture

### Input Sanitization

**Rule 1: User input → Regex**
```javascript
// ALWAYS escape before regex
const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
```

**Rule 2: User input → DOM**
```javascript
// ALWAYS use textContent (not innerHTML)
div.textContent = keyword; // Safe, no HTML parsing
// OR escape if HTML required
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

**Rule 3: Import validation**
```javascript
// Check type, size, structure
if (!Array.isArray(data.keywords)) throw error;
if (data.keywords.length > MAX) throw error;
for (const kw of data.keywords) {
  if (typeof kw.text !== 'string') continue;
  const safe = kw.text.trim().substring(0, MAX_LEN);
}
```

### Code Execution Prevention

**Never:**
```javascript
❌ eval(userInput)
❌ new Function(userInput)
❌ setTimeout(userInput, 0)
❌ innerHTML with concatenation: `<div>${userInput}</div>`
```

**Always:**
```javascript
✓ textContent for display
✓ Escaped strings for regex
✓ Declarative data manipulation
```

### Data Isolation

- Content script has access to Facebook DOM only
- Cannot access user browsing history
- Cannot read other extensions' storage
- Popup cannot directly read Facebook page content

---

## Testing Architecture

### Test Pyramid

```
     Manual Testing (Facebook site)
    /\
   /  \
  /────\        Integration Tests (Storage + UI)
 /      \
/────────\      Unit Tests (23 tests - matcher logic)
```

### Unit Tests (tests/matcher.test.js)

**Coverage:** KeywordMatcher class only
**Test Count:** 23 tests
**Categories:**
- Word boundary (8 tests)
- Case-insensitive (3 tests)
- Multiple keywords (4 tests)
- Special characters (4 tests)
- Edge cases (4 tests)

**Run:** `node tests/matcher.test.js`

### Test Data

```javascript
// Test vectors for word boundary
{
  keyword: 'book',
  positives: ['a book', 'book is', 'the book'],
  negatives: ['facebook', 'bookcase', 'handbook']
}

// Test vectors for special chars
{
  keyword: 'c++',
  text: 'I love c++ programming',
  expected: true
}
```

---

## Scalability Considerations

### Keyword Limits

| Metric | Limit | Impact |
|--------|-------|--------|
| Keywords | 5000 | Regex pattern size (~1MB) |
| Keyword length | 500 chars | Individual keyword validation |
| Total storage | 5MB local | Chrome storage quota |
| Concurrent posts | 1000+ | Performance depends on CPU |

### Optimization Opportunities

1. **Keyword Segmentation:** Split into categories (reduce regex size)
2. **Post Caching:** Cache matched/non-matched posts
3. **Priority Queue:** Higher-priority keywords first
4. **Trie-based Matching:** Alternative to regex (future)
5. **Web Worker:** Offload regex compilation (future)

---

## Deployment Architecture

### Distribution

**Platform:** Chrome Web Store
**Manifest Version:** 3 (required)
**Permissions:**
```json
{
  "permissions": ["storage", "activeTab"],
  "host_permissions": ["*://*.facebook.com/*"]
}
```

**Installation:** Users install from Chrome Web Store → automatic updates

### Data Handling

**User Data:**
- Keywords: Stored locally on device
- Statistics: Local device only
- Settings: Can sync via chrome.storage.sync (opt-in)

**Privacy:** No data sent to external servers

---

## Future Architecture Enhancements

### Phase 2: UX Improvements
- Settings UI with categories
- Post preview before blocking
- Regex pattern support (advanced)
- Case-sensitive matching option

### Phase 3: Advanced Features
- Allowlist (whitelist posts)
- Time-based blocking rules
- Blocking statistics export
- Dark mode UI

### Phase 4: Performance Optimization
- Trie-based matching (replace regex)
- Web Worker for matching
- Lazy loading of keywords
- Post caching strategy

---

## Operational Guidelines

### Debugging

**Check Extension State:**
```javascript
// In popup console (right-click icon → Inspect popup)
chrome.storage.local.get(null, (all) => {
  console.log('Local storage:', all);
});
```

**Check Content Script:**
```javascript
// Right-click facebook.com page → Inspect → Sources
// Look for content.js in Extension Content Scripts
```

**Monitor Storage Changes:**
```javascript
chrome.storage.onChanged.addListener((changes, area) => {
  console.log(`[${area}] Changed:`, changes);
});
```

### Performance Profiling

```javascript
// Measure regex compilation
console.time('regex-compile');
new RegExp(pattern, 'giu');
console.timeEnd('regex-compile');

// Measure filtering
console.time('filter-content');
filterContent();
console.timeEnd('filter-content');
```

---

## References

- [Chrome Extension MV3 Architecture](https://developer.chrome.com/docs/extensions/mv3/architecture/)
- [Content Scripts Guide](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Storage API Documentation](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Security in Extensions](https://developer.chrome.com/docs/extensions/mv3/security/)
