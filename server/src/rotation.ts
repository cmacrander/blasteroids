// Per-tick torque application and angular speed capping for one ship's rigid body.
import type RAPIER from "@dimforge/rapier2d-compat";
import type { Ship } from "@blasteroids/shared";
import {
  partType,
  engineTurnTorque,
  maxAngularSpeed,
} from "@blasteroids/shared";

// Below this, treat the ship as "facing" targetAngle: a small imperceptible
// error isn't worth correcting, and it gives residual angular velocity a
// zone to be damped out in (see angularVelocityDamping below) instead of
// endlessly re-triggering full-torque correction as it drifts back and forth
// across a zero-width target.
const angleDeadZone = 0.02;

// Fraction of residual angular velocity removed per tick once within the
// dead zone. Braking-distance control alone stops applying NEW torque near
// the target, but does nothing about velocity the ship already has -- it
// just coasts through the dead zone and out the other side, re-triggering
// correction forever. This kills that residual spin directly instead.
const angularVelocityDamping = 0.3;

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

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

// Time-optimal bang-bang control: accelerate toward the target, but once the
// braking distance at max torque would carry past it, reverse torque to
// decelerate instead. Plain "always accelerate toward target" overshoots
// badly and oscillates forever, since nothing ever slows the ship down before
// it crosses the target angle.
export function tickRotation(
  ship: Ship,
  body: RAPIER.RigidBody,
  targetAngle: number,
): void {
  const angleError = normalizeAngle(targetAngle - body.rotation());
  const torque = maxAvailableTorque(ship, body);

  body.resetTorques(true);

  if (Math.abs(angleError) <= angleDeadZone) {
    const angvel = body.angvel();
    if (angvel !== 0)
      body.setAngvel(angvel * (1 - angularVelocityDamping), true);
    return;
  }

  if (torque <= 0) return;

  const angvel = body.angvel();
  const inertia = body.principalInertia();
  const maxAngularAccel = inertia > 0 ? torque / inertia : 0;
  const brakingDistance =
    maxAngularAccel > 0 ? (angvel * angvel) / (2 * maxAngularAccel) : 0;

  const approachingTarget = Math.sign(angvel) === Math.sign(angleError);
  const shouldBrake =
    approachingTarget && brakingDistance >= Math.abs(angleError);

  const direction = shouldBrake ? -Math.sign(angvel) : Math.sign(angleError);
  body.addTorque(direction * torque, true);
}

export function capAngularSpeed(body: RAPIER.RigidBody): void {
  const angvel = body.angvel();
  if (Math.abs(angvel) > maxAngularSpeed) {
    body.setAngvel(Math.sign(angvel) * maxAngularSpeed, true);
  }
}
