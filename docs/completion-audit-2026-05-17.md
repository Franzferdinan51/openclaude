# DuckHive Completion Audit - 2026-05-17

This audit maps the active product goal to concrete evidence in the current
checkout. It is intentionally strict: a passing verifier only counts when it
covers the named requirement.

## Success Criteria

| Requirement | Current evidence | Status |
| --- | --- | --- |
| Default Windows CLI must start without freezing and accept typing | `npm run smoke` passes `TextInput` buffered typing, Windows data-event stdin selection, and Ink stdin delivery tests; CLI smoke reports 51 commands plus Windows wrapper checks. | Verified |
| Prompt submission must not crash with `Cannot read properties of undefined (reading '_zod')` | Built-in tool-schema conversion regression was added in `src/utils/api.test.ts`; the prompt-schema fix was committed as `9ed65d9`. | Verified by focused regression in prior pass |
| `duckhive` command must resolve and report the DuckHive version | `node dist\cli.mjs runtime-doctor` reports `duckhive` on PATH targeting this checkout and version `0.13.0 (DuckHive)`. | Verified |
| Version metadata and README must match the release | `package.json` and README now report `0.13.0`; `npm pack --dry-run --json` publishes `duckhive@0.13.0`. | Verified |
| `/goal` must be present as a Codex-style workflow feature | CLI smoke covers top-level `goal` and bare-print `/goal Build smoke goal`; README documents REPL and top-level forms. | Verified surface |
| Computer-use must be reachable without blocking on Codex.app | Runtime doctor reports bundled `newest-desktop-control` available for desktop, Android, and compatibility aliases; package dry-run includes the skill files. | Verified fallback |
| ClawHub skill hub must be connected | Runtime doctor reports ClawHub registry default `https://clawhub.ai` and `/skill search`, `/skill inspect`, `/skill install` availability. | Verified surface |
| Telegram/channel connectors must be provider-free and inspectable | Runtime doctor reports connector CLI status commands for `connect status`, `telegram status`, and `channel status telegram`; README documents Telegram env and AgentRun controls. | Verified surface |
| OpenClaude upstream refresh must be handled safely | Live `git ls-remote` confirms OpenClaude `main` at `0fba1541a8647a805339811f6f2bac4b8d13b699`; DuckHive selectively ported safe runtime/TUI/search/security fixes in `4345bad`. | Verified |
| Other harnesses must be tracked for feature pulls | Live `git ls-remote` confirms Codex `main` at `e7bffc5a20e92cbc64d6c16a1b257d0b2e4cd5df`, OpenClaw `main` at `800a0d316636d426feb237476f3e006336f609db`, and Hermes Agent `main` at `f36c89cd5798da0f313192555739975e57ffdef5`. | Tracked |
| Windows TUI must be runnable | A local verified Go 1.26.3 toolchain built `tui\duckhive-tui.exe`; `node dist\cli.mjs runtime-doctor` now reports `Terminal TUI - Ready`. | Verified binary readiness |
| TUI tests must be verified | Local Go 1.26.3 ran `cd tui && go test ./...` successfully after fixing the stale header version and header wrap. | Verified |

## Current Green Gates

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `npm run verify:privacy`
- `node dist\cli.mjs runtime-doctor`
- `npm pack --dry-run --json`
- `cd tui && go test ./...` using local Go 1.26.3 from `.tmp\go-toolchain`
- `bun test src\tools\BashTool\bashPermissions.test.ts src\tools\WebSearchTool\WebSearchTool.test.ts`

## Open Work

- Test `duckhive tui` manually from a real interactive PowerShell terminal. Non-interactive `--help` style launches enter the TUI and time out by design, while `runtime-doctor` verifies binary readiness.
- Continue feature-by-feature upstream imports rather than merging upstream harnesses wholesale. DuckHive and OpenClaude histories are divergent, so release commits, branding changes, and unrelated upstream removals must be reviewed selectively.
- Re-run full `bun test` before declaring the whole product complete. The current pass verifies focused regressions, smoke, build, typecheck, privacy, runtime doctor, and package dry-run, but not the full test suite after the latest documentation audit.
