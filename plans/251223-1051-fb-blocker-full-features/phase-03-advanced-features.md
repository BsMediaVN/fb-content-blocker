# Phase 3: Advanced Features

**Parent:** [plan.md](./plan.md) | **Dependencies:** [Phase 1](./phase-01-core-fixes.md), [Phase 2](./phase-02-ux-improvements.md)
**Date:** 2025-12-23 | **Priority:** Medium | **Status:** Planned
**Estimated Effort:** 6-8 hours

## Overview

Add power-user features: regex pattern support, case sensitivity options, whitelist exceptions, and a full options page for detailed configuration.

## Key Insights from Research

1. **ReDoS Prevention:** User-input regex must be validated with timeout; test against evil patterns like `(a+)+b`
2. **Whitelist Priority:** Check whitelist FIRST before blacklist to prevent false positives
3. **Options Page:** Cannot use `chrome.tabs` API; must communicate via `chrome.runtime.sendMessage`
4. **Unicode Regex:** Use `u` flag for Unicode support; `\P{L}` for non-letter boundaries

## Requirements

### 3.1 Regex/Pattern Support
- [ ] Add `isRegex` flag to keyword model
- [ ] Validate regex syntax before saving
- [ ] Implement ReDoS protection (timeout)
- [ ] Show regex indicator in UI
- [ ] Provide regex syntax help

### 3.2 Case Sensitivity Option
- [ ] Add `caseSensitive` flag to keyword model
- [ ] Global default + per-keyword override
- [ ] Update matcher to respect flag
- [ ] Show case indicator in UI

### 3.3 Whitelist
- [ ] Separate whitelist array in storage
- [ ] Check whitelist before blacklist
- [ ] Support same features as blacklist (regex, categories)
- [ ] Show whitelisted text indicator when blocked content is overridden

### 3.4 Options Page
- [ ] Full keyword management (CRUD)
- [ ] Category management (create/edit/delete)
- [ ] Whitelist management
- [ ] Settings configuration
- [ ] Stats dashboard
- [ ] Import/Export

## Architecture Decisions

### Enhanced Keyword Model
```javascript
{
  id: 'uuid-123',
  text: 'casino|gambling',
  category: 'spam',
  isRegex: true,        // NEW: interpret as regex
  caseSensitive: false, // NEW: case matching
  createdAt: '2025-12-23T10:00:00Z'
}
```

### Whitelist Structure
```javascript
{
  whitelist: [
    { id: 'uuid-456', text: 'facebook-official', isRegex: false },
    { id: 'uuid-789', text: 'sponsored.*partner', isRegex: true }
  ]
}
```

### ReDoS Validator (`src/utils/regex-validator.js`)
```javascript
const REDOS_PATTERNS = [
  /\(\s*[^)]*[+*]\s*\)\s*[+*]/, // Nested quantifiers: (a+)+
  /\(\s*[^)|]*\|\s*[^)]*\)\s*[+*]/, // Alternation with quantifier: (a|a)*
];

function validateRegex(pattern, maxDuration = 100) {
  // Syntax check
  try {
    new RegExp(pattern, 'u');
  } catch (e) {
    return { valid: false, error: 'Invalid regex syntax' };
  }

  // ReDoS pattern check
  for (const evil of REDOS_PATTERNS) {
    if (evil.test(pattern)) {
      return { valid: false, error: 'Pattern may cause performance issues' };
    }
  }

  // Runtime check
  try {
    const re = new RegExp(pattern, 'u');
    const start = performance.now();
    re.test('a'.repeat(30));
    if (performance.now() - start > maxDuration) {
      return { valid: false, error: 'Pattern too slow' };
    }
  } catch (e) {
    return { valid: false, error: e.message };
  }

  return { valid: true, error: null };
}
```

### Updated Matcher with Whitelist
```javascript
class AdvancedMatcher {
  constructor(config) {
    this.keywords = config.keywords;
    this.whitelist = config.whitelist;
    this.globalCaseSensitive = config.globalCaseSensitive || false;
    this.compile();
  }

  compile() {
    // Compile whitelist first
    this.whitelistPatterns = this.compilePatterns(this.whitelist);
    // Compile blacklist by category
    this.blacklistPatterns = this.compilePatternsByCategory(this.keywords);
  }

  compilePatterns(items) {
    return items.map(item => {
      const flags = item.caseSensitive ? 'gu' : 'giu';
      if (item.isRegex) {
        return new RegExp(item.text, flags);
      }
      const escaped = item.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, flags);
    });
  }

  matches(text) {
    // Check whitelist FIRST
    for (const pattern of this.whitelistPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        return { matched: false, whitelisted: true };
      }
    }

    // Check blacklist
    for (const [cat, patterns] of Object.entries(this.blacklistPatterns)) {
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        if (pattern.test(text)) {
          return { matched: true, category: cat, whitelisted: false };
        }
      }
    }

    return { matched: false, whitelisted: false };
  }
}
```

