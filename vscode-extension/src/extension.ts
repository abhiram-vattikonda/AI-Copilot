import * as vscode from "vscode";
import { AICompletionProvider } from "./providers/completion";
import { runDiagnostics } from "./providers/diagnostics";
import { ChatPanel } from "./panels/chatPanel";
import { fetchFix, fetchSuggestions, fetchExplain, fetchModels, getActiveModel } from "./services/api";

export function activate(ctx: vscode.ExtensionContext) {

  // ── Inline completion ─────────────────────────────────────────
  ctx.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: "**" },
      new AICompletionProvider()
    )
  );

  // ── Auto-complete on typing pause ─────────────────────────────
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  ctx.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || event.document !== editor.document) return;
      if (typingTimer) clearTimeout(typingTimer);
      typingTimer = setTimeout(async () => {
        const code = event.document.getText();
        if (code.trim().length < 2) return;
        try { await vscode.commands.executeCommand("editor.action.inlineSuggest.trigger"); }
        catch (err) { console.error("🔴 auto-complete error:", err); }
      }, 1500);
    })
  );

  // ── Status bar ────────────────────────────────────────────────
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = "aiCopilot.switchModel";
  statusBar.tooltip = "AI Copilot — click to switch model";

  function updateStatusBar() {
    const { label, model } = getActiveModel();
    statusBar.text = label && model
      ? `$(circuit-board) ${label} · ${model}`
      : `$(circuit-board) AI: select model`;
    statusBar.show();
  }
  updateStatusBar();
  ctx.subscriptions.push(statusBar);

  // Keep status bar in sync when settings change (e.g. another window updated them)
  ctx.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration("aiCopilot")) updateStatusBar();
    })
  );

  // ── switchModel command ───────────────────────────────────────
  ctx.subscriptions.push(
    vscode.commands.registerCommand("aiCopilot.switchModel", async () => {
      const allProviders = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "AI Copilot: Fetching available models…" },
        () => fetchModels()
      );

      if (!allProviders.length) {
        vscode.window.showErrorMessage(
          "AI Copilot: Backend unreachable or no providers configured in .env"
        );
        return;
      }

      // Build quick-pick with provider separators
      type ModelItem = vscode.QuickPickItem & { providerKey?: string; modelId?: string; providerLabel?: string };
      const items: ModelItem[] = [];

      for (const p of allProviders) {
        items.push({
          label: `${p.label}  (${p.type})`,
          kind: vscode.QuickPickItemKind.Separator,
        });
        for (const m of p.models) {
          const { providerKey: curKey, model: curModel } = getActiveModel();
          const isActive = curKey === p.providerKey && curModel === m;
          items.push({
            label:         m,
            description:   p.label,
            detail:        isActive ? "✓ currently active" : undefined,
            providerKey:   p.providerKey,
            modelId:       m,
            providerLabel: p.label,
          });
        }
      }

      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a model — all AI features will use it",
        matchOnDescription: true,
        matchOnDetail: false,
      }) as ModelItem | undefined;

      if (!picked || !picked.providerKey) return;

      const cfg = vscode.workspace.getConfiguration("aiCopilot");
      await cfg.update("activeProviderKey", picked.providerKey,   vscode.ConfigurationTarget.Global);
      await cfg.update("activeModel",       picked.modelId,       vscode.ConfigurationTarget.Global);
      await cfg.update("activeLabel",       picked.providerLabel, vscode.ConfigurationTarget.Global);

      updateStatusBar();
      ChatPanel.notifyModelChanged(picked.providerLabel!, picked.modelId!);
      vscode.window.showInformationMessage(
        `AI Copilot: switched to ${picked.providerLabel} · ${picked.modelId}`
      );
    })
  );

  // ── Other commands ────────────────────────────────────────────
  ctx.subscriptions.push(
    vscode.commands.registerCommand("aiCopilot.suggest", async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) await runDiagnostics(editor);
    })
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand("aiCopilot.chat", () => ChatPanel.show(ctx))
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand("aiCopilot.fix", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "AI: Fixing bugs…" },
        async () => {
          try {
            const result = await fetchFix(editor.document.getText(), editor.document.languageId);
            await editor.edit(eb => eb.replace(
              new vscode.Range(
                new vscode.Position(0, 0),
                editor.document.lineAt(editor.document.lineCount - 1).range.end
              ),
              result
            ));
          } catch (err: any) {
            vscode.window.showErrorMessage(`AI Copilot: ${err.message}`);
          }
        }
      );
    })
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand("aiCopilot.explain", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const selectedText = editor.document.getText(editor.selection);
      if (!selectedText.trim()) {
        vscode.window.showWarningMessage("AI Copilot: Please select some code to explain.");
        return;
      }
      ChatPanel.show(ctx);
      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "AI: Explaining code…" },
        async () => {
          try {
            const explanation = await fetchExplain(selectedText, editor.document.languageId);
            ChatPanel.sendExplanation(ctx, selectedText, editor.document.languageId, explanation);
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
