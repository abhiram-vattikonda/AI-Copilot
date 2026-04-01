import { WebSocketServer } from "ws";
import { stream }          from "../services/llm.js";
import { logger }          from "../services/logger.js";

export function setupWS(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    logger.info("WebSocket client connected");

    ws.on("message", async (raw) => {
      let payload;
      try {
        payload = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ error: "Invalid JSON payload" }));
        return;
      }

      const { code, language = "javascript" } = payload;
      if (!code) {
        ws.send(JSON.stringify({ error: "Missing field: code" }));
        return;
      }

      const prompt = `Complete this ${language} code. Return only code:\n\n${code}`;

      try {
        for await (const token of stream(prompt)) {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ token }));
          }
        }
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ done: true }));
        }
      } catch (err) {
        logger.error(`WS stream error: ${err.message}`);
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ error: err.message }));
        }
      }
    });

    ws.on("close", () => logger.info("WebSocket client disconnected"));
  });
}