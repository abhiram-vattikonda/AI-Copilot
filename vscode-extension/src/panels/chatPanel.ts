import * as vscode from "vscode";
import { streamChat, type ChatMessage, getActiveModel } from "../services/api";

export class ChatPanel {
  private static instance: ChatPanel | undefined;

  static show(context: vscode.ExtensionContext) {
    if (ChatPanel.instance) {
      ChatPanel.instance.panel.reveal(vscode.ViewColumn.Beside, true);
      return;
    }
    ChatPanel.instance = new ChatPanel(context);
  }

  static sendExplanation(
    context: vscode.ExtensionContext,
    code: string,
    language: string,
    explanation: string
  ) {
    ChatPanel.show(context);
    if (!ChatPanel.instance) return;
    const panel = ChatPanel.instance;
    panel.messages.push({ role: "user", content: `Explain this ${language} code:\n\`\`\`${language}\n${code}\n\`\`\`` });
    panel.messages.push({ role: "assistant", content: explanation });
    panel.postState();
  }

  /** Called from extension.ts after user switches model — updates the header pill */
  static notifyModelChanged(label: string, model: string) {
    ChatPanel.instance?.panel.webview.postMessage({ type: "modelChanged", label, model });
  }

  private readonly panel: vscode.WebviewPanel;
  private messages: ChatMessage[] = [];

  private constructor(context: vscode.ExtensionContext) {
    this.panel = vscode.window.createWebviewPanel(
      "aiCopilotChat",
      "AI Copilot Chat",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")],
      }
    );

    this.panel.webview.html = this.getHtml(this.panel.webview, context.extensionUri);
    this.panel.onDidDispose(() => { ChatPanel.instance = undefined; });

    this.panel.webview.onDidReceiveMessage(
      async (msg: { type: string; text?: string }) => {
        if (msg.type === "send" && msg.text?.trim()) {
          const userText = msg.text.trim();
          this.messages.push({ role: "user", content: userText });
          this.postState();
          this.panel.webview.postMessage({ type: "assistantStart" });
          try {
            let acc = "";
            await streamChat(this.messages, (token) => {
              acc += token;
              this.panel.webview.postMessage({ type: "assistantDelta", token });
            });
            this.messages.push({ role: "assistant", content: acc });
            this.panel.webview.postMessage({ type: "assistantDone" });
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.panel.webview.postMessage({ type: "assistantError", message });
          }
          this.postState();

        } else if (msg.type === "switchModel") {
          vscode.commands.executeCommand("aiCopilot.switchModel");

        } else if (msg.type === "explainSelection") {
          vscode.commands.executeCommand("aiCopilot.explain");

        } else if (msg.type === "clear") {
          this.messages = [];
          this.postState();

        } else if (msg.type === "ready") {
          this.postState();
          // Send current model info to webview
          const { label, model } = getActiveModel();
          if (label && model) {
            this.panel.webview.postMessage({ type: "modelChanged", label, model });
          }
        }
      },
      undefined,
      context.subscriptions
    );
  }

  private postState() {
    this.panel.webview.postMessage({ type: "history", messages: this.messages });
  }

  private getHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const styleUri  = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "chat.css"));
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
    <button type="button" id="model-pill" title="Click to switch model">
      <span id="model-pill-icon">⬡</span>
      <span id="model-pill-text">select model</span>
    </button>
    <div class="toolbar-spacer"></div>
    <button type="button" id="explain">Explain selection</button>
    <button type="button" id="clear">Clear</button>
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
