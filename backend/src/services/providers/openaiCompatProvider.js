import { createOpenAICompatibleProvider } from "./openaiCompatibleCore.js";

/**
 * One module for every OpenAI Chat Completions–shaped API.
 * Select with PROVIDER: openai | groq | openai_compatible
 */
function resolveConfig() {
  const p = process.env.PROVIDER || "ollama";

  if (p === "openai_compatible") {
    const base = process.env.OPENAI_COMPAT_BASE_URL || "";
    if (!base.trim()) {
      throw new Error(
        'Provider "openai_compatible" requires OPENAI_COMPAT_BASE_URL (e.g. http://localhost:11434/v1)'
      );
    }
    return {
      baseUrl: base,
      apiKey: process.env.OPENAI_COMPAT_API_KEY || undefined,
      model: process.env.OPENAI_COMPAT_MODEL || "gpt-4o-mini",
      errorLabel: "OpenAI-compatible",
    };
  }

  throw new Error(`openaiCompatProvider loaded with unexpected PROVIDER: ${p}`);
}

let impl;

function getImpl() {
  if (!impl) {
    impl = createOpenAICompatibleProvider(resolveConfig());
  }
  return impl;
}

export async function complete(prompt) {
  return getImpl().complete(prompt);
}

export async function* stream(prompt) {
  yield* getImpl().stream(prompt);
}
