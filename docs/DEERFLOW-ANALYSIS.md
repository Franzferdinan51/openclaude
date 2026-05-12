# DeerFlow Feature Analysis — What Duck CLI Should Adopt

## Context

Duck CLI and DeerFlow (ByteDance) are both "SuperAgent harnesses" — runtime infrastructures that orchestrate sub-agents, memory, tools, and skills. DeerFlow is a Python/LangGraph project; Duck CLI is a TypeScript/Node project. Several DeerFlow architectural ideas are worth adopting in Duck CLI.

---

## DeerFlow Architecture Summary

DeerFlow 2.0 orchestrates:
- **Lead Agent** — top-level coordinator using LangGraph
- **Sub-Agents** — spawned dynamically, each with scoped context + tools
- **Memory** — structured fact extraction + JSON storage + token-budget injection
- **Sandbox** — Docker/Apple Container isolation for code execution
- **Skills** — progressive loading, per-skill tool restrictions, public/custom categories
- **Middleware chain** — 9+ middleware layers that intercept/enhance agent behavior
- **Tracing** — callback-based observability
- **Guardrails** — input/output validation

---

## Feature Comparison: DeerFlow vs Duck CLI

| Feature | DeerFlow | Duck CLI | Priority |
|---------|----------|----------|----------|
| **Structured Memory** | Fact extraction, confidence scoring, 2k token budget injection, separate stores per user | Basic SQLite memory, no structured extraction or injection budget | HIGH |
| **Sub-Agent Lifecycle** | Full registry, status tracking, token collector, isolated event loop per subagent | Basic subagent spawning, minimal lifecycle management | HIGH |
| **Sandbox Isolation** | Docker/Apple Container for all code execution | No sandbox — direct host execution | HIGH |
| **Progressive Skill Loading** | Skills loaded only when sub-agent actually needs them | All skills loaded at startup | MEDIUM |
| **Per-Skill Tool Restrictions** | Skills can whitelist allowed tools | No per-skill tool restrictions | MEDIUM |
| **Clarification Middleware** | Asks user before proceeding on ambiguous requests | No clarification before action | HIGH |
| **Loop Detection** | Detects and prevents infinite loops | No loop detection middleware | MEDIUM |
| **Token Budget Per Subagent** | `SubagentTokenCollector` enforces per-subagent limits | No per-sub-agent token limits | MEDIUM |
| **Todo List Middleware** | Explicit `write_todos` tracking for multi-step tasks | ad-hoc task tracking | MEDIUM |
| **Title Generation** | Auto-generates conversation titles (6 words, 60 chars) | No auto-title generation | MEDIUM |
| **Summarization Middleware** | Configurable trigger/keep model, per-skill preservation | Basic session compaction | MEDIUM |
| **MCP Integration** | MCP server integration via `deerflow.community.mcp` | Partial MCP via OpenClaw | MEDIUM |
| **Guardrails** | Input/output validation and scanning | No guardrails system | MEDIUM |
| **Tracing Callbacks** | Structured `build_tracing_callbacks` factory | Limited tracing | LOW |
| **Structured Skill Categories** | public/custom with separate directories | Flat skill list | MEDIUM |
| **Configurable Memory Debounce** | 30s debounce before memory processing | Immediate memory writes | MEDIUM |
| **Skill Self-Evolution** | Agent can autonomously create/improve skills | Skill creator exists, no self-evolution | LOW |
| **Subagent Registry** | Persistent registry with cleanup, lifecycle hooks | Basic registry | MEDIUM |

---

## Top Priority Features to Add to Duck CLI

### 1. 🔴 HIGH: Structured Memory Layer

**DeerFlow's approach:**
```python
# Structured memory with fact extraction and injection budget
memory = {
    "version": "1.0",
    "user": {
        "workContext": {"summary": "", "updatedAt": ""},
        "personalContext": {"summary": "", "updatedAt": ""},
        "topOfMind": {"summary": "", "updatedAt": ""},
    },
    "history": {
        "recentMonths": {"summary": "", "updatedAt": ""},
        "earlierContext": {"summary": "", "updatedAt": ""},
        "longTermBackground": {"summary": "", "updatedAt": ""},
    },
    "facts": [],  # Extracted facts with confidence scores
}
# Injected at max 2000 tokens, debounced 30s, per-user storage
```

