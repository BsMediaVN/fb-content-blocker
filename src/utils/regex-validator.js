/**
 * Regex Validator - ReDoS protection and syntax validation
 */
const RegexValidator = {
  // Patterns that may cause catastrophic backtracking
  REDOS_PATTERNS: [
    /\(\s*[^)]*[+*]\s*\)\s*[+*]/, // Nested quantifiers: (a+)+
    /\(\s*[^)|]*\|\s*[^)]*\)\s*[+*]/, // Alternation with quantifier: (a|a)*
  ],

  /**
   * Validate regex pattern for syntax and safety
   * @param {string} pattern - Regex pattern to validate
   * @param {number} maxDuration - Max execution time in ms
   * @returns {{valid: boolean, error: string|null}}
   */
  validate(pattern, maxDuration = 100) {
    if (!pattern || typeof pattern !== 'string') {
      return { valid: false, error: 'Pattern required' };
    }

    // Syntax check
    try {
      new RegExp(pattern, 'u');
    } catch (e) {
      return { valid: false, error: `Invalid regex: ${e.message}` };
    }

    // ReDoS pattern check
    for (const evil of this.REDOS_PATTERNS) {
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
};

if (typeof window !== 'undefined') {
  window.RegexValidator = RegexValidator;
}
