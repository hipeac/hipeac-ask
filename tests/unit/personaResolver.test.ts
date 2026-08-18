import { describe, expect, it, vi } from "vitest";
import { resolvePersonaSystem, type DbPersona } from "../../server/utils/personaResolver";

const BASE_SYSTEM_PROMPT = "base prompt";
const hipeacApiUrl = "https://www.hipeac.net/api/v3/";
const timeoutMs = 2500;

describe("resolvePersonaSystem", () => {
  it("returns the cached value without fetching when already cached", async () => {
    const cache = new Map<string, string>([["vision-expert", "cached prompt"]]);
    const fetchPersonas = vi.fn();

    const result = await resolvePersonaSystem({
      cache,
      personaCode: "vision-expert",
      hipeacApiUrl,
      timeoutMs,
      baseSystemPrompt: BASE_SYSTEM_PROMPT,
      fetchPersonas,
    });

    expect(result).toBe("cached prompt");
    expect(fetchPersonas).not.toHaveBeenCalled();
  });

  it("fetches personas and caches the combined system prompt", async () => {
    const cache = new Map<string, string>();
    const personas: DbPersona[] = [
      { code: "vision-expert", system_prompt: "You are a Vision expert." },
    ];
    const fetchPersonas = vi.fn().mockResolvedValue(personas);

    const result = await resolvePersonaSystem({
      cache,
      personaCode: "vision-expert",
      hipeacApiUrl,
      timeoutMs,
      baseSystemPrompt: BASE_SYSTEM_PROMPT,
      fetchPersonas,
    });

    expect(result).toBe("You are a Vision expert.\n\nbase prompt");
    expect(cache.get("vision-expert")).toBe("You are a Vision expert.\n\nbase prompt");
  });

  it("caches personas with an empty system_prompt so they are not re-fetched every request", async () => {
    const cache = new Map<string, string>();
    const personas: DbPersona[] = [{ code: "plain", system_prompt: "" }];
    const fetchPersonas = vi.fn().mockResolvedValue(personas);

    const first = await resolvePersonaSystem({
      cache,
      personaCode: "plain",
      hipeacApiUrl,
      timeoutMs,
      baseSystemPrompt: BASE_SYSTEM_PROMPT,
      fetchPersonas,
    });
    const second = await resolvePersonaSystem({
      cache,
      personaCode: "plain",
      hipeacApiUrl,
      timeoutMs,
      baseSystemPrompt: BASE_SYSTEM_PROMPT,
      fetchPersonas,
    });

    expect(first).toBe(BASE_SYSTEM_PROMPT);
    expect(second).toBe(BASE_SYSTEM_PROMPT);
    expect(fetchPersonas).toHaveBeenCalledTimes(1);
  });

  it("falls back to the base prompt without caching when Django is unreachable", async () => {
    const cache = new Map<string, string>();
    const fetchPersonas = vi.fn().mockRejectedValue(new Error("network error"));

    const result = await resolvePersonaSystem({
      cache,
      personaCode: "vision-expert",
      hipeacApiUrl,
      timeoutMs,
      baseSystemPrompt: BASE_SYSTEM_PROMPT,
      fetchPersonas,
    });

    expect(result).toBe(BASE_SYSTEM_PROMPT);
    expect(cache.has("vision-expert")).toBe(false);
  });

  it("retries Django on the next call after a failed fetch", async () => {
    const cache = new Map<string, string>();
    const personas: DbPersona[] = [{ code: "vision-expert", system_prompt: "Recovered." }];
    const fetchPersonas = vi
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(personas);

    await resolvePersonaSystem({
      cache,
      personaCode: "vision-expert",
      hipeacApiUrl,
      timeoutMs,
      baseSystemPrompt: BASE_SYSTEM_PROMPT,
      fetchPersonas,
    });
    const second = await resolvePersonaSystem({
      cache,
      personaCode: "vision-expert",
      hipeacApiUrl,
      timeoutMs,
      baseSystemPrompt: BASE_SYSTEM_PROMPT,
      fetchPersonas,
    });

    expect(second).toBe("Recovered.\n\nbase prompt");
    expect(fetchPersonas).toHaveBeenCalledTimes(2);
  });
});
