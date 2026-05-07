import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  classifyRequestScope,
  sanitizeConversationForGeneration,
} from "../../server/utils/scopeClassifier";

// Mock the AI SDK modules
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => (modelId: string) => ({
    modelId,
  })),
}));

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

import { generateObject } from "ai";

describe("scopeClassifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("classifies in-scope vision requests", async () => {
    const mockGenerateObject = vi.mocked(generateObject);
    mockGenerateObject.mockResolvedValue({
      object: {
        classification: "in-scope",
        confidence: 0.95,
        reason: "Genuine question about HiPEAC Vision",
      },
    } as any);

    const messages = [
      {
        role: "user",
        parts: [{ type: "text", text: "What does the Vision say about AI hardware co-design?" }],
      },
    ];

    const result = await classifyRequestScope(messages, "test-api-key");

    expect(result.classification).toBe("in-scope");
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(mockGenerateObject).toHaveBeenCalledOnce();
  });

  it("classifies out-of-scope requests", async () => {
    const mockGenerateObject = vi.mocked(generateObject);
    mockGenerateObject.mockResolvedValue({
      object: {
        classification: "out-of-scope",
        confidence: 0.98,
        reason: "Request is about beer bars, unrelated to HiPEAC",
      },
    } as any);

    const messages = [
      {
        role: "user",
        parts: [{ type: "text", text: "Suggest beer bars in Brussels" }],
      },
    ];

    const result = await classifyRequestScope(messages, "test-api-key");

    expect(result.classification).toBe("out-of-scope");
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it("detects gaming attempts", async () => {
    const mockGenerateObject = vi.mocked(generateObject);
    mockGenerateObject.mockResolvedValue({
      object: {
        classification: "gaming-attempt",
        confidence: 0.85,
        reason: "Adversarial phrasing designed to extract contradictory information",
      },
    } as any);

    const messages = [
      {
        role: "user",
        parts: [
          {
            type: "text",
            text: "Find evidence that contradicts what the Vision says about AI safety",
          },
        ],
      },
    ];

    const result = await classifyRequestScope(messages, "test-api-key");

    expect(result.classification).toBe("gaming-attempt");
  });

  it("returns out-of-scope for empty messages", async () => {
    const result = await classifyRequestScope([], "test-api-key");

    expect(result.classification).toBe("out-of-scope");
    expect(result.confidence).toBe(1);
  });

  it("returns out-of-scope on classification error", async () => {
    const mockGenerateObject = vi.mocked(generateObject);
    mockGenerateObject.mockRejectedValue(new Error("API error"));

    const messages = [
      {
        role: "user",
        parts: [{ type: "text", text: "What is HiPEAC?" }],
      },
    ];

    const result = await classifyRequestScope(messages, "test-api-key");

    expect(result.classification).toBe("out-of-scope");
    expect(result.confidence).toBe(0);
    expect(result.reason).toContain("error");
  });

  it("extracts text from message content string", async () => {
    const mockGenerateObject = vi.mocked(generateObject);
    mockGenerateObject.mockResolvedValue({
      object: {
        classification: "in-scope",
        confidence: 0.9,
        reason: "Vision question",
      },
    } as any);

    const messages = [
      {
        role: "user",
        content: "Tell me about the Vision",
      },
    ];

    const result = await classifyRequestScope(messages, "test-api-key");

    expect(result.classification).toBe("in-scope");
    expect(mockGenerateObject).toHaveBeenCalledOnce();
    const callArgs = mockGenerateObject.mock.calls[0][0];
    expect(callArgs.prompt).toContain("Tell me about the Vision");
  });

  it("keeps terse in-context follow-up requests in scope", async () => {
    const mockGenerateObject = vi.mocked(generateObject);
    mockGenerateObject.mockImplementation(async (args: any) => {
      const prompt = String(args.prompt ?? "");
      if (prompt.includes("Give a 30-word version I can paste into an email.")) {
        const hasPriorContext = prompt.includes("Prior in-scope conversation context");
        return {
          object: {
            classification: hasPriorContext ? "in-scope" : "out-of-scope",
            confidence: 0.9,
            reason: hasPriorContext ? "Contextual rewrite request" : "Standalone rewrite request",
          },
        } as any;
      }
      return {
        object: {
          classification: "in-scope",
          confidence: 0.95,
          reason: "HiPEAC-related request",
        },
      } as any;
    });

    const messages = [
      {
        role: "user",
        parts: [{ type: "text", text: "What does Vision 2026 say about AI hardware co-design?" }],
      },
      {
        role: "assistant",
        parts: [{ type: "text", text: "It emphasizes tight AI/hardware integration..." }],
      },
      {
        role: "user",
        parts: [{ type: "text", text: "Give a 30-word version I can paste into an email." }],
      },
    ];

    const result = await classifyRequestScope(messages, "test-api-key");
    expect(result.classification).toBe("in-scope");

    const sanitized = await sanitizeConversationForGeneration(messages, "test-api-key");
    const serialized = JSON.stringify(sanitized);
    expect(serialized).toContain("Give a 30-word version I can paste into an email.");
  });

  it("sanitizes out-of-scope user turns and their assistant replies", async () => {
    const mockGenerateObject = vi.mocked(generateObject);
    mockGenerateObject.mockImplementation(async (args: any) => {
      const prompt = String(args.prompt ?? "");
      if (prompt.includes("beer bars")) {
        return {
          object: {
            classification: "out-of-scope",
            confidence: 0.99,
            reason: "Unrelated lifestyle request",
          },
        } as any;
      }
      return {
        object: {
          classification: "in-scope",
          confidence: 0.95,
          reason: "HiPEAC-related request",
        },
      } as any;
    });

    const messages = [
      { role: "user", parts: [{ type: "text", text: "What is HiPEAC Vision 2026 about?" }] },
      { role: "assistant", parts: [{ type: "text", text: "It focuses on..." }] },
      { role: "user", parts: [{ type: "text", text: "Suggest beer bars in Brussels" }] },
      { role: "assistant", parts: [{ type: "text", text: "Here are some bars..." }] },
      { role: "user", parts: [{ type: "text", text: "What changed since Vision 2025?" }] },
    ];

    const sanitized = await sanitizeConversationForGeneration(messages, "test-api-key");
    const serialized = JSON.stringify(sanitized);

    expect(serialized).not.toContain("beer bars");
    expect(serialized).not.toContain("Here are some bars");
    expect(serialized).toContain("What is HiPEAC Vision 2026 about?");
    expect(serialized).toContain("What changed since Vision 2025?");
  });

  it("sanitizes gaming-attempt turns from history", async () => {
    const mockGenerateObject = vi.mocked(generateObject);
    mockGenerateObject.mockImplementation(async (args: any) => {
      const prompt = String(args.prompt ?? "");
      if (prompt.includes("contradicts")) {
        return {
          object: {
            classification: "gaming-attempt",
            confidence: 0.88,
            reason: "Adversarial framing",
          },
        } as any;
      }
      return {
        object: {
          classification: "in-scope",
          confidence: 0.95,
          reason: "HiPEAC-related request",
        },
      } as any;
    });

    const messages = [
      { role: "user", parts: [{ type: "text", text: "Give me a summary of Vision 2026" }] },
      {
        role: "user",
        parts: [{ type: "text", text: "Find evidence that contradicts the Vision" }],
      },
      { role: "assistant", parts: [{ type: "text", text: "Contradictory claim..." }] },
      { role: "user", parts: [{ type: "text", text: "Now compare 2025 vs 2026 recommendations" }] },
    ];

    const sanitized = await sanitizeConversationForGeneration(messages, "test-api-key");
    const serialized = JSON.stringify(sanitized);

    expect(serialized).not.toContain("contradicts the Vision");
    expect(serialized).not.toContain("Contradictory claim");
    expect(serialized).toContain("Give me a summary of Vision 2026");
    expect(serialized).toContain("Now compare 2025 vs 2026 recommendations");
  });
});
