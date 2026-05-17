# DuckHive Completion Audit - 2026-05-17

This audit maps the active product goal to concrete evidence in the current
checkout. It is intentionally strict: a passing verifier only counts when it
covers the named requirement.

## Success Criteria

| Requirement | Current evidence | Status |
| --- | --- | --- |
| Default Windows CLI must start without freezing and accept typing | `npm run smoke` passes `TextInput` buffered typing, Windows data-event stdin selection, Ink stdin delivery tests, and 55 CLI smoke cases plus Windows wrapper checks. | Verified |
| Prompt submission must not crash with `Cannot read properties of undefined (reading '_zod')` | Built-in tool-schema conversion regression was added in `src/utils/api.test.ts`; the prompt-schema fix was committed as `9ed65d9`. | Verified by focused regression in prior pass |
| `duckhive` command must resolve and report the DuckHive version | `node dist\cli.mjs runtime-doctor` reports `duckhive` on PATH targeting this checkout and version `0.13.0 (DuckHive)`. | Verified |
| Version metadata and README must match the release | `package.json` and README now report `0.13.0`; `npm pack --dry-run --json` publishes `duckhive@0.13.0`. | Verified |
| Runtime diagnostics must not imply legacy OpenClaude/Anthropic defaults | `runtime-doctor` now mirrors DuckHive startup defaults by reporting MiniMax when no explicit provider env is active, while preserving Anthropic only for explicit DuckHive provider selection. | Verified |
| Model routing command arguments must preserve user text safely | `/router` now preserves escaped quotes in task text, rejects unterminated quoted input before invoking model selection, and accepts separated option values such as `--complexity 8` and `--vision true`. | Verified |
| Budget mutation command arguments must fail safely | `/budget` now rejects unterminated quoted input before calling provider or global budget mutation functions; focused tests cover the no-mutation path. | Verified |
| Cache mutation command arguments must fail safely | `/cache` now rejects unterminated quoted input before clearing provider cache or session cache metrics; focused tests cover the no-mutation path. | Verified |
| `/goal` must be present as a Codex-style workflow feature | CLI smoke covers top-level `goal` and bare-print `/goal Build smoke goal`; focused tests cover REPL shorthand, escaped quotes in goals/steps, and unterminated quoted input rejecting before mutation; README documents REPL and top-level forms. | Verified |
| Background AgentRun controls must be inspectable from the terminal | `duckhive attach <run-id> [limit]` now prints run metadata, pending approvals, recent events, and exact control commands instead of a not-implemented placeholder; focused tests cover event tail and invalid limits. | Verified |
| REPL `/run` controls must parse recovery text safely | `/run recover` now preserves escaped quotes inside quoted summaries and rejects unterminated quoted arguments before mutating run state; focused tests cover both paths. | Verified |
| Computer-use must be reachable without blocking on Codex.app | Runtime doctor reports bundled `newest-desktop-control` available for desktop, Android, and compatibility aliases; package dry-run includes the skill files. | Verified fallback |
| Android and Vision command arguments must preserve user text safely | `/android` and `/vision` now preserve escaped quotes and reject unterminated quoted input before running ADB actions; focused tests cover text, analyze, and no-exec rejection paths. | Verified |
| ClawHub skill hub must be connected | Runtime doctor reports ClawHub registry default `https://clawhub.ai` and `/skill search`, `/skill inspect`, `/skill install` availability. | Verified surface |
| ClawHub/local skill CLI arguments must preserve user text safely | `/skill` now preserves escaped quotes in local skill names and ClawHub search queries, and rejects unterminated quoted input before creating a skill or calling the registry. | Verified |
| Telegram/channel connectors must be provider-free and inspectable | Runtime doctor reports connector CLI status commands for `connect status`, `telegram status`, and `channel status telegram`; README documents Telegram env and AgentRun controls. | Verified surface |
| Channel message commands must preserve user text safely | `/channel` now parses quoted arguments with escaped quotes and rejects unterminated quoted strings instead of silently sending malformed messages; focused tests cover console send and Telegram rejection. | Verified |
| Agent Teams and AI Council CLI arguments must preserve user text safely | `/team`, `/council`, `/orchestrate`, `/swarm`, `/senate`, and `/decree` now preserve escaped quotes, reject unterminated quoted input before spawning/starting/executing/issuing, and accept separated flag values where applicable. | Verified |
| OpenClaude upstream refresh must be handled safely | Live `git ls-remote` confirms OpenClaude `main` at `0fba1541a8647a805339811f6f2bac4b8d13b699`; DuckHive selectively ported safe runtime/TUI/search/security fixes in `4345bad`. | Verified |
| OpenClaude conversation export formats must be available without a wholesale merge | `/export` now supports text, Markdown, and JSON via filename inference or `--format`/`-f`; focused tests cover argument parsing and Markdown/JSON rendering. | Verified |
| Gemini/OpenGateway tool calls must remain executable | The OpenAI-compatible shim converts Gemini `Tool calls requested:` raw-text fallbacks back into `tool_use` blocks for streaming and non-streaming responses; focused `openaiShim` regressions cover Write and Agent raw-tool forms. | Verified |
| Shadow Git command arguments must fail safely | `/shadow` now preserves escaped quotes in checkpoint messages and rejects unterminated quoted input before creating checkpoints or restoring files. | Verified |
| Scheduled loop command must match documented behavior and fail safely | `/loop status` now works as documented, creation accepts separated option values, invalid options reject before storing loops, lifecycle commands reject ambiguous partial IDs, and all command splitters under `src\commands` have been moved off the old regex splitter. | Verified |
| Built-in terminal commands must not be shadowed by bundled prompt skills | Command loading now filters external skill/plugin/workflow name collisions against built-in commands, so the bundled `loop` skill no longer shadows the local `/loop` command; CLI smoke covers provider-free `/loop help`. | Verified |
| Provider-free print slash commands must not emit provider-auth warnings | The startup gate now skips provider profile validation for known local `-p "/command"` slash commands while keeping auth validation for normal print prompts; CLI smoke rejects saved-provider warnings for `/loop`, `/android`, `/vision`, and `/shadow`. | Verified |
| Shared test mutation locks must fail instead of hanging indefinitely | `acquireSharedMutationLock` now applies a five-minute default timeout and reports scoped timeout errors; focused tests cover default timeout, override timeout, and release handoff. | Verified |
| SDK mutex tests must not mutate the process-global env mutex | The SDK shared mutex now exposes an isolated test-only mutex factory, and `tests\sdk\shared-utils.test.ts` exercises timeout behavior without resetting the global mutex used by other tests. | Verified |
| OpenGateway partner model catalog must be current | The `gitlawb-opengateway` preset now routes through `https://opengateway.gitlawb.com/v1`, maps to the OpenAI-compatible vendor, and exposes Gemini 3.1 Flash Lite Preview plus GLM 5.1 FP8 catalog entries. | Verified |
| Other harnesses must be tracked for feature pulls | Live `git ls-remote` confirms Codex `main` at `e7bffc5a20e92cbc64d6c16a1b257d0b2e4cd5df`, OpenClaw `main` at `800a0d316636d426feb237476f3e006336f609db`, and Hermes Agent `main` at `f36c89cd5798da0f313192555739975e57ffdef5`. | Tracked |
| Windows TUI must be runnable | A local verified Go 1.26.3 toolchain built `tui\duckhive-tui.exe`; `node dist\cli.mjs runtime-doctor` now reports `Terminal TUI - Ready`. | Verified binary readiness |
| TUI tests must be verified | Local Go 1.26.3 ran `cd tui && go test ./...` successfully after fixing the stale header version and header wrap. | Verified |
| Full repository test suite must be rerun after the latest packaging/TUI audit changes | `bun test` now reports `3226 pass`, `0 fail`, `8002 expect()` calls across 368 files. | Verified |

