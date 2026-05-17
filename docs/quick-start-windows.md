# DuckHive Quick Start for Windows

This guide uses Windows PowerShell.

## 1. Install Node.js

Install Node.js 22 or newer from:

- `https://nodejs.org/`

Then open PowerShell and check it:

```powershell
node --version
npm --version
```

## 2. Install DuckHive

```powershell
npm install -g github:Franzferdinan51/DuckHive
```

For a source checkout:

```powershell
git clone https://github.com/Franzferdinan51/DuckHive.git
cd DuckHive
.\install.ps1
duckhive --version
duckhive --yolo
```

## 3. Pick One Provider

### Option A: OpenAI

Replace `sk-your-key-here` with your real key.

```powershell
$env:CLAUDE_CODE_USE_OPENAI="1"
$env:OPENAI_API_KEY="sk-your-key-here"
$env:OPENAI_MODEL="gpt-4o"

duckhive
```

### Option B: DeepSeek

```powershell
$env:CLAUDE_CODE_USE_OPENAI="1"
$env:OPENAI_API_KEY="sk-your-key-here"
$env:OPENAI_BASE_URL="https://api.deepseek.com/v1"
$env:OPENAI_MODEL="deepseek-v4-flash"

duckhive
```

Use `deepseek-v4-pro` when you want the stronger model. `deepseek-chat` and `deepseek-reasoner` still work as DeepSeek's legacy API aliases.

### Option C: Ollama

Install Ollama first from:

- `https://ollama.com/download/windows`

Then run:

```powershell
ollama pull llama3.1:8b

$env:CLAUDE_CODE_USE_OPENAI="1"
$env:OPENAI_BASE_URL="http://localhost:11434/v1"
$env:OPENAI_MODEL="llama3.1:8b"

duckhive
```

No API key is needed for Ollama local models.

### Option D: LM Studio

Install LM Studio first from:

- `https://lmstudio.ai/`

Then in LM Studio:

1. Download a model (e.g., Llama 3.1 8B, Mistral 7B)
2. Go to the "Developer" tab
3. Select your model and enable the server via the toggle

Then run:

```powershell
$env:CLAUDE_CODE_USE_OPENAI="1"
$env:OPENAI_BASE_URL="http://localhost:1234/v1"
$env:OPENAI_MODEL="your-model-name"
# $env:OPENAI_API_KEY="lmstudio"  # optional: some users need a dummy key

duckhive
```

Replace `your-model-name` with the model name shown in LM Studio.

No API key is needed for LM Studio local models (but uncomment the `OPENAI_API_KEY` line if you hit auth errors).

## 4. If `duckhive` Is Not Found

Close PowerShell, open a new one, and try again:

```powershell
duckhive
```

If PowerShell still says `duckhive` is not recognized, use the local source
launcher from the repository root:

```powershell
.\bin\duckhive.cmd --dangerously-skip-permissions
```

Or rerun the source installer, which creates a stable launcher at
`$env:LOCALAPPDATA\DuckHive\bin\duckhive.cmd` and adds it to both your user PATH
and the current PowerShell session:

```powershell
.\install.ps1
duckhive --version
```

Or link the checkout onto your PATH:

```powershell
npm link
duckhive --version
duckhive --yolo
```

`--yolo` is an alias for `--dangerously-skip-permissions`.
Both flags are applied during the earliest launcher phase, before the full CLI
imports, so they work consistently for startup and the interactive REPL.

If the REPL opens but will not accept typing, run the non-interactive runtime
doctor from the same PowerShell window:

```powershell
duckhive runtime-doctor
```

This checks the Windows stdin mode, TUI fallback, provider routing, ClawHub
skill hub, computer-use fallback, Telegram connector config, and harness command
registry without starting the chat UI.

By default, Windows startup stays on the classic REPL and DuckHive applies the
safe stdin settings before the UI loads. The renderer uses DuckHive's
OpenClaude-compatible readable stdin path by default instead of the alternate
data-event diagnostic path. The Go TUI is
available with `duckhive tui`, but automatic Windows TUI handoff remains opt-in
with `DUCKHIVE_TUI_WINDOWS_EXPERIMENT=1`.

## 5. If the REPL Renders But Will Not Accept Typing

If the classic REPL opens but the prompt will not accept keyboard input, make
sure the Windows-safe stdin defaults are active before launching:

```powershell
$env:DUCKHIVE_DISABLE_EARLY_INPUT='1'
Remove-Item Env:\DUCKHIVE_USE_DATA_STDIN -ErrorAction SilentlyContinue
Remove-Item Env:\OPENCLAUDE_USE_DATA_STDIN -ErrorAction SilentlyContinue
Remove-Item Env:\DUCKHIVE_USE_READABLE_STDIN -ErrorAction SilentlyContinue
Remove-Item Env:\OPENCLAUDE_USE_READABLE_STDIN -ErrorAction SilentlyContinue
Remove-Item Env:\DUCKHIVE_USE_CONIN_STDIN -ErrorAction SilentlyContinue
duckhive --dangerously-skip-permissions
```

This keeps startup from touching `stdin` before Ink owns raw mode and restores
the same readable input path used by OpenClaude. Remove the temporary env
override after confirming your terminal works normally.

## 6. If Your Provider Fails

Check the basics:

### For OpenAI or DeepSeek

- make sure the key is real
- make sure you copied it fully

### For Ollama

- make sure Ollama is installed
- make sure Ollama is running
- make sure the model was pulled successfully

### For LM Studio

- make sure LM Studio is installed
- make sure LM Studio is running
- make sure the server is enabled (toggle on in the "Developer" tab)
- make sure a model is loaded in LM Studio
- make sure the model name matches what you set in `OPENAI_MODEL`

## 7. Updating DuckHive

```powershell
npm install -g github:Franzferdinan51/DuckHive
```

## 8. Uninstalling DuckHive

```powershell
npm uninstall -g duckhive
```

## Need Advanced Setup?

Use:

- [Advanced Setup](advanced-setup.md)
  For Codex, Gemini, Mistral, LiteLLM, provider profiles, and runtime diagnostics.