## Files to Create/Modify

| File | Changes |
|------|---------|
| `options.html` | NEW: Full options page layout |
| `options.js` | NEW: Options page logic |
| `options.css` | NEW: Options page styles |
| `manifest.json` | Add `options_page` or `options_ui` |
| `src/core/matcher.js` | Add regex/case/whitelist support |
| `src/utils/regex-validator.js` | NEW: ReDoS protection |
| `popup.html` | Add link to options page |

## Implementation Steps

### Step 1: Create Options Page Structure (1h)
1. Create `options.html` with sections for:
   - Keywords management table
   - Whitelist management
   - Category settings
   - Global settings
   - Statistics dashboard
2. Register in manifest.json

```json
{
  "options_ui": {
    "page": "options.html",
    "open_in_tab": true
  }
}
```

```html
<!-- options.html structure -->
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>FB Content Blocker - Cài đặt</title>
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <div class="options-container">
    <nav class="sidebar">
      <h1>FB Blocker</h1>
      <ul>
        <li data-section="keywords" class="active">Từ khóa</li>
        <li data-section="whitelist">Whitelist</li>
        <li data-section="categories">Danh mục</li>
        <li data-section="settings">Cài đặt</li>
        <li data-section="stats">Thống kê</li>
      </ul>
    </nav>

    <main class="content">
      <section id="keywords-section" class="active">
        <h2>Quản lý từ khóa</h2>
        <!-- Keyword table with search, filter, bulk actions -->
      </section>

      <section id="whitelist-section">
        <h2>Danh sách ngoại lệ</h2>
        <!-- Whitelist management -->
      </section>

      <section id="categories-section">
        <h2>Quản lý danh mục</h2>
        <!-- Category CRUD -->
      </section>

      <section id="settings-section">
        <h2>Cài đặt chung</h2>
        <!-- Global settings -->
      </section>

      <section id="stats-section">
        <h2>Thống kê</h2>
        <!-- Stats dashboard -->
      </section>
    </main>
  </div>
  <script src="options.js"></script>
</body>
</html>
```

### Step 2: Implement Regex Validator (30min)
1. Create `src/utils/regex-validator.js`
2. Implement syntax validation
3. Add ReDoS pattern detection
4. Add runtime timeout test

### Step 3: Update Matcher for Regex Support (1h)
1. Check `isRegex` flag when compiling patterns
2. Add `caseSensitive` flag handling
3. Implement whitelist check before blacklist
4. Update content.js to use AdvancedMatcher

### Step 4: Keyword Table in Options (1.5h)
1. Render keywords in table format
2. Add inline edit for text, category, flags
3. Add bulk selection and delete
4. Add regex toggle with validation feedback

```javascript
function renderKeywordTable(keywords) {
  const tbody = document.getElementById('keywords-tbody');
  tbody.innerHTML = keywords.map(kw => `
    <tr data-id="${kw.id}">
      <td><input type="checkbox" class="select-row"></td>
      <td class="keyword-text">
        <input type="text" value="${escapeHtml(kw.text)}" class="inline-edit">
        ${kw.isRegex ? '<span class="badge regex">Regex</span>' : ''}
        ${kw.caseSensitive ? '<span class="badge case">Aa</span>' : ''}
      </td>
      <td>
        <select class="category-select">
          ${categoryOptions(kw.category)}
        </select>
      </td>
      <td>
        <label><input type="checkbox" class="is-regex" ${kw.isRegex ? 'checked' : ''}> Regex</label>
        <label><input type="checkbox" class="case-sensitive" ${kw.caseSensitive ? 'checked' : ''}> Aa</label>
      </td>
      <td>
        <button class="btn-delete" data-id="${kw.id}">Xóa</button>
      </td>
    </tr>
  `).join('');
}
```

### Step 5: Whitelist Management (1h)
1. Create whitelist section in options
2. Mirror keyword table structure
3. Add whitelist-specific indicators
4. Update storage helpers

### Step 6: Category Management (1h)
1. CRUD interface for categories
2. Color picker for category color
3. Enable/disable toggle per category
4. Prevent deletion of categories with keywords

