# DuckHive Quick Start for Windows

This guide uses Windows PowerShell.

## 1. Install Node.js

Install Node.js 20 or newer from:

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
bun install
bun run build
.\bin\duckhive.cmd --version
.\bin\duckhive.cmd --yolo
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

Or link the checkout onto your PATH:

```powershell
npm link
duckhive --version
duckhive --yolo
```

`--yolo` is an alias for `--dangerously-skip-permissions`.

By default, Windows startup stays on the classic OpenClaude-style REPL and
DuckHive applies the safe stdin settings before the UI loads. The Go TUI is
available with `duckhive tui`, but automatic Windows TUI handoff remains opt-in
with `DUCKHIVE_TUI_WINDOWS_EXPERIMENT=1`.

## 5. If the REPL Renders But Will Not Accept Typing

If the classic REPL opens but the prompt will not accept keyboard input, force
the Windows-safe stdin path and disable early key capture before launching:

```powershell
$env:DUCKHIVE_DISABLE_EARLY_INPUT='1'
$env:DUCKHIVE_USE_DATA_STDIN='1'
duckhive --dangerously-skip-permissions
```

This keeps startup from touching `stdin` before Ink owns raw mode. Remove those
environment variables after confirming your terminal works normally.

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
