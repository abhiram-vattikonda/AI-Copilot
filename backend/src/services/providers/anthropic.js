const BASE    = "https://api.anthropic.com/v1/messages";
const MODEL   = process.env.ANTHROPIC_MODEL   || "claude-sonnet-4-6";
const API_KEY = process.env.ANTHROPIC_API_KEY;

function headers(streaming = false) {
  return {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
    "anthropic-version": "2023-06-01",
    ...(streaming ? { "anthropic-beta": "messages-2023-12-15" } : {}),
  };
}

export async function complete(prompt) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.content[0].text;
}

export async function* stream(prompt) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic stream error: ${res.status}`);

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value).split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        const json = JSON.parse(line.slice(6));
        if (json.type === "content_block_delta") yield json.delta.text;
      } catch { /* skip */ }
    }
  }
}
// Model-override variants used by llm.js when a per-request model is specified
export async function completeWithModel(prompt, model) {
  const m = model || MODEL;
  const res = await fetch(BASE, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: m,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.content[0].text;
}

export async function* streamWithModel(prompt, model) {
  const m = model || MODEL;
  const res = await fetch(BASE, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({
      model: m,
      max_tokens: 1024,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic stream error: ${res.status}`);
  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value).split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        const json = JSON.parse(line.slice(6));
        if (json.type === "content_block_delta") yield json.delta.text;
      } catch { /* skip */ }
    }
  }
}
