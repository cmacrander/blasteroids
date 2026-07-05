// Per-tick torque application and angular speed capping for one ship's rigid body.
import type RAPIER from "@dimforge/rapier2d-compat";
import type { Ship } from "@blasteroids/shared";
import {
  partType,
  engineTurnTorque,
  maxAngularSpeed,
  normalizeAngle,
  rotationAction,
  angularVelocityDamping,
} from "@blasteroids/shared";

// Rotation is free: every attached engine acts as a maneuvering thruster that
// contributes torque independent of power/activation, as if it can gimbal to
// fire tangentially at its actual distance from the ship's center of mass --
// torque = force * lever arm is maximized by a tangential push. This is a
// fully separate system from movement.ts's power-gated linear thrust; there's
// no shared budget between the two.
//
// A destroyed part (hp <= 0) always either disappears or detaches from the
// ship immediately (see "Ship parts" in gameDesign.md), so it should never
// actually be sitting in ship.parts by the time this runs -- this check is
// defensive, not a case we expect to hit.
export function maxAvailableTorque(ship: Ship, body: RAPIER.RigidBody): number {
  const com = body.localCom();

  let torque = 0;
  ship.parts.forEach((part) => {
    if (part.partType !== partType.engine || part.hp <= 0) return;
    const leverArm = Math.hypot(part.offsetX - com.x, part.offsetY - com.y);
    torque += engineTurnTorque * leverArm;
  });
  return torque;
}

// The steering decision (bang-bang with braking-distance control and
// dead-zone damping) lives in shared rotationControl.ts so the client's
// predictive simulation matches it exactly.
export function tickRotation(
  ship: Ship,
  body: RAPIER.RigidBody,
  targetAngle: number,
): void {
  const angleError = normalizeAngle(targetAngle - body.rotation());
  const torque = maxAvailableTorque(ship, body);

  body.resetTorques(true);

  const action = rotationAction(
    angleError,
    body.angvel(),
    torque,
    body.principalInertia(),
  );
  if (action.kind === "damp") {
    body.setAngvel(body.angvel() * (1 - angularVelocityDamping), true);
  } else if (action.kind === "torque") {
    body.addTorque(action.direction * torque, true);
  }
}

export function capAngularSpeed(body: RAPIER.RigidBody): void {
  const angvel = body.angvel();
  if (Math.abs(angvel) > maxAngularSpeed) {
    body.setAngvel(Math.sign(angvel) * maxAngularSpeed, true);
  }
}