**Duck CLI should add:**
- `src/memory/structured-memory.ts` — structured stores (workContext, personalContext, topOfMind, facts)
- Fact extraction from conversations with confidence scoring
- 2000 token injection budget (configurable)
- 30s debounce before memory updates
- Per-user memory isolation

**Implementation complexity:** MEDIUM — needs new files + memory schema migration

---

### 2. 🔴 HIGH: Sub-Agent Token Limits

**DeerFlow's approach:** `SubagentTokenCollector` tracks input/output tokens per subagent and can enforce hard limits.

**Duck CLI should add:**
- `src/subagents/token-collector.ts` — per-subagent token tracking
- Hard limits per subagent (configurable, default 100k tokens)
- Graceful termination when limits exceeded
- Token usage reporting back to parent

**Implementation complexity:** LOW — small utility, hooks into existing subagent runner

---

### 3. 🔴 HIGH: Clarification Middleware

**DeerFlow's approach:** Before executing ambiguous requests, the agent asks the user for clarification rather than guessing.

**Duck CLI should add:**
- `src/middleware/clarification.ts` — detects ambiguous intent and prompts user
- Trigger on: vague task descriptions, multiple possible approaches, missing required info
- Pattern: ask one clear question, wait for response, then proceed

**Implementation complexity:** LOW — new middleware file + integration into chat agent

---

### 4. 🟡 MEDIUM: Loop Detection Middleware

**DeerFlow's approach:** Detects repeated tool calls or messages and prevents infinite loops.

**Duck CLI should add:**
- `src/middleware/loop-detection.ts` — tracks recent tool call sequences
- If same sequence repeats N times (configurable, default 3), pause and ask user
- Track patterns like: read file → edit file → read file → edit file (in a tight loop)

**Implementation complexity:** LOW — small state machine tracking recent actions

---

### 5. 🟡 MEDIUM: Todo List Middleware

**DeerFlow's approach:** Uses a structured `write_todos` tool for complex multi-step tasks (3+ steps).

**Duck CLI already has task tools**, but they're not auto-triggered for complex tasks. Should:
- Auto-enable todo tracking when task has 3+ distinct steps
- Mark exactly one `in_progress` at a time (unless parallel)
- Update todos in real-time as progress is made
- Clean up todos when task is complete

**Implementation complexity:** LOW — extend existing task tools with middleware logic

---

### 6. 🟡 MEDIUM: Auto Title Generation

**DeerFlow's approach:** Generates conversation titles automatically (max 6 words, 60 chars).

**Duck CLI should add:**
- Trigger on first user message or after first significant exchange
- Use fast/cheap model for title generation
- Store title in session metadata
- Display in session list UI

**Implementation complexity:** LOW — small utility, integrates with session creation

---

### 7. 🟡 MEDIUM: Per-Skill Tool Restrictions

**DeerFlow's approach:** Skills can define which tools they're allowed to use, enforcing tool discipline.

**Duck CLI should add:**
- `allowed_tools: string[]` field in SKILL.md
- When skill is active, restrict agent to only those tools
- If no `allowed_tools` defined, all tools available (backwards compatible)

**Implementation complexity:** MEDIUM — needs skill schema update + tool registry filtering

---

### 8. 🟡 MEDIUM: Progressive Skill Loading

**DeerFlow's approach:** Skills are only loaded when a sub-agent actually needs them, not at startup.

**Duck CLI already has lazy loading patterns** but could improve:
- Only load skill metadata at startup (not full content)
- Load full SKILL.md content when skill is first activated
- Keep loaded skills in memory for session duration
- Unload after session ends

**Implementation complexity:** MEDIUM — skill registry changes + memory management

---

### 9. 🟡 MEDIUM: Subagent Lifecycle Registry Improvements

