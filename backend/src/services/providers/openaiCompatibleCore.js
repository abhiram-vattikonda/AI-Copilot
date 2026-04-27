/**
 * OpenAI Chat Completions API (POST .../chat/completions).
 * Works with OpenAI, OpenRouter, vLLM, LiteLLM, Ollama (/v1), Azure OpenAI
 * (set base to resource + deployment path), and other compatible servers.
 */

function joinUrl(base, path) {
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
}

export function resolveChatCompletionsUrl(baseUrl) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  return joinUrl(trimmed, "chat/completions");
}

/**
 * @param {{ baseUrl: string, apiKey?: string, model: string, errorLabel?: string }} config
 */
export function createOpenAICompatibleProvider(config) {
  const {
    baseUrl,
    apiKey,
    model,
    errorLabel = "OpenAI-compatible",
  } = config;

  const url = resolveChatCompletionsUrl(baseUrl);

  function headers() {
    const h = { "Content-Type": "application/json" };
    if (apiKey) h.Authorization = `Bearer ${apiKey}`;
    return h;
  }

  async function complete(prompt) {
    const res = await fetch(url, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        detail = JSON.stringify(await res.json());
      } catch {
        /* ignore */
      }
      throw new Error(`${errorLabel} error: ${res.status} ${detail}`);
    }
    const data = await res.json();
    return data.choices[0].message.content;
  }

  async function* stream(prompt) {
    const res = await fetch(url, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        stream: true,
      }),
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        detail = JSON.stringify(await res.json());
      } catch {
        /* ignore */
      }
      throw new Error(`${errorLabel} stream error: ${res.status} ${detail}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value).split("\n")) {
        if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
        try {
          const json = JSON.parse(line.slice(6));
          const token = json.choices?.[0]?.delta?.content;
          if (token) yield token;
        } catch {
          /* skip */
        }
      }
    }
  }

  return { complete, stream };
}
