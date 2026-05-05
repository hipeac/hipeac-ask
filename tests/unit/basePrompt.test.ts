import { describe, expect, it } from "vitest";
import { BASE_SYSTEM_PROMPT } from "../../shared/personas";

describe("BASE_SYSTEM_PROMPT", () => {
  it("requires markdown links for citations", () => {
    expect(BASE_SYSTEM_PROMPT).toContain("Format links as Markdown links");
    expect(BASE_SYSTEM_PROMPT).toContain("[label](url)");
  });

  it("contains adaptive brevity guidance", () => {
    expect(BASE_SYSTEM_PROMPT).toContain("Default to **very concise**, focused answers");
    expect(BASE_SYSTEM_PROMPT).toContain("adapt response depth to the user's request");
    expect(BASE_SYSTEM_PROMPT).toContain("If the user asks for detail, expand proportionally");
  });

  it("discourages meta framing labels", () => {
    expect(BASE_SYSTEM_PROMPT).toContain("Do not preface answers with meta labels");
    expect(BASE_SYSTEM_PROMPT).toContain("Short answer");
    expect(BASE_SYSTEM_PROMPT).toContain("Key points");
  });
});
