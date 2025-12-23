# Phase 2: UX Improvements

**Parent:** [plan.md](./plan.md) | **Dependencies:** [Phase 1](./phase-01-core-fixes.md)
**Date:** 2025-12-23 | **Priority:** High | **Status:** Planned
**Estimated Effort:** 4-6 hours

## Overview

Enhance user experience with keyword categories, search/filter functionality, and comment blocking capabilities.

## Key Insights from Research

1. **Category Architecture:** Object map with priority ordering enables efficient category-based filtering
2. **Scoped Observers:** Comment elements have different DOM structure; need separate selectors
3. **UI Filtering:** Client-side search is sufficient for <1000 keywords (no server needed)

## Requirements

### 2.1 Keyword Categories
- [ ] Add category field to keyword model
- [ ] Default categories: default, spam, politics, ads, custom
- [ ] Allow custom category creation
- [ ] Filter keywords by category in popup/options
- [ ] Compile separate regex per category for performance

### 2.2 Search in Keyword List
- [ ] Add search input above keyword list
- [ ] Filter displayed keywords in real-time
- [ ] Case-insensitive substring match
- [ ] Show match count

### 2.3 Comment Blocking
- [ ] Identify Facebook comment DOM selectors
- [ ] Add option to enable/disable comment blocking
- [ ] Reuse KeywordMatcher for comments
- [ ] Track comment blocks in stats separately

## Architecture Decisions

### Enhanced Data Model
```javascript
// Keyword with category
{
  id: 'uuid-123',
  text: 'casino',
  category: 'spam',       // NEW
  isRegex: false,
  caseSensitive: false
}

// Category definition
{
  categories: {
    default: { name: 'Mặc định', color: '#65676b', enabled: true },
    spam: { name: 'Spam', color: '#fa3e3e', enabled: true },
    politics: { name: 'Chính trị', color: '#1877f2', enabled: true },
    ads: { name: 'Quảng cáo', color: '#f5a623', enabled: true }
  }
}

// Settings addition
{
  blockComments: true,     // NEW
  enabledCategories: ['default', 'spam', 'politics', 'ads']
}
```

### Category-aware Matcher (`src/core/matcher.js` update)
```javascript
class CategoryMatcher {
  constructor(keywords, enabledCategories) {
    this.categories = {};
    this.enabledCategories = new Set(enabledCategories);

    // Group keywords by category
    for (const kw of keywords) {
      if (!this.categories[kw.category]) {
        this.categories[kw.category] = [];
      }
      this.categories[kw.category].push(kw);
    }

    // Compile regex per enabled category
    this.patterns = {};
    for (const [cat, kws] of Object.entries(this.categories)) {
      if (!this.enabledCategories.has(cat)) continue;

      const escaped = kws.map(k =>
        k.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      );
      this.patterns[cat] = new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'giu');
    }
  }

  matches(text) {
    for (const [cat, pattern] of Object.entries(this.patterns)) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        return { matched: true, category: cat };
      }
    }
    return { matched: false, category: null };
  }
}
```

### Comment Selectors
```javascript
const COMMENT_SELECTORS = [
  '[data-testid="UFI2Comment/root_depth_0"]',
  'div[aria-label*="comment"]',
  'div.x1y1aw1k.xn6708d', // Facebook comment container class
  '[role="article"] [role="article"]' // Nested articles are often comments
];
```

## Files to Modify/Create

| File | Changes |
|------|---------|
| `src/core/matcher.js` | Add CategoryMatcher class |
| `src/core/storage.js` | Add categories getter/setter |
| `content.js` | Add comment blocking logic |
| `popup.js` | Add search input, category filter |
| `popup.html` | Add search input, category badges |
| `popup.css` | Style categories, search |

## Implementation Steps

### Step 1: Update Data Model (30min)
1. Add `category` field to keyword structure
2. Add default categories to storage
3. Update migration to add category to existing keywords

```javascript
// Migration addition for v2.1
async function addCategoryToKeywords() {
  const keywords = await Storage.getKeywords();
  const updated = keywords.map(kw => ({
    ...kw,
    category: kw.category || 'default'
  }));
  await Storage.setKeywords(updated);

  // Add default categories
  const { categories } = await chrome.storage.local.get('categories');
  if (!categories) {
    await chrome.storage.local.set({
      categories: {
        default: { name: 'Mặc định', color: '#65676b', enabled: true },
        spam: { name: 'Spam', color: '#fa3e3e', enabled: true },
        politics: { name: 'Chính trị', color: '#1877f2', enabled: true },
        ads: { name: 'Quảng cáo', color: '#f5a623', enabled: true }
      }
    });
  }
}
```

### Step 2: Implement CategoryMatcher (1h)
1. Refactor KeywordMatcher to support categories
2. Compile separate regex per category
3. Return matched category in result
4. Update content.js to use CategoryMatcher

