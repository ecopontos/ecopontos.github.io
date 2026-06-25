// ⚠️ ESPELHO de desktop/src/infrastructure/sync/RateLimiter.ts
// Alterações aqui devem ser refletidas lá.
export class TokenBucketRateLimiter {
  constructor(maxTokens, refillRatePerSecond, initialTokens) {
    this.maxTokens = maxTokens;
    this.refillRatePerSecond = refillRatePerSecond;
    this.tokens = initialTokens ?? maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire() {
    while (!this.tryConsume()) {
      const waitMs = Math.ceil((1 / this.refillRatePerSecond) * 1000);
      await new Promise(r => setTimeout(r, Math.max(10, waitMs)));
      this.refill();
    }
  }

  tryConsume() {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const newTokens = elapsed * this.refillRatePerSecond;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }
}
