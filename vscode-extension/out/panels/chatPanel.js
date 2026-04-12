"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatViewProvider = void 0;
const vscode = __importStar(require("vscode"));
function backendUrl() {
    return vscode.workspace
        .getConfiguration("aiCopilot")
        .get("backendUrl", "http://localhost:3000");
}
class ChatViewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };
        webviewView.webview.html = this._getHtml();
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (message.type === "userMessage") {
                await this._handleChat(message.text, message.includeCode);
            }
            if (message.type === "openSettings") {
                vscode.commands.executeCommand("aiCopilot.openSettings");
            }
        });
    }
    async _handleChat(userText, includeCode) {
        const editor = vscode.window.activeTextEditor;
        let context = "";
        if (includeCode && editor) {
            const code = editor.document.getText();
            const lang = editor.document.languageId;
            context = `\n\nCurrent file (${lang}):\n\`\`\`${lang}\n${code}\n\`\`\``;
        }
        const prompt = `You are an expert coding assistant. Answer clearly and concisely.
${userText}${context}`;
        try {
            // Stream the response token by token via WebSocket
            const ws = new (require("ws"))(`ws://localhost:3000`);
            let fullResponse = "";
            ws.on("open", () => {
                ws.send(JSON.stringify({
                    code: prompt,
                    language: "text",
                }));
            });
            ws.on("message", (data) => {
                const json = JSON.parse(data.toString());
                if (json.token) {
                    fullResponse += json.token;
                    this._view?.webview.postMessage({
                        type: "streamToken",
                        token: json.token,
                    });
                }
                if (json.done) {
                    ws.close();
                    this._view?.webview.postMessage({ type: "streamDone" });
                }
                if (json.error) {
                    ws.close();
                    this._view?.webview.postMessage({
                        type: "error",
                        message: json.error,
                    });
                }
            });
            ws.on("error", (err) => {
                this._view?.webview.postMessage({
                    type: "error",
                    message: `Connection error: ${err.message}`,
                });
            });
        }
        catch (err) {
            this._view?.webview.postMessage({
                type: "error",
                message: err.message,
            });
        }
    }
    _getHtml() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background);
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  #messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 10px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .msg {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-width: 100%;
  }

  .msg-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    opacity: 0.5;
    letter-spacing: 0.5px;
  }

  .msg-bubble {
    padding: 8px 10px;
    border-radius: 6px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .user .msg-label { color: var(--vscode-textLink-foreground); }
  .user .msg-bubble {
    background: var(--vscode-textLink-foreground);
    color: #fff;
    align-self: flex-end;
  }

  .assistant .msg-label { color: var(--vscode-foreground); }
  .assistant .msg-bubble {
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
  }

  .error .msg-bubble {
    background: var(--vscode-inputValidation-errorBackground);
    border: 1px solid var(--vscode-inputValidation-errorBorder);
    color: var(--vscode-inputValidation-errorForeground);
  }

  code {
    font-family: var(--vscode-editor-font-family);
    background: var(--vscode-textBlockQuote-background);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 12px;
  }

  pre {
    background: var(--vscode-textBlockQuote-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    padding: 8px;
    overflow-x: auto;
    font-family: var(--vscode-editor-font-family);
    font-size: 12px;
    margin-top: 4px;
  }

  #footer {
    padding: 8px;
    border-top: 1px solid var(--vscode-panel-border);
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--vscode-sideBar-background);
  }

  #include-code-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    opacity: 0.7;
  }

  #input-row {
    display: flex;
    gap: 6px;
  }

  #input {
    flex: 1;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    padding: 6px 8px;
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    resize: none;
    outline: none;
    min-height: 36px;
    max-height: 120px;
  }

  #input:focus {
    border-color: var(--vscode-focusBorder);
  }

  #send {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 13px;
    white-space: nowrap;
    align-self: flex-end;
  }

  #send:hover { background: var(--vscode-button-hoverBackground); }
  #send:disabled { opacity: 0.5; cursor: not-allowed; }

  .typing-indicator {
    display: flex;
    gap: 4px;
    padding: 8px 10px;
  }

  .dot {
    width: 6px; height: 6px;
    background: var(--vscode-foreground);
    border-radius: 50%;
    opacity: 0.4;
    animation: bounce 1.2s infinite;
  }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
    40% { transform: translateY(-4px); opacity: 1; }
  }
