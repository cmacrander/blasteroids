// Colyseus game server entry point.
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "node:http";
import { handleRequest } from "./handleRequest";
import { GameRoom } from "./gameRoom";

const port = Number(process.env["PORT"] ?? 2567);

const httpServer = createServer(handleRequest);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("game", GameRoom);

void gameServer.listen(port).then(() => {
  console.log(`Server listening on port ${String(port)}`);
});
