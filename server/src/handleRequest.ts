// HTTP request handler for the game server.
import type { IncomingMessage, ServerResponse } from "node:http";

export function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
    return;
  }
  res.writeHead(404);
  res.end();
}
