import { describe, expect, it } from "vitest";
import {
  getCachedAuthValidation,
  setCachedAuthValidation,
  type AuthCacheEntry,
} from "../../server/utils/authValidationCache";

describe("authValidationCache", () => {
  it("returns undefined for missing token", () => {
    const cache = new Map<string, AuthCacheEntry>();
    expect(getCachedAuthValidation(cache, "missing", 1000)).toBeUndefined();
  });

  it("returns cached validity when entry is not expired", () => {
    const cache = new Map<string, AuthCacheEntry>();
    setCachedAuthValidation(cache, "token-a", true, 60_000, 1000);

    expect(getCachedAuthValidation(cache, "token-a", 50_000)).toBe(true);
  });

  it("expires and removes stale entries", () => {
    const cache = new Map<string, AuthCacheEntry>();
    setCachedAuthValidation(cache, "token-b", false, 1000, 1000);

    expect(getCachedAuthValidation(cache, "token-b", 2500)).toBeUndefined();
    expect(cache.has("token-b")).toBe(false);
  });

  it("supports caching invalid tokens", () => {
    const cache = new Map<string, AuthCacheEntry>();
    setCachedAuthValidation(cache, "token-c", false, 60_000, 1000);

    expect(getCachedAuthValidation(cache, "token-c", 2000)).toBe(false);
  });
});
