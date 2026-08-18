/**
 * POST /api/chat
 *
 * Validates the HiPEAC DRF auth token from the Authorization header, then
 * streams a response from gpt-5-mini grounded in the HiPEAC MCP server tools.
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
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { type AuthCacheEntry } from "../utils/authValidationCache";
import { ChatRequestBodySchema } from "../utils/chatRequestBody";
import {
  buildSystemPrompt,
  extractTokenFromAuthorizationHeader,
  forceFinalStepToText,
  resolveModelAndConstraint,
  resolveTopicDefinition,
  shouldUseParallelToolCalls,
  TOOL_STEP_BUDGET,
} from "../utils/chatRuntimePolicy";
import { resolvePersonaSystem } from "../utils/personaResolver";
import { classifyRequestScope, sanitizeConversationForGeneration } from "../utils/scopeClassifier";
import { validateAuthToken } from "../utils/validateAuthToken";
import { BASE_SYSTEM_PROMPT } from "../../shared/personas";
import { TOPICS } from "../../shared/topics";

const AUTH_VALIDATE_TIMEOUT_MS = 4000;
const PERSONA_FETCH_TIMEOUT_MS = 2500;
const AUTH_CACHE_TTL_MS = 60_000;

const authValidationCache = new Map<string, AuthCacheEntry>();

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
  const personaSystemCache = new Map<string, string>();

  return defineEventHandler(async (event) => {
    // --- Auth ---
    const authHeader = getHeader(event, "authorization") ?? "";
    const token = extractTokenFromAuthorizationHeader(authHeader);

    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: "Authentication required.",
      });
    }

    const isValid = await validateAuthToken({
      cache: authValidationCache,
      token,
      hipeacApiUrl: config.hipeacApiUrl,
      timeoutMs: AUTH_VALIDATE_TIMEOUT_MS,
      cacheTtlMs: AUTH_CACHE_TTL_MS,
    });
    if (isValid === null) {
      throw createError({
        statusCode: 503,
        statusMessage: "Authentication service temporarily unavailable. Please try again.",
      });
    }
    if (!isValid) {
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid or expired token.",
      });
    }

    // --- Request body ---
    const parseResult = ChatRequestBodySchema.safeParse(await readBody(event));
    if (!parseResult.success) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid request body.",
      });
    }

    const { messages, persona, topic, visionYear } = parseResult.data;

    const topicDef = resolveTopicDefinition(topic);

    // Classify request scope using LLM
    const scopeClassification = await classifyRequestScope(messages, config.openaiApiKey);
    if (scopeClassification.classification !== "in-scope") {
      const reason =
        scopeClassification.classification === "gaming-attempt"
          ? "This appears to be an adversarial request. Ask only about HiPEAC Vision, HiPEAC network members, or HiPEAC events."
          : "Out-of-scope request. Ask only about HiPEAC Vision, HiPEAC network members, or HiPEAC events.";

      throw createError({
        statusCode: 422,
        statusMessage: reason,
      });
    }

    const personaSystem = persona
      ? await resolvePersonaSystem({
          cache: personaSystemCache,
          personaCode: persona,
          hipeacApiUrl: config.hipeacApiUrl,
          timeoutMs: PERSONA_FETCH_TIMEOUT_MS,
          baseSystemPrompt: BASE_SYSTEM_PROMPT,
        })
      : BASE_SYSTEM_PROMPT;

    const sanitizedMessages = await sanitizeConversationForGeneration(
      messages,
      config.openaiApiKey,
    );

    const { modelId, constraint } = resolveModelAndConstraint(topicDef, visionYear);
    const system = buildSystemPrompt(personaSystem, constraint);
    const tools = toolsByTopic[topicDef.key];
    // Network topic: force sequential tool calls so the model sees get_metadata
    // results before calling search_members. Without this, the model calls both
    // in parallel and halluccinates topic IDs it hasn't seen yet.
    const parallelToolCalls = shouldUseParallelToolCalls(topicDef.key);
    // --- Stream ---
    const result = streamText({
      model: openai(modelId),
      system,
      messages: await convertToModelMessages(sanitizedMessages),
      tools,
      stopWhen: stepCountIs(TOOL_STEP_BUDGET),
      prepareStep: ({ stepNumber }) => forceFinalStepToText(stepNumber),
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
