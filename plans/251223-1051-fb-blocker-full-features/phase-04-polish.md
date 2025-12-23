# Phase 4: Polish

**Parent:** [plan.md](./plan.md) | **Dependencies:** [Phase 1](./phase-01-core-fixes.md), [Phase 2](./phase-02-ux-improvements.md), [Phase 3](./phase-03-advanced-features.md)
**Date:** 2025-12-23 | **Priority:** Low | **Status:** Planned
**Estimated Effort:** 3-4 hours

## Overview

Final polish: dark mode support, performance optimization with debouncing and caching, and scoped MutationObservers for better resource usage.

## Key Insights from Research

1. **Dark Mode:** Use CSS `prefers-color-scheme` media query; follows OS setting, not Chrome theme
2. **Debouncing:** 250-500ms optimal for SPA mutations; prevents rapid-fire processing
3. **Scoped Observer:** Observe specific subtrees (e.g., `[role="main"]`) instead of entire document
4. **Regex Caching:** Compile once, reuse; 1-2ms compilation cost for 100 keywords

## Requirements

### 4.1 Dark Mode
- [ ] Detect system color scheme
- [ ] Apply dark theme to popup and options
- [ ] Use CSS variables for theme colors
- [ ] Listen for scheme changes in real-time

### 4.2 Performance Optimization
- [ ] Add debouncing to MutationObserver callback
- [ ] Cache compiled regex patterns
- [ ] Scope observer to Facebook's main content area
- [ ] Add mutation queue processing
- [ ] Minimize storage reads

## Architecture Decisions

### CSS Variables Theme System
```css
:root {
  /* Light theme (default) */
  --bg-primary: #f0f2f5;
  --bg-secondary: #ffffff;
  --text-primary: #050505;
  --text-secondary: #65676b;
  --accent: #1877f2;
  --border: #dddfe2;
  --danger: #fa3e3e;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #18191a;
    --bg-secondary: #242526;
    --text-primary: #e4e6eb;
    --text-secondary: #b0b3b8;
    --accent: #2d88ff;
    --border: #3e4042;
    --danger: #f02849;
  }
}
```

### Debounced Observer Pattern
```javascript
class DebouncedObserver {
  constructor(callback, debounceMs = 300) {
    this.callback = callback;
    this.debounceMs = debounceMs;
    this.timer = null;
    this.pendingNodes = new Set();
    this.observer = new MutationObserver(this.handleMutations.bind(this));
  }

  handleMutations(mutations) {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          this.pendingNodes.add(node);
        }
      }
    }

    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const nodes = Array.from(this.pendingNodes);
      this.pendingNodes.clear();
      this.callback(nodes);
    }, this.debounceMs);
  }

  observe(target, options) {
    this.observer.observe(target, options);
  }

  disconnect() {
    clearTimeout(this.timer);
    this.observer.disconnect();
  }
}
```

### Scoped Observer Targets
```javascript
const FB_CONTENT_SELECTORS = [
  '[role="main"]',
  '[data-pagelet="FeedUnit_0"]',
  'div[data-pagelet^="FeedUnit"]'
];

function findObserverTarget() {
  for (const selector of FB_CONTENT_SELECTORS) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  // Fallback to body if specific container not found
  return document.body;
}
```

