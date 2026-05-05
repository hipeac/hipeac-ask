export interface AuthCacheEntry {
  isValid: boolean;
  expiresAt: number;
}

export function getCachedAuthValidation(
  cache: Map<string, AuthCacheEntry>,
  token: string,
  now = Date.now(),
): boolean | undefined {
  const cached = cache.get(token);
  if (!cached) {
    return undefined;
  }

  if (cached.expiresAt <= now) {
    cache.delete(token);
    return undefined;
  }

  return cached.isValid;
}

export function setCachedAuthValidation(
  cache: Map<string, AuthCacheEntry>,
  token: string,
  isValid: boolean,
  ttlMs: number,
  now = Date.now(),
): void {
  cache.set(token, {
    isValid,
    expiresAt: now + ttlMs,
  });
}
