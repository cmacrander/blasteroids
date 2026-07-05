// Laser-vs-asteroid damage: raycast to the shell, then grid-march the beam
// across the local cell grid (see "Harvesting" in gameDesign.md).
import type RAPIER from "@dimforge/rapier2d-compat";
import type { MapSchema } from "@colyseus/schema";
import type { Asteroid, Part, Player, Ship } from "@blasteroids/shared";
import {
  partType,
  activation,
  laserDamageRate,
  laserBoostDamageRate,
  laserRange,
  suppliesPerCellDestroyed,
  suppliesCap,
  explosionChance,
  activeCoreCount,
  powerEfficiency,
  facingWorldRadians,
} from "@blasteroids/shared";
import { raycastAsteroids, onAsteroidCellDestroyed } from "./physicsWorld";

function ratedDamage(part: Part): number {
  if (part.activation === activation.boosted) return laserBoostDamageRate;
  if (part.activation === activation.active) return laserDamageRate;
  return 0;
}

// Pure 2D DDA (Amanatides & Woo): walks the ray cell-by-cell from (originX,
// originY) -- already in grid-cell-center coordinates, i.e. cell (col, row)
// sits at (col, row) exactly -- collecting every in-bounds flat cell index it
// passes through, up to maxRange. No Rapier, no schema: independently testable.
export function marchGrid(
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  maxRange: number,
  gridWidth: number,
  gridHeight: number,
): number[] {
  const gx0 = originX + 0.5;
  const gy0 = originY + 0.5;

  let col = Math.floor(gx0);
  let row = Math.floor(gy0);

  const stepX = dirX > 0 ? 1 : dirX < 0 ? -1 : 0;
  const stepY = dirY > 0 ? 1 : dirY < 0 ? -1 : 0;

  const tDeltaX = dirX !== 0 ? Math.abs(1 / dirX) : Infinity;
  const tDeltaY = dirY !== 0 ? Math.abs(1 / dirY) : Infinity;

  let tMaxX = Infinity;
  if (stepX > 0) tMaxX = (col + 1 - gx0) / dirX;
  else if (stepX < 0) tMaxX = (col - gx0) / dirX;

  let tMaxY = Infinity;
  if (stepY > 0) tMaxY = (row + 1 - gy0) / dirY;
  else if (stepY < 0) tMaxY = (row - gy0) / dirY;

  const hits: number[] = [];
  let t = 0;
  let entered = false;

  while (t <= maxRange) {
    const inBounds =
      col >= 0 && col < gridWidth && row >= 0 && row < gridHeight;
    if (inBounds) {
      entered = true;
      hits.push(row * gridWidth + col);
    } else if (entered) {
      break; // exited after having entered -- beam is past the asteroid
    }

    if (tMaxX < tMaxY) {
      t = tMaxX;
      tMaxX += tDeltaX;
      col += stepX;
    } else {
      t = tMaxY;
      tMaxY += tDeltaY;
      row += stepY;
    }
  }

  return hits;
}

// A one-off visual event broadcast to clients (see messageType.spawnExplosion
// in constants.ts) -- not synced schema state, since it's transient and never
// needs to be reconciled or read back. World-space so the client doesn't need
// to know anything about the grid it came from; a future ship-part damage
// source can reuse this the same way.
export interface ExplosionSpawn {
  x: number;
  y: number;
}

function cellWorldPosition(asteroid: Asteroid, index: number): ExplosionSpawn {
  const col = index % asteroid.gridWidth;
  const row = Math.floor(index / asteroid.gridWidth);
  const localX = asteroid.originX + col;
  const localY = asteroid.originY + row;
  const cos = Math.cos(asteroid.body.angle);
  const sin = Math.sin(asteroid.body.angle);
  return {
    x: asteroid.body.x + localX * cos - localY * sin,
    y: asteroid.body.y + localX * sin + localY * cos,
  };
}

// Fractional HP not yet applied to the integer `cells` schema field, keyed by
// "asteroidId:cellIndex". Needed because per-tick damage (a few tenths of an
// HP) would otherwise round away to nothing against a uint8 field every tick.
const pendingDamage = new Map<string, number>();

function applyDamage(
  asteroidId: string,
  asteroid: Asteroid,
  index: number,
  rawDamage: number,
  player: Player,
  explosions: ExplosionSpawn[],
): void {
  const hp = asteroid.cells[index];
  if (hp === undefined || hp <= 0) return;

  const key = `${asteroidId}:${index.toString()}`;
  const total = (pendingDamage.get(key) ?? 0) + rawDamage;
  const wholeDamage = Math.floor(total);
  pendingDamage.set(key, total - wholeDamage);
  if (wholeDamage <= 0) return;

  const newHp = Math.max(0, hp - wholeDamage);
  asteroid.cells[index] = newHp;

  if (Math.random() < explosionChance) {
    explosions.push(cellWorldPosition(asteroid, index));
  }

  if (newHp <= 0) {
    onAsteroidCellDestroyed(asteroidId, asteroid, index);
    player.supplies = Math.min(
      suppliesCap,
      player.supplies + suppliesPerCellDestroyed,
    );
    pendingDamage.delete(key);
  }
}

export function tickLaserDamage(
  player: Player,
  ship: Ship,
  body: RAPIER.RigidBody,
  asteroids: MapSchema<Asteroid>,
  dt: number,
): ExplosionSpawn[] {
  const explosions: ExplosionSpawn[] = [];
  const efficiency = powerEfficiency(activeCoreCount(ship));

  const rotation = body.rotation();
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const translation = body.translation();

  ship.parts.forEach((part) => {
    if (part.partType !== partType.laser || !part.powered) return;

    const worldAngle = facingWorldRadians(part.facing) + rotation;
    const dirX = Math.cos(worldAngle);
    const dirY = Math.sin(worldAngle);
    const originX = translation.x + part.offsetX * cos - part.offsetY * sin;
    const originY = translation.y + part.offsetX * sin + part.offsetY * cos;

    const hit = raycastAsteroids(
      { x: originX, y: originY },
      { x: dirX, y: dirY },
      laserRange,
    );
    if (!hit) return;

    const asteroid = asteroids.get(hit.asteroidId);
    if (!asteroid) return;

    // Transform the hit point and beam direction into the asteroid's local,
    // origin-relative frame so marchGrid can walk it in cell-center coords.
    const hitX = originX + dirX * hit.toi;
    const hitY = originY + dirY * hit.toi;
    const cosA = Math.cos(-asteroid.body.angle);
    const sinA = Math.sin(-asteroid.body.angle);
    const dx = hitX - asteroid.body.x;
    const dy = hitY - asteroid.body.y;
    const localX = dx * cosA - dy * sinA - asteroid.originX;
    const localY = dx * sinA + dy * cosA - asteroid.originY;
    const localDirX = dirX * cosA - dirY * sinA;
    const localDirY = dirX * sinA + dirY * cosA;

    const remainingRange = laserRange - hit.toi;
    const cellIndices = marchGrid(
      localX,
      localY,
      localDirX,
      localDirY,
      remainingRange,
      asteroid.gridWidth,
      asteroid.gridHeight,
    );

    const damage = ratedDamage(part) * efficiency * dt;
    for (const index of cellIndices) {
      applyDamage(hit.asteroidId, asteroid, index, damage, player, explosions);
    }
  });

  return explosions;
}
