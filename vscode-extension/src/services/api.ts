import * as vscode from "vscode";

function backendUrl() {
  return vscode.workspace
    .getConfiguration("aiCopilot")
    .get<string>("backendUrl", "http://localhost:3000");
}

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

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
  const endLine = Math.min(document.lineCount - 1, position.line + suffixLines);

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

function stripOuterMarkdownFence(text: string): string {
  const t = text.trim();
  if (!t.startsWith("```")) return text;
  const full = /^```(?:[\w.+-]*)\s*\r?\n([\s\S]*?)\r?\n```\s*$/.exec(t);
  if (full) return full[1].trimEnd();
  let rest = t.replace(/^```(?:[\w.+-]*)\s*\r?\n?/, "");
  const close = rest.lastIndexOf("```");
  if (close !== -1) rest = rest.slice(0, close);
  return rest.trimEnd();
}

export async function fetchExplain(code: string, language: string) {
  const res = await fetch(`${backendUrl()}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, language, task: "explain" }),
  });
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  const result = (await res.json()).result as string;
  return result;
}

export async function fetchFix(code: string, language: string) {
  const res = await fetch(`${backendUrl()}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, language, task: "fix" }),
  });
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  let result = (await res.json()).result as string;
  result = stripOuterMarkdownFence(result);
  return result;
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

/**
 * Streams assistant tokens from POST /chat/stream (SSE).
 */
export async function streamChat(
  messages: ChatMessage[],
  onToken: (token: string) => void
): Promise<void> {
  const res = await fetch(`${backendUrl()}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Backend error: ${res.status}`);
  }

  const body = res.body;
  if (!body) throw new Error("Empty response body");

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const line of parts) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        const json = JSON.parse(data) as { token?: string; error?: string };
        if (json.error) throw new Error(json.error);
        if (json.token) onToken(json.token);
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
}