## Current Green Gates

- `npm run typecheck`
- `bun test`
- `npm run build`
- `npm run smoke`
- `npm run verify:privacy`
- `node dist\cli.mjs runtime-doctor`
- `npm pack --dry-run --json`
- `cd tui && go test ./...` using local Go 1.26.3 from `.tmp\go-toolchain`
- `bun test src\commands.test.ts scripts\system-check.test.ts`
- `bun test src\tools\BashTool\bashPermissions.test.ts src\tools\WebSearchTool\WebSearchTool.test.ts`
- `bun test src\utils\exportFormats.test.ts src\utils\exportRenderer.formats.test.ts`
- `bun test src\services\api\openaiShim.test.ts`
- `bun test src\test\sharedMutationLock.test.ts`
- `bun test tests\sdk\shared-utils.test.ts`
- `bun test src\integrations\compatibility.test.ts src\integrations\artifactGenerator.test.ts`
- `bun test src\commands\channel\channel-impl.test.ts`
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
- `bun test src\commands\loop\loop.test.ts`

## Open Work

- Test `duckhive tui` manually from a real interactive PowerShell terminal. Non-interactive `--help` style launches enter the TUI and time out by design, while `runtime-doctor` verifies binary readiness.
- Continue feature-by-feature upstream imports rather than merging upstream harnesses wholesale. DuckHive and OpenClaude histories are divergent, so release commits, branding changes, and unrelated upstream removals must be reviewed selectively.
- Keep importing upstream features as independent, verified slices. The current tested state is green, but the product goal remains open-ended until each new upstream slice has its own impact analysis, implementation, and verification.
