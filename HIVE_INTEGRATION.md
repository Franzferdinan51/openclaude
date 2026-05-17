# Hive Nation Integration - DuckHive

**Status:** Core CLI bridge integrated; runtime remains separately launched.
**Default Council API:** `http://localhost:3007`

DuckHive integrates multi-agent governance through the Hive Nation / Council
runtime. The DuckHive side owns the CLI, REPL, TUI, and tool surfaces; the
Council service supplies live councilors, deliberation modes, decrees, and team
state when it is running.

## Command Surfaces

| Command | Purpose |
| --- | --- |
| `/council [question]` / `duckhive council ...` | Ask the AI Council or inspect modes/councilors |
| `/senate list` / `duckhive senate ...` | Inspect and issue Senate decrees |
| `/decree [title]\|[content]` / `duckhive decree ...` | Shorthand decree creation |
| `/team list` / `duckhive team ...` | List, inspect, and spawn agent teams |
| `/orchestrate [task]` / `duckhive orchestrate ...` | Run multi-agent orchestration with council context |
| `/swarm [task]` / `duckhive swarm ...` | Run swarm-style teammate voting |

Related harness surfaces such as `/goal`, `/run`, `/spawn`, `/computer-use`,
`/skill`, Telegram run control, and the Go TUI use the same terminal-first
DuckHive command model rather than depending on a WebUI.

## Current Architecture

```text
DuckHive TypeScript CLI / REPL / TUI
  |
  |-- src/services/hive-bridge/
  |     |-- hive-bridge.ts        API client and response normalization
  |     |-- hive-types.ts         shared Council/Team/Decree types
  |
  |-- src/commands/
  |     |-- hive-council/         /council and duckhive council
  |     |-- hive-senate/          /senate and duckhive senate
  |     |-- hive-team/            /team and duckhive team
  |     |-- hive-decree/          /decree and duckhive decree
  |     |-- hive-orchestrate/     /orchestrate and duckhive orchestrate
  |     |-- hive-swarm/           /swarm and duckhive swarm
  |
  |-- src/services/council-server/council-api-server.cjs
        Local source-checkout Council runtime, port 3007 by default
```

The bridge resolves its runtime URL in this order:

1. `DUCKHIVE_COUNCIL_URL`
2. `HIVE_API_BASE`
3. `http://localhost:${COUNCIL_PORT || 3007}`

## Local Setup

From this source checkout:

```bash
bun install
bun run build
bun run council:serve
```

Then, from another terminal:

```bash
duckhive council --status
duckhive council --modes
duckhive council --councilors
duckhive team list
duckhive senate list
```

If the Council service is offline, the governance commands fail gracefully and
print the same recovery guidance:

```text
Start the local runtime with `bun run council:serve` or point DuckHive at a
running service with `DUCKHIVE_COUNCIL_URL`.
```

## Environment

```bash
DUCKHIVE_COUNCIL_URL=http://localhost:3007
COUNCIL_PORT=3007
DUCKHIVE_COUNCIL_ENABLED=true
DUCKHIVE_COUNCIL_THRESHOLD=3
```

`HIVE_API_BASE` remains accepted as a compatibility alias for older local
setups, but new DuckHive instructions should prefer `DUCKHIVE_COUNCIL_URL`.

## API Contract

DuckHive expects the Council runtime to expose these endpoints:

| Endpoint | Used By |
| --- | --- |
| `GET /api/health` | runtime health and context readiness |
| `GET /api/councilors` | `/council --councilors` and context rendering |
| `GET /api/council/modes` | `/council --modes` with local fallback modes |
| `POST /api/council/deliberate` | starting deliberations |
| `POST /api/council/ask` | asking the council for advisory context |
| `GET /api/council/current` | current deliberation status |
| `GET /api/council/messages` | deliberation transcript |
| `POST /api/decree` | decree creation |
| `GET /api/decree/active` | active decree listing |
| `GET /api/decree/:id` | single decree inspection |
| `POST /api/team/spawn` | team creation |
| `GET /api/team/active` | active team listing |
| `GET /api/team/templates` | team template listing |

The bridge normalizes both the checked-in Council server shape and compatible
Agent-Teams / AI-Bot-Council-Concensus response shapes. The misspelled upstream
mode name `concensus` is accepted and mapped to `consensus`.

## Verification

Use these focused checks after changing this integration:

```bash
bun test src/services/hive-bridge/hive-bridge.test.ts
bun test src/commands/hive-nation-commands.test.ts
bun test src/commands/hive-council/council-impl.test.ts
bun test src/commands/hive-team/team-impl.test.ts
bun test src/commands/hive-senate/senate-impl.test.ts
bun test src/commands/hive-decree/decree-impl.test.ts
duckhive runtime-doctor
```

`duckhive runtime-doctor` checks the terminal harness surfaces and reports
whether Telegram, ClawHub, computer-use fallback, provider routing, and the
Windows-safe CLI input path are ready. It does not auto-start the Council
runtime; start `bun run council:serve` separately when testing live governance.

## Remaining Work

- Embed live council deliberation events more deeply into long-running task
  pipelines.
- Add richer TUI council chamber views once the Go/Bubble Tea shell is available
  on the host.
- Expand decree enforcement from advisory output into selected tool-policy
  gates.
- Keep Agent-Teams and AI-Bot-Council-Concensus compatibility covered by focused
  bridge tests before copying any new upstream API shape.
