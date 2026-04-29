/**
 * Topic definitions for the Ask HiPEAC interface.
 *
 * Each topic maps to a subset of MCP tools and a short system prompt constraint
 * that is appended to the persona system prompt at request time.
 * Tool names must match exactly what the MCP server registers.
 *
 * iconPaths: SVG path `d` values from Heroicons outline set (viewBox 0 0 24 24).
 */

export interface Topic {
  key: string;
  label: string;
  description: string;
  iconPaths: string[];
  tools: string[];
  model: string;
  constraint: string;
  examples: string[];
  disabled?: boolean;
}

export const TOPICS: Topic[] = [
  {
    key: "vision",
    label: "HiPEAC Vision",
    description: "Strategic outlook on computing research in Europe.",
    // Heroicons: BookOpen
    iconPaths: [
      "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25",
    ],
    tools: ["search_vision", "get_vision_article", "get_vision_overview"],
    model: "gpt-4.1-mini",
    constraint:
      "Answer questions about the HiPEAC Vision strategic documents. " +
      "Always search Vision first. " +
      "If search_vision returns 0 results, retry with 2–3 alternative queries describing what the term means or relates to — never give up after one attempt. " +
      "If search_vision returns is_fallback=true, call get_vision_article on the returned slug before answering — the preview alone is not enough. " +
      "Concepts often span multiple Vision editions; cross-edition references are part of the answer, not an absence of information.",
    examples: [
      "What are the key recommendations for European computing research?",
      "What does the Vision say about AI and hardware co-design?",
      "What are the main challenges for the European semiconductor industry?",
    ],
  },
  {
    key: "network",
    label: "Network",
    description: "2,000+ researchers, institutions, and industry partners across Europe.",
    // Heroicons: GlobeAlt
    iconPaths: [
      "M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418",
    ],
    tools: ["search_members", "get_metadata"],
    model: "gpt-4.1-nano",
    constraint:
      "Answer questions about the HiPEAC research network — members, institutions, and research areas. " +
      "Call get_metadata ONCE to get the full list of topics and application areas with their numeric IDs; do not call it again. " +
      "Match the user's research area to a topic by name and pass its ID in topic_ids when calling search_members. " +
      "Always pass limit=50 to search_members. " +
      "The query parameter searches person names and emails only — never use it for research topics or keywords. " +
      "If results are empty, suggest related topics from the metadata list and offer to search again.",
    examples: [
      "Who are the HiPEAC members working on RISC-V in Spain?",
      "Which italian universities are part of the HiPEAC network?",
      "Find researchers working on neuromorphic computing in Germany.",
    ],
  },
  {
    key: "events",
    label: "Events",
    description: "Conferences, workshops, and schools organised by HiPEAC.",
    // Heroicons: CalendarDays
    iconPaths: [
      "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5",
    ],
    tools: ["get_events", "search_event"],
    model: "gpt-4.1-nano",
    constraint:
      "Answer questions about HiPEAC events — conferences, workshops, and summer schools. " +
      "Use get_events to list upcoming events and search_event for questions about a specific event.",
    examples: [
      "What are the upcoming HiPEAC events?",
      "Tell me about ACACES 2026.",
      "When and where is the next HiPEAC conference?",
      "What workshops are organised this year?",
    ],
    disabled: true,
  },
];

export const DEFAULT_TOPIC_KEY = "vision";
