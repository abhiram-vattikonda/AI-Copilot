import { complete } from "./llm.js";

/**
 * Analyzes code and returns structured suggestions.
 * Prompts the LLM to respond in JSON so we can parse it reliably.
 */
export async function analyze(code, language) {
  const prompt = `You are an expert code reviewer. Analyze this ${language} code.
Respond ONLY with a valid JSON object — no explanation, no markdown, no backticks.

{
  "bugs": ["<description of bug>"],
  "optimizations": ["<optimization suggestion>"],
  "severity": "low" | "medium" | "high"
}

Code to analyze:
\`\`\`${language}
${code}
\`\`\`

JSON:`;

  const raw = await complete(prompt);

  try {
    // Strip any accidental markdown fences the model may add
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found in response");
    return JSON.parse(match[0]);
  } catch {
    return { bugs: [], optimizations: [], severity: "low" };
  }
}