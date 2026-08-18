import { describe, expect, it } from "vitest";
import { activeTopicsLabelList, activeTopicsSummary, TOPICS } from "../../shared/topics";

describe("activeTopicsSummary", () => {
  it("includes every non-disabled topic's label and description", () => {
    const summary = activeTopicsSummary();

    for (const topic of TOPICS.filter((t) => !t.disabled)) {
      expect(summary).toContain(`- ${topic.label}: ${topic.description}`);
    }
  });

  it("excludes disabled topics", () => {
    const summary = activeTopicsSummary();

    for (const topic of TOPICS.filter((t) => t.disabled)) {
      expect(summary).not.toContain(topic.label);
    }
  });
});

describe("activeTopicsLabelList", () => {
  it("joins active topic labels with a natural-language 'or'", () => {
    const list = activeTopicsLabelList();
    const activeLabels = TOPICS.filter((t) => !t.disabled).map((t) => t.label);

    for (const label of activeLabels) {
      expect(list).toContain(label);
    }
    if (activeLabels.length > 1) {
      expect(list).toContain(`or ${activeLabels[activeLabels.length - 1]}`);
    }
  });

  it("excludes disabled topics", () => {
    const list = activeTopicsLabelList();

    for (const topic of TOPICS.filter((t) => t.disabled)) {
      expect(list).not.toContain(topic.label);
    }
  });
});
