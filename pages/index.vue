<style>
/* Prose styles for assistant markdown — must be global (applied via v-html). */
.prose-bubble p {
  margin: 0 0 0.6em;
}
.prose-bubble p:last-child {
  margin-bottom: 0;
}
.prose-bubble ul,
.prose-bubble ol {
  margin: 0.4em 0 0.6em 1.2em;
  padding: 0;
}
.prose-bubble li {
  margin-bottom: 0.2em;
}
.prose-bubble h1,
.prose-bubble h2,
.prose-bubble h3 {
  margin: 0.8em 0 0.3em;
  font-weight: 600;
}
.prose-bubble h1 {
  font-size: 1.15em;
}
.prose-bubble h2 {
  font-size: 1.05em;
}
.prose-bubble h3 {
  font-size: 1em;
}
.prose-bubble code {
  background: #e5e7eb;
  border-radius: 3px;
  padding: 0.1em 0.3em;
  font-size: 0.85em;
}
.prose-bubble pre {
  background: #1f2937;
  color: #f9fafb;
  border-radius: 6px;
  padding: 0.75em 1em;
  overflow-x: auto;
  font-size: 0.85em;
  margin: 0.5em 0;
}
.prose-bubble pre code {
  background: none;
  padding: 0;
}
.prose-bubble a {
  color: #005eb8;
  text-decoration: underline;
}
.prose-bubble blockquote {
  border-left: 3px solid #d1d5db;
  margin: 0.5em 0;
  padding-left: 0.75em;
  color: #6b7280;
}

@keyframes dot-pulse {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 1; }
}
.thinking-dot {
  animation: dot-pulse 1.4s ease-in-out infinite;
  display: inline-block;
}
.thinking-dot:nth-child(2) { animation-delay: 0.2s; }
.thinking-dot:nth-child(3) { animation-delay: 0.4s; }
</style>

<script setup lang="ts">
import { Chat } from "@ai-sdk/vue";
import { DefaultChatTransport } from "ai";
import { marked } from "marked";
import { computed, nextTick, onMounted, ref, watchEffect } from "vue";
import { useHipeacAuth } from "~/composables/useHipeacAuth";
import type { PublicPersona } from "~/server/api/personas.get";
import { DEFAULT_TOPIC_KEY, TOPICS } from "~/shared/topics";

const personas = ref<PublicPersona[]>([]);
const persona = ref("");
const topic = ref(DEFAULT_TOPIC_KEY);
const visionYear = ref<"2026" | "compare">("2026");

const currentTopic = computed(() => TOPICS.find((t) => t.key === topic.value) ?? TOPICS[0]);

// marked produces sanitized inline HTML; content is always from our own API.
function renderMarkdown(text: string): string {
  return marked.parse(text) as string;
}

const { token, isReady, init, login, logout } = useHipeacAuth();

const input = ref("");
const chatKey = ref(0);

// Recreating the Chat instance when topic, visionYear, persona, or chatKey changes clears history.
const chat = computed(() => {
  // Access chatKey.value to register it as a reactive dependency for manual resets.
  const _key = chatKey.value;
  return new Chat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      headers: () => (token.value ? { Authorization: `Token ${token.value}` } : {}),
      body: { persona: persona.value, topic: topic.value, visionYear: visionYear.value },
    }),
  });
});

function handleSubmit(e: Event) {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  chat.value.sendMessage({ text });
  input.value = "";
}

function sendExample(question: string) {
  chat.value.sendMessage({ text: question });
}

function switchPersona(code: string) {
  if (code === persona.value) return;
  persona.value = code;
  input.value = "";
}

function switchTopic(key: string) {
  if (key === topic.value) return;
  topic.value = key;
  visionYear.value = "2026";
  input.value = "";
}

function switchVisionYear(year: "2026" | "compare") {
  if (year === visionYear.value) return;
  visionYear.value = year;
  input.value = "";
}

function resetChat() {
  chatKey.value++;
  input.value = "";
}

