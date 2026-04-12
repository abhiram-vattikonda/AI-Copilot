import { getProviderConfig, getProviderConfigs } from "./providerRegistry.js";
import { createOpenAICompatibleProvider } from "./providers/openaiCompatibleCore.js";

function buildProvider(cfg, modelOverride) {
  if (!cfg) throw new Error("Unknown provider");

  const model = modelOverride || cfg.staticModels[0] || "";

  switch (cfg.type) {
    case "anthropic": {
      const BASE    = "https://api.anthropic.com/v1/messages";
      const API_KEY = cfg.apiKey;
      const m       = model || "claude-sonnet-4-5";

      function hdrs(streaming = false) {
        return {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
          ...(streaming ? { "anthropic-beta": "messages-2023-12-15" } : {}),
        };
      }

      return {
        async complete(prompt) {
          const res = await fetch(BASE, {
            method: "POST",
            headers: hdrs(),
            body: JSON.stringify({ model: m, max_tokens: 1024,
              messages: [{ role: "user", content: prompt }] }),
          });
          if (!res.ok) throw new Error(`Anthropic error: ${res.status} ${res.statusText}`);
          return (await res.json()).content[0].text;
        },
        async *stream(prompt) {
          const res = await fetch(BASE, {
            method: "POST",
            headers: hdrs(true),
            body: JSON.stringify({ model: m, max_tokens: 1024, stream: true,
              messages: [{ role: "user", content: prompt }] }),
          });
          if (!res.ok) throw new Error(`Anthropic stream error: ${res.status}`);
          const reader = res.body.getReader();
          const dec    = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            for (const line of dec.decode(value).split("\n")) {
              if (!line.startsWith("data: ")) continue;
              try {
                const j = JSON.parse(line.slice(6));
                if (j.type === "content_block_delta") yield j.delta.text;
              } catch { /* skip */ }
            }
          }
        },
      };
    }

    case "ollama": {
      const base = cfg.baseUrl || "http://localhost:11434";
      const m    = model || "codellama:7b";
      return {
        async complete(prompt) {
          const res = await fetch(`${base}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: m, prompt, stream: false }),
          });
          if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
          return (await res.json()).response;
        },
        async *stream(prompt) {
          const res = await fetch(`${base}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: m, prompt, stream: true }),
          });
          if (!res.ok) throw new Error(`Ollama stream error: ${res.status}`);
          const reader = res.body.getReader();
          const dec    = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            for (const line of dec.decode(value).split("\n").filter(Boolean)) {
              try { const j = JSON.parse(line); if (j.response) yield j.response; } catch { /**/ }
            }
          }
        },
      };
    }

    case "openai_compatible":
    default: {
      const p = createOpenAICompatibleProvider({
        baseUrl:    cfg.baseUrl,
        apiKey:     cfg.apiKey || undefined,
        model:      model || "gpt-4o-mini",
        errorLabel: cfg.label,
      });
      return p;
    }
  }
}

/**
 * complete(prompt, { providerKey, model })
 * stream(prompt,   { providerKey, model })
 *
 * providerKey = the lowercase name from .env (e.g. "groq", "ollama")
 * Falls back to the first configured provider if omitted.
 */
export async function complete(prompt, { providerKey, model } = {}) {
  const configs = getProviderConfigs();
  const cfg = providerKey
    ? getProviderConfig(providerKey)
    : configs[0];
  return buildProvider(cfg, model).complete(prompt);
}

export async function* stream(prompt, { providerKey, model } = {}) {
  const configs = getProviderConfigs();
  const cfg = providerKey
    ? getProviderConfig(providerKey)
    : configs[0];
  yield* buildProvider(cfg, model).stream(prompt);
}
