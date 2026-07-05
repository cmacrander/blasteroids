// Per-tick thrust application and speed capping for one ship's rigid body.
import type RAPIER from "@dimforge/rapier2d-compat";
import type { Ship, Part } from "@blasteroids/shared";
import {
  partType,
  activation,
  engineThrustRate,
  engineBoostThrustRate,
  maxSpeed,
  activeCoreCount,
  powerEfficiency,
  facingWorldRadians,
} from "@blasteroids/shared";

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
    const exhaustAngle = facingWorldRadians(part.facing) + body.rotation();
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
