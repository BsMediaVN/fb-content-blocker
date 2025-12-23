# FB Content Blocker

Chrome Extension to filter Facebook content by keywords. Block posts and comments containing unwanted words.

## Features

### Core Features
- **Word Boundary Matching** - "book" won't block "facebook" (uses regex `\b`)
- **Bulk Add Keywords** - Paste multiple keywords (one per line)
- **Import/Export JSON** - Backup and restore keyword lists
- **Statistics** - Track blocked posts today/total
- **Categories** - Organize keywords by type (Spam, Ads, Politics, etc.)
- **Search Keywords** - Quick search in large keyword lists

### Advanced Features
- **Comment Blocking** - Block comments containing keywords (not just posts)
- **Regex Support** - Use regex patterns for advanced matching
- **Whitelist** - Exception list (won't block even if matches)
- **Case Sensitivity** - Optional case-sensitive matching
- **Options Page** - Full settings page (not just popup)

### Polish
- **Dark Mode** - Follows system theme preference
- **Performance** - Debounced observer (300ms) + text caching

## Installation

1. Clone or download this repository
2. Open `chrome://extensions/` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the extension folder

## Usage

1. Click the extension icon to open popup
2. Add keywords to block (single or bulk)
3. Select category for organization
4. Toggle extension on/off as needed

### Options Page
Right-click extension icon → "Options" for advanced settings:
- Manage whitelist
- Enable/disable comment blocking
- Add regex patterns
- Import/export full backup

## File Structure

```
fb-content-blocker/
├── manifest.json          # Extension config (v3)
├── content.js             # Main content script (filtering logic)
├── content.css            # Placeholder styles
├── popup.html/js/css      # Extension popup UI
├── options.html/js/css    # Options page UI
├── src/
│   └── utils/
│       └── regex-validator.js  # ReDoS protection
├── tests/
│   └── matcher.test.js    # 31 unit tests
└── icons/                 # Extension icons
```

## Technical Details

### Storage
- `chrome.storage.local` - Keywords, whitelist, stats (5MB limit)
- `chrome.storage.sync` - Settings (synced across devices, 100KB limit)

### Matching Algorithm
- Plain keywords: Combined into single regex with word boundaries
- Regex keywords: Separate patterns, validated for ReDoS safety
- Whitelist: Checked first, prevents blocking if matched

### Facebook Selectors (Dec 2024)
```javascript
// Posts
'[data-pagelet^="FeedUnit"]'
'[role="article"]'
'div[class*="x1yztbdb"][class*="x1n2onr6"]'

// Comments
'[aria-label*="Comment"]'
'[data-testid*="comment"]'
'div[dir="auto"][class*="x1lliihq"]'
```

### Security
- XSS prevention: `textContent` and `createElement` (no innerHTML)
- ReDoS protection: Pattern validation + runtime timeout
- CSP: `script-src 'self'; object-src 'self'`
- Input limits: 5000 keywords, 500 chars/keyword, 10MB import

## Debug Mode

Enable debug logging in `content.js`:
```javascript
const DEBUG = true;  // Line 9
```

Then check browser console (F12) for `[FB Blocker]` logs.

## Development

### Run Tests
```bash
node tests/matcher.test.js
```

### Version History
- **v2.0.0** - Full feature release (categories, whitelist, regex, dark mode)
- **v1.0.0** - Initial release (basic keyword blocking)

## License

MIT
