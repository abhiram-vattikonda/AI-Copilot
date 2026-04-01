import * as vscode from "vscode";
import { fetchCompletion } from "../services/api";

export class AICompletionProvider implements vscode.InlineCompletionItemProvider {
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.InlineCompletionList> {
    console.log("🔵 provider fired");

    const prefix = document.getText(
      new vscode.Range(new vscode.Position(0, 0), position)
    );
    if (prefix.trim().length < 2) return { items: [] };

    try {
      const result = await fetchCompletion(document, position, document.languageId);
      if (!result?.trim()) return { items: [] };
      return {
        items: [{ insertText: result, range: new vscode.Range(position, position) }],
      };
    } catch (err) {
      console.error("🔴 completion error:", err);
      return { items: [] };
    }
  }
}