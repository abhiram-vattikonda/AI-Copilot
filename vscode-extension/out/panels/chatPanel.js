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
exports.ChatPanel = void 0;
const vscode = __importStar(require("vscode"));
const api_1 = require("../services/api");
class ChatPanel {
    static sendExplanation(context, code, language, explanation) {
        // Ensure the panel is open
        ChatPanel.show(context);
        if (!ChatPanel.instance)
            return;
        const panel = ChatPanel.instance;
        const userContent = `Explain this ${language} code:\n\`\`\`${language}\n${code}\n\`\`\``;
        panel.messages.push({ role: "user", content: userContent });
        panel.messages.push({ role: "assistant", content: explanation });
        panel.postState();
    }
    static show(context) {
        if (ChatPanel.instance) {
            ChatPanel.instance.panel.reveal(vscode.ViewColumn.Beside, true);
            return;
        }
        ChatPanel.instance = new ChatPanel(context);
    }
    constructor(context) {
        this.messages = [];
        this.panel = vscode.window.createWebviewPanel("aiCopilotChat", "AI Copilot Chat", vscode.ViewColumn.Beside, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")],
        });
        this.panel.webview.html = this.getHtml(this.panel.webview, context.extensionUri);
        this.panel.onDidDispose(() => {
            ChatPanel.instance = undefined;
        });
        this.panel.webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === "send" && msg.text?.trim()) {
                const userText = msg.text.trim();
                this.messages.push({ role: "user", content: userText });
                this.postState();
                this.panel.webview.postMessage({ type: "assistantStart" });
                try {
                    let acc = "";
                    await (0, api_1.streamChat)(this.messages, (token) => {
                        acc += token;
                        this.panel.webview.postMessage({ type: "assistantDelta", token });
                    });
                    this.messages.push({ role: "assistant", content: acc });
                    this.panel.webview.postMessage({ type: "assistantDone" });
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    this.panel.webview.postMessage({ type: "assistantError", message });
                }
                this.postState();
            }
            else if (msg.type === "explainSelection") {
                // Trigger the explain command, which uses the active editor's selection
                vscode.commands.executeCommand("aiCopilot.explain");
            }
            else if (msg.type === "clear") {
                this.messages = [];
                this.postState();
            }
            else if (msg.type === "ready") {
                this.postState();
            }
        }, undefined, context.subscriptions);
    }
    postState() {
        this.panel.webview.postMessage({ type: "history", messages: this.messages });
    }
    getHtml(webview, extensionUri) {
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "chat.css"));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "chat.js"));
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};" />
  <link href="${styleUri}" rel="stylesheet" />
</head>
<body>
  <div class="toolbar">
    <button type="button" id="explain">Explain selection</button>
    <button type="button" id="clear">Clear chat</button>
  </div>
  <div id="log" class="log"></div>
  <div class="input-row">
    <textarea id="input" rows="3" placeholder="Message… (Shift+Enter for newline)"></textarea>
    <button type="button" id="send">Send</button>
  </div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}
exports.ChatPanel = ChatPanel;
//# sourceMappingURL=chatPanel.js.map