**DeerFlow's approach:**
- Full `SubagentStatus` enum: PENDING / RUNNING / COMPLETED / FAILED / CANCELLED / TIMED_OUT
- `SubagentResult` dataclass with trace_id, token_usage_records, started/completed timestamps
- Persistent isolated event loop for subagents (avoids creating fresh loop per execution)
- Cleanup hooks and atexit handlers

**Duck CLI should improve:**
- Track subagent status properly (not just "running")
- Record start/end timestamps + duration
- Track token usage per subagent
- Proper cleanup on cancellation/timeout

**Implementation complexity:** MEDIUM — new types + runner modifications

---

### 10. 🟢 LOW: Guardrails System

**DeerFlow's approach:** Input/output validation, prompt injection detection.

**Duck CLI could add:**
- Input sanitization for user commands
- Output scanning for sensitive data leaks
- Basic prompt injection detection
- Skill security scanner (already partially exists)

**Implementation complexity:** LOW — mostly policy definitions, some scanning code

---

## Sandbox Architecture (Long-Term)

DeerFlow's Docker/Apple Container sandbox is the biggest architectural difference. For Duck CLI, this would require:

1. **Local sandbox provider** — executes commands in isolated environment
2. **Container management** — starts/stops Docker containers or Apple Container VMs
3. **Filesystem isolation** — agent can only access mounted directories
4. **Network restrictions** — optional network isolation for untrusted code

**Complexity:** HIGH — significant engineering investment. Consider as v0.9 or v1.0 feature.

---

## Recommended Roadmap

### Phase 1 (v0.8.x) — Quick Wins
- [ ] Sub-Agent Token Limits (`token-collector.ts`)
- [ ] Clarification Middleware
- [ ] Loop Detection Middleware  
- [ ] Auto Title Generation

### Phase 2 (v0.9.x) — Memory & Lifecycle
- [ ] Structured Memory Layer with fact extraction
- [ ] Subagent Lifecycle Registry improvements
- [ ] Per-Skill Tool Restrictions
- [ ] Todo List Middleware improvements

### Phase 3 (v1.0) — Infrastructure
- [ ] Progressive Skill Loading
- [ ] Sandbox Isolation (Docker/Apple Container)
- [ ] Guardrails System
- [ ] Tracing Callbacks

---

## Specific Implementation Notes

### Structured Memory Schema (Duck CLI)
```
memory/
  {userId}/
    memory.json        # Structured memory file
    facts.json         # Extracted facts with confidence scores
    sessions/          # Per-session context
```

### Todo Tracker (Duck CLI)
```typescript
interface TodoState {
  todos: Array<{
    id: string;
    title: string;
    status: 'pending' | 'in_progress' | 'completed';
    createdAt: number;
    updatedAt: number;
  }>;
}
```

### Subagent Token Collector (Duck CLI)
```typescript
interface SubagentTokenUsage {
  taskId: string;
  inputTokens: number;
  outputTokens: number;
  limit: number;
  startedAt: Date;
  endedAt?: Date;
}
```

---

## OpenClaw Tool Events Investigation — Final Answer

**Why tool_execution_start/update/end aren't in trajectory JSONL:**

The trajectory JSONL captures session-scoped events at the transcript level — user messages, assistant messages, tool calls, tool results. The `emitAgentEvent` system (which handles `tool_execution_start/update/end` with `stream: "tool"`) fires individual agent lifecycle events but these are NOT written to the trajectory JSONL file by the transcript persistence layer.

The events ARE emitted via the `onAgentEvent` listener system and could be captured by:
1. A plugin that subscribes to `onAgentEvent` and writes to its own event store
2. A gateway middleware that broadcasts agent events to connected clients in real-time
3. A tracing callback that captures them

**What's needed to capture them:**
- Subscribe to `onAgentEvent` in a plugin or service
- Filter for `stream === "tool"` events
- Write to a separate `.jsonl` file or append to an existing trajectory

The events exist in the system — they're just not persisted to the trajectory file.