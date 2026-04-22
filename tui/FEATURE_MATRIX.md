# DuckHive TUI Feature Matrix

Last updated: 2026-04-22

This matrix tracks the TUI surfaces we want to absorb from the upstream CLI products the project is drawing from. It is intentionally additive: the goal is to expose more of DuckHive's existing backend, not to remove current behavior.

## Upstream Baseline

| Source | Key traits to absorb | DuckHive backend status | TUI status |
| --- | --- | --- | --- |
| Codex | local coding loop, repo instructions, desktop/editor surface | AGENTS-based onboarding already exists; codex provider support exists in repo | planned rail + session surfacing |
| Gemini CLI | checkpointing, context files, scripting/headless posture, trusted workspace feel | checkpoint manager exists; session recovery exists | planned session card + resume surfaces |
| Kimi CLI | shell mode, ACP bridge, MCP management, IDE adjacency | ACP bridge exists; MCP stack exists | shell mode in progress |
| OpenClaw | multi-agent routing, voice, channel surfaces, live workspace concepts | voice + ACP/MCP + remote/channel foundations exist | planned orchestration and voice surfaces |
| duck-cli | AI council, mesh networking, proactive orchestration, Android/phone workflows | hybrid router, council heuristics, android/vision routing exist | planned council/orchestration surfaces |
| MiniMax Agent CLI | text/image/video/speech/music/search/vision workflows | MiniMax routing exists; multimodal provider support exists in repo | planned media mode + jobs panel |
| mercury-agent | permission hardening, budgets, daemon posture, soul/persona files, multi-channel access | permission flows, analytics budgets, channel/daemon concepts partially exist | planned status/budget/permissions surfaces |

## Current Build Order

1. Fix the TUI foundation so it actually behaves like a shell.
2. Expose the imported capability pillars in the welcome screen and right rail.
3. Add mode-aware composition for agent, shell, council, and media.
4. Layer in deeper workflows: checkpoints, model routing, orchestration, media jobs, voice, and channels.
