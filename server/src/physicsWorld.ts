// Rapier physics world: lifecycle of one dynamic rigid body per ship, keyed by session id.
import RAPIER from "@dimforge/rapier2d-compat";
import type { Ship, Asteroid } from "@blasteroids/shared";
import { partMass, mapWidth, mapHeight } from "@blasteroids/shared";
import {
  boundaryCellIndices,
  neighborsOf,
  isBoundaryCell,
} from "./asteroidShell";

const partSize = 1; // one square unit, matching the sprite/grid scale
const partHalfExtent = partSize / 2;
const partDensity = partMass / (partSize * partSize);

// Thick enough that nothing can tunnel through in one physics step even at
// max speed (30 units/s at 60Hz is 0.5 units/step, so this is a big margin).
const wallThickness = 5;

let world: RAPIER.World | undefined;
const shipBodies = new Map<string, RAPIER.RigidBody>();

// Rapier's WASM module must finish loading before any World/RigidBody is created.
export async function initPhysics(): Promise<void> {
  await RAPIER.init();
  world = new RAPIER.World({ x: 0, y: 0 }); // top-down space game: no gravity
  createBoundaryWalls();
}

// Four fixed walls framing the map (see "Map" in gameDesign.md). Zero
// restitution means ships stop dead against them instead of bouncing.
function createBoundaryWalls(): void {
  const w = requireWorld();
  const halfW = mapWidth / 2;
  const halfH = mapHeight / 2;

  const wall = (cx: number, cy: number, halfX: number, halfY: number) => {
    const body = w.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy),
    );
    w.createCollider(
      RAPIER.ColliderDesc.cuboid(halfX, halfY).setRestitution(0),
      body,
    );
  };

  wall(halfW, -wallThickness / 2, halfW + wallThickness, wallThickness / 2); // south
  wall(
    halfW,
    mapHeight + wallThickness / 2,
    halfW + wallThickness,
    wallThickness / 2,
  ); // north
  wall(-wallThickness / 2, halfH, wallThickness / 2, halfH + wallThickness); // west
  wall(
    mapWidth + wallThickness / 2,
    halfH,
    wallThickness / 2,
    halfH + wallThickness,
  ); // east
}

function requireWorld(): RAPIER.World {
  if (!world)
    throw new Error("physicsWorld used before initPhysics() resolved");
  return world;
}

export function createShipBody(
  sessionId: string,
  ship: Ship,
): RAPIER.RigidBody {
  const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(
    ship.body.x,
    ship.body.y,
  );
  const body = requireWorld().createRigidBody(desc);

  // One collider per part, positioned at its local offset, so Rapier derives
  // the ship's total mass, center of mass, and moment of inertia from the
  // actual part layout (see "Ship composition" in gameDesign.md).
  ship.parts.forEach((part) => {
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      partHalfExtent,
      partHalfExtent,
    )
      .setTranslation(part.offsetX, part.offsetY)
      .setDensity(partDensity)
      .setRestitution(0);
    requireWorld().createCollider(colliderDesc, body);
  });

  shipBodies.set(sessionId, body);
  return body;
}

export function removeShipBody(sessionId: string): void {
  const body = shipBodies.get(sessionId);
  if (!body) return;
  requireWorld().removeRigidBody(body);
  shipBodies.delete(sessionId);
}

export function getShipBody(sessionId: string): RAPIER.RigidBody | undefined {
  return shipBodies.get(sessionId);
}

export function stepPhysics(): void {
  requireWorld().step();
}

// Asteroid bodies and collision shells (see "Asteroid performance model" in
// gameDesign.md): a fixed body per asteroid, with one 1x1 collider per
// *boundary* cell only -- interior cells never contribute to a contact, so
// they get no collider. The shell is rebuilt event-driven (on destruction),
// not per tick.
const asteroidBodies = new Map<string, RAPIER.RigidBody>();
const asteroidShellColliders = new Map<string, Map<number, RAPIER.Collider>>();
const colliderToAsteroidCell = new Map<
  number,
  { asteroidId: string; cellIndex: number }
>();

function addCellCollider(
  asteroidId: string,
  asteroid: Asteroid,
  body: RAPIER.RigidBody,
  shell: Map<number, RAPIER.Collider>,
  index: number,
): void {
  const col = index % asteroid.gridWidth;
  const row = Math.floor(index / asteroid.gridWidth);
  const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5)
    .setTranslation(asteroid.originX + col, asteroid.originY + row)
    .setRestitution(0);
  const collider = requireWorld().createCollider(colliderDesc, body);
  shell.set(index, collider);
  colliderToAsteroidCell.set(collider.handle, { asteroidId, cellIndex: index });
}

export function createAsteroidBody(
  asteroidId: string,
  asteroid: Asteroid,
): RAPIER.RigidBody {
  const body = requireWorld().createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(
      asteroid.body.x,
      asteroid.body.y,
    ),
  );
  const shell = new Map<number, RAPIER.Collider>();
  asteroidBodies.set(asteroidId, body);
  asteroidShellColliders.set(asteroidId, shell);

  for (const index of boundaryCellIndices(asteroid)) {
    addCellCollider(asteroidId, asteroid, body, shell, index);
  }

  return body;
}

// Call once a cell's hp reaches 0: drops its own collider (if it had one) and
// promotes any now-newly-exposed alive neighbors into the shell.
export function onAsteroidCellDestroyed(
  asteroidId: string,
  asteroid: Asteroid,
  index: number,
): void {
  const shell = asteroidShellColliders.get(asteroidId);
  const body = asteroidBodies.get(asteroidId);
  if (!shell || !body) return;

  const existing = shell.get(index);
  if (existing) {
    colliderToAsteroidCell.delete(existing.handle);
    requireWorld().removeCollider(existing, true);
    shell.delete(index);
  }

  const col = index % asteroid.gridWidth;
  const row = Math.floor(index / asteroid.gridWidth);
  for (const neighbor of neighborsOf(asteroid, col, row)) {
    if (shell.has(neighbor.index)) continue;
    if (!isBoundaryCell(asteroid, neighbor.col, neighbor.row)) continue;
    addCellCollider(asteroidId, asteroid, body, shell, neighbor.index);
  }
}

export function removeAsteroidBody(asteroidId: string): void {
  const body = asteroidBodies.get(asteroidId);
  if (!body) return;
  requireWorld().removeRigidBody(body);
  asteroidBodies.delete(asteroidId);

  const shell = asteroidShellColliders.get(asteroidId);
  if (shell) {
    for (const collider of shell.values()) {
      colliderToAsteroidCell.delete(collider.handle);
    }
  }
  asteroidShellColliders.delete(asteroidId);
}

export interface AsteroidRayHit {
  asteroidId: string;
  cellIndex: number;
  toi: number;
}

// Raycasts against asteroid shells only (ships/walls are excluded via the
// collider-membership predicate), for laser grid-march damage.
export function raycastAsteroids(
  origin: { x: number; y: number },
  dir: { x: number; y: number },
  maxToi: number,
): AsteroidRayHit | null {
  const ray = new RAPIER.Ray(origin, dir);
  const hit = requireWorld().castRay(
    ray,
    maxToi,
    true,
    undefined,
    undefined,
    undefined,
    undefined,
    (collider) => colliderToAsteroidCell.has(collider.handle),
  );
  if (!hit) return null;

  const info = colliderToAsteroidCell.get(hit.collider.handle);
  if (!info) return null;

  return {
    asteroidId: info.asteroidId,
    cellIndex: info.cellIndex,
    toi: hit.timeOfImpact,
  };
}