### Step 3: Add Search Functionality (1h)
1. Add search input to popup.html
2. Implement client-side filtering
3. Update render to show filtered results
4. Add debounce for search input

```javascript
let searchDebounce;
document.getElementById('keyword-search').addEventListener('input', (e) => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    const query = e.target.value.toLowerCase().trim();
    filterKeywordList(query);
  }, 150);
});

function filterKeywordList(query) {
  const items = document.querySelectorAll('#keywords-list li:not(.empty-message)');
  let visibleCount = 0;

  items.forEach(item => {
    const text = item.querySelector('span').textContent.toLowerCase();
    const visible = !query || text.includes(query);
    item.style.display = visible ? '' : 'none';
    if (visible) visibleCount++;
  });

  document.getElementById('search-count').textContent =
    query ? `(${visibleCount} kết quả)` : '';
}
```

### Step 4: Add Category UI (1h)
1. Add category badge to each keyword
2. Add category filter dropdown
3. Add category select when adding keyword
4. Style category colors

```html
<!-- Category filter -->
<select id="category-filter">
  <option value="">Tất cả danh mục</option>
  <option value="default">Mặc định</option>
  <option value="spam">Spam</option>
  <option value="politics">Chính trị</option>
  <option value="ads">Quảng cáo</option>
</select>

<!-- Keyword item with category badge -->
<li>
  <span class="keyword-text">${escapeHtml(keyword.text)}</span>
  <span class="category-badge" style="background: ${categoryColor}">${categoryName}</span>
  <button class="delete-btn" data-id="${keyword.id}">Xóa</button>
</li>
```

### Step 5: Implement Comment Blocking (1.5h)
1. Add comment selectors to content.js
2. Add `blockComments` setting
3. Process comments same as posts
4. Track comment blocks separately in stats

```javascript
function filterComments() {
  if (!settings.blockComments) return;

  const commentSelectors = [
    '[data-testid="UFI2Comment/root_depth_0"]',
    'div[aria-label*="comment"]'
  ];

  commentSelectors.forEach(selector => {
    const comments = document.querySelectorAll(selector);
    comments.forEach(comment => {
      if (comment.dataset.fbBlocked === 'true') return;

      const text = comment.textContent.toLowerCase();
      const result = matcher.matches(text);

      if (result.matched) {
        hideComment(comment, result.category);
        Stats.incrementComments();
      }
    });
  });
}

function hideComment(comment, category) {
  comment.dataset.fbBlocked = 'true';
  comment.dataset.originalOpacity = comment.style.opacity;
  comment.style.opacity = '0.3';

  const indicator = document.createElement('span');
  indicator.className = 'fb-blocker-comment-badge';
  indicator.textContent = `[Ẩn: ${category}]`;
  comment.prepend(indicator);
}
```

### Step 6: Update Stats (30min)
1. Add `commentsToday` and `commentsTotal` to stats
2. Update popup to show both counts
3. Add toggle for comment blocking in popup

```javascript
// Stats structure update
{
  stats: {
    postsToday: 0,
    postsTotal: 0,
    commentsToday: 0,
    commentsTotal: 0,
    lastReset: '2025-12-23'
  }
}
```

## Todo List

- [ ] Add `category` field to keyword model
- [ ] Create default categories in storage
- [ ] Update migration for category support
- [ ] Implement CategoryMatcher class
- [ ] Add search input to popup
- [ ] Implement search filtering
- [ ] Add category badges to keyword list
- [ ] Add category filter dropdown
- [ ] Add category select for new keywords
- [ ] Identify Facebook comment selectors
- [ ] Implement `filterComments()` function
- [ ] Add `blockComments` toggle to popup
- [ ] Update stats for comments
- [ ] Test category-based blocking
- [ ] Test search functionality
- [ ] Test comment blocking on various comment types

## Success Criteria

- [ ] Keywords can be assigned to categories
- [ ] Category filter shows only matching keywords
- [ ] Search filters keyword list in real-time (<200ms)
- [ ] Comments containing keywords are dimmed/hidden
- [ ] Comment blocking can be toggled independently
- [ ] Stats show separate post/comment counts
- [ ] All categories can be enabled/disabled

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| FB changes comment DOM structure | Medium | Multiple fallback selectors, test regularly |
| Too many categories slow regex | Low | Limit to ~10 categories, benchmark |
| Search lag on 500+ keywords | Low | Virtual scroll or pagination |

## Security Considerations

1. **Category Names:** Sanitize custom category names before display
2. **DOM Injection:** Comment badge uses textContent, not innerHTML

## Next Steps

After Phase 2 completion:
1. Proceed to [Phase 3: Advanced Features](./phase-03-advanced-features.md)
2. Consider adding custom category creation UI
3. Evaluate need for category-level regex compilation caching
