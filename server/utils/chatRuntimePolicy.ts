import { DEFAULT_TOPIC_KEY, TOPICS, type Topic } from "../../shared/topics";

/**
 * Hard cap on tool/reasoning steps per request, enforced by streamText's
 * `stopWhen: stepCountIs(TOOL_STEP_BUDGET)`. The model is also told about
 * this budget in EXECUTION_BUDGET_PROMPT, but that's a soft instruction —
 * the model doesn't reliably self-count and can still be mid-tool-call when
 * the hard cutoff hits, which previously produced a silent empty response
 * (finishReason "tool-calls" with no text). `forceFinalStepToText` below
 * closes that gap by forcing the last budgeted step to be tool-free.
 */
export const TOOL_STEP_BUDGET = 6;

export const EXECUTION_BUDGET_PROMPT =
  `\n\nExecution budget: you have at most ${TOOL_STEP_BUDGET} reasoning/tool steps in total. ` +
  `If you already performed ${TOOL_STEP_BUDGET - 1} steps, stop calling tools and provide the best possible final answer to the user.`;

export const FOLLOW_UP_ACTIONS_PROMPT =
  "\n\nWhen useful, end your answer with a short section exactly titled 'Follow-up actions:' " +
  "followed by 1-2 bullet points that are ready-to-send next user questions. " +
  "Only include this section when it clearly helps the user continue the conversation. " +
  "If you include this section, it must be the final part of your response (no text after it). " +
  "Write each action as if the user is asking it directly (concise ask-style phrasing). " +
  "Avoid broad or heavy suggestions like requesting full article text unless the user explicitly asked for that level of detail.";

export const RESPONSE_STYLE_GUARD_PROMPT =
  "\n\nDo not start responses with labels such as 'Short answer:' or similar meta framing.";

export function extractTokenFromAuthorizationHeader(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }
  return authHeader.startsWith("Token ") ? authHeader.slice(6) : null;
}

export function resolveTopicDefinition(topic?: string): Topic {
  return TOPICS.find((t) => t.key === topic) ?? TOPICS.find((t) => t.key === DEFAULT_TOPIC_KEY)!;
}

export function resolveModelAndConstraint(
  topicDef: Topic,
  visionYear?: string,
): { modelId: string; constraint: string } {
  let constraint = topicDef.constraint;
  let modelId = topicDef.model;

  if (topicDef.key === "vision") {
    if (visionYear === "compare") {
      modelId = "gpt-5-mini";
      constraint +=
        "\n\nThe user is comparing Vision 2026 with Vision 2025. " +
        "You MUST pass years=[2025, 2026] to search_vision and explicitly highlight what changed between editions.";
    } else {
      constraint +=
        "\n\nThe user is asking about Vision 2026 only. " +
        "You MUST pass year=2026 to search_vision on every call. Never return results from Vision 2025 unless the user explicitly asks.";
    }
  }

  return { modelId, constraint };
}

export function buildSystemPrompt(personaSystem: string, constraint: string): string {
  return `${personaSystem}\n\n${constraint}${EXECUTION_BUDGET_PROMPT}${FOLLOW_UP_ACTIONS_PROMPT}${RESPONSE_STYLE_GUARD_PROMPT}`;
}

export function shouldUseParallelToolCalls(topicKey: string): boolean {
  return topicKey !== "network";
}

/**
 * streamText's prepareStep hook: on the last step allowed by TOOL_STEP_BUDGET,
 * disable tools so the model must respond with text instead of another tool
 * call, guaranteeing the user gets an answer instead of a silent empty
 * response when stopWhen's step cap is hit mid-tool-call.
 *
 * `stepNumber` is 0-indexed (the step about to run), confirmed against the
 * `ai` package directly: with a budget of N, valid stepNumbers are 0..N-1.
 */
export function forceFinalStepToText(stepNumber: number): { toolChoice: "none" } | undefined {
  return stepNumber === TOOL_STEP_BUDGET - 1 ? { toolChoice: "none" } : undefined;
}
