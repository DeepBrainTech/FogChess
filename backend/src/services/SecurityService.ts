/**
 * SecurityService – security and abuse-prevention layer (not wired).
 * Critical for production: rate limiting, input sanitization, abuse detection,
 * blocklists, and audit logging. Wire when moving to public deployment.
 */

export type SecurityEvent =
  | 'rate_limit_hit'
  | 'invalid_input'
  | 'suspicious_activity'
  | 'blocked_access'
  | 'auth_failure'
  | 'flood_attempt';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

export interface SecurityEventPayload {
  event: SecurityEvent;
  userId?: number;
  ip?: string;
  resource?: string;
  details?: Record<string, unknown>;
}

/** Default rate limits for different endpoints */
export const RATE_LIMITS = {
  api: { windowMs: 60_000, maxRequests: 100, keyPrefix: 'api' },
  auth: { windowMs: 15 * 60_000, maxRequests: 10, keyPrefix: 'auth' },
  socket: { windowMs: 60_000, maxRequests: 200, keyPrefix: 'socket' },
  move: { windowMs: 60_000, maxRequests: 120, keyPrefix: 'move' },
} as const;

export class SecurityService {
  private _enabled = false;
  private _auditEnabled = false;

  enable(): void {
    this._enabled = true;
  }

  disable(): void {
    this._enabled = false;
  }

  isEnabled(): boolean {
    return this._enabled;
  }

  enableAudit(): void {
    this._auditEnabled = true;
  }

  disableAudit(): void {
    this._auditEnabled = false;
  }

  /** Check if request is within rate limit. Returns true if allowed. */
  async checkRateLimit(
    key: string,
    config: RateLimitConfig = RATE_LIMITS.api
  ): Promise<{ allowed: boolean; remaining?: number }> {
    if (!this._enabled) return { allowed: true };
    // TODO: Redis INCR + EXPIRE, or in-memory Map per key
    void key;
    void config;
    return { allowed: true, remaining: config.maxRequests };
  }

  /** Record a request for rate limiting (increment counter) */
  async recordRequest(key: string, config?: RateLimitConfig): Promise<void> {
    if (!this._enabled) return;
    void key;
    void config;
  }

  /** Sanitize string input (XSS, length, charset) */
  sanitizeInput(input: string, maxLength = 500): string {
    if (!this._enabled) return input;
    const trimmed = input.trim().slice(0, maxLength);
    // TODO: strip HTML, script tags, control chars
    return trimmed;
  }

  /** Check if IP or userId is blocklisted */
  async isBlocked(ip?: string, userId?: number): Promise<boolean> {
    if (!this._enabled) return false;
    // TODO: lookup Redis/DB blocklist
    void ip;
    void userId;
    return false;
  }

  /** Add to blocklist (admin action) */
  async addToBlocklist(ip?: string, userId?: number): Promise<void> {
    if (!this._enabled) return;
    void ip;
    void userId;
  }

  /** Emit security event for logging / alerting */
  async emitEvent(payload: SecurityEventPayload): Promise<void> {
    if (!this._auditEnabled && !this._enabled) return;
    // TODO: write to log, metrics, or external SIEM
    void payload;
  }

  /** Detect suspicious move frequency (anti-bot / cheat signal) */
  async checkMoveFlood(userId: number, roomId: string): Promise<boolean> {
    if (!this._enabled) return false;
    // TODO: if moves per second exceed threshold, return true
    void userId;
    void roomId;
    return false;
  }

  /** Validate room ID format */
  isValidRoomId(id: string): boolean {
    if (!id || typeof id !== 'string') return false;
    return /^[a-zA-Z0-9_-]{4,64}$/.test(id);
  }

  /** Validate username format */
  isValidUsername(name: string): boolean {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    return trimmed.length >= 1 && trimmed.length <= 32 && !/[\x00-\x1f<>]/.test(trimmed);
  }
}

export const securityService = new SecurityService();
