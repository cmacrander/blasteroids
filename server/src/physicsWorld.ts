// Rapier physics world: lifecycle of one dynamic rigid body per ship, keyed by session id.
import RAPIER from "@dimforge/rapier2d-compat";
import type { Ship } from "@blasteroids/shared";
import { partMass } from "@blasteroids/shared";

const partSize = 1; // one square unit, matching the sprite/grid scale
const partHalfExtent = partSize / 2;
const partDensity = partMass / (partSize * partSize);

let world: RAPIER.World | undefined;
const shipBodies = new Map<string, RAPIER.RigidBody>();

// Rapier's WASM module must finish loading before any World/RigidBody is created.
export async function initPhysics(): Promise<void> {
  await RAPIER.init();
  world = new RAPIER.World({ x: 0, y: 0 }); // top-down space game: no gravity
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
      .setDensity(partDensity);
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
