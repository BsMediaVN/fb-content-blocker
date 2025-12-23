# FB Content Blocker - Code Standards & Best Practices

**Version:** 1.0.0 | **Phase:** 1 | **Last Updated:** 2025-12-23

## Project-Wide Standards

### Language & Environment
- **Language:** JavaScript (ES2021+)
- **Target Environment:** Chrome Extension (Manifest V3)
- **No Build Tool:** Content scripts must be plain JS (no bundler)
- **Compatibility:** Chrome 88+ (MV3 requirement)

---

## Naming Conventions

### Variables & Functions
```javascript
// camelCase for variables and functions
let debounceTimer;
let matcher = new KeywordMatcher([]);
async function loadSettings() { }

// CONSTANT_CASE for actual constants
const MAX_KEYWORDS = 5000;
const DEBOUNCE_MS = 300;
const MAX_PATTERN_SIZE = 1024 * 1024;

// PascalCase for classes
class KeywordMatcher { }

// CONSTANT_CASE for configuration enums
const POST_SELECTORS = [
  '[data-pagelet^="FeedUnit"]',
  '[role="article"]'
];
```

### Data Properties
```javascript
// Keywords: lowercase text field
{
  id: "uuid",
  text: "keyword",           // lowercase
  category: "default",
  isRegex: false,            // camelCase boolean
  caseSensitive: false
}

// Stats: lowercase field names
{
  today: 5,                  // count today
  total: 42,                 // count all-time
  lastReset: "2025-12-23"   // ISO date string
}
```

---

## Code Organization

### Module Structure

**Content Script (Single File - No Bundler):**
```javascript
// 1. Class definitions (if inline)
class KeywordMatcher { }

// 2. Singleton objects
const Stats = { ... };
const Migration = { ... };

// 3. Module-level state
let matcher = new KeywordMatcher([]);
let enabled = true;
let observer = null;

// 4. Initialization
init();

// 5. Main functions (alphabetical)
async function filterContent() { }
async function hidePost(post) { }
async function init() { }
async function loadSettings() { }
```

**Modular Files (src/):**
```javascript
// Full class/object definition with JSDoc
class KeywordMatcher {
  /**
   * Description...
   * @param {Array} keywords - Description
   * @returns {boolean} Description
   */
  method() { }
}

// Export if needed
if (typeof window !== 'undefined') {
  window.KeywordMatcher = KeywordMatcher;
}
```

---

## Function Signatures

### Async/Await Pattern
```javascript
// Always use async for Promise-based operations
async function loadSettings() {
  try {
    const [localData, syncData] = await Promise.all([
      chrome.storage.local.get('keywords'),
      chrome.storage.sync.get('enabled')
    ]);
    return data;
  } catch (error) {
    console.error('[FB Blocker] loadSettings error:', error);
    return defaultValue;
  }
}
```

### Event Listeners
```javascript
// Always use arrow functions in addEventListener
element.addEventListener('click', () => {
  doSomething();
});

// OR explicit handler
element.addEventListener('change', handleChange);
```

### Chrome API Usage
```javascript
// Always handle errors in Chrome API calls
try {
  await chrome.storage.local.set({ keywords });
} catch (error) {
  console.error('[FB Blocker] Storage error:', error);
}
```

---

## Error Handling

### Standard Pattern
```javascript
// Try-catch for all async operations
async function operation() {
  try {
    const result = await chromeAPI();
    return result;
  } catch (error) {
    console.error('[FB Blocker] operation error:', error);
    return defaultValue; // Never throw, always return safe default
  }
}
```

### Logging Format
```javascript
// Always prefix with [FB Blocker]
console.log('[FB Blocker] Migration started');
console.warn('[FB Blocker] Keyword limit reached: 5000');
console.error('[FB Blocker] Storage error:', error);
```

### Safe Defaults
```javascript
// Always provide defaults in destructuring
const { keywords = [] } = await chrome.storage.local.get('keywords');
const { stats = { today: 0, total: 0, lastReset: null } } = data;
const enabled = syncData.enabled !== false; // explicit false check
```

---

## Data Handling & Validation

### Input Validation
```javascript
// Type checking
const text = typeof keyword === 'string' ? keyword : keyword.text;

// Null/empty checks
if (!text || !Array.isArray(data)) return;

// Size limits
if (file.size > MAX_FILE_SIZE) return error;

// Array bounds
if (index >= 0 && index < array.length) { }
```

### Regex Escaping (Critical!)
```javascript
// ALWAYS escape user input before regex
const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Never trust user input for regex patterns
const pattern = `\\b(?:${escaped.join('|')})\\b`;
```

### Storage Schema Migrations
```javascript
// Check version and migrate
if (syncData.version === 2) {
  return { migrated: false }; // Already migrated
}

// Transform old format to new
const newData = oldData.map(item => {
  if (typeof item === 'string') {
    return { id: uuid(), text: item, ... };
  }
  return item;
});
```

