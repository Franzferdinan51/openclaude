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
| `duckhive` command must resolve and report the DuckHive version | 2026-05-18 live PowerShell evidence: `Get-Command duckhive` resolves through `C:\Users\franz\AppData\Roaming\npm\duckhive.ps1`; `duckhive --version`, `duckhive --yolo --version`, `duckhive --dangerously-skip-permissions --version`, and `node bin\duckhive --version` all report `0.13.2 (DuckHive)`; `duckhive runtime-doctor` reports the launcher on PATH targeting this checkout. | Verified |
| Version metadata and README must match the release | `package.json` and README now report `0.13.2`; current `npm pack --dry-run --json` publishes `duckhive@0.13.2`; CLI smoke checks `--version` and Windows wrapper version output against `package.json` instead of only checking for DuckHive branding. | Verified |
| Runtime diagnostics must not imply legacy OpenClaude/Anthropic defaults | `runtime-doctor` now mirrors DuckHive startup defaults by reporting MiniMax when no explicit provider env is active, while preserving Anthropic only for explicit DuckHive provider selection. | Verified |
| Codex-compatible HTTP surfaces must not leak OpenClaude attribution | Codex Responses requests, Codex web search, Codex usage reads, `/cache-probe`, and runtime-doctor Codex probes now share `CODEX_HTTP_ORIGINATOR = "duckhive"`; OAuth keeps its separate protocol-required Codex originator. Focused tests assert the DuckHive HTTP originator constant. | Verified |
| Quota/payment exhaustion must use configured fallback before failing | Inspired by Hermes auxiliary fallback safety nets, DuckHive now triggers `--fallback-model` on explicit 402/payment, credit, daily quota, and quota-exhausted 429 signals before showing the non-retryable quota guidance; focused `withRetry` tests cover configured fallback, no-fallback behavior, and generic 429 rate limits staying on the normal retry path. | Verified |
| Model routing command arguments must preserve user text safely | `/router` now preserves escaped quotes in task text, rejects unterminated quoted input before invoking model selection, and accepts separated option values such as `--complexity 8` and `--vision true`. | Verified |
| Budget mutation command arguments must fail safely | `/budget` now rejects unterminated quoted input before calling provider or global budget mutation functions; focused tests cover the no-mutation path. | Verified |
| Cache mutation command arguments must fail safely | `/cache` now rejects unterminated quoted input before clearing provider cache or session cache metrics; focused tests cover the no-mutation path. | Verified |
| `/goal` must be present as a Codex-style workflow feature | CLI smoke covers top-level `goal` and bare-print `/goal Build smoke goal`; focused tests cover REPL shorthand, escaped quotes in goals/steps, and unterminated quoted input rejecting before mutation; README documents REPL and top-level forms. | Verified |
| Background AgentRun controls must be inspectable from the terminal | `duckhive attach <run-id> [limit]` now prints run metadata, pending approvals, recent events, and exact control commands instead of a not-implemented placeholder; focused tests cover event tail and invalid limits. | Verified |
| REPL `/run` controls must parse recovery text safely | `/run recover` now preserves escaped quotes inside quoted summaries and rejects unterminated quoted arguments before mutating run state; focused tests cover both paths. | Verified |
| Computer-use must be reachable without blocking on Codex.app | Runtime doctor reports bundled `newest-desktop-control` available for desktop, Android, and compatibility aliases; current package dry-run includes the runtime `skills/newest-desktop-control/` files. | Verified fallback |
| Android and Vision command/tool arguments must preserve user text safely | `/android`, `/vision`, `AndroidTool`, and `VisionTool` now use Node's OS temp directory instead of Unix-only `/tmp` for screenshot pulls, with quoted local paths for Windows; slash commands also preserve escaped quotes and reject unterminated quoted input before running ADB actions; focused tests cover text, analyze, screenshot, tool paths, and no-exec rejection paths. | Verified |
| ClawHub skill hub must be connected | Runtime doctor reports ClawHub registry default `https://clawhub.ai` and `/skill search`, `/skill inspect`, `/skill install` availability. | Verified surface |
| ClawHub/local skill CLI arguments must preserve user text safely | `/skill` now preserves escaped quotes in local skill names and ClawHub search queries, and rejects unterminated quoted input before creating a skill or calling the registry. | Verified |
| Telegram/channel connectors must be provider-free and inspectable | Runtime doctor reports connector CLI status commands for `connect status`, `telegram status`, and `channel status telegram`; `/channel --help` now resolves to the adapter readiness snapshot instead of an unknown-action error; Telegram built-in command replies now use ASCII-safe list markers and run separators; README documents Telegram env and AgentRun controls. | Verified surface |
| Telegram long polling must not fail at the normal quiet-poll boundary | DuckHive ports the compatible OpenClaw `91266fa928` timeout-bounding fix: both the Telegram service and channel adapter keep a 45s HTTP abort window while the request body long-poll timeout stays below it; focused tests cover timeout resolution and emitted request bodies. | Verified |
| Telegram must recover from transient Bot API misdirected responses | DuckHive ports the compatible OpenClaw `63b728de43` HTTP 421/Misdirected Request retry behavior into both the Telegram service and channel adapter with a single fresh request retry; focused tests cover startup recovery, adapter send recovery, and no retry for unrelated HTTP 500 failures. | Verified |
| Telegram debug logs must not expose chat or bot identifiers | Inspired by OpenClaw `74949eda2f`, DuckHive now redacts Telegram chat IDs and bot usernames in debug lifecycle logs while preserving message routing internally; focused `TelegramService` tests verify the redacted logs do not contain private identifiers. | Verified |
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
| Provider-free print slash commands must not emit provider-auth warnings | The startup gate now skips provider profile validation for known local `-p "/command"` slash commands while keeping auth validation for normal print prompts; CLI smoke rejects saved-provider warnings for `/loop`, `/android`, `/vision`, `/shadow`, `/checkpoint`, `/router`, `/budget`, `/cache`, `/export`, `/spawn`, `/swarm`, `/senate`, and `/decree`. | Verified |
| Shared test mutation locks must fail instead of hanging indefinitely | `acquireSharedMutationLock` now applies a five-minute default timeout and reports scoped timeout errors; focused tests cover default timeout, override timeout, and release handoff. | Verified |
| SDK mutex tests must not mutate the process-global env mutex | The SDK shared mutex now exposes an isolated test-only mutex factory, and `tests\sdk\shared-utils.test.ts` exercises timeout behavior without resetting the global mutex used by other tests. | Verified |
| OpenGateway partner model catalog must be current | The `gitlawb-opengateway` preset now routes through `https://opengateway.gitlawb.com/v1`, maps to the OpenAI-compatible vendor, and exposes Gemini 3.1 Flash Lite Preview plus GLM 5.1 FP8 catalog entries. | Verified |
| Session search must stay local and provider-free | Inspired by Hermes `abf1af540193c30047ff3e7e759c330faf3a880f`, DuckHive's `agenticSessionSearch` now uses deterministic local scoring across tags, titles, branches, summaries, first prompts, and transcript excerpts instead of `sideQuery`; focused tests cover metadata ranking, quoted phrase transcript matching, and OR-style broad recall. | Verified |
| Other harnesses must be tracked for feature pulls | Live `git ls-remote` on 2026-05-18 confirms Codex `main` at `64ead6a83a6ed348229bc98a9b5d8b0c550d8305`, OpenClaw `main` at `2696f2576d3e9abac4678af871960b0fc1aceb90`, OpenClaude `main` at `f71e7692373a61d28c82fc3fadff3feaa4071ede`, and Hermes Agent `main` at `abf1af540193c30047ff3e7e759c330faf3a880f`. The newer OpenClaw session-target delta was reviewed and has no direct DuckHive gateway/session-store equivalent; the Hermes no-LLM session-search delta has been ported into DuckHive's resume/search path. | Tracked |
| Windows TUI must be runnable | A local verified Go 1.26.3 toolchain built `tui\duckhive-tui.exe`; `node dist\cli.mjs runtime-doctor` now reports `Terminal TUI - Ready` and `Terminal TUI input`; CLI smoke covers `duckhive tui --help`, provider-free `duckhive tui --snapshot`, and `duckhive tui --input-smoke` through both Node and Windows wrapper launch paths; current package dry-run includes `tui/duckhive-tui.exe` and TUI source files. | Verified binary and input readiness |
| TUI tests must be verified | Historical audit evidence recorded local Go 1.26.3 running `cd tui && go test ./...`; as of the 2026-05-18 continuation, neither `go` nor `.tmp\go-toolchain\go\bin\go.exe` is available in this shell, so the current verified gate is the packaged `duckhive tui --input-smoke` path through `npm run smoke` plus `runtime-doctor` terminal TUI readiness. | Verified packaged binary/input; Go retest blocked by missing toolchain |
| Harness state must be inspectable outside the TUI | `checkHarnessStateReadiness()` now adds a read-only `runtime-doctor` result for checkpoint count, budget state/log files, MCP, ACP, and permission readiness, with focused tests for current DuckHive config-home state and legacy OpenClaude checkpoint fallback. | Verified |
| MemoryTool must use DuckHive-owned storage | `MemoryTool` stores memories under DuckHive config-home `memory/memories.json`; focused tests cover config-home path selection and remember/recall/search/stats/forget behavior. | Verified |
| Full repository test suite must be rerun after the latest prompt, branding, packaging, and TUI audit changes | Current 2026-05-18 evidence: `bun test` completed at `3369 pass`, `0 fail`, `8487 expect()` calls across 381 files after the Telegram 421 retry port, raw timeout signal guard, HybridOrchestrator AgentRunStore isolation fix, sponsored-tip default test alignment, GitHub setup branding, and agent-team prompt guidance coverage. | Verified |

