import { describe, expect, it, vi, beforeEach } from "vitest";
import { classifyRequestScope } from "../../server/utils/scopeClassifier";

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
});
