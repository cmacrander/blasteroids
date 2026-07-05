// Colyseus room definition for a game match.
import { Room, Client } from "colyseus";
import {
  MatchState,
  Player,
  mapWidth,
  mapHeight,
  simulationHz,
  messageType,
  partType,
} from "@blasteroids/shared";
import { buildStarterShip } from "./starterShip";
import { buildAsteroid } from "./starterAsteroid";
import { tickPowerBudget } from "./powerBudget";
import {
  initPhysics,
  createShipBody,
  removeShipBody,
  getShipBody,
  createAsteroidBody,
  stepPhysics,
} from "./physicsWorld";
import { tickMovement, capSpeed } from "./movement";
import { tickRotation, capAngularSpeed } from "./rotation";
import { tickLaserDamage, type ExplosionSpawn } from "./laserDamage";
import { applyActivation, parseAimAngle } from "./playerInput";

const fixedDtMs = 1000 / simulationHz;
const fixedDt = 1 / simulationHz;

export class GameRoom extends Room<MatchState> {
  override maxClients = 8;

  private accumulatorMs = 0;
  private targetAngles = new Map<string, number>();

  override async onCreate(): Promise<void> {
    await initPhysics();
    this.setState(new MatchState());

    // One asteroid near the spawn point so there's something to see (and mine) right away.
    const asteroid = buildAsteroid(mapWidth / 2 + 15, mapHeight / 2 + 10);
    this.state.asteroids.set("asteroid-1", asteroid);
    createAsteroidBody("asteroid-1", asteroid);
    // Rapier's raycast query structures aren't built until the first step,
    // even for colliders that already exist -- without this, the very first
    // tick's laser raycast would silently miss the asteroid entirely.
    stepPhysics();

    this.onMessage(
      messageType.setEngineActivation,
      (client, message: unknown) => {
        const ship = this.state.players.get(client.sessionId)?.ship;
        if (ship) applyActivation(ship, partType.engine, message);
      },
    );

    this.onMessage(
      messageType.setLaserActivation,
      (client, message: unknown) => {
        const ship = this.state.players.get(client.sessionId)?.ship;
        if (ship) applyActivation(ship, partType.laser, message);
      },
    );

    this.onMessage(messageType.setAimAngle, (client, message: unknown) => {
      const angle = parseAimAngle(message);
      if (angle !== undefined) this.targetAngles.set(client.sessionId, angle);
    });

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
    const explosions: ExplosionSpawn[] = [];
    this.state.players.forEach((player, sessionId) => {
      const ship = player.ship;
      if (!ship) return;
      tickPowerBudget(ship, dt);
      const body = getShipBody(sessionId);
      if (!body) return;
      tickMovement(ship, body);
      const targetAngle = this.targetAngles.get(sessionId) ?? body.rotation();
      tickRotation(ship, body, targetAngle);
      explosions.push(
        ...tickLaserDamage(player, ship, body, this.state.asteroids, dt),
      );
    });

    // One batched broadcast per tick rather than one per explosion -- keeps
    // this a fixed-cost message regardless of how many players are mining.
    if (explosions.length > 0) {
      this.broadcast(messageType.spawnExplosion, explosions);
    }

    stepPhysics();

    this.state.players.forEach((player, sessionId) => {
      const ship = player.ship;
      const body = getShipBody(sessionId);
      if (!ship || !body) return;
      capSpeed(body);
      capAngularSpeed(body);
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
    this.targetAngles.delete(client.sessionId);
  }
}
