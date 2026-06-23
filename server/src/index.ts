import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom";

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error(`Origin ${origin} is not allowed`));
    },
  }),
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "physics-monopoly-server" });
});

const server = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

gameServer.define("game", GameRoom);

const port = Number(process.env.PORT ?? 2567);
server.listen(port, () => {
  const entry = fileURLToPath(import.meta.url);
  console.log(`Physics Monopoly server ready on http://localhost:${port}`);
  console.log(`Entry: ${entry}`);
});
