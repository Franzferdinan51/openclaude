# Hive Nation Integration — OpenClaude

**Status:** ✅ Phase 1 & 2 Complete | 🔄 Phase 3-5 Planned  
**Hive Nation API:** `http://localhost:3131`

This integration adds multi-agent governance (AI Council + Senate + Teams) directly into OpenClaude, powered by Hive Nation.

---

## Slash Commands Added

### 🏛️ Hive Nation Commands

| Command | Description |
|---------|-------------|
| `/council [question]` | Consult the AI Council for complex decisions |
| `/council --status` | Show current deliberation status |
| `/council --mode=adversarial [question]` | Start deliberation in specific mode |
| `/senate list` | List all active Senate decrees |
| `/senate issue [title]\|[content]` | Issue a binding Senate decree |
| `/senate show [id]` | View decree details |
| `/decree [title]\|[content]` | Quick decree creation (shorthand) |
| `/team list` | List active agent teams |
| `/team spawn [name] [type]` | Spawn a new team (research/code/security/etc.) |
| `/team templates` | Show available team templates |
| `/orchestrate [task]` | Multi-agent orchestration with council oversight |

### 🔧 Feature Commands

| Command | Description |
|---------|-------------|
| `/shell-mode` | Ctrl-X shell mode (kimi-cli style) |
| `/checkpoint save [name]` | Save session checkpoint (gemini-cli style) |
| `/checkpoint list` | List saved checkpoints |
| `/checkpoint load [name]` | Load a checkpoint |
| `/trusted add [path]` | Add trusted folder (gemini-cli style) |
| `/trusted list` | List trusted folders |
| `/mcp-manage list` | List known MCP servers |

---

## Architecture

```
OpenClaude (TypeScript)
    │
    ├── src/services/hive-bridge/     ← Bridge service
    │   ├── hive-bridge.ts             ← API client + orchestration
    │   └── hive-types.ts             ← TypeScript types
    │
    ├── src/commands/
    │   ├── hive-council/              ← /council command
    │   ├── hive-senate/               ← /senate command
    │   ├── hive-team/                 ← /team command
    │   ├── hive-decree/              ← /decree command
    │   ├── hive-orchestrate/         ← /orchestrate command
    │   ├── shell-mode/               ← /shell-mode command
    │   ├── checkpoint/               ← /checkpoint command
    │   ├── trusted-folders/          ← /trusted command
    │   └── mcp-manage/               ← /mcp-manage command
    │
    └── Hive Nation API (localhost:3131)
        ├── /api/councilors           ← 46+ AI councilors
        ├── /api/council/deliberate   ← Start deliberation
        ├── /api/council/ask          ← Agent consultation
        ├── /api/decree               ← Issue decrees
        ├── /api/team/spawn           ← Spawn teams
        └── /api/health              ← Service health
```

---

## Setup

### 1. Start Hive Nation (if not running)

```bash
cd ~/Desktop/AgentTeam-GitHub
node council-api-server.cjs &
# Runs on port 3131
```

### 2. Build OpenClaude

```bash
cd ~/.openclaw/workspace/openclaude-integration
npm install
npm run build
```

### 3. Run with Hive integration

```bash
./Product/OpenClaude --enable-hive
# or
./Product/OpenClaude
# (Hive commands available automatically)
```

---

## Phases

### ✅ Phase 1: Core Integration (DONE)
- Hive Bridge service (TypeScript API client)
- /council, /senate, /team, /decree, /orchestrate commands
- Senate decree system
- Team spawning
- Council deliberation

### ✅ Phase 2: Enhanced Features (DONE)
- /shell-mode (Ctrl-X like kimi-cli)
- /checkpoint (gemini-cli style session saving)
- /trusted-folders (gemini-cli style security)
- /mcp-manage (MCP server management)

### 🔄 Phase 3: Deep Integration
- Council deliberation embedded in task pipeline
- Decree enforcement in tool execution
- Real-time deliberation in REPL
- Team coordination via ACP

### 🔄 Phase 4: TUI Components
- Bubble Tea-style rendering for council messages
- Lip Gloss styling for REPL output
- Gum-style confirmation dialogs

