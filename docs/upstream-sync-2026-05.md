# Upstream Sync - May 2026

DuckHive checked the live upstream repositories on May 7, 2026 and ported the safest high-value fixes into `0.8.1` and the SDKv2 sync line.

## Repositories Checked

| Project | Repository | Latest checked state | DuckHive action |
| --- | --- | --- | --- |
| OpenClaude | https://github.com/Gitlawb/openclaude | `main` checked at `4b1e516fc70c07da6ad678df35030fa114cc8918` on 2026-05-07 | Ported SDKv2/runtime/build surfaces plus post-release CLI/provider/web-search fixes |
| OpenAI Codex | https://github.com/openai/codex | `main` pushed 2026-05-07; latest stable `rust-v0.128.0`, newest prerelease `rust-v0.129.0-alpha.13` | Reviewed stable/prerelease split; deferred alpha-only imports |
| OpenClaw | https://github.com/openclaw/openclaw | `main` checked at `350889dd75f494f448733d310f38a400448d0944` on 2026-05-08; latest checked release line `v2026.5.7` | Ported compatible fetch header normalization and Telegram polling/buffering reliability fixes into DuckHive's smaller channel/harness surfaces |
| Hermes Agent | https://github.com/NousResearch/hermes-agent | `main` pushed 2026-05-07; latest release `v2026.4.30` | Reviewed curator, self-improvement, MiniMax OAuth, remote model catalog, and goal-loop features for DuckHive-shaped follow-up work |

## Ported In 0.8.1

### OpenClaude effort fix

Source: `Gitlawb/openclaude@feb5791`

DuckHive now normalizes OpenAI/Codex `xhigh` effort to the standard internal `max` setting so it survives settings writes and reloads. At the OpenAI-compatible request boundary, DuckHive converts that value back to `xhigh` and emits `reasoning_effort` for chat-completions transports.

Affected files:

- `src/utils/effort.ts`
- `src/components/EffortPicker.tsx`
- `src/commands/effort/effort.tsx`
- `src/services/api/client.ts`
- `src/services/api/claude.ts`
- `src/services/api/openaiShim.ts`
- `src/utils/effort.codex.test.ts`
- `src/services/api/openaiShim.test.ts`

### OpenClaude async subagent handoff fix

Source: `Gitlawb/openclaude@6af709e`

DuckHive now tells the main agent to stop after launching an async agent unless it has clearly non-overlapping work. This reduces duplicated work and wasted model spend when a background subagent is already handling the delegated task.

Affected files:

- `src/tools/AgentTool/AgentTool.tsx`
- `src/tools/AgentTool/agentToolAsyncInstructions.test.ts`

## Reviewed But Deferred

### Codex

Stable Codex `rust-v0.128.0` adds persisted goal workflows, configurable TUI keymaps, permission profiles, sandbox profile selection, plugin marketplace improvements, external agent session import, and explicit MultiAgentV2 settings. DuckHive already has adjacent plan, permission, plugin, and agent-team surfaces, so these should be ported as feature slices with their own tests.

Codex `rust-v0.129.0-alpha.*` was treated as prerelease-only. Do not import alpha behavior into DuckHive `main` until the API and storage shapes settle.

### OpenClaw

OpenClaw `v2026.5.6` and the live `main` line checked on 2026-05-08 contain important Codex OAuth, fetch, agent, and Telegram fixes:

- preserve valid `openai-codex/*` OAuth routing instead of rewriting it to generic `openai/*`
- normalize symbol-bearing header objects before native `fetch` or debug replay
- bound guarded dispatcher cleanup after web-fetch timeouts
- keep Telegram polling alive after quiet `getUpdates` responses and avoid sticky transport stalls
- retry overloaded subagent announces

DuckHive now ports the compatible pieces that fit its architecture:

- `src/services/api/fetchWithProxyRetry.ts` strips symbol metadata from plain header dictionaries before native `fetch`.
- `src/services/telegram/TelegramService.ts` keeps long polling alive after empty Telegram batches and bounds Bot API calls with an abort timeout.
- `src/channels/TelegramAdapter.ts` buffers all updates from a batch and continues past filtered/non-text updates instead of dropping later valid messages.

The deeper OpenClaw Codex OAuth doctor route-repair and guarded Undici dispatcher lifecycle are still larger gateway/plugin slices. DuckHive already carries adjacent provider profile and WebFetch SSRF surfaces, but those should be ported as separate runtime-backed changes rather than copied wholesale from OpenClaw's gateway-specific stack.

### Hermes Agent

Hermes `v2026.4.30` adds autonomous curator, self-improvement review-loop hardening, MiniMax OAuth, remote model catalog manifests, and model-capability-driven image routing. DuckHive already has `duckcustodian`, skills, memory, MiniMax, and provider discovery.

**✅ Implemented in v0.9.0:** DuckHive Curator — `duckhive curate status` grades and ranks all skills by quality, recency, and content richness. `duckhive curate run` performs a full curation cycle with archiving of low-rated skills. Defense-in-depth protects bundled skills from mutation.

**Remaining slices:**
- MiniMax OAuth credential refresh alongside existing mmx/API-key support
- remote model catalog refresh for providers that support live catalogs
- vision-capability routing for multimodal messages
- Self-improvement loop: after-turn background fork reviewing skill/memory usefulness

## GitNexus Impact Notes

Before symbol edits, GitNexus impact analysis reported:

- `toPersistableEffort`: HIGH risk; direct callers in effort command, picker, and settings initialization
- `resolveAppliedEffort`: CRITICAL risk; affects REPL/headless prompt input, logos/status, effort display, and streaming request setup
- `getAnthropicClient`: CRITICAL risk; affects API requests, token estimation, permission explanation, side queries, MCP validation, and model validation
- `AgentTool`: LOW risk for the text-only async handoff result mapping

The implementation therefore stayed limited to upstream-matched behavior and focused regression tests.

## Ported In SDKv2 Sync

Source: `Gitlawb/openclaude@4b1e516fc70c07da6ad678df35030fa114cc8918`

DuckHive now exposes `duckhive/sdk` with the OpenClaude SDKv2 runtime entrypoint, generated SDK schemas/types, query/session APIs, permission helpers, transcript helpers, SDK-specific error classes, QueryEngine SDK mutators, and a separate `dist/sdk.mjs` build. The SDK bundle is scanned to prevent React/Ink/TUI imports from leaking into the public SDK surface.

Additional OpenClaude fixes ported in this sync:

- incremental cached token counting
- hook stdin EOF handling
- `--model` without `--provider`
- Cerebras `store` stripping in the OpenAI-compatible shim
- Brave web search auth, Google custom search query params, and Exa highlights
- interactive/plugin startup cycle fix by lazily initializing DuckHive orchestration
- command ownership cleanup so DuckHive owns `duckhive` only and no longer ships an `openclaude` wrapper

Verification highlights:

- `bun test tests/sdk` passes
- focused provider, web search, token counter, hook, and OpenAI shim tests pass
- full `bun test`, `bun run build`, `bun run smoke`, `bun run verify:privacy`, and `bun run doctor:runtime` pass
- `cd tui && go test ./...` passes

Known existing project-wide verification debt:

- `bun run typecheck` still reports broad pre-existing type errors unrelated to SDKv2 and the OpenClaw/Telegram hardening pass, including missing optional legacy modules and old strictness issues across UI/command/test surfaces.
