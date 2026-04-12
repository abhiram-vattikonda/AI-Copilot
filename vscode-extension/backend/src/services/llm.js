import * as ollama    from "./providers/ollama.js";
import * as openai    from "./providers/openai.js";
import * as anthropic from "./providers/anthropic.js";
import * as groq      from "./providers/groq.js";   // ← add this

const providers = { ollama, openai, anthropic, groq };  // ← add groq here

const providerName = process.env.PROVIDER || "ollama";
const active = providers[providerName];

if (!active) {
  throw new Error(
    `Unknown provider: "${providerName}". Valid options: ${Object.keys(providers).join(", ")}`
  );
}

console.log(`🔌 LLM provider loaded: ${providerName}`);

export const complete = active.complete;
export const stream   = active.stream;