```javascript
function renderCategoryEditor() {
  const categories = await Storage.getCategories();
  const container = document.getElementById('categories-list');

  container.innerHTML = Object.entries(categories).map(([id, cat]) => `
    <div class="category-item" data-id="${id}">
      <input type="color" value="${cat.color}" class="color-picker">
      <input type="text" value="${escapeHtml(cat.name)}" class="category-name">
      <label>
        <input type="checkbox" class="enabled" ${cat.enabled ? 'checked' : ''}>
        Bật
      </label>
      <span class="keyword-count">${getKeywordCount(id)} từ khóa</span>
      ${id !== 'default' ? `<button class="btn-delete">Xóa</button>` : ''}
    </div>
  `).join('');
}
```

### Step 7: Settings Page (30min)
1. Global case sensitivity toggle
2. Comment blocking toggle
3. Debounce delay slider
4. Reset stats button

### Step 8: Regex Help Modal (30min)
1. Create help modal with regex syntax
2. Include common patterns examples
3. Show validation feedback inline

```html
<div id="regex-help-modal" class="modal">
  <h3>Cú pháp Regex</h3>
  <table>
    <tr><td><code>.</code></td><td>Bất kỳ ký tự</td></tr>
    <tr><td><code>*</code></td><td>0 hoặc nhiều</td></tr>
    <tr><td><code>+</code></td><td>1 hoặc nhiều</td></tr>
    <tr><td><code>?</code></td><td>0 hoặc 1</td></tr>
    <tr><td><code>[abc]</code></td><td>a, b, hoặc c</td></tr>
    <tr><td><code>|</code></td><td>Hoặc</td></tr>
    <tr><td><code>^</code></td><td>Đầu dòng</td></tr>
    <tr><td><code>$</code></td><td>Cuối dòng</td></tr>
  </table>
  <h4>Ví dụ:</h4>
  <ul>
    <li><code>casino|gambling</code> - Khớp "casino" hoặc "gambling"</li>
    <li><code>sale\s*\d+%</code> - Khớp "sale 50%", "sale50%"</li>
  </ul>
</div>
```

### Step 9: Options-Popup Communication (30min)
1. Add "Open settings" link in popup
2. Sync changes between popup and options
3. Use storage.onChanged for real-time sync

```javascript
// popup.js
document.getElementById('open-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Both popup.js and options.js
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (changes.keywords) {
    refreshKeywordList();
  }
});
```

## Todo List

- [ ] Create `src/utils/regex-validator.js`
- [ ] Add `isRegex` and `caseSensitive` to keyword model
- [ ] Implement ReDoS pattern detection
- [ ] Update matcher for regex/case support
- [ ] Create `options.html` structure
- [ ] Create `options.css` styles
- [ ] Create `options.js` logic
- [ ] Register options page in manifest
- [ ] Implement keyword table in options
- [ ] Add inline edit for keywords
- [ ] Add regex toggle with validation
- [ ] Create whitelist section
- [ ] Create category management section
- [ ] Create settings section
- [ ] Add regex help modal
- [ ] Add "Open settings" link to popup
- [ ] Implement storage sync between pages
- [ ] Test regex patterns with evil inputs
- [ ] Test whitelist priority over blacklist

## Success Criteria

- [ ] User can mark keyword as regex pattern
- [ ] Invalid regex shows error message
- [ ] Evil regex patterns (ReDoS) are rejected
- [ ] Case sensitivity can be toggled per keyword
- [ ] Whitelisted text overrides blacklist matches
- [ ] Options page fully manages all settings
- [ ] Changes in options page sync to popup
- [ ] All features work without external dependencies

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| ReDoS bypasses validation | High | Multiple detection layers, runtime timeout |
| Options page too complex | Medium | Clear section navigation, progressive disclosure |
| Regex patterns confuse users | Medium | Provide help modal, validation feedback |
| Storage sync race conditions | Low | Use storage.onChanged, avoid concurrent writes |

## Security Considerations

1. **ReDoS Protection:** Validate all user regex before compilation
2. **No eval():** Never execute user patterns as code
3. **Input Sanitization:** Escape HTML in all user-provided text
4. **Whitelist Validation:** Prevent malicious whitelist patterns

## Next Steps

After Phase 3 completion:
1. Proceed to [Phase 4: Polish](./phase-04-polish.md)
2. Consider adding regex testing sandbox
3. Evaluate need for cloud sync (with encryption)
