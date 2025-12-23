/**
 * Stats - Blocking statistics tracker
 * Tracks daily and total blocked posts with automatic daily reset
 */
const Stats = {
  /**
   * Increment blocked count
   * Resets daily count at midnight
   * @returns {Promise<{today: number, total: number}>}
   */
  async increment() {
    try {
      const { stats = { today: 0, total: 0, lastReset: null } } =
        await chrome.storage.local.get('stats');

      const today = new Date().toISOString().split('T')[0];

      // Reset daily count if new day
      if (stats.lastReset !== today) {
        stats.today = 0;
        stats.lastReset = today;
      }

      stats.today++;
      stats.total++;

      await chrome.storage.local.set({ stats });
      return { today: stats.today, total: stats.total };
    } catch (error) {
      console.error('[FB Blocker] Stats.increment error:', error);
      return { today: 0, total: 0 };
    }
  },

  /**
   * Get current stats
   * @returns {Promise<{today: number, total: number}>}
   */
  async get() {
    try {
      const { stats = { today: 0, total: 0, lastReset: null } } =
        await chrome.storage.local.get('stats');

      const today = new Date().toISOString().split('T')[0];

      // Return 0 for today if different day
      if (stats.lastReset !== today) {
        return { today: 0, total: stats.total };
      }

      return { today: stats.today, total: stats.total };
    } catch (error) {
      console.error('[FB Blocker] Stats.get error:', error);
      return { today: 0, total: 0 };
    }
  },

  /**
   * Reset all stats
   */
  async reset() {
    try {
      await chrome.storage.local.set({
        stats: { today: 0, total: 0, lastReset: null }
      });
    } catch (error) {
      console.error('[FB Blocker] Stats.reset error:', error);
    }
  }
};

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.Stats = Stats;
}
