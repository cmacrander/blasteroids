// Colyseus room definition for a game match.
import { Room, Client } from "colyseus";

export class GameRoom extends Room {
  maxClients = 8;

  onJoin(client: Client): void {
    console.log(`${client.sessionId} joined`);
    client.send("hello", "hello world");
  }

  onLeave(client: Client): void {
    console.log(`${client.sessionId} left`);
  }
}
