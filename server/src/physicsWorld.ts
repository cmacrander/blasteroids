// Rapier physics world: lifecycle of one dynamic rigid body per ship, keyed by session id.
import RAPIER from "@dimforge/rapier2d-compat";

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
  x: number,
  y: number,
): RAPIER.RigidBody {
  const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y);
  const body = requireWorld().createRigidBody(desc);
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
