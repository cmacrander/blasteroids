// Pure kinematic ship simulation for client-side prediction: mirrors the
// server's Rapier-driven thrust and rotation closely enough that corrections
// stay small. Collisions are deliberately not simulated (only the map-edge
// walls, as a hard clamp); server reconciliation covers the rest.
import {
  partType,
  activation,
  facing,
  partMass,
  engineThrustRate,
  engineBoostThrustRate,
  engineTurnTorque,
  maxSpeed,
  maxAngularSpeed,
  mapWidth,
  mapHeight,
} from "./constants.js";
import { powerEfficiency } from "./shipStats.js";
import {
  rotationAction,
  normalizeAngle,
  angularVelocityDamping,
} from "./rotationControl.js";

export interface ShipMotion {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  angularVelocity: number;
}

export interface MotionControls {
  engineActivation: number;
  targetAngle: number;
}

// The slice of a Part the simulation needs; satisfied by the Part schema.
export interface SimPart {
  partType: number;
  offsetX: number;
  offsetY: number;
  facing: number;
  hp: number;
  powered: boolean;
}

// A part's facing direction in the ship's own unrotated frame, where +x is
// east and +y is north. Add the ship's rotation for the world-space angle.
export function facingWorldRadians(facingCode: number): number {
  if (facingCode === facing.east) return 0;
  if (facingCode === facing.south) return -Math.PI / 2;
  if (facingCode === facing.west) return Math.PI;
  return Math.PI / 2; // north
}

export function motionFromBody(body: {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  angularVelocity: number;
}): ShipMotion {
  return {
    x: body.x,
    y: body.y,
    angle: body.angle,
    vx: body.vx,
    vy: body.vy,
    angularVelocity: body.angularVelocity,
  };
}

// Advances the motion by one fixed step under the given controls. Prediction
// assumes a requested engine activation is actually powered; if the capacitor
// was empty the server correction pulls the ship back.
export function stepShipMotion(
  motion: ShipMotion,
  parts: SimPart[],
  controls: MotionControls,
  dt: number,
): void {
  const alive = parts.filter((part) => part.hp > 0);
  if (alive.length === 0) return;

  const mass = alive.length * partMass;
  const efficiency = powerEfficiency(
    alive.filter((part) => part.partType === partType.core && part.powered)
      .length,
  );

  if (controls.engineActivation !== activation.inactive) {
    const rate =
      controls.engineActivation === activation.boosted
        ? engineBoostThrustRate
        : engineThrustRate;
    for (const part of alive) {
      if (part.partType !== partType.engine) continue;
      const exhaustAngle = facingWorldRadians(part.facing) + motion.angle;
      const thrustAngle = exhaustAngle + Math.PI;
      const accel = (rate * efficiency) / mass;
      motion.vx += Math.cos(thrustAngle) * accel * dt;
      motion.vy += Math.sin(thrustAngle) * accel * dt;
    }
  }

  const speed = Math.hypot(motion.vx, motion.vy);
  if (speed > maxSpeed) {
    const scale = maxSpeed / speed;
    motion.vx *= scale;
    motion.vy *= scale;
  }

  motion.x += motion.vx * dt;
  motion.y += motion.vy * dt;

  // The map's walls stop ships dead (zero restitution); approximate the
  // ship's own extent with half a part.
  if (motion.x < 0.5) {
    motion.x = 0.5;
    motion.vx = Math.max(0, motion.vx);
  } else if (motion.x > mapWidth - 0.5) {
    motion.x = mapWidth - 0.5;
    motion.vx = Math.min(0, motion.vx);
  }
  if (motion.y < 0.5) {
    motion.y = 0.5;
    motion.vy = Math.max(0, motion.vy);
  } else if (motion.y > mapHeight - 0.5) {
    motion.y = mapHeight - 0.5;
    motion.vy = Math.min(0, motion.vy);
  }

  stepRotation(motion, alive, controls.targetAngle, dt);
}

// Torque and inertia mirror Rapier's compound-cuboid math: every engine is a
// free maneuvering thruster with torque = engineTurnTorque * lever arm from
// the center of mass; a unit square of mass m has inertia m/6 about its own
// center plus the parallel-axis term.
function stepRotation(
  motion: ShipMotion,
  alive: SimPart[],
  targetAngle: number,
  dt: number,
): void {
  let comX = 0;
  let comY = 0;
  for (const part of alive) {
    comX += part.offsetX;
    comY += part.offsetY;
  }
  comX /= alive.length;
  comY /= alive.length;

  let torque = 0;
  let inertia = 0;
  for (const part of alive) {
    const dx = part.offsetX - comX;
    const dy = part.offsetY - comY;
    const r2 = dx * dx + dy * dy;
    inertia += partMass * (r2 + 1 / 6);
    if (part.partType === partType.engine) {
      torque += engineTurnTorque * Math.sqrt(r2);
    }
  }

  const angleError = normalizeAngle(targetAngle - motion.angle);
  const action = rotationAction(
    angleError,
    motion.angularVelocity,
    torque,
    inertia,
  );

  if (action.kind === "damp") {
    motion.angularVelocity *= 1 - angularVelocityDamping;
  } else if (action.kind === "torque" && inertia > 0) {
    motion.angularVelocity += (action.direction * torque * dt) / inertia;
  }

  if (Math.abs(motion.angularVelocity) > maxAngularSpeed) {
    motion.angularVelocity =
      Math.sign(motion.angularVelocity) * maxAngularSpeed;
  }

  motion.angle = normalizeAngle(motion.angle + motion.angularVelocity * dt);
}
