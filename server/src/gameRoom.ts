// Colyseus room definition for a game match.
import { Room, Client } from "colyseus";
import {
  MatchState,
  Player,
  mapWidth,
  mapHeight,
  simulationHz,
  messageType,
} from "@blasteroids/shared";
import { buildStarterShip } from "./starterShip";
import { tickPowerBudget } from "./powerBudget";
import {
  initPhysics,
  createShipBody,
  removeShipBody,
  getShipBody,
  stepPhysics,
} from "./physicsWorld";
import { tickMovement, capSpeed } from "./movement";
import { applyEngineActivation } from "./playerInput";

const fixedDtMs = 1000 / simulationHz;
const fixedDt = 1 / simulationHz;

export class GameRoom extends Room<MatchState> {
  override maxClients = 8;

  private accumulatorMs = 0;

  override async onCreate(): Promise<void> {
    await initPhysics();
    this.setState(new MatchState());

    this.onMessage(
      messageType.setEngineActivation,
      (client, message: unknown) => {
        const ship = this.state.players.get(client.sessionId)?.ship;
        if (ship) applyEngineActivation(ship, message);
      },
    );

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
    this.state.players.forEach((player, sessionId) => {
      const ship = player.ship;
      if (!ship) return;
      tickPowerBudget(ship, dt);
      const body = getShipBody(sessionId);
      if (body) tickMovement(ship, body);
    });

    stepPhysics();

    this.state.players.forEach((player, sessionId) => {
      const ship = player.ship;
      const body = getShipBody(sessionId);
      if (!ship || !body) return;
      capSpeed(body);
      const translation = body.translation();
      const velocity = body.linvel();
      ship.body.x = translation.x;
      ship.body.y = translation.y;
      ship.body.angle = body.rotation();
      ship.body.vx = velocity.x;
      ship.body.vy = velocity.y;
    });
  }

  override onJoin(client: Client): void {
    console.log(`${client.sessionId} joined`);
    const player = new Player();
    player.ship = buildStarterShip(mapWidth / 2, mapHeight / 2);
    this.state.players.set(client.sessionId, player);
    createShipBody(client.sessionId, player.ship);
  }

  override onLeave(client: Client): void {
    console.log(`${client.sessionId} left`);
    this.state.players.delete(client.sessionId);
    removeShipBody(client.sessionId);
  }
}
