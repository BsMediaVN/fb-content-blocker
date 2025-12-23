# FB Content Blocker - Codebase Summary

**Version:** 2.1.0 | **Last Updated:** 2025-12-23

## Project Overview

FB Content Blocker is a Chrome Extension (Manifest V3) that filters Facebook feed content based on user-defined keywords and built-in ads patterns. Features Vietnamese support, fuzzy matching, and automatic sponsored content blocking.

### Key Statistics
- **Total Files:** 25+ (code + configuration + locales)
- **Main Components:** content.js, popup.js, options.js, matcher, stats, migration
- **Test Coverage:** 31 unit tests for keyword matching
- **i18n:** Vietnamese (vi), English (en)
- **Performance:** Debounced MutationObserver (150ms) + compiled regex

---

## Recent Changes (Dec 2025)

### v2.1.0 - Built-in Ads Blocking
- **BUILT_IN_ADS_PATTERNS**: Auto-block "Được tài trợ", "Sponsored", etc. without user keywords
- **normalizeText()**: Fuzzy matching removes Vietnamese diacritics
- **Vietnamese word boundary**: Uses lookahead/lookbehind instead of `\b` (which doesn't work with Unicode)
- **findPostContainer()**: Traverses DOM to find actual post container for hiding

### v2.0.0 - i18n & Advanced Features
- **i18n support**: `_locales/vi/messages.json`, `_locales/en/messages.json`
- **Options page**: Full settings UI (`options.html`, `options.js`)
- **Whitelist**: Keywords that won't be blocked even if matched
- **Regex support**: Optional regex patterns for advanced users
- **Case sensitivity**: Toggle case-sensitive matching
- **Comment blocking**: Filter comments containing keywords
- **Show placeholder option**: Toggle to completely remove blocked content

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│         Chrome Extension (Manifest V3)                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  POPUP UI (popup.html/js/css)                            │
│  ├─ Quick keyword add                                   │
│  ├─ Bulk add (multi-line)                               │
│  ├─ Statistics display                                  │
│  └─ Enable/Disable toggle                               │
│                                                          │
│  OPTIONS PAGE (options.html/js/css)                      │
│  ├─ Full keyword management (categories, regex, etc.)   │
│  ├─ Whitelist management                                │
│  ├─ Settings toggles (comments, case, placeholder)      │
│  └─ Import/Export JSON                                  │
│                                                          │
│  CONTENT SCRIPT (content.js)                             │
│  ├─ BUILT_IN_ADS_PATTERNS (auto-block sponsored)        │
│  ├─ KeywordMatcher (regex + whitelist)                  │
│  ├─ normalizeText() (diacritic removal)                 │
│  ├─ findPostContainer() (DOM traversal)                 │
│  ├─ Stats (increment/track)                             │
│  ├─ Migration (v1→v2)                                   │
│  └─ MutationObserver (DOM watching)                     │
│                                                          │
│  i18n (_locales/)                                        │
│  ├─ vi/messages.json (Vietnamese)                       │
│  └─ en/messages.json (English)                          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Core Modules

### 1. Built-in Ads Blocking (content.js)

**Purpose:** Automatically block sponsored/suggested content without user keywords

```javascript
const BUILT_IN_ADS_PATTERNS = [
  'Được tài trợ',      // Vietnamese sponsored
  'Đề xuất cho bạn',   // Vietnamese suggested
  'Sponsored',         // English sponsored
  'Suggested for you', // English suggested
  'Paid partnership',
  'Duoc tai tro',      // No diacritics version
];
```

**Matching Strategy:**
1. Scan all `[dir="auto"], span, a` elements
2. Normalize text (remove diacritics)
3. Check against BUILT_IN_ADS_PATTERNS
4. If match → find post container → hide immediately

### 2. KeywordMatcher (content.js)

**Purpose:** Regex-based keyword matching with word boundary support

**Key Features:**
- **Vietnamese-aware word boundary**: Uses `(?<![a-zA-Z0-9])(?:keywords)(?![a-zA-Z0-9])` instead of `\b`
- **Whitelist support**: Prevents blocking whitelisted terms
- **Regex patterns**: Optional user-defined regex
- **Case-insensitive**: Default behavior with Unicode flag

```javascript
const matcher = new KeywordMatcher(keywords, whitelist);
if (matcher.matches(text)) {
  // Block this content
}
```

**Safety Limits:**
- Max 5000 keywords
- Max 1MB pattern size

### 3. normalizeText() (content.js)

**Purpose:** Remove Vietnamese diacritics for fuzzy matching

```javascript
function normalizeText(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove combining diacritics
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Example:
normalizeText('Được tài trợ') // → 'duoc tai tro'
```

### 4. findPostContainer() (content.js)

**Purpose:** Traverse DOM to find actual post container for hiding. Always hides entire post, never just text.

```javascript
function findPostContainer(element) {
  let current = element;
  let maxDepth = 25; // Deep traversal for nested content
  let fallbackContainer = null;

  while (current && current !== document.body && maxDepth > 0) {
    const pagelet = current.getAttribute('data-pagelet');
    const role = current.getAttribute('role');

    if (pagelet?.startsWith('FeedUnit')) return current;
    if (role === 'article') return current;

    // Fallback: track large container divs (>200px height, >300px width)
    if (current.tagName === 'DIV' && !fallbackContainer) {
      const rect = current.getBoundingClientRect();
      if (rect.height > 200 && rect.width > 300) {
        fallbackContainer = current;
      }
    }
    current = current.parentElement;
    maxDepth--;
  }
  return fallbackContainer || element;
}
```

### 5. Stats (content.js)

**Purpose:** Track blocked post statistics with daily reset

```javascript
{
  today: number,           // Resets at midnight
  total: number,           // All-time count
  lastReset: "2025-12-23"  // ISO date
}
```

---

## Storage Schema

**chrome.storage.sync:**
```javascript
{
  version: 2,
  enabled: true,
  blockComments: true,
  caseSensitive: false,
  showPlaceholder: true
}
```

**chrome.storage.local:**
```javascript
{
  keywords: [
    { id: "uuid", text: "spam", category: "default", isRegex: false }
  ],
  whitelist: [
    { id: "uuid", text: "facebook" }
  ],
  stats: { today: 5, total: 42, lastReset: "2025-12-23" }
}
```

---

## i18n Structure

**_locales/vi/messages.json** (Vietnamese - default)
**_locales/en/messages.json** (English)

**Usage in HTML:**
```html
<span data-i18n="keywordsTitle"></span>
```

**Usage in JS:**
```javascript
chrome.i18n.getMessage('keywordsTitle')
```

---

## File Structure

```
fb-content-blocker/
├── _locales/
│   ├── vi/messages.json      # Vietnamese translations
│   └── en/messages.json      # English translations
├── docs/
│   ├── codebase-summary.md   # This file
│   ├── code-standards.md
│   ├── system-architecture.md
│   └── api-reference.md
├── tests/
│   └── matcher.test.js       # 31 unit tests
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── content.js                # Main content script (~600 lines)
├── content.css               # Content styling
├── popup.html/js/css         # Popup UI
├── options.html/js/css       # Options page
└── manifest.json             # MV3 manifest
```

---

## Testing

**Run tests:**
```bash
node tests/matcher.test.js
```

**Test Coverage (31 tests):**
- Word boundary matching (Vietnamese + English)
- Case-insensitive matching
- Multiple keyword matching
- Special character escaping
- Whitelist functionality
- Regex keyword support
- Unicode support

---

## Performance

| Metric | Value |
|--------|-------|
| Debounce interval | 150ms |
| Regex compilation | ~10ms for 100 keywords |
| Text matching | ~0.1ms per post |
| Memory (100 keywords) | ~7KB |

---

## Debug Mode

Enable in `content.js`:
```javascript
const DEBUG = true;  // Set to false for production
```

Logs appear in Console with `[FB Blocker]` prefix.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.1.0 | 2025-12-23 | Built-in ads blocking, fuzzy matching, debug improvements |
| 2.0.0 | 2025-12-23 | i18n, options page, whitelist, regex, comments blocking |
| 1.0.0 | 2025-12-23 | Initial release - word boundary matching |

---

## Quick Reference

**Block sponsored posts:**
- Automatic via BUILT_IN_ADS_PATTERNS (no setup needed)

**Add custom keyword:**
- Popup → type keyword → Add

**Block comments:**
- Options → Enable "Block comments"

**Whitelist a term:**
- Options → Whitelist section → Add

**Debug issues:**
- Set `DEBUG = true` in content.js
- Check Console for `[FB Blocker]` logs
