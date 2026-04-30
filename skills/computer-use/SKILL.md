# computer-use Skill — DuckHive Codex Integration

## What This Is

Integrates OpenAI Codex's bundled `computer-use` MCP server into DuckHive.
Instead of reimplementing native macOS input/screenshot modules from scratch,
we wire Codex's proven bundled plugin (`SkyComputerUseClient`) as a stdio MCP
server that DuckHive can consume via its MCP client.

## Prerequisites

1. **OpenAI Codex CLI installed**
   ```bash
   npm i -g @openai/codex
   codex --version  # should print codex-cli X.X.X
   ```

2. **Run Codex once** to populate the bundled plugin:
   ```bash
   codex  # any command; this triggers plugin extraction
   # Plugin lands at:
   # ~/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins/computer-use/
   ```

3. **macOS 15+** with Accessibility permissions granted to Terminal

## Usage

```
/computer-use status   — Check plugin detection + config status
/computer-use enable  — Wire into DuckHive MCP (adds mcp__computer-use__* tools)
/computer-use disable — Remove from DuckHive MCP
```

After enabling, restart DuckHive or run `/mcp reload`. You'll see tools like:
- `mcp__computer-use__screenshot` — capture screen
- `mcp__computer-use__click` — click at coordinate
- `mcp__computer-use__type_text` — type text
- `mcp__computer-use__scroll` — scroll
- `mcp__computer-use__drag` — drag
- `mcp__computer-use__open_application` — open an app
- `mcp__computer-use__list_apps` — list running apps
- `mcp__computer-use__request_access` — request TCC permissions
- and more...

## Architecture

```
DuckHive MCP Client
  │
  │ StdioClientTransport
  │   command: ~/.codex/.../SkyComputerUseClient
  │   args: ["mcp"]
  │
  ▼
~/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins/computer-use/
  Codex Computer Use.app/
    Contents/
      MacOS/SkyComputerUseService     ← macOS LaunchAgent (TCC, accessibility)
      SharedSupport/SkyComputerUseClient.app/
        Contents/MacOS/SkyComputerUseClient ← The MCP server binary
```

## How It Works

1. **Discovery**: `impl.ts` searches known Codex plugin paths for the
   `computer-use` plugin directory containing `.mcp.json` + the `.app` bundle.

2. **Config wiring**: `addToDuckHiveMCP()` dynamically calls DuckHive's
   `addMcpConfig()` to register the server in `mcpServers` config with
   `type: 'stdio'`, absolute `command` path, and `args: ['mcp']`.

3. **In-process launch**: DuckHive's MCP client detects the `computer-use`
   server name and (with `CHICAGO_MCP` feature flag) runs the in-process
   `createComputerUseMcpServerForCli()` OR falls through to spawning a subprocess.
   Since our binary is a real MCP stdio server, the standard subprocess path works.

4. **Rendering**: `getCodexComputerUseToolOverrides()` provides TUI-friendly
   labels and message summaries for each tool.

## Native Alternative (DuckHive Full Implementation)

DuckHive *also* has a full `src/utils/computerUse/` implementation that uses
`@ant/computer-use-mcp` + `@ant/computer-use-input` + `@ant/computer-use-swift`.
This requires those packages to be resolvable in the Node module search path —
they come from Claude Code's bundle. That path is gated by `CHICAGO_MCP`.

The Codex binary integration here is the **fallback/alternative** for users
who have Codex installed but can't use the `CHICAGO_MCP` native path.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Plugin not found" | Run `codex` once to trigger plugin extraction |
| Policy denied | Check `settings.json` → `deniedMcpServers` in DuckHive config |
| SkyComputerUseClient crashes (code sig error) | Normal on first run; macOS prompts for Accessibility perms |
| Tools not showing after enable | Run `/mcp reload` or restart DuckHive |

## Key Files

| File | Purpose |
|------|---------|
| `src/commands/computer-use/impl.ts` | Command implementation, MCP config wiring |
| `src/commands/computer-use/index.ts` | Command registration |
| `~/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins/computer-use/` | Codex plugin source |
