/**
 * Flatten chat messages into one prompt for providers that only expose stream(prompt).
 */
export function messagesToPrompt(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("messages must be a non-empty array");
  }
  const lines = ["You are a helpful coding assistant. Answer clearly and concisely."];
  for (const m of messages) {
    const role = (m.role || "user").toLowerCase();
    const content = typeof m.content === "string" ? m.content : String(m.content ?? "");
    if (role === "system") lines.push(`Instructions: ${content}`);
    else if (role === "assistant") lines.push(`Assistant: ${content}`);
    else lines.push(`User: ${content}`);
  }
  lines.push("Assistant:");
  return lines.join("\n\n");
}
