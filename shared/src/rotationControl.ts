// Bang-bang rotation control decision, shared by the server's Rapier-driven
// rotation and the client's predictive ship simulation so both steer the same.

// Below this, treat the ship as "facing" the target: a small imperceptible
// error is not worth correcting, and it gives residual angular velocity a
// zone to be damped out in instead of endlessly re-triggering full-torque
// correction as it drifts back and forth across a zero-width target.
export const angleDeadZone = 0.02;

// Fraction of residual angular velocity removed per tick once within the
// dead zone; kills spin the braking-distance rule cannot, since that rule
// only stops applying NEW torque.
export const angularVelocityDamping = 0.3;

export function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export type RotationAction =
  { kind: "damp" } | { kind: "torque"; direction: number } | { kind: "coast" };

// Time-optimal bang-bang control: accelerate toward the target, but once the
// braking distance at max torque would carry past it, reverse torque to
// decelerate instead. Plain "always accelerate toward target" overshoots
// badly and oscillates forever.
export function rotationAction(
  angleError: number,
  angularVelocity: number,
  maxTorque: number,
  inertia: number,
): RotationAction {
  if (Math.abs(angleError) <= angleDeadZone) {
    return angularVelocity !== 0 ? { kind: "damp" } : { kind: "coast" };
  }
  if (maxTorque <= 0) return { kind: "coast" };

  const maxAngularAccel = inertia > 0 ? maxTorque / inertia : 0;
  const brakingDistance =
    maxAngularAccel > 0
      ? (angularVelocity * angularVelocity) / (2 * maxAngularAccel)
      : 0;

  const approachingTarget =
    Math.sign(angularVelocity) === Math.sign(angleError);
  const shouldBrake =
    approachingTarget && brakingDistance >= Math.abs(angleError);

  const direction = shouldBrake
    ? -Math.sign(angularVelocity)
    : Math.sign(angleError);
  return { kind: "torque", direction };
}
