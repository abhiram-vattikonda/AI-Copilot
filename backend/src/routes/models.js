import { Router } from "express";
import { getProviderConfigs } from "../services/providerRegistry.js";

const router = Router();

async function fetchLiveModels(cfg) {
  try {
    if (cfg.type === "ollama") {
      const r = await fetch(`${cfg.baseUrl || "http://localhost:11434"}/api/tags`);
      const d = await r.json();
      return (d.models || []).map(m => m.name).sort();
    }

    if (cfg.type === "openai_compatible") {
      const base = cfg.baseUrl.replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
      const hdrs = { "Content-Type": "application/json" };
      if (cfg.apiKey) hdrs.Authorization = `Bearer ${cfg.apiKey}`;
      const r = await fetch(`${base}/models`, { headers: hdrs });
      const d = await r.json();
      return (d.data || []).map(m => m.id).sort();
    }
  } catch { /* unreachable provider — fall through */ }
  return [];
}

router.get("/", async (req, res) => {
  const configs = getProviderConfigs();
  const result  = [];

  for (const cfg of configs) {
    // Skip clearly unconfigured anthropic entries
    if (cfg.type === "anthropic" && (!cfg.apiKey || cfg.apiKey.startsWith("sk-ant-..."))) {
      continue;
    }

    let models = cfg.staticModels.length
      ? cfg.staticModels
      : await fetchLiveModels(cfg);

    // If live fetch returned nothing but we have a fallback static list, skip quietly
    if (!models.length) continue;

    result.push({
      providerKey: cfg.key,
      label:       cfg.label,
      type:        cfg.type,
      models,
    });
  }

  res.json({ providers: result });
});

export default router;
