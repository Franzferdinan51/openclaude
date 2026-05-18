# DuckHive Harness Todo

Last updated: 2026-05-18

This file started with the Go TUI work, but it now tracks harness-wide integration requirements as well.

## In Progress

- Turn the requested upstream repos into concrete DuckHive workstreams instead of repo-by-repo copy-paste.
- Shift imported feature work from TUI-only surfaces into shared harness layers first.
- Keep interactive model-routing controls aligned with the shared `/model` and `/provider` state.
- Continue Crush-style shell polish without making no-args Windows startup depend on the experimental renderer.

## Next

- Extend the existing shared checkpoint, council, MCP, ACP, permission, budget, AgentRun, and artifact status surfaces with mutation flows that stay owned by the backend slash commands.
- Add backend orchestration work from OpenClaw, hermes-agent, NemoClaw, duck-cli, and the AI Bot Council stack into reusable services and tools.
- Keep the session/status layer for checkpoints, permissions, budgets, model routing, MCP, ACP, bridge health, and council health consistent across TUI, REPL, runtime-doctor, and automation.
- Extend the current Kimi-style shell mode beyond local execution so session/task/approval state can be controlled through the shared AgentRun store.
- Rework the TUI into a more Crush-like shell layout without forcing transcript/session rails on by default.

## Later

- Make the local model picker mutate shared provider state safely, but keep `/models` and `/provider` authoritative.
- Add checkpoint browsing and resume flows across TUI, slash commands, and print mode.
- Add multi-agent and council execution views with task state plus shared orchestration APIs.
- Add media workflow panels for image, video, speech, music, and search jobs on top of shared media job primitives.
- Add voice, daemon, and channel controls inspired by OpenClaw, hermes-agent, NemoClaw, and mercury-agent.
- Add Kanban-backed progress counters and richer task tracking in the rail.

## Done

- Stabilized the Bubble Tea root model so window sizing, input submission, and backend bridge events work.
- Replaced the old stacked REPL with a capability-first shell layout.
- Added explicit composer modes for agent, shell, council, and media workflows.
- Added additive repo-local tracking files for the TUI scope.
- Fixed Moonshot/Kimi auth resolution so provider-specific keys do not lose to stale `OPENAI_API_KEY` values.
- Unified the council daemon and Hive bridge around the active DuckHive port so council/orchestrate commands hit a live backend.
- Enabled agent team surfaces in DuckHive by default instead of leaving them behind the old external gating.
- Cleaned the top-level CLI help/install/provider surfaces to reflect DuckHive and the current provider set.
- Reduced default Go TUI chrome by making the inspector rail opt-in and simplifying the idle status line.
- Added a live session elapsed clock plus bridge-fed API duration display to the Bubble Tea header/status rail.
- Fixed Windows shell-mode fallback and `SHELL` override handling for the Bubble Tea local shell path.
- Treated shell interrupts as clean cancellations instead of generic failures in the Bubble Tea shell path.
- Wired native Bubble Tea suspend/resume instead of leaving Ctrl+Z as placeholder status text.
- Added real external-editor round-trip support for `ctrl+x ctrl+e`, including temp-file cleanup and Windows quoted editor paths.
- Added composer undo for typed input, canceled input, history replacement, and external-editor apply.
- Wired `ctrl+p` to the real backend `/model` command when a bridge is live, with an honest local model-picker fallback when offline.
- Added a local Bubble Tea model-picker panel with fast/coding/reasoning/vision presets, provider details, backend command guidance, and escape/ctrl+d return behavior.
- Added a local read-only harness-state card for checkpoints, budgets, MCP, ACP, and permissions so offline TUI sessions can inspect readiness while backend commands remain authoritative for mutation.
- Surfaced Codex-style `/goal` status in the Bubble Tea command deck, command rail, and bridged/local fallback cards.
- Hardened legacy Go TUI prompt and streaming markers to ASCII-safe output so Windows terminals and log captures do not show mojibake.
- Added `duckhive tui --input-smoke` so the packaged Bubble Tea input loop is verified through the real launcher path without depending on the Python PTY helper.
- Added Codex-style configurable TUI keymap overrides through `DUCKHIVE_TUI_KEYMAP_PATH` and `DUCKHIVE_TUI_KEYMAP`, and fixed the documented `ctrl+p` model-picker binding in the Go TUI key resolver.
