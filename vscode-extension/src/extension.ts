import * as vscode from "vscode";
import { AICompletionProvider } from "./providers/completion";
import { runDiagnostics } from "./providers/diagnostics";
import { fetchCompletion, fetchFix, fetchSuggestions } from "./services/api";

export function activate(ctx: vscode.ExtensionContext) {

  // ── Inline completion provider (keeps ghost text working if VS Code allows it)
  ctx.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: "**" },
      new AICompletionProvider()
    )
  );

  // ── Auto-complete on typing pause ─────────────────────────────
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  let lastInsertedText = "";

  ctx.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || event.document !== editor.document) return;

      // Clear previous timer on every keystroke
      if (typingTimer) clearTimeout(typingTimer);

      typingTimer = setTimeout(async () => {
        const code = event.document.getText();
        if (code.trim().length < 2) return;
        if (code === lastInsertedText) return;

        try {
          console.log("🟡 auto-triggering completion...");
          await vscode.commands.executeCommand("editor.action.inlineSuggest.trigger");
          console.log("🟢 suggestion triggered");
        } catch (err) {
          console.error("🔴 auto-complete error:", err);
        }
      }, 1500); // 1.5 seconds after you stop typing
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

  console.log("✅ AI Copilot extension active");
}

export function deactivate() {}
