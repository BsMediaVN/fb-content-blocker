# Chrome Extension Manifest V3: Best Practices Research
**Date:** 2025-12-23 | **Focus:** Content blocking extension patterns

---

## 1. Storage Patterns (100+ Keywords)

### Problem
- `chrome.storage.sync`: ~100KB total, 8KB per item (insufficient for 100+ keywords)
- Keywords typically 5-50 bytes each = 500B-5KB total (fits sync if compressed)

### Solution
**Hybrid approach:**
```javascript
// Settings in sync (small data)
chrome.storage.sync.set({
  enabled: true,
  debounceMs: 300,
  version: 2
});

// Keywords in local (large data)
chrome.storage.local.set({
  keywords: ['facebook', 'instagram', ...] // 100+ items
});
```

### Best Practices
1. **Use `chrome.storage.local`** for keyword lists (5MB+ limit)
2. **Use `chrome.storage.sync`** for settings/preferences only
3. **Use `chrome.storage.session`** for runtime state (1MB, cleared on exit)
4. **Handle quota errors gracefully** - catch QUOTA_BYTES exceeded, implement cleanup
5. **Prefer compression** if sync is required - gzip keywords before storing
6. **Never use localStorage** - blocks UI, not available in service workers

---

## 2. Content Script Performance

### MutationObserver Optimization
**DON'T:** Observe entire document continuously
```javascript
// ❌ SLOW: Observes everything
const observer = new MutationObserver(mutations => {
  mutations.forEach(m => processAllNodes(m.addedNodes));
});
observer.observe(document, { subtree: true, childList: true });
```

**DO:** Target specific subtrees + element filtering
```javascript
// ✅ FAST: Efficient filtering
const observer = new MutationObserver(mutations => {
  mutations.forEach(m => {
    m.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.matches('a, span, div.post')) { // Specific selectors
          processNode(node);
        }
      }
    });
  });
});
observer.observe(document.querySelector('main'), {
  subtree: true,
  childList: true
}); // Observe only main content area
```

### Debouncing Strategy
```javascript
let debounceTimer;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    processPendingNodes();
  }, 300); // 300ms debounce
});
observer.observe(document, { subtree: true, childList: true });
```

### Key Rules
1. **Scope observer to relevant DOM subtrees** (not entire document)
2. **Debounce processing** - 250-500ms typical for SPAs
3. **Use element.matches()** to filter nodes before processing
4. **Consider intersection observer** for visible content (lazy block)
5. **Mutation Summary library** for complex scenarios (faster than raw MutationObserver)

---

## 3. Options Page vs Popup

### Popup (Lightweight)
- Click toolbar icon → appears temporarily
- **Access:** Chrome APIs, can talk to content scripts directly
- **Limitation:** Closed when user clicks away
- **Use case:** Quick actions, status display

```javascript
// popup.js: Direct content script messaging
chrome.tabs.sendMessage(tabId, { action: 'blockContent' });
```

### Options Page (Full Featured)
- Open via `chrome.runtime.openOptionsPage()` or settings gear
- **Access:** Chrome APIs, full DOM, persistent
- **Limitation:** Cannot use Tabs API (use `runtime.sendMessage` instead)
- **Use case:** Keyword management, detailed settings, lists

```javascript
// options.js: Cannot access tabs directly
chrome.runtime.sendMessage({ action: 'updateSettings', keywords: [...] });
```

### Message Passing Architecture
```
┌─────────────────┐
│  Background SW  │ ← Service worker (always available)
└────────┬────────┘
         │ (runtime.sendMessage / runtime.connect)
    ┌────┴──────┐
    │            │
┌───▼────┐  ┌───▼─────┐
│ Popup  │  │ Options  │
└────────┘  └──────────┘
     │ (chrome.tabs.sendMessage)
     │
┌────▼──────────────┐
│ Content Script(s) │ ← One per tab
└───────────────────┘
```

---

## 4. Message Passing (MV3 Patterns)

### One-Time Messages (Lightweight)
```javascript
// Content script → Background
chrome.runtime.sendMessage({ type: 'CONTENT_LOADED', url: location.href });

// Background → Popup
chrome.runtime.sendMessage({ type: 'UPDATE_UI', count: 42 });

// Popup → Content script
chrome.tabs.sendMessage(activeTabId, { type: 'INJECT_BLOCKER' });
```

### Long-Lived Connections (Persistent)
```javascript
// Establish port from content script
const port = chrome.runtime.connect({ name: 'block-channel' });
port.postMessage({ action: 'start_blocking' });
port.onMessage.addListener(msg => console.log('Got:', msg));

// Background listens
chrome.runtime.onConnect.addListener(port => {
  port.onMessage.addListener(msg => {
    port.postMessage({ status: 'processing' });
  });
});
```

### Best Practices
1. **One-time messages** for quick operations (< 1s)
2. **Ports (chrome.runtime.connect)** for streaming/continuous data
3. **DO NOT use storage as IPC** - slow, unpredictable, anti-pattern
4. **Service worker lifecycle:** Restarts frequently → use persistent storage for state
5. **Options page:** Use `chrome.runtime.sendMessage()` only (no Tabs API)

---

## 5. Dark Mode Detection

### Detection Pattern (MV3)
```javascript
// In background service worker or content script
const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

// Listen for changes
window.matchMedia('(prefers-color-scheme: dark)').addListener(e => {
  const isDark = e.matches;
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
});
```

### CSS Approach (Recommended)
```css
:root {
  --bg: white;
  --text: black;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1e1e1e;
    --text: #ffffff;
  }
}
```

### Limitations
1. **Follows OS setting only** - Chrome theme != prefers-color-scheme
2. **Icon color** - Browsers don't auto-adjust icon colors yet
3. **Workaround:** Use Web Preferences API (experimental, Chrome 96+)

---

## Key Takeaways

| Component | Pattern | Limit | Note |
|-----------|---------|-------|------|
| Storage (sync) | Settings only | 100KB | Use local for keywords |
| Storage (local) | Keywords, larger data | 5MB+ | Async, device-only |
| MutationObserver | Debounced, scoped | N/A | 250-500ms debounce |
| Message passing | One-time or ports | N/A | Avoid storage as IPC |
| Dark mode | matchMedia listener | N/A | Follows OS setting |
| Options page | Full settings UI | N/A | No Tabs API access |

---

## Unresolved Questions

1. How to handle keyword filtering across 100+ keywords efficiently (regex vs linear search)?
2. Should keyword list be paginated for UI display in options?
3. Best practice for testing MutationObserver performance with large DOM?

---

## Sources
- [Chrome Extensions API Reference - storage](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Content scripts in Manifest V3](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)
- [Message passing guide](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [Options page documentation](https://github.com/GoogleChrome/developer.chrome.com/blob/main/site/en/docs/extensions/mv3/options/index.md)
- [prefers-color-scheme MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
- [Chrome Extension performance best practices](https://dev.to/javediqbal8381/understanding-chrome-extensions-a-developers-guide-to-manifest-v3-233l)