const messagesEl = ref<HTMLElement | null>(null);

const userMessageCount = computed(
  () => chat.value.messages.filter((m) => m.role === "user").length,
);

// True while the model is thinking — either before the first token or after
// tool calls complete but before the assistant starts writing its answer.
const isThinking = computed(() => {
  if (chat.value.status === "submitted") return true;
  if (chat.value.status !== "streaming") return false;
  const lastAssistant = [...chat.value.messages].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) return true;
  return !lastAssistant.parts.some((p) => p.type === "text" && (p as { text?: string }).text);
});

function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
  });
}

// Friendly error message derived from chat.error; null when no error.
const chatError = ref<string | null>(null);

watchEffect(() => {
  // Access messages and status to re-run on every streaming tick.
  void chat.value.messages.length;
  void chat.value.status;
  scrollToBottom();
});

watchEffect(() => {
  const err = chat.value.error;
  if (!err) {
    chatError.value = null;
    return;
  }
  // The AI SDK surfaces HTTP error bodies as the error message (JSON string).
  try {
    const parsed = JSON.parse(err.message);
    if (parsed.statusCode === 401) {
      // Token expired or invalid — drop it and return to login screen.
      logout();
      return;
    }
    if (parsed.statusCode === 429) {
      chatError.value = "Rate limit reached. Please wait a moment before sending another message.";
      return;
    }
    chatError.value = parsed.statusMessage ?? "Something went wrong. Please try again.";
  } catch {
    chatError.value = err.message ?? "Something went wrong. Please try again.";
  }
});

onMounted(async () => {
  init();
  try {
    const data = await $fetch<PublicPersona[]>("/api/personas");
    personas.value = data;
    if (data.length && !persona.value) persona.value = data[0].code;
  } catch {
    // personas will remain empty; chat still works with the base system prompt
  }
});
</script>

