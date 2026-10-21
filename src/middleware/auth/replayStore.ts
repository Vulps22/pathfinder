export interface ReplayStore {
  /**
   * Record `key` until `expiresAt` (ms since epoch). Return false if the key is
   * already recorded and unexpired. Must be an atomic check-and-set, e.g. Redis `SET key 1 NX PXAT expiresAt`.
   */
  add(key: string, expiresAt: number): boolean | Promise<boolean>;
}

// Per-process only: replays sent to a different instance won't be caught. Use a shared store for multi-instance deployments.
export function memoryReplayStore(): ReplayStore {
  const seen = new Map<string, number>();

  return {
    add(key: string, expiresAt: number): boolean {
      const now = Date.now();

      // Entries go in roughly in expiry order, so sweeping expired ones off the front keeps the map bounded to about one window.
      for (const [k, exp] of seen) {
        if (exp > now) break;
        seen.delete(k);
      }

      const existing = seen.get(key);
      if (existing !== undefined && existing > now) {
        return false;
      }

      seen.delete(key);
      seen.set(key, expiresAt);
      return true;
    },
  };
}
