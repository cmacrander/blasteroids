// Colyseus room definition for a game match.
import { Room, Client } from "colyseus";
import type { BuildRejection } from "@blasteroids/shared";
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
import type { Ship } from "@blasteroids/shared";
import {
  activation,
  bestDefragArrangement,
  applyArrangement,
  defragDurationSeconds,
  FloatingPart,
  detachedPartHp,
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
import { canSpawnAsteroid } from "./entityCount";
import { tickPowerBudget } from "./powerBudget";
import {
  initPhysics,
  createShipBody,
  removeShipBody,
  getShipBody,
  addShipPartCollider,
  resetShipColliders,
  createAsteroidBody,
  getAsteroidBody,
  removeAsteroidBody,
  stepPhysics,
} from "./physicsWorld";
import { tickMovement, capSpeed } from "./movement";
import { tickRotation, capAngularSpeed } from "./rotation";
import {
  tickLaserDamage,
  type ExplosionSpawn,
  type ZeroedPart,
} from "./laserDamage";
import { resolveDestroyedParts, type RemovedPart } from "./shipDamage";
import {
  applyActivation,
  parsePartType,
  parsePlayerInput,
} from "./playerInput";
import { tryBuildPart } from "./buildPart";

const fixedDtMs = 1000 / simulationHz;
const fixedDt = 1 / simulationHz;

export class GameRoom extends Room<MatchState> {
  override maxClients = 8;

  private accumulatorMs = 0;
  private targetAngles = new Map<string, number>();
  private nextAsteroidId = 0;
  private nextPartId = 0;
  private nextFloatingId = 0;
  private targetAsteroidCount = 0;
  // Last player to laser each victim, for kill credit (see "Game over").
  private lastAttacker = new Map<string, string>();

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
    this.targetAsteroidCount = spawnPoints.length;
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

    // One packet per client prediction tick: sequence-numbered engine
    // activation and aim angle. The seq is always acked (so the client can
    // trim its replay log), but the controls are dead while defragging (see
    // "Scavenging" in gameDesign.md): the ship drifts until it completes.
    this.onMessage(messageType.playerInput, (client, message: unknown) => {
      const player = this.state.players.get(client.sessionId);
      const input = parsePlayerInput(message);
      if (!player || !input) return;

      if (input.seq > player.lastProcessedInput)
        player.lastProcessedInput = input.seq;

      const ship = player.ship;
      if (!ship || ship.defragRemaining > 0) return;
      applyActivation(ship, partType.engine, input.engine);
      this.targetAngles.set(client.sessionId, input.aim);
    });

    this.onMessage(
      messageType.setLaserActivation,
      (client, message: unknown) => {
        const ship = this.state.players.get(client.sessionId)?.ship;
        if (ship && ship.defragRemaining <= 0)
          applyActivation(ship, partType.laser, message);
      },
    );

    this.onMessage(messageType.defragment, (client) => {
      const ship = this.state.players.get(client.sessionId)?.ship;
      const body = getShipBody(client.sessionId);
      if (!ship || !body || ship.defragRemaining > 0) return;

      ship.defragTotal = defragDurationSeconds(ship.parts.size);
      ship.defragRemaining = ship.defragTotal;
      ship.parts.forEach((part) => {
        if (
          part.partType === partType.engine ||
          part.partType === partType.laser
        ) {
          part.activation = activation.inactive;
        }
      });
      // tickMovement/tickRotation are skipped while defragging, so any force
      // or torque they applied last tick must be cleared now or it would keep
      // accelerating the "drifting" ship for the whole downtime.
      body.resetForces(true);
      body.resetTorques(true);
    });

    this.onMessage(messageType.buildPart, (client, message: unknown) => {
      const player = this.state.players.get(client.sessionId);
      const requested = parsePartType(message);
      if (!player || requested === undefined) return;

      const key = `built-${String(this.nextPartId++)}`;
      const result = tryBuildPart(player, requested, key);
      if (!result.ok) {
        const rejection: BuildRejection = {
          partType: requested,
          reason: result.reason,
        };
        client.send(messageType.buildRejected, rejection);
        return;
      }
      addShipPartCollider(client.sessionId, result.key, result.part);
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
    const zeroedParts: ZeroedPart[] = [];
    this.state.players.forEach((player, sessionId) => {
      const ship = player.ship;
      if (!ship) return;
      tickPowerBudget(ship, dt);
      const body = getShipBody(sessionId);
      if (!body) return;
      if (ship.defragRemaining > 0) {
        this.tickDefrag(ship, sessionId, dt);
        return; // drifting: no thrust, steering, or lasers until done
      }
      tickMovement(ship, body);
      const targetAngle = this.targetAngles.get(sessionId) ?? body.rotation();
      tickRotation(ship, body, targetAngle);
      const lasers = tickLaserDamage(sessionId, player, body, this.state, dt);
      explosions.push(...lasers.explosions);
      zeroedParts.push(...lasers.zeroedParts);
      for (const victimId of lasers.damagedShipIds) {
        this.lastAttacker.set(victimId, sessionId);
      }
    });

    this.resolveZeroedParts(zeroedParts);

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

    this.tickFloatingParts(dt);
    this.tickAsteroidField();
  }

  // Applies the detach-or-destroy roll and group-cut rule to every part that
  // reached 0 HP this tick, spawning FloatingParts for the detached ones and
  // rebuilding each affected ship's colliders once.
  private resolveZeroedParts(zeroedParts: ZeroedPart[]): void {
    const keysByVictim = new Map<string, string[]>();
    for (const zeroed of zeroedParts) {
      const keys = keysByVictim.get(zeroed.sessionId) ?? [];
      keys.push(zeroed.partKey);
      keysByVictim.set(zeroed.sessionId, keys);
    }

    for (const [victimId, keys] of keysByVictim) {
      const ship = this.state.players.get(victimId)?.ship;
      if (!ship) continue;
      const removed = resolveDestroyedParts(ship, keys, Math.random);
      this.spawnDetachedParts(ship, removed);
      resetShipColliders(victimId, ship);
    }
  }

  // Detached parts become free-floating, scavengeable, and non-colliding,
  // keeping the ship's velocity and orientation (see "Scavenging").
  private spawnDetachedParts(ship: Ship, removed: RemovedPart[]): void {
    const cos = Math.cos(ship.body.angle);
    const sin = Math.sin(ship.body.angle);
    for (const entry of removed) {
      if (!entry.detached) continue;
      const floating = new FloatingPart();
      floating.partType = entry.part.partType;
      floating.facing = entry.part.facing;
      floating.hp = detachedPartHp;
      floating.body.x =
        ship.body.x + entry.part.offsetX * cos - entry.part.offsetY * sin;
      floating.body.y =
        ship.body.y + entry.part.offsetX * sin + entry.part.offsetY * cos;
      floating.body.angle = ship.body.angle;
      floating.body.vx = ship.body.vx;
      floating.body.vy = ship.body.vy;
      this.state.floatingParts.set(
        `float-${String(this.nextFloatingId++)}`,
        floating,
      );
    }
  }

  // Floating parts collide with nothing, so they are plain state, not Rapier
  // bodies: drift them manually and drop any that leave the map for good.
  private tickFloatingParts(dt: number): void {
    const departed: string[] = [];
    this.state.floatingParts.forEach((floating, id) => {
      floating.body.x += floating.body.vx * dt;
      floating.body.y += floating.body.vy * dt;
      if (
        isFarOutOfBounds(
          floating.body.x,
          floating.body.y,
          asteroidDespawnMargin,
        )
      ) {
        departed.push(id);
      }
    });
    for (const id of departed) this.state.floatingParts.delete(id);
  }

  // Counts down defrag downtime; on completion, rearranges the surviving
  // parts (the arrangement is computed now, not at the start, so parts
  // destroyed or built mid-defrag are accounted for) and swaps the physics
  // colliders to the new layout.
  private tickDefrag(ship: Ship, sessionId: string, dt: number): void {
    ship.defragRemaining = Math.max(0, ship.defragRemaining - dt);
    if (ship.defragRemaining > 0) return;

    const arrangement = bestDefragArrangement(
      [...ship.parts.values()],
      Math.random,
    );
    applyArrangement(ship, arrangement);
    resetShipColliders(sessionId, ship);
    ship.defragTotal = 0;
  }

  // Asteroids drift forever and never bounce off the walls (see
  // randomAsteroid.ts), so the field would otherwise slowly leak out of
  // bounds, and a fully-mined asteroid would otherwise just sit in state
  // forever as an empty shell. Departures are removed, then the field is
  // topped back up to its initial size -- but only while a replacement is
  // guaranteed to fit under the colliding-entity cap, so a busy match
  // (many ship parts and floating parts) pauses replenishment and resumes
  // once destruction frees room.
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
    }

    let spawned = 0;
    while (
      this.state.asteroids.size < this.targetAsteroidCount &&
      canSpawnAsteroid(this.state)
    ) {
      const entry = randomAsteroidEntry(asteroidEntryMargin);
      this.spawnAsteroid(
        entry.x,
        entry.y,
        { x: entry.vx, y: entry.vy },
        randomAsteroidCellCount(),
      );
      spawned++;
    }

    // Same reason as the initial-spawn step in onCreate: a freshly created
    // collider isn't raycast-queryable until the next step, and any just
    // spawned above would otherwise have to wait a full tick to become
    // hittable.
    if (spawned > 0) stepPhysics();
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
