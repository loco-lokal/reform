// Fixed-window limiter per key (client IP). In memory: the service runs as a single replica.
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Counts a hit and returns false once the key exceeded the limit in the current window. */
  hit(key: string, now = Date.now()): boolean {
    if (this.hits.size > 10000) this.prune(now)
    const entry = this.hits.get(key)
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs })
      return true
    }
    entry.count++
    return entry.count <= this.limit
  }

  private prune(now: number) {
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key)
  }
}