</style>
</head>
<body>

<div id="messages">
  <div class="msg assistant">
    <span class="msg-label">AI Copilot</span>
    <div class="msg-bubble">👋 Hi! I'm your AI coding assistant. Ask me anything about your code, or check "Include current file" to give me context.</div>
  </div>
</div>

<div id="footer">
  <div id="toolbar">
    <button id="settingsBtn" title="Open Settings">⚙ Settings</button>
  </div>

  <div id="include-code-row">
    <input type="checkbox" id="include-code" checked/>
    <label for="include-code">Include current file as context</label>
  </div>
  <div id="input-row">
    <textarea id="input" placeholder="Ask anything about your code..." rows="1"></textarea>
    <button id="send">Send</button>
  </div>

  
</div>

<script>
  const vscode  = acquireVsCodeApi();
  const msgs    = document.getElementById('messages');
  const input   = document.getElementById('input');
  const sendBtn = document.getElementById('send');
  const includeCode = document.getElementById('include-code');

  let isStreaming = false;
  let currentBubble = null;

  function scrollBottom() {
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addMessage(role, text = "") {
    const wrap   = document.createElement('div');
    wrap.className = \`msg \${role}\`;

    const label  = document.createElement('span');
    label.className = 'msg-label';
    label.textContent = role === 'user' ? 'You' : role === 'error' ? 'Error' : 'AI Copilot';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;

    wrap.appendChild(label);
    wrap.appendChild(bubble);
    msgs.appendChild(wrap);
    scrollBottom();
    return bubble;
  }

  function addTypingIndicator() {
    const wrap = document.createElement('div');
    wrap.className = 'msg assistant';
    wrap.id = 'typing';

    const label = document.createElement('span');
    label.className = 'msg-label';
    label.textContent = 'AI Copilot';

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';

    wrap.appendChild(label);
    wrap.appendChild(indicator);
    msgs.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  function removeTypingIndicator() {
    const el = document.getElementById('typing');
    if (el) el.remove();
  }

  function send() {
    const text = input.value.trim();
    if (!text || isStreaming) return;

    addMessage('user', text);
    input.value = '';
    input.style.height = 'auto';
    isStreaming = true;
    sendBtn.disabled = true;

    const typing = addTypingIndicator();

    vscode.postMessage({
      type: 'userMessage',
      text,
      includeCode: includeCode.checked,
    });
  }

  // Handle streamed response from extension
  window.addEventListener('message', (event) => {
    const msg = event.data;

    if (msg.type === 'streamToken') {
      if (!currentBubble) {
        removeTypingIndicator();
        currentBubble = addMessage('assistant');
      }
      currentBubble.textContent += msg.token;
      scrollBottom();
    }

    if (msg.type === 'streamDone') {
      currentBubble = null;
      isStreaming = false;
      sendBtn.disabled = false;
    }

    if (msg.type === 'error') {
      removeTypingIndicator();
      addMessage('error', msg.message);
      currentBubble = null;
      isStreaming = false;
      sendBtn.disabled = false;
    }
  });

  // Send on Enter (Shift+Enter for newline)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  sendBtn.addEventListener('click', send);

  window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('settingsBtn').addEventListener('click', () => {
    vscode.postMessage({ type: 'openSettings' });
  });
});
});
</script>


</body>
</html>`;
    }
}
exports.ChatViewProvider = ChatViewProvider;
ChatViewProvider.viewType = "aiCopilot.chatView";
//# sourceMappingURL=chatPanel.js.map