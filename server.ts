// server.ts — Next.js + WebSocket relay (Roblox <-> web UI)
import { createServer, type IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer, WebSocket, type RawData } from "ws";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url ?? "/", true));
  });

  // noServer so we only take /connect and leave other upgrades (Next HMR) alone
  const wss = new WebSocketServer({ noServer: true });
  const nextUpgrade = app.getUpgradeHandler();

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { pathname } = parse(req.url ?? "/");
    if (pathname === "/connect") {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    } else {
      nextUpgrade(req, socket, head);
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    ws.on("message", (data: RawData, isBinary: boolean) => {
      // broadcast to every other client (Roblox <-> web UI)
      for (const client of wss.clients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(isBinary ? data : data.toString());
        }
      }
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (ws://localhost:${port}/connect)`);
  });
});
