/**
 * POST /api/chat
 *
 * Validates the HiPEAC DRF auth token from the Authorization header, then
 * streams a response from gpt-4.1-mini grounded in the HiPEAC MCP server tools.
 *
 * The MCP client and tool schemas are initialised once at server startup and
 * reused across all requests. The tool schemas are still sent to OpenAI on
 * every call — that is unavoidable with stateless LLM APIs — but the round-trip
 * to the MCP server only happens once.
 *
 * The client sends the full message history on each request (AI SDK default).
 * No server-side session is maintained.
 */

import { createMCPClient } from "@ai-sdk/mcp";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, UIMessage } from "ai";
import { BASE_SYSTEM_PROMPT } from "../../shared/personas";
import { DEFAULT_TOPIC_KEY, TOPICS } from "../../shared/topics";

async function validateHipeacToken(token: string, hipeacApiUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${hipeacApiUrl}auth/me/`, {
      headers: { Authorization: `Token ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default defineLazyEventHandler(async () => {
  const config = useRuntimeConfig();

  if (!config.openaiApiKey) throw new Error("Missing NUXT_OPENAI_API_KEY");

  const openai = createOpenAI({ apiKey: config.openaiApiKey });

  // MCP client shared across requests — tool schemas discovered once at startup.
  const mcpClient = await createMCPClient({
    transport: { type: "http", url: config.mcpServerUrl },
  });
  const allTools = await mcpClient.tools();

  // Pre-build per-topic tool subsets.
  const toolsByTopic: Record<string, typeof allTools> = {};
  for (const topicDef of TOPICS) {
    toolsByTopic[topicDef.key] = Object.fromEntries(
      topicDef.tools.filter((name) => name in allTools).map((name) => [name, allTools[name]]),
    ) as typeof allTools;
  }

  // Persona system prompts cached in process memory for the lifetime of the server.
  // Cleared on redeploy. Falls back to BASE_SYSTEM_PROMPT if Django is unreachable.
  interface DbPersona {
    code: string;
    system_prompt: string;
  }
  const personaSystemCache = new Map<string, string>();

  async function resolvePersonaSystem(personaCode: string): Promise<string> {
    if (personaSystemCache.has(personaCode)) {
      return personaSystemCache.get(personaCode)!;
    }
    try {
      const list = await $fetch<DbPersona[]>(`${config.hipeacApiUrl}chat/personas/`);
      for (const p of list) {
        if (p.system_prompt) {
          personaSystemCache.set(p.code, `${p.system_prompt}\n\n${BASE_SYSTEM_PROMPT}`);
        }
      }
    } catch {
      // Django unreachable — fall back to base prompt for this request.
    }
    return personaSystemCache.get(personaCode) ?? BASE_SYSTEM_PROMPT;
  }

  return defineEventHandler(async (event) => {
    // --- Auth ---
    const authHeader = getHeader(event, "authorization") ?? "";
    const token = authHeader.startsWith("Token ") ? authHeader.slice(6) : null;

    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: "Authentication required.",
      });
    }

    const isValid = await validateHipeacToken(token, config.hipeacApiUrl);
    if (!isValid) {
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid or expired token.",
      });
    }

    // --- Request body ---
    const {
      messages,
      persona,
      topic,
      visionYear,
    }: {
      messages: UIMessage[];
      persona?: string;
      topic?: string;
      visionYear?: string;
    } = await readBody(event);
    if (!messages?.length) {
      throw createError({
        statusCode: 400,
        statusMessage: "messages is required.",
      });
    }

    const personaSystem = persona ? await resolvePersonaSystem(persona) : BASE_SYSTEM_PROMPT;

    const topicDef =
      TOPICS.find((t) => t.key === topic) ?? TOPICS.find((t) => t.key === DEFAULT_TOPIC_KEY)!;

    let constraint = topicDef.constraint;
    // Compare mode requires cross-edition reasoning — step up to a stronger model.
    let modelId = topicDef.model;
    if (topicDef.key === "vision") {
      if (visionYear === "compare") {
        modelId = "gpt-4.1";
        constraint +=
          "\n\nThe user is comparing Vision 2026 with Vision 2025. " +
          "You MUST pass years=[2025, 2026] to search_vision and explicitly highlight what changed between editions.";
      } else {
        constraint +=
          "\n\nThe user is asking about Vision 2026 only. " +
          "You MUST pass year=2026 to search_vision on every call. Never return results from Vision 2025 unless the user explicitly asks.";
      }
    }
    const system = `${personaSystem}\n\n${constraint}`;
    const tools = toolsByTopic[topicDef.key];
    // Network topic: force sequential tool calls so the model sees get_metadata
    // results before calling search_members. Without this, the model calls both
    // in parallel and halluccinates topic IDs it hasn't seen yet.
    const parallelToolCalls = topicDef.key !== "network";
    // --- Stream ---
    const result = streamText({
      model: openai(modelId),
      system,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
      providerOptions: { openai: { parallelToolCalls } },
      onStepFinish: (step) => {
        if (import.meta.dev) {
          for (const part of step.toolCalls ?? []) {
            console.log(`[chat:tool-call] ${part.toolName}`, JSON.stringify(part.input, null, 2));
          }
          for (const part of step.toolResults ?? []) {
            const preview = JSON.stringify(part.output).slice(0, 400);
            console.log(`[chat:tool-result] ${part.toolName} →`, preview);
          }
        }
      },
      onError: (err) => {
        console.error("[chat] streamText error:", err);
      },
    });

    return result.toUIMessageStreamResponse();
  });
});
