// Unit tests for thrust application and speed capping.
import { describe, it, expect, beforeAll } from "vitest";
import { partType, activation, maxSpeed } from "@blasteroids/shared";
import { buildStarterShip } from "./starterShip";
import { tickPowerBudget } from "./powerBudget";
import { initPhysics, createShipBody, stepPhysics } from "./physicsWorld";
import { tickMovement, capSpeed } from "./movement";

beforeAll(async () => {
  await initPhysics();
});

function findPart(
  ship: ReturnType<typeof buildStarterShip>,
  type: (typeof partType)[keyof typeof partType],
) {
  return [...ship.parts.values()].find((part) => part.partType === type);
}

describe("tickMovement", () => {
  it("accelerates a 4-part ship at 3 m/s^2 when its engine is active", () => {
    const ship = buildStarterShip(0, 0);
    const engine = findPart(ship, partType.engine);
    if (engine) engine.activation = activation.active;

    tickPowerBudget(ship, 1); // sets powered flags before thrust reads them
    expect(engine?.powered).toBe(true);

    const body = createShipBody("accelerate-test", ship);
    tickMovement(ship, body);
    stepPhysics();

    const v = body.linvel();
    expect(v.y).toBeCloseTo(3 / 60, 3); // a=3 m/s^2 over one 1/60s tick, forward (+y)
    expect(v.x).toBeCloseTo(0, 6);
  });

  it("does not exceed the speed cap", () => {
    const ship = buildStarterShip(0, 0);
    const body = createShipBody("cap-test", ship);
    body.setLinvel({ x: maxSpeed * 2, y: 0 }, true);

    capSpeed(body);

    const v = body.linvel();
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(maxSpeed, 6);
  });
});
