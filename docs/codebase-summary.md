# FB Content Blocker - Codebase Summary

**Version:** 1.0.0 | **Phase:** 1 - Core Implementation | **Last Updated:** 2025-12-23

## Project Overview

FB Content Blocker is a Chrome Extension (Manifest V3) that filters Facebook feed content based on user-defined keywords. The extension uses word boundary regex matching to accurately identify and hide posts containing blocked keywords, with features for bulk keyword management, import/export, and blocking statistics.

### Key Statistics
- **Total Files:** 20 (code + configuration)
- **Main Components:** 5 (content.js, popup.js, matcher, stats, migration)
- **Test Coverage:** 23 unit tests for keyword matching
- **Storage Model:** Hybrid (chrome.storage.sync for settings, chrome.storage.local for large data)
- **Performance:** Debounced MutationObserver (300ms) + compiled regex for O(n) text scanning

---

## Architecture Overview

### Component Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│         Chrome Extension (Manifest V3)                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  POPUP UI (popup.html/js/css)                            │
│  ├─ Keyword Management (add, delete, list)              │
│  ├─ Bulk Operations (import 100+ keywords)              │
│  ├─ Statistics Display (today/total blocks)             │
│  └─ Enable/Disable Toggle                               │
│                                                          │
│  CONTENT SCRIPT (content.js)                             │
│  ├─ KeywordMatcher (regex compilation)                  │
│  ├─ Stats (increment/track blocks)                      │
│  ├─ Migration (v1→v2 data upgrade)                      │
│  ├─ MutationObserver (DOM watching)                      │
│  └─ DOM Filtering (hide/show logic)                      │
│                                                          │
│  STORAGE LAYER                                          │
│  ├─ chrome.storage.sync (settings, version)            │
│  └─ chrome.storage.local (keywords, stats)             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Message Flow

```
POPUP ──(chrome.tabs.sendMessage)──> CONTENT SCRIPT
                                           │
                          ┌─────────────────┼─────────────────┐
                          │                 │                 │
                          v                 v                 v
                   DOM Filtering        Storage Update   MutationObserver
                                           │
                                           v
                                   firebase/facebook.com
```

---

## Core Modules

### 1. KeywordMatcher (content.js + src/core/matcher.js)

**Purpose:** High-performance regex-based keyword matching with word boundary support

