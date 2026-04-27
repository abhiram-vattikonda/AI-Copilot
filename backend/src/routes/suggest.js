import { Router } from "express";
import { analyze } from "../services/suggestions.js";
import { logger }  from "../services/logger.js";

const router = Router();

router.post("/", async (req, res) => {
  const { code, language = "javascript", providerKey, model } = req.body;

  if (!code) return res.status(400).json({ error: "Missing required field: code" });

  const start = Date.now();

  try {
    const result = await analyze(code, language, { providerKey, model });
    const ms     = Date.now() - start;
    logger.request("/suggest", providerKey || process.env.PROVIDER || "default", ms);
    res.json({ ...result, latency: ms });
  } catch (err) {
    logger.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;