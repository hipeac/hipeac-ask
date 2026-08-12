# Agent guidance for hipeac-ask

This file is the canonical source of truth for AI coding agents working in this repo.
Aliases: `CLAUDE.md` and `.github/copilot-instructions.md` are symlinks to this file.

## Core philosophy

- **Proactive collaboration**: do not blindly follow instructions. If a request is ambiguous, overly complex, or risky, challenge it and suggest a better alternative.
- **Maintainability first**: prioritise code that is easy to read, understand, and modify.
- **Simplicity (KISS & YAGNI)**: favour the most straightforward solution. Do not add functionality that has not been explicitly requested.
- **Consistency over novelty**: follow existing codebase conventions. Only introduce new patterns when clearly justified.

## Code generation style

- **Self-documenting code**: clear, unabbreviated names. Decompose into single-purpose functions. Use type hints.
- **Strategic commenting**: avoid comments explaining _what_ code does. Only comment _why_ when not obvious.
- **Testability**: write code that is easy to test. Prefer pure functions and clear interfaces.

## Stack

- **Frontend**: Nuxt 4 + Vue 3 (SPA mode, `ssr: false`) + TypeScript, managed with yarn 4. Nitro serves `server/api/*` routes server-side.
- **AI / chat**: AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/mcp`) — the chat endpoint streams responses from OpenAI grounded in the HiPEAC MCP server tools (`mcpServerUrl`).
- **Validation**: zod for runtime schemas. **Sanitisation**: `isomorphic-dompurify` for any `v-html` rendering. **Markdown**: `marked`.
- **Backend** (separate repo): `hipeac-mcp` — the MCP server this app's `server/api/chat.post.ts` talks to over HTTP. The HiPEAC DRF API (`hipeacApiUrl`) provides auth-token validation and persona system prompts.
- **Observability**: Sentry (frontend project; backend errors live in the `hipeac-mcp` Sentry project).

## Commands

There is no `./run` wrapper — run all commands via `yarn` directly.

```
yarn dev               # nuxt dev server
yarn build             # production build
yarn start             # node .output/server/index.mjs
yarn format            # prettier --write .
yarn test              # vitest run
yarn test:watch        # vitest
yarn test:coverage     # vitest run --coverage
```

## Commit conventions

Conventional Commits. Short form: `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, `test: ...`, `chore: ...`, `perf: ...`.
Optional scope: `type(scope): description` (e.g. `fix(chat): handle missing token`).
Imperative mood, lowercase, no trailing period.
Breaking change: `feat!: ...` or a `BREAKING CHANGE:` footer.
Never use vague messages like `wip` or `update`.

## TypeScript

### General

- TypeScript is mandatory; no plain JS source.
- All function signatures use explicit types; no `any` without a justification comment explaining why a narrower type is impossible. Prefer `unknown` over `any` when accepting untrusted input; narrow it with type guards.
- Do not relax compiler flags to silence a single error — fix the code.
- Prefer `interface` for object shapes that may be extended, `type` for unions and mapped types.

### Style

- **Prettier only** (no ESLint). Config in `.prettierrc` (semi, double quotes, trailing comma `all`, `printWidth` 100, `tabWidth` 2).
- **Package manager:** yarn 4 (`corepack enable` then `yarn`). Run all commands via `yarn` directly — there is no `./run` wrapper.
- Editor defaults: see `.editorconfig`.

### Testing (vitest)

We test **behaviour**, not functions. We test **boundaries**, not external libraries.

