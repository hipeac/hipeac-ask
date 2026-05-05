import { describe, expect, it, vi } from "vitest";
import { type AuthCacheEntry } from "../../server/utils/authValidationCache";
import { validateAuthToken } from "../../server/utils/validateAuthToken";

describe("validateAuthToken", () => {
  it("returns cached validation without calling fetch", async () => {
    const cache = new Map<string, AuthCacheEntry>([
      ["t1", { isValid: true, expiresAt: Date.now() + 60_000 }],
    ]);
    const fetchFn = vi.fn<typeof fetch>();

    const result = await validateAuthToken({
      cache,
      token: "t1",
      hipeacApiUrl: "https://www.hipeac.net/api/v3/",
      timeoutMs: 1000,
      cacheTtlMs: 60_000,
      fetchFn,
    });

    expect(result).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns true and caches value when upstream auth is valid", async () => {
    const cache = new Map<string, AuthCacheEntry>();
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue({ ok: true } as Response);

    const result = await validateAuthToken({
      cache,
      token: "t2",
      hipeacApiUrl: "https://www.hipeac.net/api/v3/",
      timeoutMs: 1000,
      cacheTtlMs: 60_000,
      fetchFn,
    });

    expect(result).toBe(true);
    expect(cache.get("t2")?.isValid).toBe(true);
  });

  it("returns false and caches value when upstream auth is invalid", async () => {
    const cache = new Map<string, AuthCacheEntry>();
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue({ ok: false } as Response);

    const result = await validateAuthToken({
      cache,
      token: "t3",
      hipeacApiUrl: "https://www.hipeac.net/api/v3/",
      timeoutMs: 1000,
      cacheTtlMs: 60_000,
      fetchFn,
    });

    expect(result).toBe(false);
    expect(cache.get("t3")?.isValid).toBe(false);
  });

  it("returns null when upstream fetch fails", async () => {
    const cache = new Map<string, AuthCacheEntry>();
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new Error("network"));

    const result = await validateAuthToken({
      cache,
      token: "t4",
      hipeacApiUrl: "https://www.hipeac.net/api/v3/",
      timeoutMs: 1000,
      cacheTtlMs: 60_000,
      fetchFn,
    });

    expect(result).toBeNull();
    expect(cache.has("t4")).toBe(false);
  });

  it("uses global fetch when fetchFn is not provided", async () => {
    const cache = new Map<string, AuthCacheEntry>();
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue({ ok: true } as Response);
    vi.stubGlobal("fetch", fetchSpy);

    try {
      const result = await validateAuthToken({
        cache,
        token: "t5",
        hipeacApiUrl: "https://www.hipeac.net/api/v3/",
        timeoutMs: 1000,
        cacheTtlMs: 60_000,
      });

      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