---

## DOM Manipulation

### Safe HTML Insertion
```javascript
// DO: Use textContent for untrusted content
div.textContent = untrustedText;

// AVOID: innerHTML with untrusted content
// div.innerHTML = untrustedText; // XSS risk

// Safe HTML utility
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

### DOM Query Performance
```javascript
// Cache queries when used multiple times
const list = document.getElementById('keywords-list');
list.textContent = '';
list.appendChild(item);

// Use specific selectors
const posts = document.querySelectorAll('[data-pagelet^="FeedUnit"]');

// Use forEach for NodeList iteration
posts.forEach(post => {
  processPost(post);
});
```

### Mutation Tracking
```javascript
// Track state with data attributes
post.dataset.fbBlocked = 'true';        // string values
post.dataset.originalDisplay = display;

// Check before processing
if (post.dataset.fbBlocked === 'shown') return;

// Clean up
delete post.dataset.fbBlocked;
delete post.dataset.originalDisplay;
```

---

## Style Guidelines

### Spacing & Indentation
```javascript
// 2-space indentation (standard for Chrome extensions)
async function example() {
  try {
    const result = await call();
    return result;
  } catch (error) {
    return default;
  }
}

// One space around operators
const x = a + b;
const fn = (param) => param * 2;
```

### Comments
```javascript
// Line comments for brief explanations
const DEBOUNCE_MS = 300; // Debounce interval in milliseconds

// Block comments for sections
// ============================================
// Main content script logic
// ============================================

// JSDoc for exported functions
/**
 * Increment blocked count
 * Resets daily count at midnight
 * @returns {Promise<{today: number, total: number}>}
 */
async function increment() { }
```

### File Headers
```javascript
/**
 * FB Content Blocker - Component Name
 * Brief description of what this file does
 */

// Then imports/class definitions
```

---

## Chrome Storage Patterns

### Storage Selection
```javascript
// Preferences & settings → use sync
await chrome.storage.sync.set({
  enabled: true,
  version: 2
});

// Large data (keywords) → use local
await chrome.storage.local.set({
  keywords: [...]
});

// Runtime state (if needed) → use session
await chrome.storage.session.set({
  processingQueue: [...]
});
```

### Get/Set Pattern
```javascript
// Always handle missing keys with defaults
const { keywords = [] } = await chrome.storage.local.get('keywords');

// Batch get when related
const [local, sync] = await Promise.all([
  chrome.storage.local.get('keywords'),
  chrome.storage.sync.get('enabled')
]);

// Always set atomically
await chrome.storage.local.set({
  keywords: [...],
  stats: { ... }
});
```

### Quota Management
```javascript
// Check before large writes
const ESTIMATED_SIZE = keywords.length * 100; // bytes
if (ESTIMATED_SIZE > MAX_SAFE_SIZE) {
  console.warn('[FB Blocker] Storage quota risk');
}

// Handle quota errors
try {
  await chrome.storage.local.set({ keywords });
} catch (error) {
  if (error.message.includes('QUOTA_BYTES')) {
    // Cleanup or notify user
  }
}
```

---

## Message Passing

### Content Script → Popup
```javascript
// In content script: notify popup of changes
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

### Listen for Messages
```javascript
// In content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'update') {
    loadSettings();
  }
});
```

### Storage Change Events
```javascript
// Always listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.keywords) {
    matcher.update(changes.keywords.newValue || []);
  }
  if (areaName === 'sync' && changes.enabled) {
    enabled = changes.enabled.newValue !== false;
  }
});
```

---

## Security Best Practices

### Input Sanitization
```javascript
// Always escape user input in DOM
const keyword = escapeHtml(userInput);

// Always escape before regex
const pattern = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Force safe defaults on import
keywords.push({
  ...userKeyword,
  isRegex: false,  // Force to false (security)
  caseSensitive: false
});
```

### File Validation
```javascript
// Check file size
if (file.size > MAX_FILE_SIZE) throw error;

// Validate JSON structure
const data = JSON.parse(file.text());
if (!data.keywords || !Array.isArray(data.keywords)) {
  throw error;
}

// Validate array bounds
if (data.keywords.length > MAX_KEYWORDS) {
  throw error;
}

// Validate individual items
for (const kw of data.keywords) {
  if (!kw.text || typeof kw.text !== 'string') continue;
  const trimmed = kw.text.trim().substring(0, MAX_LENGTH);
}
```

### Content Security
```javascript
// Never execute user input as code
// ✗ eval(userInput) - NEVER
// ✗ new Function(userInput) - NEVER
// ✓ Use declarative approaches only

// Use data attributes to store info
post.dataset.blocked = 'true';
```

---

## Testing Standards