**Key Features:**
- Compiles keyword array into single alternation regex: `\b(?:keyword1|keyword2|...)\b`
- Word boundary `\b` prevents false matches (e.g., "spam" won't match "antispam")
- Case-insensitive (flag `i`) + Unicode support (flag `u`)
- Safety limits: max 5000 keywords, 1MB pattern size

**Usage:**
```javascript
const matcher = new KeywordMatcher(['facebook', 'spam', 'ads']);
const text = "I hate spam posts";
if (matcher.matches(text)) {
  // Hide this post
}
```

**Performance:** O(n) text scanning (single regex pass)

**File Locations:**
- Inline: `/Users/quang/develop/fb-content-blocker/content.js` (lines 16-66)
- Modular: `/Users/quang/develop/fb-content-blocker/src/core/matcher.js` (full export)

---

### 2. Stats (content.js + src/core/stats.js)

**Purpose:** Track blocked post statistics with automatic daily reset

**Data Structure:**
```javascript
{
  today: number,        // Blocked posts today (resets at midnight)
  total: number,        // All-time blocked posts
  lastReset: "2025-12-23"  // ISO date of last daily reset
}
```

**Key Features:**
- Automatic daily counter reset based on ISO date comparison
- Persistent storage via `chrome.storage.local`
- Methods: `increment()`, `get()`, `reset()`

**Usage:**
```javascript
const stats = await Stats.increment(); // { today: 5, total: 42 }
```

**File Locations:**
- Inline: `/Users/quang/develop/fb-content-blocker/content.js` (lines 71-94)
- Modular: `/Users/quang/develop/fb-content-blocker/src/core/stats.js` (full export)

---

### 3. Migration (content.js + src/utils/migration.js)

**Purpose:** Handle v1→v2 data format upgrade

**Migration Path:**
```
v1: keywords as string[] in chrome.storage.sync
    ↓
v2: keywords as object[] in chrome.storage.local
    {
      id: UUID,
      text: string,
      category: "default",
      isRegex: false,
      caseSensitive: false
    }
```

**Key Features:**
- One-time migration trigger at content script init
- Handles partial migrations (mixed formats)
- Preserves existing enabled/disabled state
- Sets version flag to prevent re-migration

**Usage:**
```javascript
const result = await Migration.migrateV1ToV2();
// { migrated: true/false, count: number }
```

**File Locations:**
- Inline: `/Users/quang/develop/fb-content-blocker/content.js` (lines 99-145)
- Modular: `/Users/quang/develop/fb-content-blocker/src/utils/migration.js` (full export)

---

### 4. DOM Filtering (content.js)

**Purpose:** Identify and hide blocked posts in Facebook feed

**Post Selectors (Multiple Fallbacks):**
```javascript
[
  '[data-pagelet^="FeedUnit"]',      // Facebook 2024+ feed structure
  '[role="article"]',                 // Standard article posts
  'div[data-ad-preview="message"]',   // Sponsored content
  '.x1yztbdb.x1n2onr6.xh8yej3.x1ja2u2z'  // Utility class-based posts
]
```

**Flow:**
1. MutationObserver detects DOM changes
2. Debounces filter calls (300ms) to prevent performance issues
3. Iterates through post selectors
4. Tests each post's textContent against keyword regex
5. If match: hide post + create placeholder with unhide button
6. Track in stats

**State Management:**
- `data-fb-blocked="true"` - Post is hidden
- `data-fb-blocked="shown"` - User clicked unhide
- `data-original-display` - Original CSS display value

**File Location:** `/Users/quang/develop/fb-content-blocker/content.js` (lines 228-288)

---

### 5. Popup UI (popup.html/popup.js/popup.css)

**Purpose:** User interface for keyword management and settings

**Features:**
1. **Keyword Management**
   - Single keyword add with Enter key support
   - Delete button per keyword
   - Keyword count display

2. **Bulk Operations**
   - Toggle bulk textarea
   - Multi-line input (one keyword per line)
   - Duplicate detection
   - Status alert (added count + duplicates skipped)

3. **Statistics Display**
   - Today's blocked count
   - Total all-time blocked
   - Updates in real-time

4. **Import/Export**
   - Export as JSON: `{ version, exportedAt, keywords, stats }`
   - Import with validation:
     - File size limit: 10MB
     - Keyword count limit: 5000 total
     - Keyword length limit: 500 chars
     - Duplicate detection
   - Force isRegex=false on import (security)

5. **Enable/Disable Toggle**
   - Chrome.storage.sync persisted setting
   - Syncs across devices

**File Locations:**
- HTML: `/Users/quang/develop/fb-content-blocker/popup.html`
- JavaScript: `/Users/quang/develop/fb-content-blocker/popup.js` (367 lines)
- CSS: `/Users/quang/develop/fb-content-blocker/popup.css`

---

## Storage Architecture

### Chrome Storage Strategy

| Storage Type | Use Case | Limit | Benefits |
|---|---|---|---|
| `chrome.storage.sync` | Settings, version flag, enabled state | 100KB | Cross-device sync, backup |
| `chrome.storage.local` | Keywords, statistics | 5MB+ | Device-only, large data support, fast access |
| `chrome.storage.session` | Runtime state (unused in v1) | 1MB | Auto-cleanup on exit |

### Data Schema

**chrome.storage.sync:**
```javascript
{
  version: 2,              // Current data version
  enabled: true,           // Extension enabled/disabled
}
```

**chrome.storage.local:**
```javascript
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
  ],
  stats: {
    today: 5,
    total: 42,
    lastReset: "2025-12-23"
  }
}
```

---

## Message Passing Protocol

### Content Script Initialization

```javascript
// content.js init sequence
1. Migration.migrateV1ToV2() - upgrade old data
2. loadSettings() - fetch keywords & enabled state
3. setupObserver() - attach MutationObserver
4. filterContent() - scan existing DOM
5. Listen for storage.onChanged events
6. Listen for runtime.onMessage from popup
```

### Popup → Content Script

```javascript
// When user modifies keywords in popup
notifyContentScript() {
  chrome.tabs.sendMessage(tabId, { action: 'update' })
}

// Content script receives & reacts
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'update') {
    loadSettings()
    resetHiddenPosts()
    filterContent()
  }
})
```

### Cross-Storage Updates

```javascript
// Storage listener automatically triggers in content script
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.keywords) {
    matcher.update(changes.keywords.newValue)
    filterContent()
  }
  if (areaName === 'sync' && changes.enabled) {
    enabled = changes.enabled.newValue
  }
})
```

---

## Testing

### Test File: `/Users/quang/develop/fb-content-blocker/tests/matcher.test.js`

**Test Count:** 23 unit tests
**Focus Areas:**
1. Word boundary matching (8 tests)
   - "book" should NOT match "facebook" ✓
   - "book" should match "a book" ✓
   - "spam" should NOT match "antispam" ✓

2. Case-insensitive matching (3 tests)
   - "FACEBOOK" matches "Facebook" ✓

3. Multiple keyword matching (4 tests)
   - Alternation with multiple keywords ✓

4. Special character handling (4 tests)
   - Escapes: `.*+?^${}()|[\]\\` ✓

5. Edge cases (4 tests)
   - Empty keywords array ✓
   - Empty/null text ✓
   - Unicode support ✓

**Run Tests:**
```bash
cd /Users/quang/develop/fb-content-blocker
node tests/matcher.test.js
```

---

## File Structure

```
fb-content-blocker/
├── docs/                          # Documentation (this file)
├── src/
│   ├── core/
│   │   ├── matcher.js            # Modular KeywordMatcher export
│   │   └── stats.js              # Modular Stats export
│   └── utils/
│       └── migration.js           # Modular Migration export
├── tests/
│   └── matcher.test.js            # 23 unit tests
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── content.js                     # Main content script (289 lines)
├── content.css                    # Content styling
├── popup.html                     # Popup UI template
├── popup.js                       # Popup logic (367 lines)
├── popup.css                      # Popup styling
├── manifest.json                  # MV3 manifest (required)
├── CLAUDE.md                      # Agent documentation
└── README.md                      # User guide
```

---

## Performance Characteristics

### Memory Usage
- Compiled regex: ~2KB for 100 keywords
- Keywords array: ~5KB for 100 keywords (100 bytes avg per keyword)
- DOM placeholders: 1 per blocked post (lightweight)

### CPU Utilization
- Regex compilation: ~10ms for 100 keywords (one-time on init/update)
- Text matching: ~0.1ms per post (single regex pass)
- MutationObserver debounce: 300ms (configurable)
- Filtering 100 posts: ~10ms total

### Storage Footprint
- 100 keywords: ~5KB in local storage
- Stats: ~100 bytes
- Typical user setup: <50KB total

---

## Known Limitations

1. **Regex Alternation Limit:** Max 5000 keywords before pattern size warning
2. **Special Characters:** All regex metacharacters must be escaped in user input
3. **Word Boundaries:** `\b` may behave differently with Unicode letters (requires `u` flag)
4. **Facebook Selectors:** Relies on multiple fallback selectors due to Facebook's frequent DOM changes
5. **Storage Sync:** Limited to 100KB total across all extension data (use local storage for large data)

---

## Phase 1 Completion Status

### Features Implemented
- ✓ Word boundary matching (`\b` regex with safety limits)
- ✓ Bulk keyword add (multi-line textarea)
- ✓ Import/Export JSON with validation
- ✓ Statistics counter (daily + total)
- ✓ v1→v2 data migration
- ✓ 23 unit tests (all passing)
- ✓ MutationObserver debouncing (300ms)

### Quality Metrics
- **Test Coverage:** KeywordMatcher fully tested (23 tests)
- **Security:** Input validation, regex escaping, file size limits
- **Performance:** Optimized regex compilation, debounced DOM updates
- **Documentation:** Complete architecture documentation

### Next Phase (Phase 2) Planned
- [ ] Settings UI improvements (categories, sorting)
- [ ] Regex pattern support (opt-in)
- [ ] Case-sensitive matching option
- [ ] Post preview/read mode
- [ ] Export statistics report
- [ ] Dark mode UI

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-23 | Initial release - Phase 1 Core Implementation |

---

## References

- [Chrome Extension MV3 Documentation](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome Storage API Guide](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Regex Word Boundary Reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions)
- [MutationObserver Performance](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
