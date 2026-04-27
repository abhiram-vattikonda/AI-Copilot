/**
 * Remove a single outer ```lang ... ``` wrapper if the model returned one anyway.
 */
export function stripOuterMarkdownFence(text) {
  if (typeof text !== "string") return text;
  const t = text.trim();
  if (!t.startsWith("```")) return text;

  const full = t.match(/^```(?:[\w.+-]*)\s*\r?\n([\s\S]*?)\r?\n```\s*$/);
  if (full) return full[1].trimEnd();

  let rest = t.replace(/^```(?:[\w.+-]*)\s*\r?\n?/, "");
  const close = rest.lastIndexOf("```");
  if (close !== -1) rest = rest.slice(0, close);
  return rest.trimEnd();
}
