# DuckHive Completion Audit - 2026-05-17

This audit maps the active product goal to concrete evidence in the current
checkout. It is intentionally strict: a passing verifier only counts when it
covers the named requirement.

## Success Criteria

| Requirement | Current evidence | Status |
| --- | --- | --- |
| Default Windows CLI must start without freezing and accept typing | `npm run smoke` passes `TextInput` buffered typing, Windows data-event stdin selection, Ink stdin delivery tests, and 67 CLI smoke cases plus Windows wrapper checks. | Verified |
| Prompt submission must not crash with `Cannot read properties of undefined (reading '_zod')` | Built-in tool-schema conversion regression was added in `src/utils/api.test.ts`; the prompt-schema fix was committed as `9ed65d9`; `scripts/postbuild-patch.mjs` now fails the build if any required Zod v4 bundle patch target disappears, with `scripts/postbuild-patch.test.ts` covering both successful patching and fail-closed behavior. | Verified |
| Repeated tool failures must not loop forever | DuckHive ports OpenClaude `f71e769237`'s repeated-tool-failure guard into `src/query.ts`; focused tests cover signature, category, path, ignored synthetic failures, threshold parsing, DuckHive env override, source ordering before optional follow-up work, and path-safe logging. | Verified |
| `duckhive` command must resolve and report the DuckHive version | 2026-05-18 live PowerShell evidence after the 0.13.6 bump: `Get-Command duckhive` resolves through `C:\Users\franz\AppData\Roaming\npm\duckhive.ps1`; `where.exe duckhive` finds the npm shims; `duckhive --version`, `duckhive --yolo --version`, `duckhive --dangerously-skip-permissions --version`, and `node dist\cli.mjs --version` all report `0.13.6 (DuckHive)`. | Verified |
| Version metadata and README must match the release | `package.json`, README, and Go TUI header now report `0.13.6`; `npm pack --dry-run --json` publishes `duckhive@0.13.6`; CLI smoke checks `--version` and Windows wrapper version output against `package.json` instead of only checking for DuckHive branding. | Verified |
| Runtime diagnostics must not imply legacy OpenClaude/Anthropic defaults | `runtime-doctor` now mirrors DuckHive startup defaults by reporting MiniMax when no explicit provider env is active, while preserving Anthropic only for explicit DuckHive provider selection. | Verified |
| Codex-compatible HTTP surfaces must not leak OpenClaude attribution | Codex Responses requests, Codex web search, Codex usage reads, `/cache-probe`, and runtime-doctor Codex probes now share `CODEX_HTTP_ORIGINATOR = "duckhive"`; OAuth keeps its separate protocol-required Codex originator. Focused tests assert the DuckHive HTTP originator constant. | Verified |
| Quota/payment exhaustion must use configured fallback before failing | Inspired by Hermes auxiliary fallback safety nets, DuckHive now triggers `--fallback-model` on explicit 402/payment, credit, daily quota, and quota-exhausted 429 signals before showing the non-retryable quota guidance; focused `withRetry` tests cover configured fallback, no-fallback behavior, and generic 429 rate limits staying on the normal retry path. | Verified |
| Model routing command arguments must preserve user text safely | `/router` now preserves escaped quotes in task text, rejects unterminated quoted input before invoking model selection, and accepts separated option values such as `--complexity 8` and `--vision true`. | Verified |
| Budget mutation command arguments must fail safely | `/budget` now rejects unterminated quoted input before calling provider or global budget mutation functions; focused tests cover the no-mutation path. | Verified |
| Cache mutation command arguments must fail safely | `/cache` now rejects unterminated quoted input before clearing provider cache or session cache metrics; focused tests cover the no-mutation path. | Verified |
| `/goal` must be present as a Codex-style workflow feature | CLI smoke covers top-level `goal`, top-level `g`, and bare-print `/goal Build smoke goal`; focused tests cover REPL shorthand, escaped quotes in goals/steps, unterminated quoted input rejecting before mutation, autonomous `/goal pursue` teammate spawn wiring, and `/goal stop-autonomous` pausing the goal/current step. README documents REPL and top-level forms. 2026-05-18 live launcher check: `duckhive goal --help` and `duckhive g --help` print both terminal and REPL `/goal` forms without provider startup. | Verified |
| Background AgentRun controls must be inspectable from the terminal | `duckhive attach <run-id> [limit]` now prints run metadata, pending approvals, stored artifacts, recent events, and exact control commands instead of a not-implemented placeholder; `/run <id>` also exposes stored artifact paths/URLs. `duckhive runs [status]`, `duckhive run [status]`, and `/run [status]` list matching AgentRuns instead of treating lifecycle status words as run IDs. Top-level `duckhive --help` now advertises the provider-free AgentRun controls `ps`, `logs`, `attach`, `pause`, `resume`, `approve`, `recover`, and `kill`; CLI smoke asserts the default help surface includes key controls. Focused tests cover event tail, invalid limits, artifact output, and status shorthand filtering. | Verified |
| REPL `/run` controls must parse recovery text safely | `/run recover` now preserves escaped quotes inside quoted summaries and rejects unterminated quoted arguments before mutating run state; focused tests cover both paths. | Verified |
| Computer-use must be reachable without blocking on Codex.app | Runtime doctor reports bundled `newest-desktop-control` available for desktop, Android, and compatibility aliases; `duckhive computer-use status` reports native Codex computer-use as macOS-only and points Windows users to `duckhive desktop` / `/desktop` or the bundled `newest-desktop-control` MCP gateway; `duckhive computer-use tools`, `duckhive cu tools`, and `duckhive comput-use tools` all list native Codex tool names plus bundled fallback `computer_use_*` aliases; current package dry-run includes the runtime `skills/newest-desktop-control/` files. | Verified fallback |
| Android and Vision command/tool arguments must preserve user text safely | `/android`, `/vision`, `AndroidTool`, and `VisionTool` now use Node's OS temp directory instead of Unix-only `/tmp` for screenshot pulls, with quoted local paths for Windows; slash commands also preserve escaped quotes and reject unterminated quoted input before running ADB actions; focused tests cover text, analyze, screenshot, tool paths, and no-exec rejection paths. | Verified |
| ClawHub skill hub must be connected | Runtime doctor reports ClawHub registry default `https://clawhub.ai` and `/skill search`, `/skill inspect`, `/skill install` availability. 2026-05-18 live launcher checks: `duckhive skill search agent --limit 1` returns a ClawHub result from `https://clawhub.ai`, and `duckhive skill inspect api-agent-rate-limiter-1-3-1` returns the remote skill metadata, version, moderation status, reason code, and changelog without provider startup. | Verified surface |
| ClawHub/local skill CLI arguments must preserve user text safely | `/skill` now preserves escaped quotes in local skill names and ClawHub search queries, and rejects unterminated quoted input before creating a skill or calling the registry. | Verified |
| Telegram/channel connectors must be provider-free and inspectable | Runtime doctor reports connector CLI status commands for `connect status`, `telegram status`, and `channel status telegram`; `duckhive channel status telegram` returns a provider-free Telegram adapter readiness snapshot; `/channel --help` now resolves to the adapter readiness snapshot instead of an unknown-action error; Telegram built-in command replies now use ASCII-safe list markers and run separators; README documents Telegram env and AgentRun controls. | Verified surface |
| Voice readiness must be inspectable without starting provider auth or microphone tooling | `/voice status`, `/voice --help`, and `duckhive voice status` now run provider-free and report feature-gate, Claude.ai OAuth, configured, and ready state without toggling voice mode; headless bare `/voice` returns status instead of touching microphone state. Focused tests cover status/help/non-interactive behavior, and CLI smoke covers both print-slash and top-level voice status. | Verified surface |
| Telegram long polling must not fail at the normal quiet-poll boundary | DuckHive ports the compatible OpenClaw `91266fa928` timeout-bounding fix: both the Telegram service and channel adapter keep a 45s HTTP abort window while the request body long-poll timeout stays below it; focused tests cover timeout resolution and emitted request bodies. | Verified |
| Telegram must recover from transient Bot API misdirected responses | DuckHive ports the compatible OpenClaw `63b728de43` HTTP 421/Misdirected Request retry behavior into both the Telegram service and channel adapter with a single fresh request retry; focused tests cover startup recovery, adapter send recovery, and no retry for unrelated HTTP 500 failures. | Verified |
| Telegram debug logs must not expose chat or bot identifiers | Inspired by OpenClaw `74949eda2f`, DuckHive now redacts Telegram chat IDs and bot usernames in debug lifecycle logs while preserving message routing internally; focused `TelegramService` tests verify the redacted logs do not contain private identifiers. | Verified |
| Telegram media turns must not be silently dropped | Inspired by OpenClaw `491ce8b7535baadbb73191587453ac1124c9b6c2`, DuckHive now preserves Telegram photo/document captions and emits explicit media placeholders through both the polling service and `TelegramAdapter`; focused tests cover captioned photo forwarding in both paths. | Verified |
| Channel message commands must preserve user text safely | `/channel` now parses quoted arguments with escaped quotes and rejects unterminated quoted strings instead of silently sending malformed messages; focused tests cover console send and Telegram rejection. | Verified |
| Agent Teams and AI Council CLI arguments must preserve user text safely | `/team`, `/council`, `/orchestrate`, `/spawn`, `/swarm`, `/senate`, and `/decree` now preserve escaped quotes, reject unterminated quoted input before spawning/starting/executing/issuing, and accept separated flag values where applicable; CLI smoke covers provider-free headless `/spawn --help`, `/swarm --help`, `/senate --help`, and `/decree --help`. | Verified |
| Agent/team/council guidance must be visible to model-facing prompts | `src/constants/promptIdentity.test.ts` verifies the normal system prompt tells DuckHive to use subagents, prefer native subagent/spawn surfaces when the runtime provides them, and use `/council`, `/team`, `/spawn`, `/skills`, Agent Tool, and team surfaces when they genuinely help DuckHive, ACP, or team delegation. It also verifies `DEFAULT_AGENT_PROMPT` carries the same native-subagent preference plus subagent, `/council`, and `/spawn` guidance. | Verified |
| AI Council runtime must be inspectable from the terminal | `runtime-doctor` checks the local `council:serve` source/script, probes `DUCKHIVE_COUNCIL_URL` or default `/api/health`, and verifies `/api/councilors` returns a usable councilor catalog; focused tests cover live, offline guidance, missing source, and empty catalog paths. | Verified |
| Runtime-doctor HTTP timeouts must clean up promptly | `checkCouncilRuntimeReadiness()` now uses `createCombinedAbortSignal(..., { timeoutMs: 1500 })` instead of raw `AbortSignal.timeout`; `scripts\no-raw-abort-signal-timeout.test.ts` guards against reintroducing raw timeout signals across source files. | Verified |
| OpenClaude upstream refresh must be handled safely | Live `git ls-remote` confirms OpenClaude `main` at `f71e7692373a61d28c82fc3fadff3feaa4071ede`; DuckHive selectively ported the safe repeated-tool-failure loop guard from that delta while keeping DuckHive code, branding, and provider defaults intact. | Verified |
| OpenClaude conversation export formats must be available without a wholesale merge | `/export` now supports text, Markdown, and JSON via filename inference or `--format`/`-f`; focused tests cover argument parsing and Markdown/JSON rendering, and CLI smoke covers provider-free headless `/export --help` plus a real JSON file write. | Verified |
| GitHub workflow setup artifacts must be DuckHive-facing while keeping compatible runtime templates | `src/utils/openclaudeUiSurfaces.test.ts` verifies the setup dialog, existing-workflow warnings, generated PR title/body, and workflow-file commit messages use DuckHive wording while the underlying Claude GitHub Action template and `@claude` trigger remain compatible. | Verified |
| Gemini/OpenGateway tool calls must remain executable | The OpenAI-compatible shim converts Gemini `Tool calls requested:` raw-text fallbacks back into `tool_use` blocks for streaming and non-streaming responses; focused `openaiShim` regressions cover Write and Agent raw-tool forms. | Verified |
| Shadow Git command arguments must fail safely | `/shadow` now preserves escaped quotes in checkpoint messages and rejects unterminated quoted input before creating checkpoints or restoring files. | Verified |
| Scheduled loop command must match documented behavior and fail safely | `/loop status` now works as documented, creation accepts separated option values, invalid options reject before storing loops, lifecycle commands reject ambiguous partial IDs, and all command splitters under `src\commands` have been moved off the old regex splitter. | Verified |
| Built-in terminal commands must not be shadowed by bundled prompt skills | Command loading now filters external skill/plugin/workflow name collisions against built-in commands, so the bundled `loop` skill no longer shadows the local `/loop` command; CLI smoke covers provider-free `/loop help`. | Verified |
| Provider-free print slash commands must not emit provider-auth warnings | The startup gate now skips provider profile validation for known local `-p "/command"` slash commands while keeping auth validation for normal print prompts; CLI smoke rejects saved-provider warnings for `/loop`, `/android`, `/vision`, `/shadow`, `/checkpoint`, `/router`, `/budget`, `/cache`, `/export`, `/permissions profile`, `/spawn`, `/swarm`, `/senate`, and `/decree`. | Verified |
| Permission and sandbox profiles must be selectable from the terminal | Inspired by Codex permission/sandbox profile workflows, `/permissions profile` and top-level `duckhive permissions profile` now expose provider-free `list`, `status`, and named profile application for `safe`, `balanced`, `edit`, `yolo`, and `off`; `duckhive allowed-tools profile status` remains a compatibility alias. Profiles set `permissions.defaultMode` plus matching sandbox settings, default to local project settings, support `--project` and `--user`, and update the active session permission mode. Top-level `duckhive --help` advertises `permissions|allowed-tools`. Focused tests cover parsing, unknown-option rejection before mutation, generated settings, active AppState transition, and terminal status/list rendering; CLI smoke covers provider-free slash profile list, top-level profile list, default help visibility, and safe profile application in an isolated config home. | Verified |
| Shared test mutation locks must fail instead of hanging indefinitely | `acquireSharedMutationLock` now applies a five-minute default timeout and reports scoped timeout errors; focused tests cover default timeout, override timeout, and release handoff. | Verified |
| SDK mutex tests must not mutate the process-global env mutex | The SDK shared mutex now exposes an isolated test-only mutex factory, and `tests\sdk\shared-utils.test.ts` exercises timeout behavior without resetting the global mutex used by other tests. | Verified |
| OpenGateway partner model catalog must be current | The `gitlawb-opengateway` preset now routes through `https://opengateway.gitlawb.com/v1`, maps to the OpenAI-compatible vendor, and exposes Gemini 3.1 Flash Lite Preview plus GLM 5.1 FP8 catalog entries. | Verified |
| Session search must stay local and provider-free | Inspired by Hermes `abf1af540193c30047ff3e7e759c330faf3a880f`, DuckHive's `agenticSessionSearch` now uses deterministic local scoring across tags, titles, branches, summaries, first prompts, and transcript excerpts instead of `sideQuery`; focused tests cover metadata ranking, quoted phrase transcript matching, and OR-style broad recall. | Verified |
| Skill slash commands must load from symlinked skill directories | Inspired by Hermes `ff078738ea0108548fc9c147140942fbeab7c833`, `src\skills\loadSkillsDir.test.ts` verifies DuckHive discovers and loads a skill command from a symlinked `.claude\skills\<name>` directory while preserving the visible skill root. | Verified |
| Other harnesses must be tracked for feature pulls | Live upstream probes on 2026-05-18 confirm Codex `main` at `7ee7fe239f8bd2f478a30c369c2566004769a3da`, OpenClaw `main` at `b823a5a26626ee4637975cd923dfd12df063baf0`, OpenClaude `main` at `f71e7692373a61d28c82fc3fadff3feaa4071ede`, and Hermes Agent `main` at `609c485fc6d0a0c24a023cd1349ebd6ddbf60315`. DuckHive is no longer behind `Gitlawb/openclaude:main`; `main..openclaude/main` is empty. The latest OpenClaw delta set was reviewed as CI/docs/xAI OAuth sidecar/release-stability internals with no direct DuckHive runtime port identified; the Hermes deliverable-mode slice now covers Telegram uploads and terminal AgentRun artifact visibility. | Tracked |
| Windows TUI must be runnable | A local verified Go 1.25.4 toolchain built `tui\duckhive-tui.exe`; `duckhive tui --snapshot` renders the packaged Bubble Tea UI, and `duckhive tui --input-smoke "typed after go rebuild"` verifies the rebuilt packaged input loop through the real launcher. `node dist\cli.mjs runtime-doctor` and CLI smoke also cover `Terminal TUI - Ready`, `Terminal TUI input`, `duckhive tui --help`, snapshot, and input smoke through Node and Windows wrapper launch paths; current package dry-run includes `tui/duckhive-tui.exe` and TUI source files. | Verified binary and input readiness |
| TUI keymaps must be configurable like Codex-style terminal workflows | The Go TUI now loads action-key overrides from `DUCKHIVE_TUI_KEYMAP_PATH` and `DUCKHIVE_TUI_KEYMAP`, merges inline JSON over file JSON, warns on invalid entries while preserving defaults, and resolves remapped actions by binding instead of literal key string. Focused `tui/tui` tests cover custom model/shell/undo mappings, env/file merge precedence, unknown-action warnings, and the default `ctrl+p` model-picker path. | Verified |
| TUI backend slash commands must stay command-shaped | Argument-bearing backend commands such as `/goal Build the harness`, `/council Review this plan`, `/permissions profile list`, `/budget set minimax 5`, `/channel status telegram`, and `/computer-use tools` now dispatch through the bridge when connected, and fall back to local read-only cards when offline instead of being sent as normal chat. Focused Go tests cover bridged and offline routing, and the rebuilt packaged binary passes `duckhive tui --snapshot` plus `duckhive tui --input-smoke "backend command routing smoke"`. | Verified |
| TUI tests must be verified | Current 2026-05-18 evidence: downloaded the official Go 1.25.4 Windows amd64 archive from `go.dev/dl`, verified SHA256 `6dad204d42719795f22067553b2b042c0e710b32c5a00f6c67892865167fdfd0`, extracted it to `.tmp\go-toolchain`, and ran `cd tui && go test ./...` successfully across `tui`, `tui/cmd/duckhive-tui`, `tui/model/bridge`, and `tui/model/components`. | Verified |
| Harness state must be inspectable outside the TUI | `checkHarnessStateReadiness()` now adds a read-only `runtime-doctor` result for checkpoint count, budget state/log files, MCP, ACP, and permission readiness, with focused tests for current DuckHive config-home state and legacy OpenClaude checkpoint fallback. | Verified |
| Checkpoint browsing and mutation must be reachable from the default CLI | `duckhive checkpoint list`, `duckhive checkpoints save <name>`, `/checkpoint list`, `/checkpoint resume <name>`, and `duckhive checkpoint resume <name>` now run provider-free outside the interactive REPL. Top-level `duckhive --help` advertises `checkpoint|checkpoints`. Focused checks cover isolated config-home list/save/list/load/resume behavior, and CLI smoke rejects provider warnings plus non-interactive REPL guard output for top-level checkpoint paths and asserts default help visibility. | Verified |
| MemoryTool must use DuckHive-owned storage | `MemoryTool` stores memories under DuckHive config-home `memory/memories.json`; focused tests cover config-home path selection and remember/recall/search/stats/forget behavior. | Verified |
| Full repository test suite must be rerun after the latest prompt, branding, packaging, and TUI audit changes | Current 2026-05-18 evidence: `bun test` completed at `3369 pass`, `0 fail`, `8487 expect()` calls across 381 files after the Telegram 421 retry port, raw timeout signal guard, HybridOrchestrator AgentRunStore isolation fix, sponsored-tip default test alignment, GitHub setup branding, and agent-team prompt guidance coverage. | Verified |

