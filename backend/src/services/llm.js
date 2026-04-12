import * as ollama from "./providers/ollama.js";
import * as openaiCompat from "./providers/openaiCompatProvider.js";
import * as anthropic from "./providers/anthropic.js";

const providers = {
  ollama,
  anthropic,
  openai_compatible: openaiCompat,
};

const providerName = process.env.PROVIDER || "ollama";
const active = providers[providerName];

if (!active) {
  throw new Error(
    `Unknown provider: "${providerName}". Valid options: ${Object.keys(providers).join(", ")}`
  );
}

console.log(`🔌 LLM provider loaded: ${providerName}`);

export const complete = active.complete;
export const stream = active.stream;
