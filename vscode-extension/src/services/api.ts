import * as vscode from "vscode";

function backendUrl() {
  return vscode.workspace
    .getConfiguration("aiCopilot")
    .get<string>("backendUrl", "http://localhost:3000");
}

/**
 * Extracts context around the cursor:
 * - prefix: last N lines before cursor (what the model sees as context)
 * - suffix: next few lines after cursor (so model knows what comes next)
 */
export function getCursorContext(
  document: vscode.TextDocument,
  position: vscode.Position,
  prefixLines = 20,
  suffixLines = 5
) {
  const startLine = Math.max(0, position.line - prefixLines);
  const endLine   = Math.min(document.lineCount - 1, position.line + suffixLines);

  const prefix = document.getText(
    new vscode.Range(new vscode.Position(startLine, 0), position)
  );
  const suffix = document.getText(
    new vscode.Range(position, new vscode.Position(endLine, 999))
  );

  return { prefix, suffix };
}

export async function fetchCompletion(
  document: vscode.TextDocument,
  position: vscode.Position,
  language: string
) {
  const { prefix, suffix } = getCursorContext(document, position);

  console.log("🟡 fetching completion for cursor context...");

  const res = await fetch(`${backendUrl()}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prefix,
      suffix,
      language,
      task: "complete",
    }),
  });

  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  const result = (await res.json()).result as string;
  console.log("🟢 got result:", result.slice(0, 80));
  return result;
}

export async function fetchFix(code: string, language: string) {
  const res = await fetch(`${backendUrl()}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, language, task: "fix" }),
  });
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  return (await res.json()).result as string;
}

export async function fetchSuggestions(code: string, language: string) {
  const res = await fetch(`${backendUrl()}/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, language }),
  });
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  return res.json() as Promise<{
    bugs: string[];
    optimizations: string[];
    severity: string;
  }>;
}