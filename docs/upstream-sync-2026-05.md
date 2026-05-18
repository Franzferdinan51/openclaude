# Upstream Sync - May 2026

DuckHive checked the live upstream repositories on May 7, 2026 and refreshed the live heads on May 9, 2026 before the hardening pass. Follow-up probes on May 17, 2026 refreshed the current heads/tags for the named harnesses before the context-collapse recovery fix and again before the CLI/TUI completion audit. A May 18, 2026 probe refreshed the live HEADs again before further feature-port triage. The safest high-value fixes from the earlier check were ported into `0.8.1` and the SDKv2 sync line.

## Repositories Checked

| Project | Repository | Latest checked state | DuckHive action |
| --- | --- | --- | --- |
| OpenClaude | https://github.com/Gitlawb/openclaude | `main` refreshed at `ed7b6972f9cd7d36cd604738f5160064061ab254` on 2026-05-09; previous sync base `4b1e516fc70c07da6ad678df35030fa114cc8918` | Ported SDKv2/runtime/build surfaces plus post-release CLI/provider/web-search fixes |
| OpenAI Codex | https://github.com/openai/codex | `main` pushed 2026-05-07; latest stable `rust-v0.128.0`, newest prerelease `rust-v0.129.0-alpha.13` | Reviewed stable/prerelease split; deferred alpha-only imports |
| OpenClaw | https://github.com/openclaw/openclaw | `main` refreshed at `e22730e1c53e2032dd743e07cd38ac52a9b31b6c` on 2026-05-09; latest checked release line `v2026.5.7` | Ported compatible fetch header normalization and Telegram polling/buffering reliability fixes into DuckHive's smaller channel/harness surfaces |
| Hermes Agent | https://github.com/NousResearch/hermes-agent | `main` refreshed at `a7e7921dbc0a593027f40b571861f50a71221aec` on 2026-05-09; latest checked tag `v2026.5.7` | Reviewed curator, self-improvement, MiniMax OAuth, remote model catalog, and goal-loop features for DuckHive-shaped follow-up work |

## Refreshed May 17, 2026

| Project | Current probe result | DuckHive follow-up |
| --- | --- | --- |
| OpenClaude | `main`/`HEAD` at `0fba1541a8647a805339811f6f2bac4b8d13b699`; `fix/363-startup-input-freeze` at `af5bb8fed8f830280b0db2eaed26d46ec39ffe0b`; latest observed tag `v0.13.0` | Confirmed DuckHive already carries the Windows early-input disable/data-stdin hardening direction, then selectively ported the latest heap-cap, Bash sandbox fanout, prompt-banner, spinner-nowrap, TaskList label-preservation, and WebSearch adapter diagnostic fixes while keeping DuckHive branding/default-provider behavior. |
| OpenAI Codex | `main`/`HEAD` at `e7bffc5a20e92cbc64d6c16a1b257d0b2e4cd5df`; latest stable tag observed `rust-v0.130.0`; latest observed prerelease line `rust-v0.131.0-alpha.22` | Kept `/goal` as the current stable Codex-inspired slice; no alpha-only behavior imported. |
| OpenClaw | `main`/`HEAD` at `5434769e47e69a254456879c25a4f3fb60cf9eac`; latest observed stable `v2026.5.7`, latest observed beta `v2026.5.9-beta.1` | Existing channel/Telegram/ClawHub hardening remains the DuckHive-shaped slice; after reviewing the newer Telegram delivery and doctor-health commits, DuckHive tightened Telegram command output to ASCII-safe help/run/event lines and ported the latest compatible long-poll timeout bounding across both the Telegram service and channel adapter so quiet Telegram polls are not aborted at the same second as the server-side long-poll timeout. The reviewed OpenClaw `5434769e` cron announce fix targets OpenClaw's isolated-agent source-reply delivery mode; DuckHive has local cron/scheduled task plumbing but no matching isolated-agent announce source-reply path, so no direct runtime port was applied. DuckHive's applicable branding follow-up was to remove leaked OpenClaude HTTP originator headers from Codex-compatible DuckHive request surfaces. |
| Hermes Agent | `main`/`HEAD` at `43e566f77eaf01293086eb7cb99a21e240d60634`; latest observed tag `v2026.5.16` | Closed a local long-session harness gap by making context-collapse subscriptions real and preventing `/context` projection crashes when the collapse gate is enabled; then ported the compatible auxiliary-fallback lesson by letting DuckHive's API retry path use a configured fallback model on explicit 402/payment, credit, daily quota, and quota-exhausted 429 signals before surfacing the non-retryable quota guidance. |