### Cached Matcher
```javascript
class CachedMatcher {
  constructor(config) {
    this.config = config;
    this.compiledPatterns = null;
    this.lastCompileTime = 0;
    this.textCache = new Map();
    this.maxCacheSize = 1000;
  }

  getPatterns() {
    // Recompile only if config changed (check via hash or timestamp)
    if (!this.compiledPatterns) {
      this.compile();
    }
    return this.compiledPatterns;
  }

  matches(text) {
    // Check text cache first
    if (this.textCache.has(text)) {
      return this.textCache.get(text);
    }

    const result = this.doMatch(text);

    // Maintain cache size
    if (this.textCache.size >= this.maxCacheSize) {
      const firstKey = this.textCache.keys().next().value;
      this.textCache.delete(firstKey);
    }
    this.textCache.set(text, result);

    return result;
  }

  invalidateCache() {
    this.compiledPatterns = null;
    this.textCache.clear();
  }
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `popup.css` | Add CSS variables, dark theme |
| `options.css` | Add CSS variables, dark theme |
| `content.css` | Add dark theme for placeholder |
| `content.js` | Add DebouncedObserver, scoped targeting |
| `src/core/matcher.js` | Add text caching |

## Implementation Steps

### Step 1: Implement CSS Variable Theme (45min)

1. Define CSS variables for all colors
2. Add dark theme media query
3. Update all hardcoded colors to variables

```css
/* popup.css updates */
:root {
  --bg-primary: #f0f2f5;
  --bg-secondary: #ffffff;
  --text-primary: #050505;
  --text-secondary: #65676b;
  --accent: #1877f2;
  --accent-hover: #166fe5;
  --border: #dddfe2;
  --danger: #fa3e3e;
  --danger-hover: #d93025;
  --toggle-off: #ccc;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #18191a;
    --bg-secondary: #242526;
    --text-primary: #e4e6eb;
    --text-secondary: #b0b3b8;
    --accent: #2d88ff;
    --accent-hover: #1a7cf5;
    --border: #3e4042;
    --danger: #f02849;
    --danger-hover: #c41e3a;
    --toggle-off: #3a3b3c;
  }
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.keywords-section {
  background: var(--bg-secondary);
  /* ... */
}

#add-btn {
  background: var(--accent);
  /* ... */
}

#add-btn:hover {
  background: var(--accent-hover);
}
```

### Step 2: Update Content CSS for Dark Mode (15min)

```css
/* content.css */
.fb-blocker-placeholder {
  background: var(--fb-blocker-bg, #f0f2f5);
  border-color: var(--fb-blocker-border, #bec3c9);
  color: var(--fb-blocker-text, #65676b);
}

@media (prefers-color-scheme: dark) {
  .fb-blocker-placeholder {
    --fb-blocker-bg: #242526;
    --fb-blocker-border: #3e4042;
    --fb-blocker-text: #b0b3b8;
  }

  .fb-blocker-show-btn {
    background: #3a3b3c;
    color: #e4e6eb;
  }

  .fb-blocker-show-btn:hover {
    background: #4e4f50;
  }
}
```

### Step 3: Implement Debounced Observer (1h)

1. Create DebouncedObserver class
2. Replace existing MutationObserver
3. Queue nodes for batch processing
4. Add configurable debounce time

```javascript
// content.js updates
let debouncedObserver = null;

function setupObserver() {
  const debounceMs = settings.debounceMs || 300;

  debouncedObserver = new DebouncedObserver((nodes) => {
    if (!enabled || keywords.length === 0) return;

    // Process only added nodes, not entire document
    nodes.forEach(node => {
      processNode(node);
    });
  }, debounceMs);

  const target = findObserverTarget();
  debouncedObserver.observe(target, {
    childList: true,
    subtree: true
  });
}

function processNode(node) {
  // Check if node matches post selectors
  const postSelectors = [
    '[data-pagelet^="FeedUnit"]',
    '[role="article"]'
  ];

  for (const selector of postSelectors) {
    if (node.matches?.(selector)) {
      checkAndBlockPost(node);
      return;
    }

    // Check descendants
    const posts = node.querySelectorAll?.(selector) || [];
    posts.forEach(post => checkAndBlockPost(post));
  }
}

function findObserverTarget() {
  const selectors = [
    '[role="main"]',
    '[data-pagelet="FeedUnit_0"]'
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      console.log('[FB Blocker] Observing:', sel);
      return el;
    }
  }

  console.log('[FB Blocker] Fallback: observing body');
  return document.body;
}
```

### Step 4: Add Text Caching to Matcher (45min)

1. Add LRU-style cache to matcher
2. Cache match results by text hash
3. Invalidate cache on keyword changes
4. Set reasonable cache size (1000 entries)

```javascript
// src/core/matcher.js additions
class CachedKeywordMatcher extends KeywordMatcher {
  constructor(keywords, options = {}) {
    super(keywords);
    this.cache = new Map();
    this.maxCacheSize = options.maxCacheSize || 1000;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  matches(text) {
    // Normalize text for consistent cache keys
    const key = text.toLowerCase().substring(0, 500); // Limit key size

    if (this.cache.has(key)) {
      this.cacheHits++;
      return this.cache.get(key);
    }

    this.cacheMisses++;
    const result = super.matches(text);

    // LRU-style eviction
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, result);
    return result;
  }

  clearCache() {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  getCacheStats() {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? (this.cacheHits / total * 100).toFixed(1) : 0,
      size: this.cache.size
    };
  }
}
```

### Step 5: Minimize Storage Reads (30min)

1. Cache settings in memory
2. Listen for storage.onChanged
3. Only read storage on init and change events

```javascript
// Cached settings pattern
let cachedSettings = null;
let cachedKeywords = null;
let cachedMatcher = null;

async function init() {
  await loadCachedData();
  setupStorageListener();
  setupObserver();
  filterContent();
}

async function loadCachedData() {
  const [settings, keywords] = await Promise.all([
    Storage.getSettings(),
    Storage.getKeywords()
  ]);

  cachedSettings = settings;
  cachedKeywords = keywords;
  cachedMatcher = new CachedKeywordMatcher(keywords);
}

function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.keywords) {
      cachedKeywords = changes.keywords.newValue;
      cachedMatcher = new CachedKeywordMatcher(cachedKeywords);
      filterContent();
    }

    if (areaName === 'sync') {
      if (changes.enabled !== undefined) {
        cachedSettings.enabled = changes.enabled.newValue;
      }
      if (changes.debounceMs !== undefined) {
        cachedSettings.debounceMs = changes.debounceMs.newValue;
        // Recreate observer with new debounce
        debouncedObserver?.disconnect();
        setupObserver();
      }
    }
  });
}
```

### Step 6: Add Performance Logging (15min)

```javascript
// Debug mode for performance monitoring
const DEBUG = false;

