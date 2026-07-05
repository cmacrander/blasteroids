// Verifies the predictive ship simulation: thrust, caps, walls, steering.
import { describe, it, expect } from "vitest";
import { stepShipMotion, type ShipMotion, type SimPart } from "./shipSim.js";
import {
  partType,
  facing,
  activation,
  maxSpeed,
  mapHeight,
  simulationHz,
} from "./constants.js";

const fixedDt = 1 / simulationHz;

// The starter ship, powered up: nose north, engine exhaust south.
function starterParts(): SimPart[] {
  return [
    {
      partType: partType.laser,
      offsetX: 0,
      offsetY: 1,
      facing: facing.north,
      hp: 100,
      powered: false,
    },
    {
      partType: partType.core,
      offsetX: 0,
      offsetY: 0,
      facing: facing.north,
      hp: 100,
      powered: true,
    },
    {
      partType: partType.power,
      offsetX: 0,
      offsetY: -1,
      facing: facing.north,
      hp: 100,
      powered: true,
    },
    {
      partType: partType.engine,
      offsetX: 0,
      offsetY: -2,
      facing: facing.south,
      hp: 100,
      powered: true,
    },
  ];
}

function restingMotion(): ShipMotion {
  return { x: 100, y: 100, angle: 0, vx: 0, vy: 0, angularVelocity: 0 };
}

function simulate(
  motion: ShipMotion,
  parts: SimPart[],
  engineActivation: number,
  targetAngle: number,
  seconds: number,
): void {
  const steps = Math.round(seconds * simulationHz);
  for (let i = 0; i < steps; i++) {
    stepShipMotion(motion, parts, { engineActivation, targetAngle }, fixedDt);
  }
}

describe("stepShipMotion", () => {
  it("accelerates the ship toward its nose while engines are active", () => {
    const motion = restingMotion();
    simulate(motion, starterParts(), activation.active, 0, 1);
    // One engine at 48kN, 25% efficiency, 4000 kg -> 3 m/s^2 northward.
    expect(motion.vy).toBeCloseTo(3, 1);
    expect(Math.abs(motion.vx)).toBeLessThan(0.01);
    expect(motion.y).toBeGreaterThan(100);
  });

  it("does not accelerate while inactive", () => {
    const motion = restingMotion();
    simulate(motion, starterParts(), activation.inactive, 0, 1);
    expect(motion.vx).toBe(0);
    expect(motion.vy).toBe(0);
  });

  it("caps speed at maxSpeed", () => {
    const motion = restingMotion();
    simulate(motion, starterParts(), activation.boosted, 0, 30);
    expect(Math.hypot(motion.vx, motion.vy)).toBeLessThanOrEqual(maxSpeed);
  });

  it("stops dead at the map walls", () => {
    const motion = restingMotion();
    motion.y = mapHeight - 2;
    simulate(motion, starterParts(), activation.boosted, 0, 5);
    expect(motion.y).toBeLessThanOrEqual(mapHeight - 0.5);
    expect(motion.vy).toBeLessThanOrEqual(0);
  });

  it("steers toward the target angle and settles there", () => {
    const motion = restingMotion();
    simulate(motion, starterParts(), activation.inactive, Math.PI / 2, 3);
    expect(motion.angle).toBeCloseTo(Math.PI / 2, 1);
    expect(Math.abs(motion.angularVelocity)).toBeLessThan(0.1);
  });

  it("does nothing for a ship with no living parts", () => {
    const motion = restingMotion();
    const dead = starterParts().map((part) => ({ ...part, hp: 0 }));
    simulate(motion, dead, activation.boosted, 1, 1);
    expect(motion).toEqual(restingMotion());
  });
});