## Refreshed May 18, 2026

| Project | Current probe result | DuckHive follow-up |
| --- | --- | --- |
| OpenAI Codex | `main`/`HEAD` at `64ead6a83a6ed348229bc98a9b5d8b0c550d8305` | Keep `/goal` as the current stable Codex-inspired slice; the newer exec-server websocket keepalive commit has no direct DuckHive exec-server equivalent after review, while DuckHive already carries websocket ping/keepalive behavior in its CLI transport. |
| OpenClaw | `main`/`HEAD` at `71ed6526b1296edc68a41ddc7e48855dfee798e9` | Ported the compatible Telegram HTTP 421/Misdirected Request retry behavior into DuckHive's Telegram service and channel adapter. Re-reviewed the newer session-target delta through `8483d03375`: its `configuredAgentsOnly` gateway/session-store fix targets OpenClaw's `src/config/sessions` and `src/gateway` stores, which DuckHive does not have. DuckHive's closest surfaces are JSONL `listSessionsImpl`, sidechain subagent transcripts, and remote-agent metadata, so no direct runtime port was applied. The remaining OpenClaw deltas are CI, QA-lab scheduling, and autoreview fallback changes. |
| OpenClaude | `main`/`HEAD` at `f71e7692373a61d28c82fc3fadff3feaa4071ede` | DuckHive already carries the repeated-tool-failure guard and the recent Gemini raw tool-call/TaskList label-preservation behavior; keep future OpenClaude imports selective. |
| Hermes Agent | `main`/`HEAD` at `43e566f77eaf01293086eb7cb99a21e240d60634` | No new Hermes-specific follow-up slice identified beyond the already-ported auxiliary fallback and existing self-improvement/memory surfaces. |

## Refreshed Later May 18, 2026

| Project | Current probe result | DuckHive follow-up |
| --- | --- | --- |
| OpenClaude | `main`/`HEAD` at `f71e7692373a61d28c82fc3fadff3feaa4071ede` | No new OpenClaude delta beyond the already-reviewed repeated-tool-failure and Gemini/TaskList behavior. |
| OpenAI Codex | `main`/`HEAD` at `64ead6a83a6ed348229bc98a9b5d8b0c550d8305` | No new Codex delta beyond the already-reviewed `/goal` and exec-server websocket keepalive notes. |
| OpenClaw | `main`/`HEAD` at `2696f2576d3e9abac4678af871960b0fc1aceb90` | New deltas are mostly updater/plugin/QA/browser/gateway/Telegram service changes. The gateway hot-reload/isolated-ingress Telegram fix targets OpenClaw-specific channel manager and worker code that DuckHive does not have. Ported the compatible privacy lesson from the raw-update redaction delta by redacting DuckHive Telegram debug chat IDs and bot usernames, and mirrored the Codex session-spawn routing lesson by teaching DuckHive prompts to prefer native subagent/spawn surfaces while keeping DuckHive `/spawn`, Agent Tool, ACP, and team delegation available for explicit team work. |
| Hermes Agent | `main`/`HEAD` at `abf1af540193c30047ff3e7e759c330faf3a880f` | Ported the compatible no-LLM session-search lesson into DuckHive's resume/session search path: `agenticSessionSearch` now scores local tags, titles, branches, summaries, first prompts, and transcript excerpts directly, including quoted phrase and OR-style literal recall, instead of calling an auxiliary model. |

