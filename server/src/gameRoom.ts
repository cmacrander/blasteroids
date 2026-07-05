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
  asteroidEntryMargin,
  asteroidDespawnMargin,
} from "@blasteroids/shared";
import { buildStarterShip } from "./starterShip";
import {
  buildRandomAsteroid,
  randomAsteroidCellCount,
  randomAsteroidVelocity,
  randomAsteroidEntry,
  pickAsteroidSpawnPoints,
  isFarOutOfBounds,
} from "./randomAsteroid";
import { isAsteroidDestroyed } from "./asteroidShell";
import { tickPowerBudget } from "./powerBudget";
import {
  initPhysics,
  createShipBody,
  removeShipBody,
  getShipBody,
  createAsteroidBody,
  getAsteroidBody,
  removeAsteroidBody,
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
  private nextAsteroidId = 0;

  override async onCreate(): Promise<void> {
    await initPhysics();
    this.setState(new MatchState());

    // Scatter a field of roundish asteroids across the map, clear of the
    // player spawn point (see randomAsteroid.ts for density/size/speed).
    const spawnPoints = pickAsteroidSpawnPoints(
      mapWidth / 2,
      mapHeight / 2,
      15,
    );
    for (const point of spawnPoints) {
      this.spawnAsteroid(
        point.x,
        point.y,
        randomAsteroidVelocity(),
        randomAsteroidCellCount(),
      );
    }
    // Rapier's raycast query structures aren't built until the first step,
    // even for colliders that already exist -- without this, the very first
    // tick's laser raycast would silently miss any asteroid entirely.
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

    this.state.asteroids.forEach((asteroid, id) => {
      const body = getAsteroidBody(id);
      if (!body) return;
      const translation = body.translation();
      asteroid.body.x = translation.x;
      asteroid.body.y = translation.y;
    });

    this.tickAsteroidField();
  }

  // Asteroids drift forever and never bounce off the walls (see
  // randomAsteroid.ts), so the field would otherwise slowly leak out of
  // bounds, and a fully-mined asteroid would otherwise just sit in state
  // forever as an empty shell. Removing either kind immediately spawns one
  // replacement entering from just outside an edge, aimed back in -- a
  // direct one-for-one swap, so the in-map count stays exactly constant
  // rather than merely trending toward some average.
  private tickAsteroidField(): void {
    const departed: string[] = [];
    this.state.asteroids.forEach((asteroid, id) => {
      if (
        isFarOutOfBounds(
          asteroid.body.x,
          asteroid.body.y,
          asteroidDespawnMargin,
        ) ||
        isAsteroidDestroyed(asteroid)
      ) {
        departed.push(id);
      }
    });

    for (const id of departed) {
      removeAsteroidBody(id);
      this.state.asteroids.delete(id);

      const entry = randomAsteroidEntry(asteroidEntryMargin);
      this.spawnAsteroid(
        entry.x,
        entry.y,
        { x: entry.vx, y: entry.vy },
        randomAsteroidCellCount(),
      );
    }

    // Same reason as the initial-spawn step in onCreate: a freshly created
    // collider isn't raycast-queryable until the next step, and any just
    // spawned above would otherwise have to wait a full tick to become
    // hittable.
    if (departed.length > 0) stepPhysics();
  }

  private spawnAsteroid(
    x: number,
    y: number,
    velocity: { x: number; y: number },
    cellCount: number,
  ): void {
    const asteroid = buildRandomAsteroid(x, y, cellCount);
    asteroid.body.vx = velocity.x;
    asteroid.body.vy = velocity.y;

    const id = `asteroid-${(this.nextAsteroidId++).toString()}`;
    this.state.asteroids.set(id, asteroid);
    createAsteroidBody(id, asteroid, velocity);
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
