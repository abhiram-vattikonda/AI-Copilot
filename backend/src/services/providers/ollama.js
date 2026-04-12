const BASE  = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL    || "codellama:7b";

export async function complete(prompt) {
  const res = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.response;
}

export async function* stream(prompt) {
  const res = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt, stream: true }),
  });
  if (!res.ok) throw new Error(`Ollama stream error: ${res.status}`);

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value).split("\n").filter(Boolean)) {
      try {
        const json = JSON.parse(line);
        if (json.response) yield json.response;
      } catch { /* skip malformed lines */ }
    }
  }
}