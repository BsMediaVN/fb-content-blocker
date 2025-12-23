# FB Content Blocker - Claude Code Configuration

## Project Overview
Chrome Extension (Manifest V3) that blocks Facebook content by keywords.

## Tech Stack
- **Platform:** Chrome Extension (Manifest V3)
- **Language:** Vanilla JavaScript (ES2020+)
- **Storage:** chrome.storage.sync/local API
- **UI:** HTML/CSS (no frameworks)

## Code Standards

### JavaScript
- Use `async/await` over callbacks/promises chains
- Use `const` by default, `let` when reassignment needed, never `var`
- Use arrow functions for callbacks
- Use template literals for string interpolation
- Use destructuring for object/array access
- Escape user input before DOM insertion (XSS prevention)
- Use `?.` optional chaining and `??` nullish coalescing

### Naming Conventions
- **Files:** kebab-case (`content-script.js`, `keyword-matcher.js`)
- **Functions:** camelCase, verb-first (`loadSettings`, `filterContent`)
- **Classes:** PascalCase (`KeywordMatcher`, `StorageManager`)
- **Constants:** SCREAMING_SNAKE_CASE (`MAX_KEYWORDS`, `DEFAULT_DEBOUNCE_MS`)
- **CSS classes:** kebab-case with prefix (`fb-blocker-placeholder`)

### Chrome Extension Patterns
- Use `chrome.storage.local` for large data (keywords), `chrome.storage.sync` for settings
- Use `chrome.runtime.sendMessage` for popup ↔ content script communication
- Handle storage quota errors gracefully
- Use MutationObserver with debouncing for DOM changes
- Never use `eval()` or inline scripts (CSP violation)

### Error Handling
```javascript
// Always catch async errors
try {
  await chrome.storage.local.set({ keywords });
} catch (error) {
  console.error('[FB Blocker] Storage error:', error);
}
```

### Comments
- Add comments for non-obvious logic only
- Use JSDoc for public functions:
```javascript
/**
 * Filters Facebook posts containing blocked keywords
 * @param {string[]} keywords - List of keywords to block
 * @returns {number} Count of blocked posts
 */
```

## File Structure
```
/
├── manifest.json       # Extension manifest (MV3)
├── content.js          # Content script (runs on Facebook)
├── content.css         # Styles for blocked content placeholders
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic
├── popup.css           # Popup styles
├── options.html        # Settings page (if needed)
├── options.js          # Settings logic
├── icons/              # Extension icons
├── src/                # Modular source (future)
│   ├── core/           # Matcher, storage, stats
│   └── utils/          # Helpers, migration
├── plans/              # Implementation plans
└── docs/               # Documentation
```

## Security Rules
- Never trust user input - escape HTML before rendering
- Validate regex patterns before compilation (prevent ReDoS)
- Don't store sensitive data in storage.sync (syncs to cloud)
- Use word boundary `\b` in regex to prevent partial matches

## Testing
- Test on facebook.com with various post types
- Test keyword matching with edge cases (unicode, Vietnamese, emoji)
- Test with 100+ keywords for performance
- Test data migration from v1 to v2 format

## Git Commit Messages
```
feat: add bulk keyword import
fix: word boundary matching for Vietnamese
refactor: extract KeywordMatcher class
docs: update README with usage instructions
```

## Forbidden
- No external CDN dependencies
- No `eval()`, `new Function()`, or inline event handlers
- No localStorage (use chrome.storage APIs)
- No hardcoded Facebook selectors without fallbacks
- No synchronous storage operations in content scripts