function logPerf(label, startTime) {
  if (!DEBUG) return;
  console.log(`[FB Blocker] ${label}: ${(performance.now() - startTime).toFixed(2)}ms`);
}

function filterContent() {
  const start = performance.now();

  // ... filtering logic ...

  logPerf('filterContent', start);

  if (DEBUG && cachedMatcher) {
    console.log('[FB Blocker] Cache stats:', cachedMatcher.getCacheStats());
  }
}
```

## Todo List

- [ ] Define CSS variables for all colors in popup.css
- [ ] Add dark theme media query to popup.css
- [ ] Update all color references to CSS variables
- [ ] Apply same theme system to options.css
- [ ] Update content.css for dark mode
- [ ] Create DebouncedObserver class
- [ ] Replace MutationObserver with DebouncedObserver
- [ ] Implement scoped observer targeting
- [ ] Add text caching to KeywordMatcher
- [ ] Implement LRU cache eviction
- [ ] Cache settings in memory
- [ ] Add storage.onChanged listener
- [ ] Add performance logging (debug mode)
- [ ] Test dark mode on macOS/Windows
- [ ] Benchmark filtering performance
- [ ] Test with 100+ keywords

## Success Criteria

- [ ] Dark mode activates automatically based on OS setting
- [ ] All UI elements readable in dark mode
- [ ] MutationObserver debounced (no rapid-fire callbacks)
- [ ] Observer scoped to main content area
- [ ] Text matching cached (cache hit rate >50% typical usage)
- [ ] Storage reads minimized (only on init and changes)
- [ ] Filtering 100 keywords completes <100ms

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cache grows unbounded | Low | LRU eviction at 1000 entries |
| Scoped observer misses content | Medium | Fallback to body if target not found |
| Dark mode colors unreadable | Low | Test contrast ratios, use established palettes |
| Debounce too aggressive | Medium | Make debounceMs configurable (default 300) |

## Security Considerations

1. **Cache Poisoning:** Cache keyed on text content; no execution risk
2. **Memory Leaks:** LRU eviction prevents unbounded growth
3. **No new permissions:** All optimizations use existing APIs

## Performance Benchmarks (Target)

| Metric | Before | Target |
|--------|--------|--------|
| Observer callbacks/sec | 50+ | <5 |
| Regex match (100 kw, 10KB text) | ~1ms | ~1ms (cached: <0.1ms) |
| Storage reads/minute | 10+ | 1-2 |
| Memory (cache) | N/A | <1MB |

## Next Steps

After Phase 4 completion:
1. Final testing on various Facebook layouts
2. Create user documentation
3. Prepare for Chrome Web Store submission
4. Consider i18n for English UI
