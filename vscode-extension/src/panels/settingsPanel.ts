import * as vscode from "vscode";
import * as fs from "fs";
import { getEnvPath, restartBackend } from "../services/backendManager";

export class SettingsPanel {
  public static readonly viewType = "aiCopilot.settings";
  private static _panel?: vscode.WebviewPanel;

  public static open(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    if (SettingsPanel._panel) {
      SettingsPanel._panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      SettingsPanel.viewType,
      "AI Copilot Settings",
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    SettingsPanel._panel = panel;
    panel.onDidDispose(() => { SettingsPanel._panel = undefined; });

    const envPath = getEnvPath(extensionUri);
    const env = readEnv(envPath);
    panel.webview.html = getHtml(env);

    panel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === "save") {
        writeEnv(envPath, msg.data);
        vscode.window
          .showInformationMessage(
            "Settings saved. Restart backend to apply changes?",
            "Restart now",
            "Later"
          )
          .then((choice) => {
            if (choice === "Restart now") {
              restartBackend(extensionUri, context);
            }
          });
      }
    });
  }
}

function readEnv(envPath: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      result[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch { /* file doesn't exist yet */ }
  return result;
}

function writeEnv(envPath: string, data: Record<string, string>) {
  const lines = Object.entries(data)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  fs.writeFileSync(envPath, lines, "utf8");
}

function getHtml(env: Record<string, string>): string {
  const val = (key: string, def = "") => env[key] ?? def;
  const selected = (key: string, match: string) =>
    val("PROVIDER") === match ? "selected" : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 32px;
    max-width: 760px;
  }
  h1 { font-size: 22px; font-weight: 500; margin-bottom: 6px; }
  .subtitle { opacity: 0.6; font-size: 13px; margin-bottom: 32px; }
  .section {
    margin-bottom: 24px;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 8px;
    overflow: hidden;
  }
  .section-header {
    background: var(--vscode-sideBarSectionHeader-background);
    padding: 10px 16px;
    font-weight: 500;
    font-size: 13px;
    border-bottom: 1px solid var(--vscode-panel-border);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .badge {
    font-size: 10px; padding: 2px 7px; border-radius: 10px;
    background: var(--vscode-textLink-foreground); color: #fff; opacity: 0.85;
  }
  .free { background: #2d8a4e; }
  .section-body { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .field { display: flex; flex-direction: column; gap: 5px; }
  label { font-size: 12px; font-weight: 500; opacity: 0.8; }
  .hint { font-size: 11px; opacity: 0.5; }
  input, select {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 13px;
    font-family: var(--vscode-font-family);
    outline: none; width: 100%;
  }
  input:focus, select:focus { border-color: var(--vscode-focusBorder); }
  .key-row { position: relative; }
  .key-row input { padding-right: 60px; font-family: monospace; }
  .toggle-key {
    position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
    background: none; border: none; color: var(--vscode-textLink-foreground);
    cursor: pointer; font-size: 11px; padding: 2px 4px;
  }
  .actions {
    display: flex; gap: 10px; align-items: center; margin-top: 8px;
  }
  button.primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none; border-radius: 4px;
    padding: 8px 20px; font-size: 13px; cursor: pointer;
    font-family: var(--vscode-font-family);
  }
  button.primary:hover { background: var(--vscode-button-hoverBackground); }
  .status { font-size: 12px; opacity: 0.6; }
</style>
</head>
<body>

<h1>AI Copilot — Settings</h1>
<p class="subtitle">Configure your provider and API keys. Changes restart the backend automatically.</p>

<!-- Provider -->
<div class="section">
  <div class="section-header">Active Provider</div>
  <div class="section-body">
    <div class="field">
      <label>Provider</label>
      <select id="PROVIDER" onchange="showActive()">
        <option value="ollama"    ${selected("PROVIDER","ollama")}>🖥 Ollama — local model</option>
        <option value="groq"      ${selected("PROVIDER","groq")}>⚡ Groq Cloud — free &amp; fast</option>
        <option value="openai"    ${selected("PROVIDER","openai")}>OpenAI — GPT models</option>
        <option value="anthropic" ${selected("PROVIDER","anthropic")}>Anthropic — Claude models</option>
        <option value="grok"      ${selected("PROVIDER","grok")}>Grok — xAI models</option>
      </select>
      <span class="hint">Only the selected provider is used at runtime.</span>
    </div>
  </div>
</div>

<!-- Ollama -->
<div class="section provider-section" id="sec-ollama">
  <div class="section-header">🖥 Ollama <span class="badge free">Local</span></div>
  <div class="section-body">
    <div class="row">
      <div class="field">
        <label>Base URL</label>
        <input id="OLLAMA_BASE_URL" value="${val("OLLAMA_BASE_URL","http://localhost:11434")}"/>
        <span class="hint">Default: http://localhost:11434</span>
      </div>
      <div class="field">
        <label>Model</label>
        <input id="OLLAMA_MODEL" value="${val("OLLAMA_MODEL","codellama:7b")}"/>
        <span class="hint">e.g. codellama:7b · deepseek-coder:6.7b · llama3:8b</span>
      </div>
    </div>
  </div>
</div>

<!-- Groq -->
<div class="section provider-section" id="sec-groq">
  <div class="section-header">⚡ Groq Cloud <span class="badge free">Free tier</span></div>
  <div class="section-body">
    <div class="row">
      <div class="field">
        <label>API Key</label>
        <div class="key-row">
          <input id="GROQ_API_KEY" type="password" value="${val("GROQ_API_KEY")}"/>
          <button class="toggle-key" onclick="toggleKey('GROQ_API_KEY',this)">Show</button>
        </div>
        <span class="hint">Get free key at console.groq.com</span>
      </div>
      <div class="field">
        <label>Model</label>
        <input id="GROQ_MODEL" value="${val("GROQ_MODEL","llama-3.3-70b-versatile")}"/>
        <span class="hint">e.g. llama-3.3-70b-versatile · deepseek-r1-distill-llama-70b</span>
      </div>
    </div>
  </div>
</div>

<!-- OpenAI -->
<div class="section provider-section" id="sec-openai">
  <div class="section-header">OpenAI</div>
  <div class="section-body">
    <div class="row">
      <div class="field">
        <label>API Key</label>
        <div class="key-row">
          <input id="OPENAI_API_KEY" type="password" value="${val("OPENAI_API_KEY")}"/>
          <button class="toggle-key" onclick="toggleKey('OPENAI_API_KEY',this)">Show</button>
        </div>
        <span class="hint">Get from platform.openai.com</span>
      </div>
      <div class="field">
        <label>Model</label>
        <input id="OPENAI_MODEL" value="${val("OPENAI_MODEL","gpt-4o-mini")}"/>
        <span class="hint">e.g. gpt-4o-mini · gpt-4o · gpt-4-turbo</span>
      </div>
    </div>
  </div>
</div>

<!-- Anthropic -->
<div class="section provider-section" id="sec-anthropic">
  <div class="section-header">Anthropic — Claude</div>
  <div class="section-body">
    <div class="row">
      <div class="field">
        <label>API Key</label>
        <div class="key-row">
          <input id="ANTHROPIC_API_KEY" type="password" value="${val("ANTHROPIC_API_KEY")}"/>
          <button class="toggle-key" onclick="toggleKey('ANTHROPIC_API_KEY',this)">Show</button>
        </div>
        <span class="hint">Get from console.anthropic.com</span>
      </div>
      <div class="field">
        <label>Model</label>
        <input id="ANTHROPIC_MODEL" value="${val("ANTHROPIC_MODEL","claude-sonnet-4-6")}"/>
        <span class="hint">e.g. claude-sonnet-4-6 · claude-opus-4-6</span>
      </div>
    </div>
  </div>
</div>

<!-- Grok -->
<div class="section provider-section" id="sec-grok">
  <div class="section-header">Grok — xAI</div>
  <div class="section-body">
    <div class="row">
      <div class="field">
        <label>API Key</label>
        <div class="key-row">
          <input id="GROK_API_KEY" type="password" value="${val("GROK_API_KEY")}"/>
          <button class="toggle-key" onclick="toggleKey('GROK_API_KEY',this)">Show</button>
        </div>
        <span class="hint">Get from console.x.ai</span>
      </div>
      <div class="field">
        <label>Model</label>
        <input id="GROK_MODEL" value="${val("GROK_MODEL","grok-3")}"/>
        <span class="hint">e.g. grok-3 · grok-3-fast</span>
      </div>
    </div>
  </div>
</div>

<!-- Backend port -->
<div class="section">
  <div class="section-header">Backend</div>
  <div class="section-body">
    <div class="field" style="max-width:200px">
      <label>Port</label>
      <input id="PORT" value="${val("PORT","3000")}"/>
      <span class="hint">Default: 3000</span>
    </div>
  </div>
</div>

<div class="actions">
  <button class="primary" onclick="save()">Save &amp; restart backend</button>
  <span class="status" id="status"></span>
</div>

<script>
  const vscode = acquireVsCodeApi();

  const ALL_FIELDS = [
    "PROVIDER",
    "OLLAMA_BASE_URL","OLLAMA_MODEL",
    "GROQ_API_KEY","GROQ_MODEL",
    "OPENAI_API_KEY","OPENAI_MODEL",
    "ANTHROPIC_API_KEY","ANTHROPIC_MODEL",
    "GROK_API_KEY","GROK_MODEL",
    "PORT"
  ];

  function showActive() {
    const provider = document.getElementById("PROVIDER").value;
    document.querySelectorAll(".provider-section").forEach(el => {
      el.style.display = el.id === "sec-" + provider ? "block" : "none";
    });
  }

  function toggleKey(id, btn) {
    const input = document.getElementById(id);
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    btn.textContent = isHidden ? "Hide" : "Show";
  }

  function save() {
    const data = {};
    for (const f of ALL_FIELDS) {
      const el = document.getElementById(f);
      if (el) data[f] = el.value.trim();
    }
    document.getElementById("status").textContent = "Saving...";
    vscode.postMessage({ type: "save", data });
    setTimeout(() => {
      document.getElementById("status").textContent = "✅ Saved";
    }, 500);
  }

  // Init — show only active provider section
  showActive();
</script>
</body>
</html>`;
}