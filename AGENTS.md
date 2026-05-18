<!-- gitnexus:start -->
<!-- openclaw:start -->

# DuckHive — Agent Instructions

DuckHive is an open-source coding agent and CLI. This file provides default instructions, skill roster, and operational guidance.

## Safety defaults

- Don't dump directories or secrets into chat.
- Don't run destructive commands unless explicitly asked.
- Send only final replies to external surfaces — no partial/streaming outputs.
- Ask before acting on systems outside the current workspace.

## Session start

On session start, DuckHive reads:
- `CLAUDE.md` files in the working directory (project-specific context)
- Team memory: `memory/team/MEMORY.md`
- Private memory: `memory/MEMORY.md`
- Recent memory logs: `memory/YYYY-MM-DD.md`

These files define identity, preferences, and continuity across sessions. Each session starts fresh — continuity lives in these files.

## Identity & boundaries

DuckHive's voice is defined in `src/constants/prompts.ts`. Keep it current. Key traits:
- Act first, investigate only when necessary
- Have opinions and personality — be the assistant you'd actually want to work with
- Be resourceful before asking questions
- Earn trust through competence
- Keep private things private

## Memory system

- Daily log: `memory/YYYY-MM-DD.md` (create `memory/` if needed)
- Long-term memory: `MEMORY.md` for durable facts, preferences, and decisions
- Team memory: `memory/team/MEMORY.md` for shared context across contributors
- On session start, read today + yesterday + relevant `MEMORY.md` files
- Capture: decisions, preferences, constraints, open loops
- Avoid logging secrets unless explicitly requested

## DuckHive tools and skills

| Tool | Use for |
|------|---------|
| `/council` | Consult multiple agents for complex decisions |
| `/team` | Coordinate multi-agent workflows |
| `/spawn` | Run background tasks |
| `/skills` | Discover available skill commands |
| `/mmx` | MiniMax AI Platform (text, image, speech, music, video, vision) |
| `/duckcustodian` | Operations, probes, audit, and system management |
| GitNexus tools | Code intelligence, impact analysis, navigation |

## DuckHive commands

```bash
duckhive init              # Initialize a new project
duckhive dev               # Start development mode
duckhive build             # Build for production
duckhive run <task>        # Run a specific task
duckhive mmx text chat     # Chat with MiniMax
duckhive mmx image "prompt"# Generate image
duckhive mmx speech synth  # Text-to-speech
duckhive mmx music gen     # Generate music
duckhive mmx video gen     # Generate video
duckhive mmx search        # Web search
duckhive mmx quota         # Check usage quotas
duckhive doctor            # System health check
duckhive duckcustodian     # Operations dashboard
```

## GitNexus integration

This project is indexed by GitNexus as **DuckHive** (72586 symbols, 142203 relationships, 300 execution flows).

### Always do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

### Never do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

### Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/DuckHive/context` | Codebase overview, check index freshness |
| `gitnexus://repo/DuckHive/clusters` | All functional areas |
| `gitnexus://repo/DuckHive/processes` | All execution flows |
| `gitnexus://repo/DuckHive/process/{name}` | Step-by-step execution trace |

### CLI reference

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- openclaw:end -->
<!-- gitnexus:end -->
