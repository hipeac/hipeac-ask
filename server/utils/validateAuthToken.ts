import {
  getCachedAuthValidation,
  setCachedAuthValidation,
  type AuthCacheEntry,
} from "./authValidationCache";

interface ValidateAuthTokenOptions {
  cache: Map<string, AuthCacheEntry>;
  token: string;
  hipeacApiUrl: string;
  timeoutMs: number;
  cacheTtlMs: number;
  fetchFn?: typeof fetch;
}

export async function validateAuthToken({
  cache,
  token,
  hipeacApiUrl,
  timeoutMs,
  cacheTtlMs,
  fetchFn = fetch,
}: ValidateAuthTokenOptions): Promise<boolean | null> {
  const cached = getCachedAuthValidation(cache, token);
  if (typeof cached === "boolean") {
    return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(`${hipeacApiUrl}auth/me/`, {
      headers: { Authorization: `Token ${token}` },
      signal: controller.signal,
    });
    setCachedAuthValidation(cache, token, res.ok, cacheTtlMs);
    return res.ok;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
