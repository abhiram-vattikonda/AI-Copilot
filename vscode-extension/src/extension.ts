import * as vscode from "vscode";
import * as path from "path";
import { AICompletionProvider } from "./providers/completion";
import { runDiagnostics } from "./providers/diagnostics";
import { fetchCompletion, fetchFix } from "./services/api";
import { ChatViewProvider } from "./panels/chatPanel";
import { SettingsPanel } from "./panels/settingsPanel";
import { startBackend, restartBackend, stopBackend } from "./services/backendManager";

export async function activate(ctx: vscode.ExtensionContext) {

  // ── Auto-start the embedded backend ──────────────────────────
  vscode.window.showInformationMessage("🚀 AI Copilot starting backend...");
  await startBackend(ctx.extensionUri, ctx);

  // ── Inline completion provider ────────────────────────────────
  ctx.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: "**" },
      new AICompletionProvider()
    )
  );

  // ── Chat sidebar ──────────────────────────────────────────────
  ctx.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      new ChatViewProvider(ctx.extensionUri)
    )
  );

  // ── Auto-complete on typing pause ─────────────────────────────
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  let lastInsertedText = "";

  ctx.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || event.document !== editor.document) return;
      if (typingTimer) clearTimeout(typingTimer);

      typingTimer = setTimeout(async () => {
        const code = event.document.getText();
        if (code.trim().length < 2) return;
        if (code === lastInsertedText) return;
        try {
          await vscode.commands.executeCommand("editor.action.inlineSuggest.trigger");
        } catch (err) {
          console.error("auto-complete error:", err);
        }
      }, 1500);
    })
  );

  // ── Commands ──────────────────────────────────────────────────
  ctx.subscriptions.push(
    vscode.commands.registerCommand("aiCopilot.suggest", async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) await runDiagnostics(editor);
    })
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand("aiCopilot.fix", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "AI: Fixing bugs..." },
        async () => {
          try {
            const result = await fetchFix(
              editor.document.getText(),
              editor.document.languageId
            );
            await editor.edit((eb) =>
              eb.replace(
                new vscode.Range(
                  new vscode.Position(0, 0),
                  editor.document.lineAt(editor.document.lineCount - 1).range.end
                ),
                result
              )
            );
          } catch (err: any) {
            vscode.window.showErrorMessage(`AI Copilot: ${err.message}`);
          }
        }
      );
    })
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand("aiCopilot.triggerComplete", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "AI: Completing..." },
        async () => {
          try {
            const result = await fetchCompletion(
              editor.document,
              editor.selection.active,
              editor.document.languageId
            );
            await editor.edit((eb) => eb.insert(editor.selection.active, result));
          } catch (err: any) {
            vscode.window.showErrorMessage(`AI Copilot: ${err.message}`);
          }
        }
      );
    })
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand("aiCopilot.openSettings", () => {
      SettingsPanel.open(ctx.extensionUri, ctx);
    })
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand("aiCopilot.restartBackend", () => {
      restartBackend(ctx.extensionUri, ctx);
      vscode.window.showInformationMessage("🔄 Backend restarting...");
    })
  );

  console.log("✅ AI Copilot extension active");
}

export function deactivate() {
  stopBackend();
}