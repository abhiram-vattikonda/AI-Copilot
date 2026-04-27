import { Router } from "express";
import { complete } from "../services/llm.js";
import { logger } from "../services/logger.js";
import { stripOuterMarkdownFence } from "../services/stripCodeFence.js";

const router = Router();

function buildPrompt(task, language, { code, prefix, suffix }) {
  switch (task) {
    case "complete":
      return `You are a code completion assistant. Complete the ${language} code at the cursor position.
IMPORTANT: Return ONLY the completion text that should be inserted at the cursor. Do not repeat the code before the cursor. Do not add explanations.

Code before cursor:
${prefix}
<CURSOR>
Code after cursor:
${suffix || ""}

Completion:`;

    case "fix":
      return `Fix all bugs in this ${language} code.

STRICT OUTPUT RULES:
- Return ONLY the raw source code of the fixed program.
- Do NOT wrap the code in markdown fences (no triple backticks or language tags).
- Do NOT add any explanation, headings, or text before or after the code.
- Indicate each change with a short inline comment on the same line (e.g. // fix: ...).

--- code to fix ---
${code}
--- end ---`;

    case "explain":
      return `Explain what this ${language} code does in 2-3 sentences:\n\n${code}`;

    default:
      return `Complete this ${language} code. Return only the completion:\n\n${prefix}`;
  }
}

router.post("/", async (req, res) => {
  const {
    code, prefix, suffix,
    language = "javascript",
    task = "complete",
    providerKey,
    model,
  } = req.body;

  const context = { code, prefix: prefix ?? code, suffix: suffix ?? "" };
  if (!code && !prefix) {
    return res.status(400).json({ error: "Missing required field: code or prefix" });
  }

  const prompt = buildPrompt(task, language, context);
  const start  = Date.now();

  try {
    let result = await complete(prompt, { providerKey, model });
    if (task === "fix") result = stripOuterMarkdownFence(result);
    const ms = Date.now() - start;
    logger.request("/complete", providerKey || "default", ms);
    res.json({ result, latency: ms, task, language });
  } catch (err) {
    logger.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
