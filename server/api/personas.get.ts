/**
 * GET /api/personas
 *
 * Fetches persona definitions from the HiPEAC API and returns only the
 * public fields (code, name, description) to the client.
 * system_prompt is intentionally omitted from the client response.
 */

interface RawPersona {
  code: string;
  name: string;
  description: string;
  icon: string;
  starter_questions: string[];
  system_prompt: string;
}

export interface PublicPersona {
  code: string;
  name: string;
  description: string;
  icon: string;
  starter_questions: string[];
}

export default defineEventHandler(async (): Promise<PublicPersona[]> => {
  const { hipeacApiUrl } = useRuntimeConfig();

  try {
    const data = await $fetch<RawPersona[]>(`${hipeacApiUrl}chat/personas/`);
    return data.map(({ code, name, description, icon, starter_questions }) => ({
      code,
      name,
      description,
      icon,
      starter_questions,
    }));
  } catch {
    return [];
  }
});
