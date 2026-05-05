import { describe, expect, it } from "vitest";
import { TOPICS } from "../../shared/topics";
import {
  buildSystemPrompt,
  EXECUTION_BUDGET_PROMPT,
  extractTokenFromAuthorizationHeader,
  resolveModelAndConstraint,
  resolveTopicDefinition,
  shouldUseParallelToolCalls,
} from "../../server/utils/chatRuntimePolicy";

describe("chatRuntimePolicy", () => {
  it("extracts token from valid authorization header", () => {
    expect(extractTokenFromAuthorizationHeader("Token abc123")).toBe("abc123");
  });

  it("returns null for missing/invalid authorization headers", () => {
    expect(extractTokenFromAuthorizationHeader(undefined)).toBeNull();
    expect(extractTokenFromAuthorizationHeader("Bearer abc123")).toBeNull();
  });

  it("resolves known topic by key", () => {
    const topic = resolveTopicDefinition("network");
    expect(topic.key).toBe("network");
  });

  it("falls back to default topic for unknown key", () => {
    const topic = resolveTopicDefinition("unknown");
    expect(topic.key).toBe("vision");
  });

  it("applies compare mode policy for vision topic", () => {
    const vision = TOPICS.find((t) => t.key === "vision")!;
    const result = resolveModelAndConstraint(vision, "compare");

    expect(result.modelId).toBe("gpt-5-mini");
    expect(result.constraint).toContain("years=[2025, 2026]");
  });

  it("applies single-year policy for non-compare vision mode", () => {
    const vision = TOPICS.find((t) => t.key === "vision")!;
    const result = resolveModelAndConstraint(vision, "2026");

    expect(result.constraint).toContain("MUST pass year=2026");
  });

  it("keeps model and constraint for non-vision topics", () => {
    const network = TOPICS.find((t) => t.key === "network")!;
    const result = resolveModelAndConstraint(network);

    expect(result.modelId).toBe(network.model);
    expect(result.constraint).toBe(network.constraint);
  });

  it("builds system prompt with execution budget suffix", () => {
    const system = buildSystemPrompt("persona", "constraint");

    expect(system).toContain("persona\n\nconstraint");
    expect(system).toContain(EXECUTION_BUDGET_PROMPT.trim());
  });

  it("disables parallel tool calls for network topic only", () => {
    expect(shouldUseParallelToolCalls("network")).toBe(false);
    expect(shouldUseParallelToolCalls("vision")).toBe(true);
  });
});
