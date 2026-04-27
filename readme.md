# AI Copilot

A VS Code extension that brings AI-powered coding assistance directly into your editor, backed by a lightweight Node.js server that can connect to any LLM provider — local or cloud.

## Features

- **Inline code completion** — suggestions appear as you type, triggered automatically after a short pause
- **Bug fixer** — rewrites the current file with all bugs corrected and annotated inline comments
- **Code explainer** — right-click any selected code to get a plain-English explanation in the chat panel
- **Improvement suggestions** — analyses the active file and surfaces actionable diagnostics
- **Streaming chat panel** — a persistent chat sidebar for free-form conversations with your chosen model
- **Model switcher** — pick any provider/model from the status bar at any time; all features switch instantly

## Architecture

```
Project/
├── backend/                   # Express.js API server (Node.js)
│   ├── index.js               # Entry point, route wiring
│   ├── .env                   # Provider configuration
│   └── src/
│       ├── routes/
│       │   ├── complete.js    # POST /complete  — code completion, fix, explain
│       │   ├── suggest.js     # POST /suggest   — improvement analysis
│       │   ├── chat.js        # POST /chat/stream — SSE streaming chat
│       │   ├── models.js      # GET  /models    — list available providers/models
│       │   └── health.js      # GET  /health
│       └── services/
│           ├── llm.js                     # Provider dispatcher
│           ├── providerRegistry.js        # Reads PROVIDER_* env vars
│           └── providers/
│               ├── anthropic.js           # Anthropic (Claude) adapter
│               ├── ollama.js              # Ollama adapter
│               └── openaiCompatibleCore.js # OpenAI-compatible adapter (Groq, OpenAI, LM Studio…)
│
└── vscode-extension/          # VS Code extension (TypeScript)
    └── src/
        ├── extension.ts       # Activation, command registration
        ├── providers/
        │   ├── completion.ts  # Inline completion provider
        │   └── diagnostics.ts # Suggestion diagnostics
        ├── panels/
        │   └── chatPanel.ts   # Webview chat UI
        └── services/
            └── api.ts         # HTTP client for the backend
```

## Prerequisites

- **Node.js** 18+
- **VS Code** 1.85+
- At least one LLM provider (see [Provider Setup](#provider-setup))

## Getting Started

### 1. Start the backend

```bash
cd backend
npm install
```

Configure your providers in `.env` (see [Provider Setup](#provider-setup)), then:

```bash
npm start          # production
npm run dev        # watch mode (auto-restarts on changes)
```

The server starts on `http://localhost:3000` by default.

### 2. Install the VS Code extension

```bash
cd vscode-extension
npm install
npm run compile
```

Then open the `vscode-extension` folder in VS Code and press **F5** to launch the Extension Development Host, or package it with `vsce package` for a permanent install.

### 3. Select a model

Click the **`⊕ AI: select model`** item in the VS Code status bar (bottom-right), choose a provider and model from the quick-pick list, and you're ready to go.

## Provider Setup

All provider configuration lives in `backend/.env`. Add as many providers as you like using the `PROVIDER_<NAME>_*` pattern — no code changes required.

```env
# ── Ollama (local) ──────────────────────────────────────────────
PROVIDER_OLLAMA_TYPE=ollama
PROVIDER_OLLAMA_BASE_URL=http://localhost:11434
# Leave MODELS empty → the backend queries /api/tags live

# ── Groq ────────────────────────────────────────────────────────
PROVIDER_GROQ_TYPE=openai_compatible
PROVIDER_GROQ_BASE_URL=https://api.groq.com/openai/v1
PROVIDER_GROQ_API_KEY=<your-groq-api-key>

# ── OpenAI ──────────────────────────────────────────────────────
PROVIDER_OPENAI_TYPE=openai_compatible
PROVIDER_OPENAI_BASE_URL=https://api.openai.com/v1
PROVIDER_OPENAI_API_KEY=<your-openai-api-key>
# PROVIDER_OPENAI_MODELS=gpt-4o,gpt-4-turbo,gpt-3.5-turbo

# ── Anthropic (Claude) ──────────────────────────────────────────
PROVIDER_ANTHROPIC_TYPE=anthropic
PROVIDER_ANTHROPIC_API_KEY=<your-anthropic-api-key>
PROVIDER_ANTHROPIC_MODELS=claude-opus-4-5,claude-sonnet-4-5,claude-haiku-4-5

# ── LM Studio (local OpenAI-compatible) ─────────────────────────
# PROVIDER_LMSTUDIO_TYPE=openai_compatible
# PROVIDER_LMSTUDIO_BASE_URL=http://localhost:1234/v1

# ── Server ──────────────────────────────────────────────────────
PORT=3000
```

Supported `TYPE` values:

| Type | Description |
|---|---|
| `ollama` | Local [Ollama](https://ollama.com) instance |
| `openai_compatible` | Any OpenAI-compatible API (Groq, OpenAI, LM Studio, etc.) |
| `anthropic` | Anthropic Claude API |

When `PROVIDER_<NAME>_MODELS` is omitted, the backend queries the provider's API live to populate the model list.

## VS Code Commands

All commands are available via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Description |
|---|---|
| `AI: Switch model` | Pick a provider and model from the status bar |
| `AI: Open chat` | Open the streaming chat panel |
| `AI: Fix bugs in file` | Rewrite the active file with bugs fixed |
| `AI: Analyze & suggest improvements` | Run diagnostics on the active file |
| `AI: Explain selected code` | Explain highlighted code (also in right-click menu) |

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `aiCopilot.backendUrl` | `http://localhost:3000` | URL of the backend server |
| `aiCopilot.activeProviderKey` | *(auto-set)* | Active provider key |
| `aiCopilot.activeModel` | *(auto-set)* | Active model name |
| `aiCopilot.activeLabel` | *(auto-set)* | Display label for the active provider |

## API Reference

The backend exposes the following endpoints:

| Method | Path | Description |
|---|---|---|
| `POST` | `/complete` | Code completion, fix, or explain |
| `POST` | `/suggest` | Code improvement analysis |
| `POST` | `/chat/stream` | Streaming chat (SSE) |
| `GET` | `/models` | List all configured providers and their models |
| `GET` | `/health` | Health check |

### `POST /complete`

```json
{
  "prefix": "function add(a, b) {",
  "suffix": "}",
  "language": "javascript",
  "task": "complete",
  "providerKey": "groq",
  "model": "llama3-8b-8192"
}
```

`task` can be `"complete"`, `"fix"`, or `"explain"`.

### `POST /chat/stream`

Accepts a `messages` array and streams the response as Server-Sent Events:

```json
{ "messages": [{"role": "user", "content": "How do I reverse a linked list?"}], "providerKey": "ollama", "model": "codellama:7b" }
```

Each SSE event is `data: {"token": "..."}`, terminated by `data: [DONE]`.

## Adding a New Provider

1. Open `backend/.env`.
2. Add three lines:
   ```env
   PROVIDER_MYPROVIDER_TYPE=openai_compatible
   PROVIDER_MYPROVIDER_BASE_URL=https://api.example.com/v1
   PROVIDER_MYPROVIDER_API_KEY=<key>
   ```
3. Restart the backend. The new provider will appear immediately in the VS Code model switcher.

## License

MIT