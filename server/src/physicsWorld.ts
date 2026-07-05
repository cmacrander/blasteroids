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
// Per-ship collider handles keyed by part key, so a single part's collider
// can be added (building, scavenging) or removed (destruction) later, plus
// the reverse lookup lasers need to resolve a raycast hit to a ship part.
const shipPartColliders = new Map<string, Map<string, RAPIER.Collider>>();
const colliderToShipPart = new Map<
  number,
  { sessionId: string; partKey: string }
>();

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
  const partColliders = new Map<string, RAPIER.Collider>();
  ship.parts.forEach((part, key) => {
    registerPartCollider(sessionId, key, part, body, partColliders);
  });

  shipBodies.set(sessionId, body);
  shipPartColliders.set(sessionId, partColliders);
  return body;
}

function registerPartCollider(
  sessionId: string,
  partKey: string,
  part: { offsetX: number; offsetY: number },
  body: RAPIER.RigidBody,
  partColliders: Map<string, RAPIER.Collider>,
): void {
  const collider = requireWorld().createCollider(partColliderDesc(part), body);
  partColliders.set(partKey, collider);
  colliderToShipPart.set(collider.handle, { sessionId, partKey });
}

function partColliderDesc(part: {
  offsetX: number;
  offsetY: number;
}): RAPIER.ColliderDesc {
  return RAPIER.ColliderDesc.cuboid(partHalfExtent, partHalfExtent)
    .setTranslation(part.offsetX, part.offsetY)
    .setDensity(partDensity)
    .setRestitution(0);
}

// Attaches one more part collider to an existing ship body (building,
// scavenging); Rapier recomputes mass properties automatically.
export function addShipPartCollider(
  sessionId: string,
  partKey: string,
  part: { offsetX: number; offsetY: number },
): void {
  const body = shipBodies.get(sessionId);
  const partColliders = shipPartColliders.get(sessionId);
  if (!body || !partColliders) return;
  registerPartCollider(sessionId, partKey, part, body, partColliders);
}

// Replaces a ship body's colliders to match its current part layout (after
// defragmentation or part destruction). The body itself persists, so its
// position and velocity carry over untouched.
export function resetShipColliders(sessionId: string, ship: Ship): void {
  const body = shipBodies.get(sessionId);
  const partColliders = shipPartColliders.get(sessionId);
  if (!body || !partColliders) return;
  for (const collider of partColliders.values()) {
    colliderToShipPart.delete(collider.handle);
    requireWorld().removeCollider(collider, true);
  }
  partColliders.clear();
  ship.parts.forEach((part, key) => {
    registerPartCollider(sessionId, key, part, body, partColliders);
  });
}

export function removeShipBody(sessionId: string): void {
  const body = shipBodies.get(sessionId);
  if (!body) return;
  const partColliders = shipPartColliders.get(sessionId);
  if (partColliders) {
    for (const collider of partColliders.values()) {
      colliderToShipPart.delete(collider.handle);
    }
  }
  requireWorld().removeRigidBody(body);
  shipBodies.delete(sessionId);
  shipPartColliders.delete(sessionId);
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

// Kinematic-velocity-based rather than fixed: it drifts at a constant
// velocity every step with no manual driving needed, but (unlike a dynamic
// body) is never affected by collision forces from the ships that bump into
// it -- no momentum transfer, for free, straight from Rapier's body types.
export function createAsteroidBody(
  asteroidId: string,
  asteroid: Asteroid,
  velocity: { x: number; y: number } = { x: 0, y: 0 },
): RAPIER.RigidBody {
  const body = requireWorld().createRigidBody(
    RAPIER.RigidBodyDesc.kinematicVelocityBased()
      .setTranslation(asteroid.body.x, asteroid.body.y)
      .setLinvel(velocity.x, velocity.y),
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

export function getAsteroidBody(
  asteroidId: string,
): RAPIER.RigidBody | undefined {
  return asteroidBodies.get(asteroidId);
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

export type LaserRayHit =
  | { kind: "asteroid"; asteroidId: string; cellIndex: number; toi: number }
  | { kind: "ship"; sessionId: string; partKey: string; toi: number };

// Raycasts against everything a laser can damage -- asteroid shells and
// other ships' part colliders -- excluding the firing ship itself and the
// boundary walls via the collider-membership predicate.
export function raycastLaser(
  origin: { x: number; y: number },
  dir: { x: number; y: number },
  maxToi: number,
  excludeSessionId: string,
): LaserRayHit | null {
  const ray = new RAPIER.Ray(origin, dir);
  const hit = requireWorld().castRay(
    ray,
    maxToi,
    true,
    undefined,
    undefined,
    undefined,
    undefined,
    (collider) => {
      if (colliderToAsteroidCell.has(collider.handle)) return true;
      const shipPart = colliderToShipPart.get(collider.handle);
      return shipPart !== undefined && shipPart.sessionId !== excludeSessionId;
    },
  );
  if (!hit) return null;

  const asteroidCell = colliderToAsteroidCell.get(hit.collider.handle);
  if (asteroidCell) {
    return {
      kind: "asteroid",
      asteroidId: asteroidCell.asteroidId,
      cellIndex: asteroidCell.cellIndex,
      toi: hit.timeOfImpact,
    };
  }
  const shipPart = colliderToShipPart.get(hit.collider.handle);
  if (shipPart) {
    return {
      kind: "ship",
      sessionId: shipPart.sessionId,
      partKey: shipPart.partKey,
      toi: hit.timeOfImpact,
    };
  }
  return null;
}
