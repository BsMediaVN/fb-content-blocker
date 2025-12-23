# FB Content Blocker - Claude Code Configuration

## IMPORTANT: First Steps
**Before coding any feature, ALWAYS read:**
1. `docs/codebase-summary.md` - Current architecture & features
2. `docs/code-standards.md` - Coding conventions

**After implementing features:**
1. Update `docs/codebase-summary.md` with new features
2. Commit with conventional message format

---

## Project State
- **Version:** 2.1.0
- **Status:** Production ready
- **Language:** Vietnamese (vi) + English (en)

## Current Features
- Built-in ads blocking (auto-block "Được tài trợ", "Sponsored")
- Keyword filtering with Vietnamese word boundary support
- Fuzzy matching (diacritic-insensitive)
- Whitelist support
- Comment blocking
- Regex patterns (optional)
- Import/Export JSON
- Statistics tracking

---

## Tech Stack
- **Platform:** Chrome Extension (Manifest V3)
- **Language:** Vanilla JavaScript (ES2020+)
- **Storage:** chrome.storage.sync/local API
- **i18n:** `_locales/vi/`, `_locales/en/`
- **UI:** HTML/CSS (no frameworks)

---

## Quick Commands

```bash
# Run tests
node tests/matcher.test.js

# Check syntax
node -c content.js

# Enable debug mode
# Edit content.js: const DEBUG = true;
```

---

## Code Standards

### JavaScript
- Use `async/await` over callbacks
- Use `const` by default, `let` when needed, never `var`
- Use arrow functions for callbacks
- Use `?.` optional chaining and `??` nullish coalescing
- Escape user input before DOM insertion (XSS prevention)

### Naming Conventions
- **Files:** kebab-case (`content-script.js`)
- **Functions:** camelCase, verb-first (`loadSettings`, `filterContent`)
- **Classes:** PascalCase (`KeywordMatcher`)
- **Constants:** SCREAMING_SNAKE_CASE (`MAX_KEYWORDS`)
- **CSS classes:** kebab-case with prefix (`fb-blocker-placeholder`)

### Vietnamese Support
- Word boundary: Use `(?<![a-zA-Z0-9])(?:pattern)(?![a-zA-Z0-9])` instead of `\b`
- Diacritics: Use `normalizeText()` for fuzzy matching
- i18n: Add messages to both `_locales/vi/` and `_locales/en/`

---

## File Structure
```
fb-content-blocker/
├── _locales/           # i18n translations
│   ├── vi/messages.json
│   └── en/messages.json
├── docs/               # Documentation (READ FIRST)
│   ├── codebase-summary.md  # ← READ THIS
│   └── code-standards.md
├── tests/
│   └── matcher.test.js
├── content.js          # Main content script
├── popup.html/js/css   # Popup UI
├── options.html/js/css # Options page
└── manifest.json
```

---

## Key Components (content.js)

### BUILT_IN_ADS_PATTERNS
Auto-blocks sponsored content without user keywords:
```javascript
['Được tài trợ', 'Sponsored', 'Đề xuất cho bạn', ...]
```

### KeywordMatcher
Regex-based matching with whitelist support:
```javascript
const matcher = new KeywordMatcher(keywords, whitelist);
matcher.matches(text); // true/false
```

### normalizeText()
Removes Vietnamese diacritics for fuzzy matching:
```javascript
normalizeText('Được tài trợ') // → 'duoc tai tro'
```

### findPostContainer()
Traverses DOM to find Facebook post container for hiding.

---

## Git Commit Messages
```
feat: add bulk keyword import
fix: word boundary matching for Vietnamese
refactor: extract KeywordMatcher class
docs: update codebase-summary with new features
chore: disable DEBUG mode
```

---

## Security Rules
- Never trust user input - escape HTML
- Validate regex patterns (prevent ReDoS)
- Use word boundary patterns for accurate matching
- No `eval()`, `new Function()`, or inline scripts

---

## Testing Checklist
- [ ] Test on facebook.com with sponsored posts
- [ ] Test Vietnamese keywords with/without diacritics
- [ ] Test with 100+ keywords
- [ ] Run `node tests/matcher.test.js` (31 tests)
- [ ] Check Console for `[FB Blocker]` errors

---

## Workflow

### Adding New Feature
1. Read `docs/codebase-summary.md`
2. Implement feature
3. Add tests if needed
4. Update `docs/codebase-summary.md`
5. Commit with conventional message
6. Push to remote

### Debugging
1. Set `DEBUG = true` in content.js
2. Reload extension in chrome://extensions
3. Check Console filter: `[FB Blocker]`
4. Fix issue
5. Set `DEBUG = false`
6. Commit fix
