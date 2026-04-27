# DuckCustodian — DuckHive Self-Repair & Configuration Helper

**Based on:** OpenClaw Crestodian pattern, adapted for DuckHive
**Location:** `src/crestodian/` + `src/commands/duckcustodian/`

---

## What It Does

DuckCustodian is DuckHive's built-in self-repair and configuration helper — the "AI doctor" that keeps DuckHive running. It's inspired by OpenClaw's Crestodian and integrates natively with DuckHive's existing memory layers (LESSONS.md, embedRecall).

### Core Capabilities

1. **Deterministic Command Parser** — no LLM needed for routing. Typed operations map directly to actions.
2. **Health Probes** — checks mmx, LM Studio, OpenClaw gateway, Git, Node availability
3. **Config Validation** — reads DuckHive's global config, reports errors
4. **Typed Operations** — 15 operations: status, health, doctor, doctor-fix, mmx-status, lmstudio-status, models, audit, memory-stats, memory-scan, lessons, inject-memory, openclaw-status, openclaw-restart
5. **Approval Workflow** — persistent ops (config-set, doctor-fix, inject-memory, openclaw-restart) require `--yes`
6. **JSONL Audit Trail** — `~/.duckhive/audit/duckcustodian.jsonl` records every applied change
7. **Rescue Mode** — works even when config is broken or gateway is down
8. **Memory Integration** — reads LESSONS.md for past failures, surfaces them before acting

---

## Usage

```
/duckcustodian status              # System overview (default)
/duckcustodian health              # Probe mmx, LM Studio, OpenClaw
/duckcustodian doctor             # Run diagnostics (read-only)
/duckcustodian doctor fix          # Run diagnostics + apply repairs
/duckcustodian mmx-status        # Check mmx CLI availability
/duckcustodian lmstudio-status    # Check LM Studio models
/duckcustodian openclaw-status    # Check OpenClaw gateway
/duckcustodian openclaw restart   # Restart gateway (requires --yes)
/duckcustodian memory-stats        # Memory layer statistics
/duckcustodian lessons            # Show past failure lessons
/duckcustodian audit              # Show recent audit entries
/duckcustodian inject-memory <text>  # Inject memory (requires --yes)
```

---

## DuckHive Command

```bash
# Inside DuckHive chat
/duckcustodian status

# Or via CLI
duckhive duckcustodian health
```

**Aliases:** `duckcustodian`, `custodian`

---

## Architecture

```
src/crestodian/
├── index.ts         # Public exports
├── operations.ts    # Command parser + executor (15 typed ops)
├── overview.ts       # System state snapshot
├── probes.ts         # Health checks (mmx, LM Studio, OpenClaw)
├── audit.ts         # JSONL audit trail
└── commands/duckcustodian/
    ├── index.ts     # Command registration
    └── impl.ts      # CLI implementation
```

### Key Design Decisions

- **No LLM for routing** — deterministic parse → typed op. LLM only as fallback planner.
- **LESSONS.md integration** — past failures surfaced via `getLessonsForTask()`
- **Approval required for persistent ops** — `--yes` flag or interactive confirmation
- **Works on broken config** — probes don't depend on valid config file
- **Audit trail** — one JSONL line per applied operation, timestamped

---

## Comparison: OpenClaw Crestodian vs DuckHive DuckCustodian

| Feature | OpenClaw Crestodian | DuckHive DuckCustodian |
|---------|---------------------|------------------------|
| Gateway management | ✅ Gateway start/stop/restart | ✅ OpenClaw gateway probe + restart |
| Agent creation | ✅ `create agent` | — (DuckHive uses spawn) |
| TUI integration | ✅ Interactive TUI | Planned |
| Model planner | ✅ LLM fallback | — (DuckHive uses MiniMax directly) |
| Rescue mode | ✅ /crestodian in DMs | Basic (works without config) |
| LESSONS.md | — | ✅ Past failures surface automatically |
| embedRecall | — | ✅ Memory scan insights |
| mmx probe | — | ✅ MiniMax CLI status |
| LM Studio probe | — | ✅ Model availability |

---

## DuckHive LESSONS.md Integration

DuckCustodian reads from `LESSONS.md` (permanent failure moat):

```
~/.duckhive/auto-memory/LESSONS.md
```

Lessons are auto-populated by DuckHive's failure recovery system. DuckCustodian surfaces relevant lessons when running diagnostics, helping avoid repeating past mistakes.

---

## Extending DuckCustodian

### Adding a new operation:

1. Add to `DuckCustodianOperation` in `operations.ts`:
   ```typescript
   | { kind: 'my-new-op'; arg: string }
   ```

2. Add parser case in `parseDuckCustodianOperation()`.

3. Add executor case in `executeDuckCustodianOperation()`.

4. If persistent, add to `isPersistentDuckCustodianOperation()`.

5. Add audit call if needed.

### Adding a new probe:

1. Add function in `probes.ts`.
2. Call it in `overview.ts` → `loadDuckCustodianOverview()`.
3. Display in `formatDuckCustodianOverview()`.

---

## Credits

- **OpenClaw Crestodian** — original pattern (MIT Licensed)
- **DuckHive LESSONS.md** — permanent failure moat by Aiden (persistence inspiration)
- **DuckHive embedRecall** — semantic memory (context awareness)

---

**Version:** 1.0.0
**Added:** 2026-04-27
