// Colyseus room definition for a game match.
import { Room, Client } from "colyseus";

export class GameRoom extends Room {
  onJoin(client: Client): void {
    console.log(`${client.sessionId} joined`);
    client.send("hello", "hello world");
  }

  onLeave(client: Client): void {
    console.log(`${client.sessionId} left`);
  }
}
