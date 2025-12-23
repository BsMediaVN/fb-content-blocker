# FB Content Blocker - Full Features Implementation Plan

**Created:** 2025-12-23 | **Status:** Phase 1 DONE (2025-12-23) | **Priority:** High

## Overview

Upgrade FB Content Blocker Chrome Extension from basic keyword blocking to a full-featured content filtering solution with proper word boundary matching, categories, statistics, and advanced filtering options.

## Current State

| Component | Lines | Issues |
|-----------|-------|--------|
| `content.js` | 102 | No word boundary, no debouncing, posts only |
| `popup.js` | 100 | Single keyword add, no bulk operations |
| `manifest.json` | 29 | MV3 compliant, minimal permissions |

**Critical Bug:** `text.includes(keyword)` matches "book" in "facebook" - false positives.

## Architecture Decision

Adopt modular architecture with shared utilities:
```
src/
  core/
    matcher.js      # KeywordMatcher class (regex engine)
    storage.js      # Storage abstraction (sync/local hybrid)
    stats.js        # Statistics tracking
  content/
    content.js      # MutationObserver + filtering
    comments.js     # Comment-specific blocking
  popup/
    popup.js        # Quick actions UI
  options/
    options.js      # Full settings page
  utils/
    import-export.js
    migration.js    # v1 → v2 data migration
```

## Data Model (v2)

```javascript
// chrome.storage.local (large data)
{
  keywords: [
    { id: 'uuid', text: 'spam', category: 'default', isRegex: false, caseSensitive: false }
  ],
  whitelist: ['facebook-official'],
  stats: { today: 0, total: 0, lastReset: '2025-12-23' }
}

// chrome.storage.sync (settings only)
{
  enabled: true,
  version: 2,
  blockComments: true,
  debounceMs: 300
}
```

## Phase Summary

| Phase | Features | Priority | Est. Effort | Status |
|-------|----------|----------|-------------|--------|
| [Phase 1](./phase-01-core-fixes.md) | Word boundary, bulk add, import/export, stats | Critical | 4-6h | DONE (2025-12-23) |
| [Phase 2](./phase-02-ux-improvements.md) | Categories, search, comment blocking | High | 4-6h | Pending |
| [Phase 3](./phase-03-advanced-features.md) | Regex support, case sensitivity, whitelist, options page | Medium | 6-8h | Pending |
| [Phase 4](./phase-04-polish.md) | Dark mode, performance optimization | Low | 3-4h | Pending |

**Total Estimated:** 17-24 hours

## Migration Strategy

1. Detect `version` field absence → v1 data
2. Transform flat `keywords: string[]` → structured objects
3. Move keywords from `storage.sync` → `storage.local`
4. Set `version: 2` in sync storage

## Success Criteria

- [ ] "book" does NOT match "facebook"
- [ ] 100+ keywords perform <100ms per scan
- [ ] All existing user data preserved after upgrade
- [ ] No external dependencies added

## Research References

- [Chrome Extension Patterns](./research/researcher-01-chrome-extension-patterns.md)
- [Keyword Filtering Algorithms](./research/researcher-02-keyword-filtering-algorithms.md)

## Unresolved Questions

1. Should we add background service worker for centralized stats?
2. Pagination threshold for keyword list UI (50? 100?)?
3. Keep Vietnamese-only UI or add English?
