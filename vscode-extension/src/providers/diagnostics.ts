import * as vscode from "vscode";
import { fetchSuggestions } from "../services/api";

const collection = vscode.languages.createDiagnosticCollection("ai-copilot");

export async function runDiagnostics(editor: vscode.TextEditor) {
  const code = editor.document.getText();
  const lang = editor.document.languageId;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "AI: Analyzing code..." },
    async () => {
      try {
        console.log("🟡 fetching suggestions...");
        const { bugs, optimizations } = await fetchSuggestions(code, lang);
        console.log("🟢 bugs:", bugs, "opts:", optimizations);

        const diags: vscode.Diagnostic[] = [];
        const lastLine = editor.document.lineCount - 1;

        // Spread bugs across actual lines in the file
        bugs.forEach((msg, i) => {
          const line = Math.min(i, lastLine);
          diags.push(new vscode.Diagnostic(
            new vscode.Range(line, 0, line, 999),
            `🐛 ${msg}`,
            vscode.DiagnosticSeverity.Warning
          ));
        });

        optimizations.forEach((msg, i) => {
          const line = Math.min(bugs.length + i, lastLine);
          diags.push(new vscode.Diagnostic(
            new vscode.Range(line, 0, line, 999),
            `💡 ${msg}`,
            vscode.DiagnosticSeverity.Information
          ));
        });

        collection.set(editor.document.uri, diags);

        vscode.window.showInformationMessage(
          `AI found ${bugs.length} bug(s) and ${optimizations.length} suggestion(s). Check the Problems panel.`
        );
      } catch (err: any) {
        console.error("🔴 diagnostics error:", err);
        vscode.window.showErrorMessage(`AI Copilot: ${err.message}`);
      }
    }
  );
}