<template>
  <!-- Outer shell: covers the full viewport, prevents any page scroll -->
  <div
    style="
      position: fixed;
      inset: 0;
      overflow: hidden;
      display: flex;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, sans-serif;
      color: #111827;
    "
  >
    <!-- Inner: constrained width, full height, flex column -->
    <div style="width: 100%; max-width: 900px; height: 100%; display: flex; flex-direction: column">
      <!-- Loading -->
      <div
        v-if="!isReady"
        style="flex: 1; display: flex; align-items: center; justify-content: center; color: #9ca3af"
      >
        Loading…
      </div>

      <!-- Not authenticated -->
      <div
        v-else-if="!token"
        style="
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 1rem;
          padding: 1rem;
        "
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1"
          stroke="#005eb8"
          style="width: 48px; height: 48px"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25"
          />
        </svg>
        <div>
          <h1 style="font-size: 1.75rem; font-weight: 700; margin: 0 0 0.5rem">Ask HiPEAC</h1>
          <p style="color: #6b7280; max-width: 400px; line-height: 1.6; margin: 0 0 1.5rem">
            Ask questions about the HiPEAC Vision documents, upcoming events, and the European
            computing research network.
          </p>
          <button
            style="
              background: #005eb8;
              color: white;
              border: none;
              padding: 0.65rem 1.75rem;
              border-radius: 8px;
              font-size: 1rem;
              font-weight: 500;
              cursor: pointer;
            "
            @click="login"
          >
            Sign in with HiPEAC
          </button>
        </div>
      </div>

      <!-- Chat UI -->
      <template v-else>
        <!-- Header — fixed top bar -->
        <div
          style="
            flex-shrink: 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            border-bottom: 1px solid #e5e7eb;
            background: white;
          "
        >
          <div style="display: flex; align-items: center; gap: 0.5rem">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="#005eb8"
              style="width: 22px; height: 22px; flex-shrink: 0"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25"
              />
            </svg>
            <span style="font-size: 1.125rem; font-weight: 700; color: #111827">Ask HiPEAC</span>
          </div>
          <button
            style="
              background: none;
              border: 1px solid #e5e7eb;
              padding: 0.3rem 0.85rem;
              border-radius: 6px;
              cursor: pointer;
              font-size: 0.8rem;
              color: #6b7280;
            "
            @click="logout"
          >
            Sign out
          </button>
        </div>

        <!-- Messages area — scrollable middle -->
        <div
          ref="messagesEl"
          style="
            flex: 1;
            overflow-y: auto;
            padding: 1.5rem 1rem;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            background: white;
          "
        >
          <!-- Empty state -->
          <div
            v-if="chat.messages.length === 0"
            style="
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              text-align: center;
              gap: 1rem;
              padding: 1rem 2rem;
            "
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1"
              stroke="#d1d5db"
              style="width: 40px; height: 40px"
            >
              <path
                v-for="(d, i) in currentTopic.iconPaths"
                :key="i"
                stroke-linecap="round"
                stroke-linejoin="round"
                :d="d"
              />
            </svg>
            <div>
              <p
                style="
                  font-size: 0.9rem;
                  color: #6b7280;
                  max-width: 500px;
                  line-height: 1.6;
                  margin: 0 auto 2rem;
                "
              >
                <template v-if="topic === 'vision' && visionYear === 'compare'">
                  Ask anything about the <strong>HiPEAC Vision</strong> — comparing what changed
                  between the 2025 and 2026 editions. The Vision is Europe's strategic roadmap for
                  computing systems research.
                </template>
                <template v-else-if="topic === 'vision'">
                  Ask anything about the <strong>HiPEAC Vision 2026</strong> — Europe's strategic
                  roadmap for computing systems research. Covering AI, hardware, software, skills,
                  and policy from the perspective of the research community.
                </template>
                <template v-else-if="topic === 'events'">
                  Ask about <strong>HiPEAC events</strong> — including the annual conference, ACACES
                  summer school, co-located workshops, and webinars. Find dates, locations, and
                  what's on the programme.
                </template>
                <template v-else>
                  Explore the <strong>HiPEAC network</strong> — around 2,000 world-class computing
                  researchers, universities, and industry partners from across Europe. Find people
                  and institutions by research area or country.
                </template>
              </p>
              <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center">
                <button
                  v-for="q in currentTopic.examples"
                  :key="q"
                  style="
                    padding: 0.45rem 0.85rem;
                    border-radius: 999px;
                    border: 1px solid #e5e7eb;
                    background: #f9fafb;
                    color: #374151;
                    font-size: 0.8rem;
                    cursor: pointer;
                    line-height: 1.4;
                    text-align: left;
                  "
                  @click="sendExample(q)"
                >
                  {{ q }}
                </button>
              </div>
            </div>
          </div>

          <!-- Messages -->
          <div
            v-for="(m, i) in chat.messages"
            :key="m.id ?? i"
            style="display: flex; flex-direction: column; gap: 0.4rem"
          >
            <!-- Tool call indicators grouped together -->
            <div
              v-if="m.parts.some((p) => p.type === 'dynamic-tool')"
              style="display: flex; flex-wrap: wrap; gap: 0.3rem; padding-bottom: 0.25rem"
            >
              <template v-for="(part, pi) in m.parts" :key="`${m.id}-tool-${pi}`">
                <div
                  v-if="part.type === 'dynamic-tool'"
                  :style="{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    fontFamily: 'monospace',
                    background:
                      part.state === 'output-available'
                        ? '#f0fdf4'
                        : part.state === 'output-error'
                          ? '#fef2f2'
                          : '#fffbeb',
                    color:
                      part.state === 'output-available'
                        ? '#15803d'
                        : part.state === 'output-error'
                          ? '#b91c1c'
                          : '#92400e',
                    border: `1px solid ${part.state === 'output-available' ? '#bbf7d0' : part.state === 'output-error' ? '#fecaca' : '#fde68a'}`,
                  }"
                >
                  <span>{{
                    part.state === "output-available"
                      ? "✓"
                      : part.state === "output-error"
                        ? "✗"
                        : "⟳"
                  }}</span>
                  <span>{{ part.toolName }}</span>
                </div>
              </template>
            </div>

            <!-- Text bubbles -->
            <template v-for="(part, pi) in m.parts" :key="`${m.id}-text-${pi}`">
              <div
                v-if="part.type === 'text' && part.text"
                :style="{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                }"
              >
                <div
                  :style="{
                    background: m.role === 'user' ? '#005eb8' : '#f3f4f6',
                    color: m.role === 'user' ? 'white' : '#111827',
                    padding: '0.65rem 0.95rem',
                    borderRadius: '10px',
                    maxWidth: '70%',
                    whiteSpace: m.role === 'user' ? 'pre-wrap' : 'normal',
                    wordBreak: 'break-word',
                    lineHeight: '1.55',
                    fontSize: '0.9rem',
                  }"
                  :class="m.role === 'assistant' ? 'prose-bubble' : null"
                  v-html="m.role === 'assistant' ? renderMarkdown(part.text) : part.text"
                />
              </div>
            </template>
          </div>

          <!-- Streaming indicator -->
          <div v-if="isThinking" style="color: #9ca3af; font-size: 0.85rem; padding-left: 0.1rem">
            Thinking<span class="thinking-dot">.</span><span class="thinking-dot">.</span><span class="thinking-dot">.</span>
          </div>

          <!-- MCP promo — shown after 3 interactions -->
          <div
            v-if="userMessageCount >= 3 && chat.status === 'ready'"
            style="
              background: #f0f7ff;
              border: 1px solid #bfdbfe;
              border-radius: 10px;
              padding: 0.85rem 1rem;
              font-size: 0.82rem;
              color: #1e3a5f;
              line-height: 1.55;
            "
          >
            <strong style="display: block; margin-bottom: 0.25rem">Enjoying Ask HiPEAC?</strong>
            Connect the
            <a
              href="https://www.hipeac.net/mcp/"
              target="_blank"
              rel="noopener"
              style="color: #005eb8; font-weight: 500"
              >HiPEAC MCP server</a
            >
            directly to Claude, ChatGPT, Cursor, or any MCP-compatible agent — and query the HiPEAC
            knowledge base from your own tools.
          </div>
        </div>

        <!-- Bottom bar — fixed -->
        <div
          style="
            flex-shrink: 0;
            border-top: 1px solid #e5e7eb;
            background: white;
            padding: 1.5rem 1rem;
            display: flex;
            flex-direction: column;
            gap: 0.8rem;
          "
        >
          <!-- Error -->
          <div
            v-if="chatError"
            style="
              background: #fef2f2;
              color: #b91c1c;
              padding: 0.5rem 0.9rem;
              border-radius: 8px;
              font-size: 0.85rem;
            "
          >
            {{ chatError }}
          </div>

          <!-- Topic selector — 3 columns -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem">
            <button
              v-for="t in TOPICS"
              :key="t.key"
              :disabled="t.disabled"
              :style="{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '2px solid',
                borderColor: topic === t.key ? '#005eb8' : '#e5e7eb',
                background: t.disabled ? '#f9fafb' : topic === t.key ? '#eff6ff' : '#fafafa',
                cursor: t.disabled ? 'not-allowed' : 'pointer',
                opacity: t.disabled ? '0.45' : '1',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }"
              @click="!t.disabled && switchTopic(t.key)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                :stroke="topic === t.key ? '#005eb8' : '#6b7280'"
                style="width: 15px; height: 15px; flex-shrink: 0"
              >
                <path
                  v-for="(d, i) in t.iconPaths"
                  :key="i"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :d="d"
                />
              </svg>
              <span
                :style="{
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  color: topic === t.key ? '#005eb8' : '#374151',
                }"
              >
                {{ t.label }}
              </span>
            </button>
          </div>

          <!-- Vision year toggle -->
          <div v-if="topic === 'vision'" style="display: flex; align-items: center; gap: 0.375rem">
            <span style="font-size: 0.75rem; color: #9ca3af; white-space: nowrap">Reading…</span>
            <button
              :style="{
                padding: '0.25rem 0.65rem',
                borderRadius: '999px',
                border: '1px solid',
                borderColor: visionYear === '2026' ? '#005eb8' : '#e5e7eb',
                background: visionYear === '2026' ? '#005eb8' : 'white',
                color: visionYear === '2026' ? 'white' : '#6b7280',
                fontSize: '0.75rem',
                fontWeight: visionYear === '2026' ? '600' : '400',
                cursor: 'pointer',
              }"
              @click="switchVisionYear('2026')"
            >
              Vision 2026
            </button>
            <button
              :style="{
                padding: '0.25rem 0.65rem',
                borderRadius: '999px',
                border: '1px solid',
                borderColor: visionYear === 'compare' ? '#005eb8' : '#e5e7eb',
                background: visionYear === 'compare' ? '#005eb8' : 'white',
                color: visionYear === 'compare' ? 'white' : '#6b7280',
                fontSize: '0.75rem',
                fontWeight: visionYear === 'compare' ? '600' : '400',
                cursor: 'pointer',
              }"
              @click="switchVisionYear('compare')"
            >
              Compare with 2025
            </button>
          </div>

          <!-- Persona pills -->
          <div
            v-if="personas.length"
            style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap"
          >
            <span style="font-size: 0.75rem; color: #9ca3af; white-space: nowrap">I am…</span>
            <button
              v-for="p in personas"
              :key="p.code"
              :style="{
                padding: '0.2rem 0.65rem',
                borderRadius: '999px',
                border: '1px solid',
                borderColor: persona === p.code ? '#005eb8' : '#d1d5db',
                background: persona === p.code ? '#005eb8' : 'white',
                color: persona === p.code ? 'white' : '#6b7280',
                fontSize: '0.78rem',
                cursor: 'pointer',
                lineHeight: '1.5',
                fontWeight: persona === p.code ? '500' : '400',
              }"
              @click="switchPersona(p.code)"
            >
              {{ p.name }}
            </button>
          </div>

          <!-- Input form -->
          <form style="display: flex; gap: 0.5rem" @submit="handleSubmit">
            <button
              v-if="chat.messages.length > 0"
              type="button"
              title="Start new chat"
              :disabled="chat.status === 'streaming' || chat.status === 'submitted'"
              style="
                background: transparent;
                color: #6b7280;
                border: 1px solid #d1d5db;
                padding: 0.65rem 0.75rem;
                border-radius: 8px;
                font-size: 0.9rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                flex-shrink: 0;
              "
              @click="resetChat"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                style="width: 16px; height: 16px"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
            </button>
            <input
              v-model="input"
              :placeholder="`Ask about ${currentTopic.label}…`"
              :disabled="chat.status === 'streaming' || chat.status === 'submitted'"
              style="
                flex: 1;
                padding: 0.65rem 1rem;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                font-size: 0.9rem;
                outline: none;
                font-family: inherit;
                color: #111827;
              "
              @keydown.enter.exact.prevent="handleSubmit"
            />
            <button
              type="submit"
              :disabled="
                !input.trim() || chat.status === 'streaming' || chat.status === 'submitted'
              "
              style="
                background: #005eb8;
                color: white;
                border: none;
                padding: 0.65rem 1.25rem;
                border-radius: 8px;
                font-size: 0.9rem;
                font-weight: 500;
                cursor: pointer;
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: 0.4rem;
              "
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                style="width: 16px; height: 16px"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
              Send
            </button>
          </form>

          <!-- Footer -->
          <p style="font-size: 0.72rem; color: #9ca3af; margin: 0; text-align: center">
            Powered by the HiPEAC MCP ·
            <strong
              ><a
                href="https://www.hipeac.net/mcp/"
                target="_blank"
                rel="noopener"
                style="color: #9ca3af"
                >Install MCP</a
              >
              for direct access in your LLM</strong
            >
          </p>
        </div>
      </template>
    </div>
  </div>
</template>
