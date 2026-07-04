// Colyseus room definition for a game match.
import { Room, Client } from "colyseus";
import { MatchState, Player, mapWidth, mapHeight } from "@blasteroids/shared";
import { buildStarterShip } from "./starterShip";

export class GameRoom extends Room<MatchState> {
  override maxClients = 8;

  override onCreate(): void {
    this.setState(new MatchState());
  }

  override onJoin(client: Client): void {
    console.log(`${client.sessionId} joined`);
    const player = new Player();
    player.ship = buildStarterShip(mapWidth / 2, mapHeight / 2);
    this.state.players.set(client.sessionId, player);
  }

  override onLeave(client: Client): void {
    console.log(`${client.sessionId} left`);
    this.state.players.delete(client.sessionId);
  }
}