## Current Green Gates

Latest continuation evidence from 2026-05-18:

- `npm run build`
- `npm run typecheck`
- `npm run smoke` (`CLI smoke passed (79 commands plus Windows wrapper checks)`)
- `npm run verify:privacy`
- `bun test` (`3369 pass`, `0 fail`, `8487 expect()` calls across 381 files)
- `duckhive --version`, `duckhive --yolo --version`, `duckhive --dangerously-skip-permissions --version`, and `node dist\cli.mjs --version` (`0.13.6 (DuckHive)`)
- `duckhive runtime-doctor` (PATH launcher, Windows data-event stdin, packaged TUI input smoke, ClawHub, connector controls, provider readiness, AI Council, harness command surfaces)
- `Get-Command duckhive` and `where.exe duckhive` (PowerShell/npm shims resolve on PATH)
- `duckhive goal --help` and `duckhive g --help`
- `duckhive computer-use status`
- `duckhive computer-use tools`, `duckhive cu tools`, and `duckhive comput-use tools`
- `duckhive channel status telegram`
- `duckhive skill search agent --limit 1`
- `duckhive skill inspect api-agent-rate-limiter-1-3-1`
- `node dist\cli.mjs --bare -p "/permissions profile list"`
- `node dist\cli.mjs --bare -p "/permissions profile safe --user"` with isolated `CLAUDE_CONFIG_DIR`
- `node dist\cli.mjs permissions profile list`
- `node dist\cli.mjs allowed-tools profile status`
- `node dist\cli.mjs checkpoint list` with isolated `CLAUDE_CONFIG_DIR`
- `duckhive tui --input-smoke "typed text"`
- `node dist\cli.mjs runtime-doctor`
- `bun test src\utils\agenticSessionSearch.test.ts`
- `bun test src\skills\loadSkillsDir.test.ts`
- `bun test scripts\postbuild-patch.test.ts`
- `bun test scripts\no-raw-abort-signal-timeout.test.ts scripts\system-check.test.ts src\orchestrator\hybrid\hybrid-orchestrator.test.ts`
- `bun test src\channels\TelegramAdapter.test.ts src\services\telegram\TelegramService.test.ts` (`27 pass`, with Telegram media placeholder coverage)
- `bun test src\services\telegram\TelegramService.test.ts` (`13 pass`)
- `bun test src\constants\promptIdentity.test.ts`
- `bun test src\entrypoints\providerStartupGate.test.ts src\commands\permissions\permission-profiles.test.ts`
- `bun test src\services\tips\sponsoredTips.test.ts src\services\tips\tipScheduler.test.ts`
- `bun test src\utils\openclaudeUiSurfaces.test.ts`
- `npm pack --dry-run --json`
- `node dist\cli.mjs --version` (`0.13.6 (DuckHive)`)
- `.tmp\go-toolchain\go\bin\go.exe version` (`go1.25.4 windows/amd64`)
- `cd tui && go test ./...` (local Go 1.25.4)
- `cd tui && go test ./...` after the configurable TUI keymap slice, including `tui/tui` keybinding override coverage
- `cd tui && go test ./...` after the TUI backend slash-command routing slice, including bridged and offline argument-bearing command coverage
- `duckhive tui --snapshot`
- `duckhive tui --input-smoke "typed after go rebuild"`
- `duckhive tui --input-smoke "backend command routing smoke"`
- `node --check src\services\council-server\council-api-server.cjs`
- `bun test src\memdir\bm25.test.ts src\memdir\fts5.test.ts src\tools\MemoryTool\MemoryTool.test.ts`

