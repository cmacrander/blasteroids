// Unit tests for torque application and angular speed capping.
import { describe, it, expect, beforeAll } from "vitest";
import { partType, maxAngularSpeed } from "@blasteroids/shared";
import { buildStarterShip } from "./starterShip";
import { initPhysics, createShipBody, stepPhysics } from "./physicsWorld";
import { tickRotation, capAngularSpeed, maxAvailableTorque } from "./rotation";

beforeAll(async () => {
  await initPhysics();
});

function findPart(
  ship: ReturnType<typeof buildStarterShip>,
  type: (typeof partType)[keyof typeof partType],
) {
  return [...ship.parts.values()].find((part) => part.partType === type);
}

// Physics tests share one persistent Rapier world; spawn each ship far apart
// so leftover bodies from other tests (still spinning/moving) never collide
// with the one under test once stepPhysics() advances the whole world.
describe("tickRotation", () => {
  it("reports zero available torque with no engines attached", () => {
    const ship = buildStarterShip(20, 100);
    const engine = findPart(ship, partType.engine);
    if (engine) engine.hp = 0;
    const body = createShipBody("no-torque-test", ship);

    expect(maxAvailableTorque(ship, body)).toBe(0);
  });

  it("provides torque from an attached engine regardless of activation", () => {
    const ship = buildStarterShip(40, 100);
    const body = createShipBody("free-rotation-test", ship);

    // No activation set, no power budgeting run -- rotation costs nothing.
    expect(maxAvailableTorque(ship, body)).toBeGreaterThan(0);
  });

  it("spins the ship toward a target angle", () => {
    const ship = buildStarterShip(60, 100);
    const body = createShipBody("spin-test", ship);
    expect(maxAvailableTorque(ship, body)).toBeGreaterThan(0);

    tickRotation(ship, body, Math.PI / 2);
    stepPhysics();

    expect(body.angvel()).toBeGreaterThan(0);
    expect(body.rotation()).toBeGreaterThan(0);
  });

  it("does not apply torque once within the angle dead zone", () => {
    const ship = buildStarterShip(80, 100);
    const body = createShipBody("deadzone-test", ship);
    tickRotation(ship, body, body.rotation());
    stepPhysics();

    expect(body.angvel()).toBe(0);
  });

  it("damps residual angular velocity while within the dead zone", () => {
    const ship = buildStarterShip(100, 100);
    const body = createShipBody("damping-test", ship);
    body.setAngvel(0.5, true);

    // Already facing the target -- any correction here should only be
    // damping, not a fresh bang-bang push (which wouldn't apply, since the
    // angle error is zero either way).
    tickRotation(ship, body, body.rotation());

    expect(Math.abs(body.angvel())).toBeLessThan(0.5);
    expect(Math.abs(body.angvel())).toBeGreaterThan(0);
  });

  it("converges on the target angle without overshooting far past it", () => {
    const ship = buildStarterShip(120, 100);
    const body = createShipBody("converge-test", ship);
    const targetAngle = Math.PI / 2;

    let maxAngleSeen = 0;
    for (let i = 0; i < 300; i++) {
      tickRotation(ship, body, targetAngle);
      stepPhysics();
      maxAngleSeen = Math.max(maxAngleSeen, body.rotation());
    }

    expect(body.rotation()).toBeCloseTo(targetAngle, 1);
    // Discrete-timestep bang-bang naturally chatters a bit near zero velocity
    // rather than settling exactly still; just confirm it's no longer
    // meaningfully spinning, not that it's perfectly damped to zero.
    expect(Math.abs(body.angvel())).toBeLessThan(1);
    // A little overshoot from discrete timesteps is fine; blowing well past
    // the target (as pure "always accelerate toward it" bang-bang did) isn't.
    expect(maxAngleSeen).toBeLessThan(targetAngle + 0.2);
  });
});

describe("capAngularSpeed", () => {
  it("clamps angular velocity to the cap", () => {
    const ship = buildStarterShip(140, 100);
    const body = createShipBody("angular-cap-test", ship);
    body.setAngvel(maxAngularSpeed * 5, true);

    capAngularSpeed(body);

    expect(body.angvel()).toBeCloseTo(maxAngularSpeed, 6);
  });
});