## Refreshed Latest May 18, 2026

| Project | Current probe result | DuckHive follow-up |
| --- | --- | --- |
| OpenClaude | `main`/`HEAD` at `f71e7692373a61d28c82fc3fadff3feaa4071ede` | No new OpenClaude delta since the previous refresh. |
| OpenAI Codex | `main`/`HEAD` at `22dd9ad3929253ed24d7ee4f10f238e95ab25f37` | New delta is memory-summary densification/versioning. No direct DuckHive port yet; keep under review when touching memory summary generation. |
| OpenClaw | `main`/`HEAD` at `491ce8b7535baadbb73191587453ac1124c9b6c2` | Ported the compatible Telegram-media lesson from `491ce8b753`: DuckHive now preserves Telegram photo/document captions and emits explicit media placeholders through both the polling service and `TelegramAdapter`. Remaining deltas are mostly gateway, native macOS, Telegram QA/spool internals, and native Codex task recovery; continue reviewing as independent slices. |
| Hermes Agent | `main`/`HEAD` at `dadc8aa25580ac1ecc65d6185dfc6bd0e1d6d279` | Added DuckHive regression coverage for the compatible `ff078738` symlinked skill slash-command lesson: symlinked `.claude/skills/<name>` directories now stay covered by `src/skills/loadSkillsDir.test.ts`. Kanban/ACP changes remain under review for future slices. |

## Refreshed Current May 18, 2026

| Project | Current probe result | DuckHive follow-up |
| --- | --- | --- |
| OpenClaude | `main`/`HEAD` at `f71e7692373a61d28c82fc3fadff3feaa4071ede` | No new OpenClaude delta since the previous refresh. |
| OpenAI Codex | `main`/`HEAD` at `22dd9ad3929253ed24d7ee4f10f238e95ab25f37` | No new Codex delta since the previous refresh. |
| OpenClaw | `main`/`HEAD` at `1e5450f23e1c770912bc1eb0b4eaa7b6d1ba94e3` | Reviewed the new provider-owner harness commit; DuckHive does not have OpenClaw's plugin runtime loader, so there is no direct provider-owner port. Ported the compatible group-visible reply safety lesson by making DuckHive Telegram ignore slash commands addressed to a different bot username, preventing group replies to `/command@other_bot` turns. Focused `TelegramService` tests cover matching bot suffixes and quiet non-matching suffixes. |
| Hermes Agent | `main`/`HEAD` at `dadc8aa25580ac1ecc65d6185dfc6bd0e1d6d279` | No new Hermes delta since the previous refresh. |

## Refreshed TUI Follow-up May 18, 2026

| Project | Current probe result | DuckHive follow-up |
| --- | --- | --- |
| OpenClaw | `main`/`HEAD` at `3553aa3763eba95b4d0d1dc94b67c426657a7730` | Reviewed OpenClaw's standalone TUI exit guard. DuckHive's TUI is a standalone Go binary, so the Node post-return process-exit guard does not apply directly. The compatible bug class did exist locally: typed `/exit` or `/quit` in DuckHive's TUI could fall through to backend dispatch or a no-bridge error instead of exiting. DuckHive now handles those commands locally with `tea.Quit`, and Go tests cover `/exit` without backend dispatch. |

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
- `src/services/telegram/TelegramService.ts` and `src/channels/TelegramAdapter.ts` now give `getUpdates` a 45s HTTP abort window while bounding the Telegram long-poll body timeout below that window, avoiding false timeout failures when a quiet poll reaches the normal server boundary.
- `src/channels/TelegramAdapter.ts` buffers all updates from a batch and continues past filtered/non-text updates instead of dropping later valid messages.
- `src/agent-runs/*` adds DuckHive's AgentRun control plane and experimental `duckhive/harness` split: DuckHive core owns provider/model/session/tool/channel policy, while a harness only claims and executes a prepared attempt.
- Telegram now exposes AgentRun control commands (`/runs`, `/run`, `/tail`, `/pause`, `/resume`, `/stop`, `/approve`) with chunked replies, Markdown fallback, and optional `DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID` filtering.

