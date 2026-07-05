// Per-tick thrust application and speed capping for one ship's rigid body.
import type RAPIER from "@dimforge/rapier2d-compat";
import type { Ship, Part } from "@blasteroids/shared";
import {
  partType,
  activation,
  facing,
  engineThrustRate,
  engineBoostThrustRate,
  maxSpeed,
} from "@blasteroids/shared";
import { activeCoreCount, powerEfficiency } from "./powerBudget";

// A part's facing direction in the ship's own unrotated frame, where +x is
// east and +y is north (matches gameDesign.md's map orientation). Add the
// ship's current rotation to get the world-space direction.
export const facingRadians: Record<number, number> = {
  [facing.north]: Math.PI / 2,
  [facing.east]: 0,
  [facing.south]: -Math.PI / 2,
  [facing.west]: Math.PI,
};

export function ratedThrust(part: Part): number {
  if (part.activation === activation.boosted) return engineBoostThrustRate;
  if (part.activation === activation.active) return engineThrustRate;
  return 0;
}

export function tickMovement(ship: Ship, body: RAPIER.RigidBody): void {
  const efficiency = powerEfficiency(activeCoreCount(ship));

  let forceX = 0;
  let forceY = 0;

  ship.parts.forEach((part) => {
    if (part.partType !== partType.engine || !part.powered) return;

    // Thrust pushes the ship opposite its exhaust direction, like a rocket.
    const exhaustAngle = (facingRadians[part.facing] ?? 0) + body.rotation();
    const thrustAngle = exhaustAngle + Math.PI;
    const magnitude = ratedThrust(part) * efficiency;
    forceX += Math.cos(thrustAngle) * magnitude;
    forceY += Math.sin(thrustAngle) * magnitude;
  });

  body.resetForces(true);
  if (forceX !== 0 || forceY !== 0) {
    body.addForce({ x: forceX, y: forceY }, true);
  }
}

export function capSpeed(body: RAPIER.RigidBody): void {
  const v = body.linvel();
  const speed = Math.hypot(v.x, v.y);
  if (speed > maxSpeed) {
    const scale = maxSpeed / speed;
    body.setLinvel({ x: v.x * scale, y: v.y * scale }, true);
  }
}
