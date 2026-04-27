import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    status:   "ok",
    provider: process.env.PROVIDER || "ollama",
    uptime:   process.uptime(),
  });
});

export default router;