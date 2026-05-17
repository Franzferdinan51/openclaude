# DuckHive Harness Kanban

Last updated: 2026-05-16

This board tracks harness-wide capability merging, with the Go TUI as one delivery surface.

## Backlog

- Crush-style shell layout pass
- Codex/Gemini/Kimi provider UX unification
- OpenClaw/hermes-agent/NemoClaw orchestration primitives
- Checkpoint browser and resume flow
- Council execution view
- Multi-agent session view
- Media generation jobs
- Voice/channel/daemon controls
- Shared harness checkpoint/session APIs
- Shared budget/approval state
- Shared media job orchestration

## Ready

- Dedicated local model picker screen on top of the now-working bridge shortcut
- Shared harness session state extraction
- Shared bridge fallback rules for non-bridge launches
- CLI/help branding cleanup for remaining high-traffic commands
- Backend workstream mapping for Crush, Codex, Gemini CLI, Kimi CLI, OpenClaw, hermes-agent, and NemoClaw

## In Progress

- External repo intake mapped into DuckHive workstreams
- Session/status enrichment
- Provider and orchestration baseline stabilization
- README alignment with the OpenClaude base plus DuckHive shell direction

## Review

- Go TUI test/build verification
- Runtime verification for provider flags, council health, and slash orchestration commands
- Root README alignment once the unrelated README worktree diff is safely disentangled

## Done

- Initial scope capture for upstream feature merging
- Root model event flow
- Capability-first REPL layout
- Composer mode system
- Feature matrix covering Codex, Gemini CLI, Kimi CLI, OpenClaw, duck-cli, MiniMax Agent CLI, and mercury-agent
- Moonshot/Kimi auth baseline fix
- Council daemon and Hive bridge port alignment
- DuckHive agent teams enabled by default
- Top-level provider/install/help surface cleanup
- Default TUI rail toned down
- Bubble Tea session clock and bridge-fed API duration rail
- Bubble Tea Windows shell fallback and `SHELL` override correctness
- Bubble Tea shell interrupt handling
- Bubble Tea suspend/resume wiring
- Bubble Tea external editor support
- Bubble Tea composer undo support
- Bubble Tea `ctrl+p` bridge dispatch to the real `/model` backend command
