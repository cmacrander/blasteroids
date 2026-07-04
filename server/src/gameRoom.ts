// Colyseus room definition for a game match.
import { Room, Client } from "colyseus";
import {
  MatchState,
  Player,
  mapWidth,
  mapHeight,
  simulationHz,
} from "@blasteroids/shared";
import { buildStarterShip } from "./starterShip";
import { tickPowerBudget } from "./powerBudget";
import { initPhysics, createShipBody, removeShipBody } from "./physicsWorld";

const fixedDtMs = 1000 / simulationHz;
const fixedDt = 1 / simulationHz;

export class GameRoom extends Room<MatchState> {
  override maxClients = 8;

  private accumulatorMs = 0;

  override async onCreate(): Promise<void> {
    await initPhysics();
    this.setState(new MatchState());
    this.setSimulationInterval((deltaTime) => {
      this.onUpdate(deltaTime);
    });
  }

  // Colyseus calls this at a variable rate; drain the accumulator in fixed
  // steps so per-tick effects never depend on frame rate (see gameDesign.md).
  private onUpdate(deltaTime: number): void {
    this.accumulatorMs += deltaTime;
    while (this.accumulatorMs >= fixedDtMs) {
      this.tick(fixedDt);
      this.accumulatorMs -= fixedDtMs;
    }
  }

  private tick(dt: number): void {
    this.state.players.forEach((player) => {
      if (player.ship) tickPowerBudget(player.ship, dt);
    });
  }

  override onJoin(client: Client): void {
    console.log(`${client.sessionId} joined`);
    const player = new Player();
    player.ship = buildStarterShip(mapWidth / 2, mapHeight / 2);
    this.state.players.set(client.sessionId, player);
    createShipBody(client.sessionId, player.ship.body.x, player.ship.body.y);
  }

  override onLeave(client: Client): void {
    console.log(`${client.sessionId} left`);
    this.state.players.delete(client.sessionId);
    removeShipBody(client.sessionId);
  }
}
