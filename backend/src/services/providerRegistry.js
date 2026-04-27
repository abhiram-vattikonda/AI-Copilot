/**
 * providerRegistry.js
 *
 * Reads all PROVIDER_<NAME>_* env vars and returns a list of named provider configs.
 * Adding a new provider = adding lines to .env, no code changes needed.
 */

export function getProviderConfigs() {
  const names = new Set();

  // Discover all provider names from env keys
  for (const key of Object.keys(process.env)) {
    const m = key.match(/^PROVIDER_([A-Z0-9_]+)_TYPE$/);
    if (m) names.add(m[1]);
  }

  const configs = [];
  for (const name of names) {
    const type     = process.env[`PROVIDER_${name}_TYPE`];
    const baseUrl  = process.env[`PROVIDER_${name}_BASE_URL`] || "";
    const apiKey   = process.env[`PROVIDER_${name}_API_KEY`]  || "";
    const modelsRaw= process.env[`PROVIDER_${name}_MODELS`]   || "";

    const staticModels = modelsRaw
      ? modelsRaw.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    configs.push({
      key:   name.toLowerCase(),   // e.g. "groq", "ollama"
      label: name,                 // e.g. "GROQ", "OLLAMA"  (display)
      type,                        // "ollama" | "openai_compatible" | "anthropic"
      baseUrl,
      apiKey,
      staticModels,                // pre-configured list (empty = query live)
    });
  }

  return configs;
}

/** Find a single config by its key (case-insensitive) */
export function getProviderConfig(key) {
  return getProviderConfigs().find(c => c.key === key.toLowerCase()) || null;
}
