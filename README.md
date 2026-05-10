# 🦆 DuckHive

![DuckHive](https://img.shields.io/badge/DuckHive-v0.9.2-gold?style=for-the-badge&logo=buymeacoffee)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=for-the-badge&logo=typescript)](package.json)
[![Bun](https://img.shields.io/badge/Bun-1.3-yellow?style=for-the-badge&logo=bun)](package.json)

**The Mega AI Coding Harness** — Forked from [Gitlawb/openclaude](https://github.com/Gitlawb/openclaude) and extended with MiniMax M2.7, Agent Teams, AI Council, and full MiniMax CLI integration. Built with 3-layer memory (BM25 → embed → LESSONS), swarm voting, task planning, budget enforcement, and unified channel adapters.

[Features](#features) · [Quick Start](#getting-started) · [SDK](#duckhive-sdk) · [Agent Harness](#agent-harness-platform) · [DuckHive mmx](#duckhive-mmx) · [Agent Teams](#agent-teams) · [Memory Layers](#memory--intelligence) · [Architecture](#architecture) · [Comparison](#what-duckhive-adds-over-openclaude)

---

## Overview

DuckHive is an AI coding CLI built on top of [Gitlawb/openclaude](https://github.com/Gitlawb/openclaude). That OpenClaude codebase is the direct upstream base for this fork. OpenClaw is a separate harness project that influenced parts of the broader ecosystem, but DuckHive itself extends the OpenClaude line directly. On top of that base, DuckHive swaps the default model to **MiniMax M2.7**, adds **Agent Teams** for multi-agent orchestration, layers in **AI Council** for adversarial deliberation, and integrates full **MiniMax CLI (mmx)** support for image, speech, music, and video generation — all from a single `duckhive` command.

### Key Differentiators from OpenClaude

| OpenClaude ships | DuckHive adds |
|-----------------|---------------|
| Claude as default | **MiniMax M2.7** as default |
| Basic tool set | **24+ custom tools** including mmx, council, senate |
| Single-agent | **Sub-Agent spawning** with per-agent model routing |
| No deliberation layer | **AI Council** — 46 adversarial councilors |
| No MiniMax modalities | **Full mmx** — image, speech, music, video |
| No shell toggle | **Ctrl-X shell toggle** |
| No hierarchical context | **DUCK.md** context loading (gemini-cli style) |
| No project init | **init_tool** — auto-generates AGENTS.md + workspace setup |
| No session export | **/export** — zip sessions for sharing |
| No built-in council daemon | **Integrated Council daemon** — auto-starts on first run |
| Basic MCP | **dmcp** — enhanced MCP server management |
| Distribution | **npm global install** — one command setup |

---

## Features

### Experimental Bubble Tea TUI

DuckHive now includes an additive Go/Bubble Tea shell. Plain interactive `duckhive` auto-starts the Go TUI when `tui/duckhive-tui` is present, and `duckhive tui` remains available as an explicit launcher. Set `DUCKHIVE_NO_AUTO_TUI=1` if you want to stay in the legacy Ink REPL.

The TUI is only one surface of that work. The actual goal is to merge the useful parts of Codex, Gemini CLI, Kimi CLI, OpenClaw, duck-cli, MiniMax Agent CLI, and mercury-agent throughout the whole DuckHive harness: shared tools, orchestration, sessioning, model routing, permissions, media jobs, automation, and every major interaction surface.

The rule going forward is:

- land imported capabilities in shared harness layers first
- surface them in `duckhive`, the Go TUI, the legacy REPL, print/headless flows, and backend services second
- avoid TUI-only implementations for features that should exist across the product

Current TUI foundations:

- Welcome screen that highlights imported feature pillars
- Agent, Shell, Council, and Media composer modes
- Kimi-style `Ctrl-X` shell toggle inside the TUI
- Session rail for bridge state, checkpoints, context files, and imported capability status
- Transcript rail toggle and tracked TUI backlog files
- Quieter terminal-first styling with inspector/transcript rails kept opt-in

Harness capability tracking currently lives in:

- `tui/TODO.md`
- `tui/KANBAN.md`
- `tui/FEATURE_MATRIX.md`

Validation for the Go shell:

```bash
cd tui
go test ./...
```

### Getting Started

**Option 1 — npm install:**
```bash
npm install -g github:Franzferdinan51/DuckHive
# after publishing to npm:
# npm install -g duckhive

# OR clone and install locally
git clone https://github.com/Franzferdinan51/DuckHive.git
cd DuckHive && bun install && bun run build
```

**Option 2 — Direct run:**
```bash
./bin/duckhive
```

Interactive `duckhive` launches the Go TUI first. Use `DUCKHIVE_NO_AUTO_TUI=1 ./bin/duckhive` to stay in the legacy TypeScript REPL.

**After setup:**
```bash
# First-run: init_tool auto-analyzes your project and creates AGENTS.md
/init_tool action=setup

# Then just code
duckhive "Implement a REST API"
```

---

### Distribution

DuckHive is distributed as a `duckhive` launcher that boots the TypeScript agent core and, for interactive sessions, hands off to the checked-in Go TUI binary. DuckHive owns only the `duckhive` command; the `openclaude` command should remain installed from `@gitlawb/openclaude`.

| Method | Command |
|--------|---------|  
| npm from GitHub | `npm i -g github:Franzferdinan51/DuckHive` |
| npm after publish | `npm i -g duckhive` |
| Homebrew | `brew install franzferdinan51/tap/duckhive` |
| Git clone | `git clone && bun install && bun run build` |

The TypeScript agent core (`dist/cli.mjs`) is built via `bun run build` and runs under the Go CLI harness. All integrated services (council daemon on port 3007, MCP servers) are started on-demand.

### WebUI: Hybrid Agent Console

DuckHive ships a dedicated WebUI for a Codex-style workbench with OpenClaw-style operational visibility. The WebUI is backed by a DuckHive-owned API instead of depending on an OpenClaw dashboard process.

```bash
# Terminal 1: DuckHive WebUI API
DUCKHIVE_WEBUI_API_PORT=3017 bun run webui:api

# Terminal 2: React WebUI
cd webui
VITE_DUCKHIVE_API_BASE=http://localhost:3017 npm run dev
```

The WebUI API exposes health, status, agents, tools, MCP servers, sessions, AgentRun inspection, and run controls. It also streams run lifecycle events over Server-Sent Events at `/api/events`.

Useful endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | DuckHive WebUI API health/version |
| `GET /api/status` | provider, Telegram, desktop/Android, OpenClaw optional status |
| `GET /api/runs` | AgentRun list and root run tree |
| `GET /api/runs/:id/events` | compact run event tail |
| `POST /api/runs/:id/pause` | pause a run |
| `POST /api/runs/:id/resume` | resume a run |
| `POST /api/runs/:id/stop` | cancel a run |
| `POST /api/runs/:id/approve` | approve a pending run action |
| `POST /api/runs/:id/recover` | mark a run for recovery |

Optional OpenClaw visibility is configured with `OPENCLAW_GATEWAY_URL`; DuckHive still owns the provider/model/session/tool/channel policy and the `duckhive` command.

### DuckHive SDK

DuckHive exposes the OpenClaude SDKv2-compatible runtime at `duckhive/sdk`. The SDK entrypoint is intentionally separate from the CLI bundle and builds to `dist/sdk.mjs` so consumers can import session/query APIs without pulling in React, Ink, or TUI-only modules.

```ts
import { query } from 'duckhive/sdk'

for await (const message of query({
  prompt: 'Summarize this repository',
  options: { cwd: process.cwd() },
})) {
  console.log(message)
}
```

The SDK surface includes generated schemas/types, query/session helpers, permission helpers, transcript helpers, and SDK-specific errors. `bun run build` verifies that the SDK bundle has no React/Ink leakage.

### Agent Harness Platform

DuckHive now has an experimental shared AgentRun control plane. Local agent tasks and hybrid orchestration runs are mirrored into a durable run store with normalized lifecycle events:

```
queued → preparing → running → awaiting_approval → paused → recovering → completed|failed|cancelled
```

The split follows the same safety boundary used by modern agent harnesses: DuckHive core owns provider/model selection, auth, session and transcript mirroring, tool policy, permissions, budgets, and channel delivery. A harness only executes a prepared attempt and streams events back.

Public experimental harness import:

```ts
import {
  registerAgentHarness,
  resolveAgentHarness,
  type AgentHarness,
} from 'duckhive/harness'
```

Runtime selection:

```bash
DUCKHIVE_AGENT_RUNTIME=auto              # default: choose a matching harness
DUCKHIVE_AGENT_RUNTIME=builtin           # force DuckHive core execution
DUCKHIVE_AGENT_HARNESS_FALLBACK=builtin  # default fallback
DUCKHIVE_AGENT_HARNESS_FALLBACK=none     # fail if no harness supports the run
```

The AgentRun store persists under DuckHive's config home by default, or under `DUCKHIVE_AGENT_RUN_STORE_DIR` when set. Shared run-control operations now cover list/inspect/tail-style event access, pause, resume, stop/cancel, approval, and recovery so Telegram, TUI, SDK/headless, and future harness plugins can use one lifecycle instead of separate state paths. `duckhive/harness` is intentionally separate from `duckhive/sdk` and builds to `dist/harness.mjs`.

### Telegram Remote Control

Telegram can inspect and control AgentRuns when `DUCKHIVE_TELEGRAM_BOT_TOKEN` is set. For safety, set `DUCKHIVE_TELEGRAM_ALLOWED_CHAT_ID` to a comma-separated chat allowlist before using a bot in shared chats.

Supported run-control commands:

```text
/agents
/runs
/run <id>
/tail <id>
/pause <id>
/resume <id>
/stop <id>
/approve <id>
/status
```

Long Telegram responses are chunked, Markdown delivery falls back to plain text, and `bun run doctor:runtime` reports the Agent Harness and Telegram configuration state.

### /init — Project Setup

> **For non-interactive use (scripts, CI, --print mode): use `init_tool` below.**
> The built-in `/init` REPL command requires an interactive terminal.

**Interactive REPL mode:**
```bash
/init   # Launches the interactive setup wizard
```

**Non-interactive (scripts / CI / --print mode):**
```bash
/init_tool action=setup    # Auto-analyze + create AGENTS.md, SOUL.md, TOOLS.md
/init_tool action=detect   # Preview what would be created
/init_tool action=config   # Configure ~/.duckhive/config.json
```

### /export — Session Packaging

Zip up a DuckHive session for sharing or archival. Includes context files, history, and config.

```bash
/export                        # Export current session
/export list                   # Show saved exports
/export import session.zip    # Restore a session
```

### /goal — Persisted Workflow Goals

Track multi-step tasks across sessions with persisted goals. Inspired by Codex `/goal` (r0.128.0). Goals survive restarts and can be resumed later.

```bash
/goal create Build user authentication system    # Create a new goal
/goal list                                          # List all goals
/goal list active                                   # Filter by status
/goal status goal_abc123                            # Show goal details
/goal pause goal_abc123                            # Pause a goal
/goal resume goal_abc123                           # Resume paused goal
/goal complete goal_abc123                         # Mark as done
/goal step add goal_abc123 Implement login API     # Add a step
/goal clear goal_abc123                             # Delete a goal
```

Goals persist in `~/.duckhive/config.json` and survive across sessions.

### Sub-Agent Spawning with Model Routing

Spawn specialized sub-agents with automatic model selection based on task type. Each sub-agent gets the optimal model from the router.

```bash
# Spawn a coding sub-agent (routes to GPT-4o or best available)
/subagent spawn coding "Implement a REST API"

# Spawn with explicit model
/subagent spawn --model qwen3.6-35b "Analyze this code"

# Route a task by complexity
/router route "build a Flutter app" complexity=7 vision=true
```

### Integrated Council Daemon

AI Council deliberation is auto-started on first run. No separate install — the daemon forks automatically and stays alive between runs.

```bash
/council "Should we use microservices?" mode=adversarial
/team spawn analysis "Research Redis caching"
/senate show DECREE-001
```

---

### MiniMax M2.7 — Default Model

DuckHive boots with **MiniMax M2.7** as the default model, shown right in the startup banner. MiniMax M2.7 is a powerful reasoning and coding model that handles complex agentic tasks efficiently. The Hybrid Orchestrator routes tasks intelligently:

- **Complexity 1–3**: Fast path, direct execution
- **Complexity 4–6**: Best model routing + optional council
- **Complexity 7–10**: Full deliberation with AI Council

---

### DuckHive mmx — All MiniMax Modalities

DuckHive mmx gives you the full MiniMax CLI stack directly from the harness. Generate images, synthesize speech, create music, and produce video without leaving the CLI.

```bash
# Generate images
duckhive mmx image "A cyberpunk cat"
duckhive mmx image "A serene mountain lake at dawn" --aspect 16:9

# Text-to-speech
duckhive mmx speech synthesize --text "Hello from DuckHive" --out hello.mp3
duckhive mmx speech synthesize --text "System online" --voice narrator --out alert.mp3

# Music generation
duckhive mmx music generate --prompt "Upbeat electronic, driving beat" --out track.mp3
duckhive mmx music generate --prompt "Sad piano ballad" --lyrics "Verse 1: Lost in the rain..." --out ballad.mp3

# Video generation
duckhive mmx video "A drone flying through redwood trees"
```

---

### Ctrl-X Shell Toggle

Drop from AI mode into a real shell and return seamlessly — no second terminal needed.

```bash
# Inside duckhive
duckhive> Ctrl-X   # → drops to shell
$ ls -la
$ exit            # → returns to duckhive AI mode
```

Inspired by Kimi CLI's shell mode, built into the harness for zero-friction context switching.

---

### DUCK.md Context Loading

DuckHive loads hierarchical context from `DUCK.md` files (gemini-cli style), merging project context into every session. Place a `DUCK.md` in your project root:

```markdown
# My Project Context

## Project
- Name: MyApp
- Stack: Bun + TypeScript + Hono

## Key Files
- src/index.ts — entry point
- src/routes/ — API routes

## Commands
- bun run dev — start dev server
- bun run test — run tests
```

DuckHive automatically finds and loads the nearest `DUCK.md` up the directory tree, prepending it to every prompt.

---

### Desktop And Android Control

DuckHive ships the bundled `newest-desktop-control` MCP gateway in `skills/newest-desktop-control`. It consolidates cross-platform desktop automation, Android ADB control, and Codex Computer Use detection behind one MCP surface. The older `desktop_control` tool and `/desktop` command remain available for the legacy Python/OpenClaw workflow, but new agent integrations should prefer the MCP gateway because it exposes stable tool names and compatibility aliases.

**Setup (one-time):**
```bash
python3 -m pip install pyautogui pillow
adb devices -l   # optional, for Android devices/emulators
```

**MCP config:**
```json
{
  "newest-desktop-control": {
    "command": "node",
    "args": ["${SKILL_DIR}/newest-desktop-control/src/server.js"]
  }
}
```

**Desktop MCP tools:**
```
mcp__newest-desktop-control__desktop_screenshot
mcp__newest-desktop-control__desktop_mouse_move
mcp__newest-desktop-control__desktop_mouse_click
mcp__newest-desktop-control__desktop_mouse_scroll
mcp__newest-desktop-control__desktop_keyboard_type
mcp__newest-desktop-control__desktop_keyboard_press
mcp__newest-desktop-control__desktop_keyboard_hotkey
mcp__newest-desktop-control__desktop_clipboard_read
mcp__newest-desktop-control__desktop_clipboard_write
mcp__newest-desktop-control__desktop_get_screen_size
mcp__newest-desktop-control__desktop_get_pixel_color
mcp__newest-desktop-control__desktop_window_list
mcp__newest-desktop-control__desktop_window_activate
mcp__newest-desktop-control__desktop_launch_app
mcp__newest-desktop-control__desktop_terminal
mcp__newest-desktop-control__desktop_file_read
mcp__newest-desktop-control__desktop_file_write
```

**Android MCP tools:**
```
mcp__newest-desktop-control__android_devices
mcp__newest-desktop-control__android_screenshot
mcp__newest-desktop-control__android_screen_size
mcp__newest-desktop-control__android_current_activity
mcp__newest-desktop-control__android_tap
mcp__newest-desktop-control__android_swipe
mcp__newest-desktop-control__android_text
mcp__newest-desktop-control__android_key
mcp__newest-desktop-control__android_launch_app
mcp__newest-desktop-control__android_ui_dump
mcp__newest-desktop-control__android_logcat
```

**Diagnostics and aliases:**
```
mcp__newest-desktop-control__backend_status
mcp__newest-desktop-control__permissions_check
mcp__newest-desktop-control__codex_mcp_config

# Legacy aliases are preserved by the gateway:
screenshot, mouse_click, keyboard, terminal, file_read, run_script,
computer_use_screenshot, computer_use_mouse_click, computer_use_keyboard
```

Desktop mouse/keyboard/app actions may require Accessibility and Screen Recording permissions on macOS. Android actions require Developer Options plus USB debugging or an emulator. Codex Computer Use is detected through supported Codex app integration points; DuckHive does not patch or bypass proprietary Codex binaries.

---

### DuckHive Android — Run on Android via Termux

DuckHive runs natively on Android using Termux + glibc-runner. Based on [openclaw-android](https://github.com/AidanPark/openclaw-android).

**Quick Install (in Termux):**
```bash
curl -sL https://raw.githubusercontent.com/Franzferdinan51/DuckHive/main/scripts/duckhive-android/install.sh | bash
```

**Commands:**
```bash
dh update                           # Update DuckHive
dh backup                           # Backup config and skills
dh android screenshot               # Take device screenshot
dh android tap 500 500              # Tap screen coordinates
dh android swipe 100 500 300 500    # Swipe gesture
dh android text "hello"             # Input text
dh onboard                          # Initial setup
dh status                           # Show status
```

**Requirements:**
- Android with [Termux](https://f-droid.org/en/packages/com.termux/) (F-Droid recommended)
- ~200MB storage footprint

---

### BrowserOS MCP — Full Desktop Browser Automation

DuckHive integrates [BrowserOS](https://github.com/browseros-ai/BrowserOS) for full desktop browser automation via Chrome DevTools Protocol. BrowserOS MCP is pre-configured in `config/mcporter.json` and available to DuckHive's MCP tools.

**Requirements:** BrowserOS.app must be running. Start it with:
```bash
open -a BrowserOS
```

**Via DuckHive MCP tools (`/mcp`):**
```
/mcp list           — list available MCP servers and tools
/mcp call browseros.new_page url="https://github.com"
/mcp call browseros.take_snapshot
/mcp call browseros.get_page_content
```

**Via mcporter CLI (standalone):**
```bash
mcporter list                          — list servers
mcporter list browseros --schema       — show BrowserOS tool docs
mcporter call browseros.new_page url="https://example.com"
mcporter call browseros.screenshot     — capture current page
mcporter call browseros.take_snapshot   — interactive element tree
mcporter call browseros.click element=42
```

**Available BrowserOS tools (66 total):**
- Navigation: `new_page`, `navigate`, `get_url`, `get_page_content`
- Interaction: `click`, `type`, `key`, `hover`, `select`, `evaluate`
- Screenshot: `screenshot`, `take_snapshot`, `take_full_page_screenshot`
- Tabs: `new_tab`, `close_tab`, `list_tabs`, `switch_tab`
- Downloads: `download_start`, `download_list`, `download_cancel`
- Clipboard: `copy`, `paste`

**Configured at:** `~/.mcporter/mcporter.json` and `config/mcporter.json`

---

### Agent Teams

Spawn multi-agent crews that work in parallel on complex tasks. DuckHive integrates Agent Teams for structured delegation.

```bash
# Inside duckhive
/council "Should we use microservices here?"       # 46 councilors debate
/team researcher "Research Redis caching"          # Spawn researcher agent
/senate "Proposal: switch to Bun runtime"         # 94 senators vote
/decree "DECREE-007: Use Bun for all new APIs"    # Issue binding law
/orchestrate "Build a REST API"                  # Route by complexity
```

**Governance pipeline**: Council debates → Senate passes decree → Teams execute per decree.

> **Integrated Council daemon** — On first `duckhive` run, the AI Council daemon starts automatically on port 3007 and stays alive between invocations. No separate install needed.

---

### /swarm — Code Swarming

Code swarming launches parallel sub-agents across 17 specialized domains to tackle complex tasks from multiple angles simultaneously.

```bash
/swarm "Build a REST API" --domain=coding --count=4
/swarm "Audit this security vulnerability" --domain=security
/swarm "Research new ML techniques" --domain=research
/swarm --list          # Show all 17 available domain agents
/swarm --list-domain   # List domain agent capabilities
/swarm --dry-run       # Preview what would spawn
```

**Domain agents include:** coding, code-review, security, debugging, architecture, testing, devops, research, analysis, docs, optimization, refactor, backend, frontend, mobile, infrastructure, data

### Swarm Voting — Multi-Agent Response Routing

When multiple agents respond, DuckHive routes the best response through three strategies:

```bash
/swarm vote           # Peer voting — agents score each other's work
/swarm merge          # Merge — combine complementary responses
/swarm pick-best      # Pick — score by completeness + correctness + code quality
```

**Strategies:**
- `vote()` — agents rate peers, highest score wins (LLM-based peer scoring)
- `merge()` — combine responses, deduplicate overlapping sections
- `pickBest()` — heuristic scoring: completeness (40%), correctness (30%), code quality (30%)

Integrates with existing `teammateMailbox.ts` — no new agent spawning mechanism needed.

---

### /acp — ACP Server for IDE Integration

Start the Agent Client Protocol server for IDE integration (Kimi CLI style).

```bash
/acp                    # Start ACP server
/acp status            # Check server status
/acp stop              # Stop server
```

---

### /spawn — Subagent Spawning

Spawn a subagent teammate to handle a task in parallel (Hermes Agent style).

```bash
/spawn "Implement a REST API"
/spawn "Analyze this code" --label=reviewer
```

---

### /introspect — DUCK.md Influence Analysis

Analyze how DUCK.md context files are influencing the current session (Gemini CLI style).

```bash
/introspect             # Analyze current session influence
/context load          # Reload context files
/context scan          # Scan for DUCK.md files in scope
```

---

### /prompt-suggest — Prompt Engineering Analysis

Analyze and suggest improvements to your prompts (Gemini CLI style).

```bash
/prompt-suggest "my complex prompt here"
```

---

### /instruct — DUCK.md Tuning Assistant

Helps you write and refine DUCK.md context files (Gemini CLI style).

```bash
/instruct "add a section about testing conventions"
```

---

### /changelog — Parse CHANGELOG from PR

Extract and format changelog entries from PR bodies or git commits.

```bash
/changelog                    # Parse current PR
/changelog 123               # Parse specific PR
/changelog --all              # Show all commits
/changelog --tag=v0.7.0      # Show commits since tag
```

Requires PR body format:
```markdown
<!-- CHANGELOG:START -->...<!-- CHANGELOG:END -->
```

---

### /pr-size — PR Size Classification

Classify the size of a pull request (XS→XL).

```bash
/pr-size                    # Current PR
/pr-size 123               # Specific PR
```

Output: `XS` (trivial), `S` (small), `M` (medium), `L` (large), `XL` (massive)

---

### Session Search — Full-Text Search Across Sessions

Search past sessions using FTS5 (SQLite full-text search).

```bash
# Via /memory or context tools
/memory search "authentication bug"
/session search "REST API implementation"
```

---

### Skill Workshop — Auto-Capture Complex Tasks

Automatically captures complex tasks as reusable skills for future sessions.

```bash
/skill "my new skill"        # Create from current task
/skill --capture            # Auto-capture mode
/skills                     # List all skills
```

---

### MCP Server Management

Manage Model Context Protocol servers with the `dmcp` CLI.

```bash
duckhive dmcp list          # List installed MCP servers
duckhive dmcp add <server>  # Add an MCP server
duckhive dmcp remove <name> # Remove an MCP server
duckhive dmcp health        # Check MCP server health
```

---

### Memory & Intelligence — 3-Layer Recall System

DuckHive layers three memory systems for progressively smarter recall:

```
Query → BM25 (keyword, fast) → EmbedRecall (semantic) → LESSONS (permanent failure moat)
```

**BM25 Keyword Search** (`src/memdir/bm25.ts`) — From-scratch BM25, no external deps:
- Inverted index over all session files, stored in `~/.duckhive/bm25-index.json`
- Tokenize: lowercase, strip punctuation, split on whitespace
- BM25 formula: k1=1.5, b=0.75
- `buildIndex()`, `search(query, limit?)`, `updateIndex()`, `clearIndex()`

**Embed Recall** (`src/memdir/embedRecall.ts`) — Semantic/conceptual search:
- Primary: LM Studio `/v1/embeddings` if `LM_STUDIO_URL` is set
- Fallback: TF-IDF cosine similarity (no external calls, runs locally)
- 82 stopwords filtered, IDF rebuilt on every index update
- `indexDocument()`, `search()`, `clearIndex()`, `indexSessionContent()`

**LESSONS.md** (`src/memdir/lessons.ts`) — Permanent failure moat:
- Append-only log of every provider failure, tool error, API limit, and infra mistake
- Never compacted, never deleted — the permanent record of what doesn't work
- `recordLesson()`, `getLessonsForTask(query)`, `recordProviderFailure()`, `recordToolError()`
- Auto-deduplication: 80% word overlap threshold prevents recording the same failure twice
- Pre-flight check: `getLessonsForTask()` called at session start before repeating past approaches
- Location: `<memdir>/LESSONS.md`, tags: `provider-failure`, `tool-error`, `api-limit`, `infra`, `code-pattern`, `permission`, `security`

### Task Planner — Structured Decomposition

DuckHive plans complex tasks before executing, with two planner strategies:

```bash
# Auto-selects based on task complexity
/plan "Build a REST API with auth"

# Force LLM planner for complex tasks
/plan --llm "Architect a microservices system"
```

**SimplePlanner** — Fast keyword heuristics, dependency ordering, per-step complexity scoring.

**LLMPlanner** — Full reasoning for complex tasks (complexity ≥7), JSON plan output, falls back to SimplePlanner on parse errors.

### Budget Tracker — Daily Spend Enforcement

Tracks spend per provider daily and auto-falls back when budgets are exhausted:

```bash
/budget                 # Show current spend and remaining
/budget set minimax 5.00  # Set $5/day limit on minimax
/budget reset          # Reset all spend counters
```

State: `~/.duckhive/budget-state.json` · Log: `~/.duckhive/budget-log.jsonl` · Fail-open (never blocks API calls).

### Provider Cache — 30s Response Cache

Cache LLM responses for 30 seconds to skip redundant API calls:

```bash
/cache                  # Show cache stats (hits, misses, size)
/cache clear           # Flush entire cache
```

Keyed by `model::baseUrl::SHA256(messages)`, LRU eviction at 1000 entries. TTL configurable via `PROVIDER_CACHE_TTL=30`.

### Custom Providers — OpenAI-Compatible Endpoints

Add any OpenAI-compatible API without code changes:

```bash
/provider add my-endpoint --base-url https://api.example.com --api-key sk-xxx --model chat
/provider list            # Show all custom providers
/provider remove my-endpoint
```

Config: `~/.duckhive/custom-providers.json` · Auto health-checks endpoints on add.

First-class OpenAI-compatible presets are available through `/provider` and `--provider`, including OpenRouter and NVIDIA NIM:

```bash
duckhive --provider openrouter --model openrouter/auto
duckhive --provider nvidia-nim --model nvidia/llama-3.1-nemotron-70b-instruct
```

Use `OPENROUTER_API_KEY` for OpenRouter and `NVIDIA_API_KEY` for NVIDIA NIM. DuckHive maps them onto the OpenAI-compatible runtime for the active session without requiring you to overwrite `OPENAI_API_KEY`.

### Channel Adapters — Unified Messaging

DuckHive unifies messaging across channels through a shared interface — the agent loop doesn't know or care which channel it's talking to:

```bash
/channel list           # Show all registered adapters
/channel status telegram  # Check Telegram adapter health
/channel send telegram "Hello"  # Send via Telegram
```

Adapters: **TelegramAdapter** · **WebhookAdapter** (HTTP receiver) · **EmailAdapter** (IMAP/SMTP) · **ConsoleAdapter** (local TUI/REPL for debugging). All normalize to DuckHive's `Message` type.

Telegram supports `DUCKHIVE_TELEGRAM_BOT_TOKEN` or `TELEGRAM_BOT_TOKEN`. The long-polling path is hardened to keep polling after quiet `getUpdates` responses, bound Bot API calls with a timeout, and preserve later valid updates when earlier updates in a batch are filtered.

### Custom Tools

DuckHive adds 40+ custom tools on top of the OpenClaude base:

| Tool | Command | Description |
|------|---------|-------------|
| **HiveCouncilTool** | `/council` | 46 AI councilors debate decisions |
| **HiveSenateTool** | `/senate` | 94 senators pass binding decrees |
| **HiveTeamTool** | `/team` | Spawn specialized multi-agent crews |
| **HiveDecreeTool** | `/decree` | Issue and enforce binding laws |
| **HiveOrchestrateTool** | `/orchestrate` | Smart complexity-based routing with parallel agent execution |
| **HiveSwarmTool** | `/swarm` | Code swarming — 17 domain agents in parallel |
| **SwarmVotingTool** | `/swarm vote\|merge\|pick-best` | Multi-agent response routing |
| **ConnectTool** | `/connect` | Connect Telegram bots and external services |
| **MultiModelRouterTool** | `/router` | Route across 9+ providers |
| **ShadowGitTool** | `/shadow` | Git snapshots before changes (Gemini CLI style) |
| **CheckpointTool** | `/checkpoint` | Save and restore long AI sessions |
| **ContextTool** | `/context` | Hierarchical DUCK.md loading |
| **TaskPlannerTool** | `/plan` | Structured task decomposition (heuristic or LLM) |
| **AndroidTool** | `/android` | Full Android control via ADB |
| **VisionTool** | `/vision` | Phone screenshot + AI analysis |
| **MemoryTool** | `/memory` | Long-term remember/recall |
| **LessonsTool** | `/lessons` | Permanent failure moat — provider/tool error log |
| **BM25Tool** | `/bm25` | Keyword search across all sessions |
| **EmbedRecallTool** | `/embed` | Semantic search across memory |
| **KAIROSTool** | `/kairos` | Proactive heartbeat daemon |
| **MeshTool** | `/mesh` | Agent mesh networking |
| **SkillTool** | `/skill` | Runtime skill creation |
| **SkillManageTool** | `/skills` | Create, edit, and manage skills |
| **SessionSearchTool** | — | FTS5 full-text search across past sessions |
| **CronRunTool** | `/cron` | Manually trigger scheduled cron jobs |
| **BudgetTrackerTool** | `/budget` | Daily spend enforcement with auto-fallback |
| **ProviderCacheTool** | `/cache` | 30s response cache for provider calls |
| **CustomProvidersTool** | `/provider add\|list\|remove` | OpenAI-compatible endpoint config |
| **ChannelAdapterTool** | `/channel` | Unified messaging — Telegram/Webhook/Email/Console |
| **SecretScannerTool** | — | Detect secrets before writing to memory |
| **SSRFValidationTool** | — | DNS-based URL validation for SSRF protection |
| **TrustedFoldersTool** | `/trusted-folders` | Folder-level security boundaries |
| **ShellModeTool** | `/shell-mode` | Ctrl-X AI↔shell toggle |
| **SwapTool** | `/swap` | AI/shell mode switching |
| **MCPManageTool** | `/mcp` | MCP server management |
| **ConfirmTool** | `/confirm` | Gum-style interactive prompts |
| **StatusBarTool** | `/statusbar` | Bubble Tea status bar rendering |
| **StreamTool** | `/stream` | Spinners, progress bars, thinking indicators |
| **REPLPanelTool** | `/panel` | Bubble Tea table/panel rendering |
| **DeskDevTool** | `/deskdev` | Desktop development mode |
| **ACPCommand** | `/acp` | ACP server for IDE integration (Kimi CLI style) |
| **SpawnCommand** | `/spawn` | Spawn a subagent teammate (Hermes Agent style) |
| **InspectCommand** | `/introspect` | Analyze DUCK.md influence on current session |
| **PromptSuggestCommand** | `/prompt-suggest` | Prompt engineering analysis (Gemini CLI style) |
| **InstructCommand** | `/instruct` | DUCK.md tuning assistant (Gemini CLI style) |
| **ChangelogCommand** | `/changelog` | Parse CHANGELOG entries from PR body |
| **PrSizeCommand** | `/pr-size` | PR size classification (XS→XL) |

---

## Architecture

```
DuckHive v0.9.2
├── MiniMax M2.7 (default model)
├── DuckHive mmx (MiniMax CLI integration)
│   ├── Image generation
│   ├── Speech synthesis
│   ├── Music generation
│   └── Video generation
├── Agent Teams (multi-agent orchestration)
│   ├── /council   — 46 adversarial councilors
│   ├── /senate    — 94 senators, binding decrees
│   ├── /team      — spawn by role (researcher, coder, reviewer...)
│   ├── /swarm     — 17 domain agents in parallel (code-swarm)
│   ├── /decree    — binding laws enforced across agents
│   └── Swarm Voting — vote / merge / pick-best response routing
├── 3-Layer Memory & Intelligence
│   ├── BM25 (keyword) — inverted index, ~/.duckhive/bm25-index.json
│   ├── Embed Recall (semantic) — TF-IDF or LM Studio embeddings
│   └── LESSONS.md (permanent) — append-only failure moat, never deleted
├── Task Planner — SimplePlanner (heuristic) + LLMPlanner (complexity ≥7)
├── Budget Tracker — daily spend enforcement, ~/.duckhive/budget-state.json
├── Provider Cache — 30s LRU response cache, ~/.duckhive/provider-cache/
├── Custom Providers — OpenAI-compatible endpoint config
├── Channel Adapters — Telegram / Webhook / Email / Console
├── AI Council (46 councilors)
├── Hybrid Orchestrator
│   ├── Task Complexity Classifier (1–10)
│   ├── Model Router (MiniMax M2.7, Kimi K2.5, Gemma 4, more)
│   ├── Parallel Agent Execution (auto-spawn on complex tasks)
│   └── Fallback Chain (retry → fallback → never fail)
├── Auto-Compact (CONTEXT_COLLAPSE=true, auto-shrinks context)
├── MCP support (dmcp CLI)
├── Ctrl-X shell toggle
├── DUCK.md hierarchical context
└── 40+ Custom Tools
```

---

## What DuckHive Adds Over OpenClaude

| Feature | OpenClaude | DuckHive |
|---------|-----------|---------|
| **Default Model** | Claude | MiniMax M2.7 ✅ |
| **MiniMax mmx** | ❌ | ✅ Image / Speech / Music / Video |
| **Code Swarming** | ❌ | ✅ /swarm — 17 domain agents in parallel |
| **Agent Teams** | ❌ | ✅ Spawn multi-agent crews |
| **AI Council** | ❌ | ✅ 46 adversarial councilors |
| **Senate** | ❌ | ✅ 94 senators, binding decrees |
| **Ctrl-X Shell Toggle** | ❌ | ✅ Seamless AI↔shell |
| **DUCK.md Context** | ❌ | ✅ Hierarchical gemini-cli style |
| **Auto-Compact** | ❌ | ✅ CONTEXT_COLLAPSE=true auto-shrinks |
| **Session Search** | ❌ | ✅ FTS5 full-text search across sessions |
| **Skill Workshop** | ❌ | ✅ Auto-capture complex tasks as skills |
| **MCP CLI** | Basic | dmcp (enhanced) |
| **Governance** | ❌ | ✅ Council → Senate → Decree pipeline |
| **Shadow Git** | ❌ | ✅ Pre-change git snapshots |
| **Checkpoints** | ❌ | ✅ Session save/restore |
| **Bubble Tea TUI** | ❌ | ✅ Rich terminal rendering |
| **Multi-Model Router** | ❌ | ✅ 9+ provider routing |
| **Android Control** | ❌ | ✅ Full ADB integration |
| **KAIROS Daemon** | ❌ | ✅ Proactive heartbeat |
| **IDE Integration** | ❌ | ✅ /acp ACP server |
| **PR/Changelog Tools** | ❌ | ✅ /changelog, /pr-size, /introspect |
| **Secret Scanner** | ❌ | ✅ Detect secrets before memory writes |
| **SSRF Protection** | ❌ | ✅ DNS-based URL validation |
| **BM25 Keyword Search** | ❌ | ✅ Full-text session search, no deps |
| **Embed Recall** | ❌ | ✅ Semantic search (TF-IDF or LM Studio) |
| **LESSONS.md** | ❌ | ✅ Permanent failure moat, never deleted |
| **Task Planner** | ❌ | ✅ Heuristic + LLM task decomposition |
| **Budget Tracker** | ❌ | ✅ Daily spend enforcement + auto-fallback |
| **Provider Cache** | ❌ | ✅ 30s LRU response cache for all providers |
| **Custom Providers** | ❌ | ✅ OpenAI-compatible endpoint config |
| **Channel Adapters** | ❌ | ✅ Telegram / Webhook / Email / Console |
| **Swarm Voting** | ❌ | ✅ vote / merge / pick-best response routing |

---

## Installation

### Prerequisites

- **Bun** 1.3+ (for build/test)
- **Node.js** 22+ (runtime)
- **Git**

### Build from Source

```bash
git clone https://github.com/Franzferdinan51/DuckHive.git
cd DuckHive
bun install
bun run build
```

### Run

```bash
./bin/duckhive
```

For convenience, add `bin/` to your PATH or symlink:

```bash
ln -s "$(pwd)/bin/duckhive" ~/.local/bin/duckhive
```

---

## Configuration

DuckHive inherits the OpenClaude configuration model, while also carrying some compatibility paths from the upstream fork history. Set up your environment:

```bash
# MiniMax API key (required for default model + mmx)
export MINIMAX_API_KEY=sk-your-key-here

# Optional: other providers
export KIMI_API_KEY=sk-kimi-...
export OPENAI_API_KEY=sk-...
export OPENROUTER_API_KEY=sk-or-...
export LMSTUDIO_URL=http://localhost:1234

# Optional: configure default model
export DUCK_CHAT_MODEL=MiniMax-M2.7
```

See `~/.openclaude/`, project `.openclaude/`, and `~/.duckhive/config.json` for the current configuration surfaces carried by this fork.

### Meta-Agent Configuration

Configure meta-agent models, features, and limits in `~/.duckhive/config.json`:

```bash
# Initialize default config
duckhive config init

# View current config
duckhive config show

# Find config file path
duckhive config path
```

**Config schema:**

```json
{
  "meta": {
    "enabled": true,              // enable/disable meta-agent orchestration
    "complexityThreshold": 4,      // complexity level that triggers meta-agent (1-10)
    "models": {
      "orchestrator": "auto",     // model for task routing (auto, minimax/MiniMax-M2.7, etc.)
      "fast": "auto",              // model for simple tasks (complexity 1-3)
      "standard": "auto",           // model for medium tasks (complexity 4-6)
      "complex": "auto",           // model for complex tasks (complexity 7-10)
      "android": "auto",           // model for Android control tasks
      "vision": "auto",            // model for vision/screenshot analysis
      "coding": "auto"             // model for code generation tasks
    },
    "features": {
      "councilEnabled": true,      // enable AI Council deliberation
      "fallbackEnabled": true,     // enable automatic model fallback
      "selfHealing": true,         // enable self-healing on failures
      "learning": true              // enable learning from feedback
    },
    "limits": {
      "maxConcurrent": 3,          // max parallel sub-agents
      "maxRetries": 3,             // max retry attempts per task
      "timeoutMs": 60000           // default task timeout in ms
    }
  },
  "providers": {
    "default": "minimax",          // default provider (minimax, kimi, openai, lmstudio)
    "fallback": "openrouter"       // fallback provider
  }
}
```

**Model alias examples:**
- `"auto"` — use DuckHive's default routing
- `"minimax/MiniMax-M2.7"` — specific provider/model
- `"kimi/kimi-k2.5"` — Kimi vision model
- `"local/qwen3.5-9b"` — local via LM Studio
- `"free"` — OpenRouter free tier

---

## Usage

```bash
# Start interactive session
./bin/duckhive

# Single command
./bin/duckhive -- "Explain this codebase"

# With specific provider
./bin/duckhive -- --provider minimax --model MiniMax-M2.7

# Version
./bin/duckhive --version

# Command ownership check
duckhive --version      # 0.9.2 (DuckHive)
openclaude --version    # upstream OpenClaude, if installed separately
```

---

## Verification

Current shipping/runtime gates:

```bash
bun test
bun run build
bun run verify:privacy
bun run smoke
bun run doctor:runtime
cd tui && go test ./...
```

Recent verification snapshot:

- `bun test`: `2415 pass`, `0 fail`
- `bun run build`, `bun run smoke`, `bun run verify:privacy`, and `bun run doctor:runtime`: passing
- `cd tui && go test ./...`: passing
- `duckhive --version`: `0.9.2 (DuckHive)`
- `openclaude --version`: upstream OpenClaude remains separately owned when installed
- package dry-run includes `config/`, `duckhive/sdk`, `duckhive/harness`, and `skills/newest-desktop-control/`

Known debt: `bun run typecheck` is still a repo-wide hardening task. The current pass has already added missing transport/OAuth/optional-integration type surfaces, but remaining errors are broad pre-existing TypeScript debt in dormant optional modules, legacy command surfaces, ACP/bridge paths, telemetry, and older UI/test typing. Runtime build, tests, SDK bundle checks, privacy verification, smoke, doctor, and TUI Go tests are the current green gates.

---

## DuckHive mmx Quick Reference

```bash
duckhive mmx image "prompt" [--aspect 1:1|16:9|9:16]  # Generate image
duckhive mmx speech synthesize --text "..." --out file.mp3  # TTS
duckhive mmx music generate --prompt "..." --out track.mp3  # Music
duckhive mmx video "prompt"  # Video generation
```

---

## License

MIT License — see [LICENSE](LICENSE) file.

---

*Forked from [Gitlawb/openclaude](https://github.com/Gitlawb/openclaude) · Powered by [MiniMax](https://www.minimax.io/) · DuckHive DNA*

---

## Known Issues & Troubleshooting

### Yolo Mode (`--yolo` flag)
Yolo mode is ONLY available as an in-app command, NOT as a CLI flag:
```bash
# Inside duckhive REPL, type:
/yolo on   # enable
/yolo off  # disable
/yolo      # toggle
```

### OpenClaw Integration
DuckHive has built-in OpenClaw commands (from openclaude upstream):
- `/openclaw-status` - Check OpenClaw gateway status
- `/openclaw-restart` - Restart OpenClaw gateway

These are HELP commands to manage OpenClaw, not conflicts. OpenClaw and DuckHive are SEPARATE:
- `openclaw` - OpenClaw gateway/agent (standalone)
- `duckhive` - DuckHive AI coding harness

### Timer in TUI
The Go TUI (`duckhive-tui`) doesn't display session elapsed time in the UI.
The time IS tracked in the bridge layer - the display connection needs work.
Use the legacy Ink REPL for duration display after tasks.

### Terminal Freezes During Heavy Tasks
The SerialBatchEventUploader has a blocking queue. During heavy tool use,
the queue fills and `enqueue()` blocks the Node.js event loop.
Workarounds: split tasks, reduce concurrent calls, use `/yolo on`.

### Building from Source
```bash
cd ~/Desktop/DuckHive-git
bun run build
# Rebuilds dist/cli.mjs from TypeScript source
```

---

## ⚠️ IMPORTANT: OpenClaw vs OpenClaude (2026-05-09)

DuckHive is based on **OpenClaude** (https://github.com/Gitlawb/openclaude), NOT OpenClaw.

| Project | URL | Role in DuckHive |
|---------|-----|------------------|
| **OpenClaude** | https://github.com/Gitlawb/openclaude | DIRECT UPSTREAM - DuckHive is forked from this |
| **OpenClaw** | https://github.com/openclaw/openclaw | SEPARATE project - DuckHive can interact with it via built-in commands |
| **DuckHive** | https://github.com/Franzferdinan51/DuckHive | Ryan's fork with MiniMax/MMX/Agent Teams |

### Built-in Commands for OpenClaw Gateway
These commands let DuckHive check/manage the **OpenClaw gateway** running separately:
- `/openclaw-status` - Check OpenClaw gateway status (must be running at localhost:18789)
- `/openclaw-restart` - Restart OpenClaw gateway

These are HELPER commands to manage OpenClaw, NOT DuckHive's upstream.

### Common Confusion
- Type `duckhive` → starts DuckHive (based on OpenClaude)
- Type `openclaw` → starts OpenClaw gateway (separate process)

They CAN run together - DuckHive uses OpenClaw commands as helpers, but they are completely separate programs.