Historical broader gates from earlier audit passes:

- Earlier historical TUI pass used local Go 1.26.3 from `.tmp\go-toolchain`; the current verified TUI pass uses local Go 1.25.4.
- `bun test src\commands.test.ts scripts\system-check.test.ts`
- `bun test src\tools\BashTool\bashPermissions.test.ts src\tools\WebSearchTool\WebSearchTool.test.ts`
- `bun test src\commands.test.ts src\utils\processUserInput\processUserInput.test.ts src\utils\exportFormats.test.ts src\utils\exportRenderer.formats.test.ts src\entrypoints\providerStartupGate.test.ts`
- `bun test src\services\api\openaiShim.test.ts`
- `bun test src\test\sharedMutationLock.test.ts`
- `bun test tests\sdk\shared-utils.test.ts`
- `bun test src\integrations\compatibility.test.ts src\integrations\artifactGenerator.test.ts`
- `bun test src\commands\channel\channel-impl.test.ts`
- `bun test src\services\telegram\TelegramService.test.ts src\channels\TelegramAdapter.test.ts`
- `bun test src\commands\skill\skill-impl.test.ts`
- `bun test src\commands\router\router-impl.test.ts`
- `bun test src\commands\budget\budget-impl.test.ts`
- `bun test src\commands\cache\cache-impl.test.ts`
- `bun test src\commands\hive-team\team-impl.test.ts src\commands\hive-council\council-impl.test.ts src\commands\hive-orchestrate\orchestrate-impl.test.ts`
- `bun test src\commands\hive-swarm\swarm-impl.test.ts src\commands\hive-senate\senate-impl.test.ts src\commands\hive-decree\decree-impl.test.ts`
- `bun test src\cli\bg.test.ts`
- `bun test src\commands\run\run-impl.test.ts`
- `bun test src\commands\goal\goal.test.ts`
- `bun test src\commands\android\android-impl.test.ts src\commands\vision\vision-impl.test.ts src\commands\shadow\shadow-impl.test.ts`
- `bun test src\commands\android\android-impl.test.ts src\commands\vision\vision-impl.test.ts src\tools\MemoryTool\MemoryTool.test.ts`
- `bun test src\commands\loop\loop.test.ts`

## Open Work

- Test full `duckhive tui` keyboard interaction manually from a real interactive PowerShell terminal. Non-interactive `duckhive tui --snapshot` now renders one TUI frame and exits for CI/log verification, `duckhive tui --input-smoke "typed text"` verifies packaged Bubble Tea input-loop delivery through the launcher, `runtime-doctor` verifies binary readiness, and local Go 1.25.4 now verifies `cd tui && go test ./...`.
- Continue feature-by-feature upstream imports rather than merging upstream harnesses wholesale. DuckHive and OpenClaude histories are divergent, so release commits, branding changes, and unrelated upstream removals must be reviewed selectively.
- Keep importing upstream features as independent, verified slices. The current tested state is green, but the product goal remains open-ended until each new upstream slice has its own impact analysis, implementation, and verification.