- All new code requires tests.
- Tests live in `tests/unit/*.test.ts` (the project's convention — a `tests/unit/` directory, not colocated `*.spec.ts`).
- Vitest `environment: "node"`; include pattern `tests/**/*.test.ts`.
- Structure tests using Arrange-Act-Assert.
- Mock external APIs / HTTP calls (OpenAI, the MCP server, the HiPEAC DRF API) — never hit live services from unit tests.
- Coverage via `@vitest/coverage-v8`; config in `vitest.config.ts`. Coverage includes `composables/`, `server/`, `shared/`, `nuxt.config.ts`.
- Avoid snapshot-heavy tests for content that changes frequently.
- Do not test third-party library internals.

#### The "black box" rule

Test the public API of your modules. Do not test private methods or internal implementation details. If you refactor internal code but the output stays the same, tests should not break.

#### The "not our code" rule

Assume external libraries work as advertised. Do not write tests to verify library behaviour.

- ❌ Testing the library: asserting that `marked(md)` returns a string tests `marked`, not us.
- ❌ Testing the mock: mocking a function and asserting it returns what you told it to return.
- ✅ Testing integration: asserting that _our_ code handles the library's success/failure correctly.

#### Functionality over implementation

Test _what_ the result is, not _how_ we got it. Do not spy on internal method calls.

```typescript
// ❌ BAD: Brittle, tied to implementation
it('should call validateInput then calculateTax', () => {
  const spy1 = vi.spyOn(service, 'validateInput');
  service.processOrder(100);
  expect(spy1).toHaveBeenCalled();
});

// ✅ GOOD: Robust, tests behaviour
it('should return the total price including 20% tax', () => {
  const result = service.processOrder(100);
  expect(result.total).toBe(120);
});
```

#### Boundary testing

When using external libraries, mock the **boundary**, not the logic. Test _our reaction_ to external success/failure.

```typescript
// ❌ BAD: Testing if our mock works
it('axios should return data', async () => {
  mockAxios.get.mockResolvedValue({ data: 'foo' });
  const result = await axios.get('/url');
  expect(result.data).toBe('foo');
});

// ✅ GOOD: Testing our error handling
it('should throw CustomLibError when the network fails', async () => {
  mockAxios.get.mockRejectedValue(new Error('Network Error'));
  await expect(myLibrary.fetchData()).rejects.toThrow(CustomLibError);
});
```

## Vue / Nuxt

### Stack

- **Nuxt 4 + Vue 3** with the Composition API — `<script setup lang="ts">` is mandatory. No Options API.
- **SPA mode** (`ssr: false`): pages render in the browser; Nitro still serves `server/api/*` routes server-side.
- **No Pinia / Quasar / Inertia** — this is a Nuxt app, not a Quasar SPA. Avoid introducing global state unless clearly required; prefer composables and local refs.
- **Routing**: Nuxt file-based routing in `pages/`.
- **Shared constants and prompt text** live in `shared/*` (`personas.ts`, `topics.ts`).
- **Composables** live in `composables/` for reusable behaviour.
- Package manager: yarn 4.

### Component structure

- **Naming**: `PascalCase.vue` for components, `useSomething.ts` for composables.
- `<script setup lang="ts">` is mandatory — no Options API, no `defineComponent({})` unless a specific feature requires it.
- Keep components straightforward; avoid over-componentisation for small UI pieces.
- Preserve current UX patterns unless the task explicitly requests redesign.

### Reactivity best practices

- **API responses:** use `shallowRef` for data fetched from APIs to avoid the performance cost of deep reactivity.
- **Updating `shallowRef`:** replace the `.value` entirely — do not mutate nested fields.
- Expose read-only state from composables via `readonly()`; keep the writable ref internal.

### Code organisation for testability

- **Pure functions** (`server/utils/`, `shared/`): stateless, no Vue imports. Testable in isolation.
- **Composables** (`composables/`): stateful, use Vue reactivity. Tested by calling the composable and asserting on returned refs.
- Do not write complex transformation logic inside `<script setup>`. Extract it to a pure function (`server/utils/`) or a composable so it can be tested in isolation.

### API route conventions (`server/api/*.ts`)

- Validate request payloads with runtime schemas (zod).
- Use explicit timeouts for upstream calls (`$fetch` `timeout`).
- Return clear HTTP status codes and concise status messages (`createError`).
- Keep route handlers readable by extracting reusable logic into `server/utils/*`.
- Lazy-init heavy clients (MCP client, OpenAI) once per server lifetime via `defineLazyEventHandler` — the MCP client and tool schemas are initialised once at startup and reused across requests.

### Chat-specific guidance

- Prioritise graceful failure modes (never leave users with silent/empty outcomes).
- Keep prompt/policy changes focused and measurable.
- Avoid prompt instructions that are overly rigid; prefer adaptive behaviour rules.

### Security and output rendering

- If rendering model output with `v-html`, keep HTML sanitisation enabled (`isomorphic-dompurify`).
- Never trust tool/model output as safe HTML by default.

### Testing (Vue-specific)

- Use `@vue/test-utils` for component mounting; `happy-dom` for the DOM environment when needed.
- Mock the AI SDK / MCP client / OpenAI / HiPEAC API as needed — never hit the backend from unit tests.
- **Composables** usually do not need to be mounted in a component — call the composable directly and assert on the returned refs.

## Error monitoring (Sentry)

You have access to the Sentry MCP server. Use it to investigate errors proactively when debugging issues.

- **`regionUrl`**: `https://de.sentry.io`
- **`organizationSlug`**: `ea06`
- **`projectSlugOrId`**: `hipeac-ask` (Vue/Nuxt app)

The backend this app talks to (`hipeac-mcp`) has its own Sentry project in a separate repo — do not duplicate backend project slugs here.

When resolving issues, prefer **`resolvedInNextRelease`** over `resolved` — this signals the fix is in the next deployment rather than already live.

### Bug fix workflow

When a Sentry issue reveals a bug that is not covered by an existing test, always add a regression test before (or alongside) the fix:

1. **Reproduce first**: write a test that fails against the current code, confirming you have isolated the root cause.
2. **Fix the code**: make the test pass.
3. **Verify no new gaps**: confirm no related paths are left uncovered.

Never close a Sentry bug without a corresponding regression test. The fix lives in the code; the test ensures it stays fixed.