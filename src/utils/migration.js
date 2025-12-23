/**
 * Migration - Handles v1 to v2 data migration
 * v1: keywords as string[] in chrome.storage.sync
 * v2: keywords as object[] in chrome.storage.local
 */
const Migration = {
  /**
   * Check and migrate v1 data to v2 format
   * @returns {Promise<{migrated: boolean, count: number}>}
   */
  async migrateV1ToV2() {
    try {
      const syncData = await chrome.storage.sync.get(['keywords', 'version', 'enabled']);

      // Already migrated
      if (syncData.version === 2) {
        return { migrated: false, count: 0 };
      }

      const oldKeywords = syncData.keywords || [];
      if (oldKeywords.length === 0 && !syncData.keywords) {
        // No v1 data, just set version
        await chrome.storage.sync.set({ version: 2 });
        return { migrated: false, count: 0 };
      }

      // Transform flat string[] to structured objects
      const newKeywords = oldKeywords.map(text => {
        // Handle if already object (partial migration)
        if (typeof text === 'object' && text.text) {
          return {
            id: text.id || crypto.randomUUID(),
            text: text.text,
            category: text.category || 'default',
            isRegex: text.isRegex || false,
            caseSensitive: text.caseSensitive || false
          };
        }

        return {
          id: crypto.randomUUID(),
          text: String(text),
          category: 'default',
          isRegex: false,
          caseSensitive: false
        };
      });

      // Move keywords to local storage
      await chrome.storage.local.set({ keywords: newKeywords });

      // Update sync storage: set version, keep enabled, remove keywords
      await chrome.storage.sync.set({
        version: 2,
        enabled: syncData.enabled !== false
      });
      await chrome.storage.sync.remove('keywords');

      console.log(`[FB Blocker] Migrated ${newKeywords.length} keywords from v1 to v2`);
      return { migrated: true, count: newKeywords.length };
    } catch (error) {
      console.error('[FB Blocker] Migration error:', error);
      return { migrated: false, count: 0, error: error.message };
    }
  },

  /**
   * Get current data version
   * @returns {Promise<number>}
   */
  async getVersion() {
    try {
      const { version = 1 } = await chrome.storage.sync.get('version');
      return version;
    } catch {
      return 1;
    }
  }
};

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.Migration = Migration;
}
