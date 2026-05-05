import { describe, expect, it } from "vitest";
import { ChatRequestBodySchema } from "../../server/utils/chatRequestBody";

describe("ChatRequestBodySchema", () => {
  it("accepts a valid request payload", () => {
    const result = ChatRequestBodySchema.safeParse({
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "Hello" }] }],
      persona: "general",
      topic: "vision",
      visionYear: "2026",
    });

    expect(result.success).toBe(true);
  });

  it("rejects payloads without messages", () => {
    const result = ChatRequestBodySchema.safeParse({
      persona: "general",
      topic: "vision",
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty messages array", () => {
    const result = ChatRequestBodySchema.safeParse({ messages: [] });

    expect(result.success).toBe(false);
  });

  it("rejects non-string optional fields", () => {
    const result = ChatRequestBodySchema.safeParse({
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "Hi" }] }],
      persona: 123,
    });

    expect(result.success).toBe(false);
  });
});