### 🔄 Phase 5: ACP Protocol
- kimi-cli style ACP protocol for agent communication
- MCP server management
- Shell mode integration

---

## API Reference

### HiveBridge (src/services/hive-bridge/hive-bridge.ts)

```typescript
import { getHiveBridge } from './services/hive-bridge/index.js'

const hive = getHiveBridge()

// Health check
const healthy = await hive.isHealthy()

// Start council deliberation
const result = await hive.startDeliberation(
  "Should we use microservices?",
  "adversarial"
)

// Ask council for advice
const advice = await hive.askCouncil({
  question: "What error handling pattern is best?",
  mode: "consensus",
  scope: "standard"
})

// Issue a decree
await hive.issueDecree(
  "Secure Mode",
  "Agents SHALL verify file paths before deletion",
  "openclaude",
  "agent",
  "high"
)

// Spawn a team
await hive.spawnTeam("API Security Team", "security")

// Get context for prompts
const ctx = await hive.formatContextForPrompt()
// Returns formatted string for system prompts
```

---

## Configuration

### Environment Variables

```bash
HIVE_API_BASE=http://localhost:3131    # Hive Nation API
HIVE_API_KEY=                          # Optional API key
HIVE_AUTO_COUNCIL=false                # Auto-consult for complex tasks
HIVE_COUNCIL_THRESHOLD=7               # Complexity threshold (1-10)
```

### Integration Options

```typescript
import { initHiveBridge } from './services/hive-bridge/index.js'

initHiveBridge(
  { apiBase: 'http://localhost:3131', enabled: true },
  {
    autoConsultCouncil: false,   // Don't auto-trigger council
    councilThreshold: 7,        // Complexity 7+ triggers council
    showCouncilInRepl: true,     // Show council status in UI
    cacheCouncilResults: true,   // Cache verdicts
  }
)
```

---

## Governance Loop

```
1. USER asks a complex question
         ↓
2. /council triggers deliberation
         ↓
3. 46+ AI councilors debate (2-3 seconds)
         ↓
4. Council reaches verdict (yea/nay/consensus)
         ↓
5. If binding action needed → /senate issues decree
         ↓
6. Decree enforced by agent
         ↓
7. Team spawned if multi-agent needed
```

---

## Council Modes

| Mode | When to Use |
|------|-------------|
| `balanced` | Standard decisions, pros and cons |
| `adversarial` | Devil's advocate, challenging assumptions |
| `consensus` | Building agreement, collaborative |
| `brainstorm` | Creative ideation, wild ideas welcome |
| `swarm` | Parallel specialist opinions |
| `legislature` | Formal debate, voting |
| `prediction` | Forecasting outcomes |
| `inspector` | Critical review, finding flaws |

---

## Team Templates

| Template | Roles | Best For |
|---------|-------|----------|
| `research` | researcher + writer + reviewer | Research workflows |
| `code` | coder + reviewer + security | Full development |
| `security` | security + reviewer + communicator | Security audits |
| `emergency` | security + communicator + planner | Incident response |
| `planning` | planner + analyst + reviewer | Strategic planning |
| `analysis` | analyst + researcher + writer | Deep analysis |
| `devops` | devops + security + reviewer | Deployment/infrastructure |
| `swarm` | multiple specialists | Parallel tasks |

---

## Known Issues

1. **Hive Nation must be running** — Commands fail gracefully if API is offline
2. **Council deliberation is async** — Use `/council --status` to monitor
3. **TypeScript strict mode** — Some type assertions needed for dynamic command loading

---

## Future Enhancements (Phase 3-5)

- [ ] Council deliberation embedded in task pipeline (complexity scoring)
- [ ] Decree enforcement in tool execution layer
- [ ] Real-time council messages in REPL
- [ ] Bubble Tea TUI for council chamber
- [ ] Lip Gloss styled output for all commands
- [ ] ACP protocol for inter-agent communication
- [ ] kimi-cli style shell mode with Ctrl-X
- [ ] Checkpoint auto-save on context overflow
- [ ] Trusted folders with automatic permission grants
- [ ] Codex OAuth integration for desktop mode
