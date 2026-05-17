# DuckHive Harness Todo

Last updated: 2026-05-16

This file started with the Go TUI work, but it now tracks harness-wide integration requirements as well.

## In Progress

- Turn the requested upstream repos into concrete DuckHive workstreams instead of repo-by-repo copy-paste.
- Shift imported feature work from TUI-only surfaces into shared harness layers first.
- Add interactive model-routing controls backed by shared provider state.
- Define the Crush-style shell pass so it improves the default `duckhive` UI without reintroducing noisy rails or status chrome.

## Next

- Move checkpoint, council, media, MCP, ACP, permission, and budget state into shared harness services that every client can consume.
- Add backend orchestration work from OpenClaw, hermes-agent, NemoClaw, duck-cli, and the AI Bot Council stack into reusable services and tools.
- Add a session/status layer for checkpoints, permissions, budgets, model routing, MCP, ACP, bridge health, and council health that works in TUI, REPL, and automation.
- Extend the current Kimi-style shell mode beyond local execution so session/task/approval state is shared with the rest of the harness.
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
