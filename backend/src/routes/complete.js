import { Router } from "express";
import { complete } from "../services/llm.js";
import { logger }   from "../services/logger.js";

const router = Router();

function buildPrompt(task, language, { code, prefix, suffix }) {
  switch (task) {
    case "complete":
      // FIM (fill-in-middle) style prompt — only complete what comes after cursor
      return `You are a code completion assistant. Complete the ${language} code at the cursor position.
IMPORTANT: Return ONLY the completion text that should be inserted at the cursor. Do not repeat the code before the cursor. Do not add explanations.

Code before cursor:
${prefix}
<CURSOR>
Code after cursor:
${suffix || ""}

Completion:`;

    case "fix":
      return `Fix all bugs in this ${language} code. Return the corrected code only, no explanation:\n\n${code}`;

    case "explain":
      return `Explain what this ${language} code does in 2-3 sentences:\n\n${code}`;

    default:
      return `Complete this ${language} code. Return only the completion:\n\n${prefix}`;
  }
}

router.post("/", async (req, res) => {
  const {
    code,
    prefix,
    suffix,
    language = "javascript",
    task = "complete",
  } = req.body;

  // Support both old (code) and new (prefix/suffix) formats
  const context = { code, prefix: prefix ?? code, suffix: suffix ?? "" };

  if (!code && !prefix) {
    return res.status(400).json({ error: "Missing required field: code or prefix" });
  }

  const prompt = buildPrompt(task, language, context);
  const start  = Date.now();

  try {
    const result = await complete(prompt);
    const ms     = Date.now() - start;
    logger.request("/complete", process.env.PROVIDER, ms);
    res.json({ result, latency: ms, task, language });
  } catch (err) {
    logger.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;