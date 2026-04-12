import { Router } from "express";
import { stream } from "../services/llm.js";
import { messagesToPrompt } from "../services/chatPrompt.js";
import { logger } from "../services/logger.js";

const router = Router();

router.post("/stream", async (req, res) => {
  const { messages } = req.body;
  let prompt;
  try {
    prompt = messagesToPrompt(messages);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  if (typeof res.flushHeaders === "function") res.flushHeaders();
  const start = Date.now();

  try {
    for await (const token of stream(prompt)) {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    logger.request("/chat/stream", process.env.PROVIDER, Date.now() - start);
  } catch (err) {
    logger.error(err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  }
  res.end();
});

export default router;
