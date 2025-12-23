/**
 * KeywordMatcher - Regex-based keyword matching with word boundary support
 * Compiles keywords into single regex for O(n) text scanning
 */
class KeywordMatcher {
  constructor(keywords = []) {
    this.keywords = keywords;
    this.compiledRegex = null;
    this.compile();
  }

  /**
   * Compile keywords into single alternation regex with word boundaries
   * Escapes special regex characters in user input
   */
  compile() {
    if (this.keywords.length === 0) {
      this.compiledRegex = null;
      return;
    }

    const escaped = this.keywords.map(kw => {
      const text = typeof kw === 'string' ? kw : kw.text;
      return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });

    // Using \b for word boundary with 'u' flag for Unicode support
    // 'i' flag for case-insensitive matching
    this.compiledRegex = new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'giu');
  }

  /**
   * Test if text contains any blocked keyword
   * @param {string} text - Text to check
   * @returns {boolean} True if any keyword matches
   */
  matches(text) {
    if (!this.compiledRegex || !text) return false;
    this.compiledRegex.lastIndex = 0; // Reset for global flag
    return this.compiledRegex.test(text);
  }

  /**
   * Update keywords and recompile regex
   * @param {Array} keywords - New keywords array
   */
  update(keywords) {
    this.keywords = keywords;
    this.compile();
  }

  /**
   * Get count of keywords
   * @returns {number}
   */
  get count() {
    return this.keywords.length;
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.KeywordMatcher = KeywordMatcher;
}