## Current Green Gates

Latest continuation evidence from 2026-05-18:

- `npm run typecheck`
- `npm run build`
- `npm run smoke` (`CLI smoke passed (67 commands plus Windows wrapper checks)`)
- `npm run verify:privacy`
- `bun test` (`3369 pass`, `0 fail`, `8487 expect()` calls across 381 files)
- `duckhive --version`, `duckhive --yolo --version`, and `duckhive --dangerously-skip-permissions --version` (`0.13.2 (DuckHive)`)
- `duckhive runtime-doctor` (PATH launcher, Windows data-event stdin, packaged TUI input smoke, ClawHub, connector controls, provider readiness, AI Council, harness command surfaces)
- `node dist\cli.mjs runtime-doctor`
- `bun test src\utils\agenticSessionSearch.test.ts`
- `bun test scripts\postbuild-patch.test.ts`
- `bun test scripts\no-raw-abort-signal-timeout.test.ts scripts\system-check.test.ts src\orchestrator\hybrid\hybrid-orchestrator.test.ts`
- `bun test src\channels\TelegramAdapter.test.ts src\services\telegram\TelegramService.test.ts` (`24 pass`)
- `bun test src\services\telegram\TelegramService.test.ts` (`13 pass`)
- `bun test src\constants\promptIdentity.test.ts`
- `bun test src\services\tips\sponsoredTips.test.ts src\services\tips\tipScheduler.test.ts`
- `bun test src\utils\openclaudeUiSurfaces.test.ts`
- `npm pack --dry-run --json`
- `node dist\cli.mjs --version` (`0.13.2 (DuckHive)`)
- `node --check src\services\council-server\council-api-server.cjs`
- `bun test src\memdir\bm25.test.ts src\memdir\fts5.test.ts src\tools\MemoryTool\MemoryTool.test.ts`

Historical broader gates from earlier audit passes:

- `cd tui && go test ./...` using local Go 1.26.3 from `.tmp\go-toolchain` (not available in the 2026-05-18 shell)
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

- Test full `duckhive tui` keyboard interaction manually from a real interactive PowerShell terminal. Non-interactive `duckhive tui --snapshot` now renders one TUI frame and exits for CI/log verification, `duckhive tui --input-smoke "typed text"` verifies packaged Bubble Tea input-loop delivery through the launcher, and `runtime-doctor` verifies binary readiness. Re-run `cd tui && go test ./...` when Go is available again; in the 2026-05-18 shell, `go` is not on PATH and `.tmp\go-toolchain\go\bin\go.exe` is absent.
- Continue feature-by-feature upstream imports rather than merging upstream harnesses wholesale. DuckHive and OpenClaude histories are divergent, so release commits, branding changes, and unrelated upstream removals must be reviewed selectively.
- Keep importing upstream features as independent, verified slices. The current tested state is green, but the product goal remains open-ended until each new upstream slice has its own impact analysis, implementation, and verification.