### Test File Structure
```javascript
// 1. Imports/Setup
class KeywordMatcher { }

// 2. Test utilities
let passed = 0, failed = 0;
function test(name, fn) { }
function assert(condition, message) { }

// 3. Test cases
console.log('=== Test Suite ===\n');
test('should do X', () => {
  const result = operation();
  assertEqual(result, expected);
});

// 4. Summary
console.log(`\n${passed} passed, ${failed} failed`);
```

### Test Naming
```javascript
// Descriptive test names
test('Word boundary: "book" should NOT match "facebook"', () => {
  // Clearly states input and expected output
});

test('Case-insensitive: "FACEBOOK" should match "facebook"', () => {
  // Indicates feature being tested
});
```

### Assertion Functions
```javascript
function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}
```

---

## Performance Guidelines

### Regex Compilation
```javascript
// ✓ Compile once, use multiple times
this.compiledRegex = new RegExp(pattern, 'giu');

// Only recompile when keywords change
matcher.update(newKeywords); // triggers compile()
```

### DOM Operations
```javascript
// ✓ Batch DOM queries
const posts = document.querySelectorAll('[data-pagelet^="FeedUnit"]');
posts.forEach(post => { }); // single iteration

// ✓ Cache elements used repeatedly
const list = document.getElementById('keywords-list');
list.innerHTML = ''; // reuse reference

// ✗ Repeated queries
for (let i = 0; i < 100; i++) {
  const el = document.getElementById('x'); // inefficient
}
```

### Debouncing
```javascript
// Debounce rapid events (MutationObserver)
let debounceTimer;
observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    filterContent();
  }, DEBOUNCE_MS); // 300ms typical
});
```

---

## Deployment & Versioning

### Version String
```javascript
// manifest.json version format
"version": "1.0.0" // semver: MAJOR.MINOR.PATCH

// Data schema versioning
{ version: 2 } // chrome.storage.sync
```

### Change Log Format
```markdown
## Version 1.0.0 (2025-12-23)
- Feature: Word boundary keyword matching
- Feature: Bulk keyword import/export
- Feature: Statistics tracking
- Fix: Migration from v1 to v2 data format
- Tests: 23 unit tests for matcher
```

---

## Common Patterns

### Settings Load Pattern
```javascript
async function loadSettings() {
  try {
    const [localData, syncData] = await Promise.all([
      chrome.storage.local.get('keywords'),
      chrome.storage.sync.get('enabled')
    ]);

    const keywords = localData.keywords || [];
    const enabled = syncData.enabled !== false;

    matcher.update(keywords);
    return { keywords, enabled };
  } catch (error) {
    console.error('[FB Blocker] loadSettings error:', error);
    return { keywords: [], enabled: true };
  }
}
```

### Event Listener Pattern
```javascript
async function setupEventListeners() {
  document.getElementById('add-btn')
    .addEventListener('click', addKeyword);

  document.getElementById('keyword-input')
    .addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addKeyword();
    });
}
```

### Data Transform Pattern
```javascript
// When migrating or importing data
const transformed = items.map(item => {
  // Handle both old and new formats
  const text = typeof item === 'string' ? item : item.text;

  // Add required fields
  return {
    id: item.id || crypto.randomUUID(),
    text: text.trim().substring(0, MAX_LENGTH),
    category: item.category || 'default',
    isRegex: false, // force safe value
    caseSensitive: false
  };
});
```

---

## Debugging

### Logging Best Practices
```javascript
// Always prefix with extension name
console.log('[FB Blocker] Settings loaded');
console.warn('[FB Blocker] Regex pattern too large');
console.error('[FB Blocker] Storage error:', error);

// Include context in error messages
if (!matcher) {
  console.error('[FB Blocker] matcher is null in filterContent()');
}
```

### Chrome Extension Debugging
```javascript
// Access popup console: Right-click extension icon → Inspect popup
// Access content script console: Right-click page → Inspect → Sources

// Use debugger
debugger; // execution pauses here if DevTools open

// Check extension state
chrome.storage.local.get(null, (all) => {
  console.log('All local storage:', all);
});
```

---

## Code Review Checklist

- [ ] All variables follow camelCase (except constants)
- [ ] All functions have try-catch with error logging
- [ ] All user input is escaped before DOM use
- [ ] All regex patterns escape user input
- [ ] All Chrome API calls handle errors
- [ ] All async functions properly await Promises
- [ ] No `localStorage` or `sessionStorage` (use chrome.storage)
- [ ] No `eval()` or `new Function()`
- [ ] File size limits enforced on uploads
- [ ] Array bounds checked before access
- [ ] Null/undefined safely handled
- [ ] JSDoc comments on exported functions
- [ ] Tests pass: `node tests/matcher.test.js`

---

## References

- [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html) (baseline, adapted for extensions)
- [Chrome Extension Best Practices](https://developer.chrome.com/docs/extensions/mv3/)
- [OWASP Security Guidelines](https://owasp.org/www-project-web-security-testing-guide/)
