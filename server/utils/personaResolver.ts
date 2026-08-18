/**
 * Resolves a persona code to its combined system prompt, fetched from the
 * HiPEAC DRF API and cached in process memory for the lifetime of the server.
 */

export interface DbPersona {
  code: string;
  system_prompt: string;
}

interface ResolvePersonaSystemOptions {
  cache: Map<string, string>;
  personaCode: string;
  hipeacApiUrl: string;
  timeoutMs: number;
  baseSystemPrompt: string;
  fetchPersonas?: (url: string, timeoutMs: number) => Promise<DbPersona[]>;
}

export async function resolvePersonaSystem({
  cache,
  personaCode,
  hipeacApiUrl,
  timeoutMs,
  baseSystemPrompt,
  fetchPersonas = defaultFetchPersonas,
}: ResolvePersonaSystemOptions): Promise<string> {
  if (cache.has(personaCode)) {
    return cache.get(personaCode)!;
  }

  try {
    const list = await fetchPersonas(`${hipeacApiUrl}chat/personas/`, timeoutMs);
    // Cache every persona seen, even ones whose system_prompt is empty —
    // otherwise personas with no custom prompt never get cached and this
    // fetch re-runs on every single request for that persona code.
    for (const p of list) {
      cache.set(
        p.code,
        p.system_prompt ? `${p.system_prompt}\n\n${baseSystemPrompt}` : baseSystemPrompt,
      );
    }
  } catch {
    // Django unreachable — fall back to base prompt for this request, without
    // caching it, so the next request retries Django instead of getting
    // stuck on a transient failure.
  }

  return cache.get(personaCode) ?? baseSystemPrompt;
}

async function defaultFetchPersonas(url: string, timeoutMs: number): Promise<DbPersona[]> {
  return await $fetch<DbPersona[]>(url, { timeout: timeoutMs });
}