The deeper OpenClaw Codex OAuth doctor route-repair and guarded Undici dispatcher lifecycle are still larger gateway/plugin slices. DuckHive already carries adjacent provider profile and WebFetch SSRF surfaces, but those should be ported as separate runtime-backed changes rather than copied wholesale from OpenClaw's gateway-specific stack.

### Hermes Agent

Hermes `v2026.4.30` adds autonomous curator, self-improvement review-loop hardening, MiniMax OAuth, remote model catalog manifests, and model-capability-driven image routing. DuckHive already has `duckcustodian`, skills, memory, MiniMax, provider discovery, and now route-aware vision overrides for multimodal prompt submissions.

**✅ Implemented in v0.9.0:** DuckHive Curator — `duckhive curate status` grades and ranks all skills by quality, recency, and content richness. `duckhive curate run` performs a full curation cycle with archiving of low-rated skills. Defense-in-depth protects bundled skills from mutation.

**Already present in DuckHive:** route-owned dynamic model discovery and `/model refresh` for providers/gateways that expose live catalogs, with cache partitioning, stale-cache fallback, startup/background refresh modes, and privacy gating.

**Implemented in v0.9.x:** multimodal prompt routing now checks the active main-loop model's capability metadata. If a prompt includes image blocks and the current model lacks vision support, DuckHive applies a route-aware override to a known vision-capable model on the active provider when one exists.

**Implemented in v0.9.x:** after memory extraction, DuckHive now launches a best-effort self-improvement background fork that reviews recent turns for memory gaps, reusable skill/process improvements, and harness friction, then writes actionable markdown reviews under `~/.duckhive/self-improvement/reviews/` when it finds something worth keeping.

**Implemented in v0.9.x:** MiniMax auth now reuses `MINIMAX_API_KEY`, `MMX_API_KEY`, `~/.mmx/config.json`, and `~/.mmx/credentials.json`, and MiniMax request paths now attempt a best-effort `mmx auth refresh` before using file-backed OAuth access tokens. Validation and env-only bootstrap paths accept the same shared credential sources instead of assuming MiniMax is API-key-only.

**Remaining slices:** no explicit Hermes-specific follow-up slice is still open from this audit, although broader whole-product verification debt still remains.

**Implemented after `43e566f77e`:** DuckHive now mirrors the compatible Hermes auxiliary fallback behavior for quota and payment exhaustion: when the primary model returns explicit 402/payment, credit, daily quota, or quota-exhausted 429 signals and `--fallback-model` is configured, the API retry path triggers the existing fallback handoff instead of failing immediately. Generic 429 rate limits still use the normal retry path. If no fallback is configured, DuckHive preserves the current non-retryable quota guidance.

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

Historical verification highlights from the SDKv2 sync:

- `bun test tests/sdk` passes
- focused provider, web search, token counter, hook, and OpenAI shim tests pass
- full `bun test`, `bun run build`, `bun run smoke`, `bun run verify:privacy`, and `bun run doctor:runtime` pass
- `cd tui && go test ./...` passes

Current project-wide verification status after the CLI/TUI completion audit:

- `bun run typecheck`, `npm run smoke`, full `bun test`, `npm run integrations:check`, `npm run verify:privacy`, and `npm pack --dry-run --json` pass on the TypeScript/Node side.
- `cd tui && go test ./...` now passes on the current Windows machine with a local Go 1.25.4 toolchain under `.tmp\go-toolchain`; the packaged Bubble Tea binary was rebuilt and rechecked with `duckhive tui --snapshot` plus `duckhive tui --input-smoke`.
