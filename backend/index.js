import "dotenv/config";
import express from "express";
import { createServer } from "http";
import cors from "cors";
import completeRouter from "./src/routes/complete.js";
import suggestRouter from "./src/routes/suggest.js";
import healthRouter from "./src/routes/health.js";
import { setupWS } from "./src/websocket/handler.js";
import { logger } from "./src/services/logger.js";

const app = express();

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/complete", completeRouter);
app.use("/suggest", suggestRouter);
app.use("/health", healthRouter);

const server = createServer(app);
setupWS(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  const provider = process.env.PROVIDER || "ollama";
  console.log(`✅ Backend running on :${PORT}`);
  console.log(`🤖 Provider: ${provider}`);
});