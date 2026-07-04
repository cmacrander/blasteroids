// Unit tests for per-tick power budgeting.
import { describe, it, expect } from "vitest";
import { partType, activation } from "@blasteroids/shared";
import { buildStarterShip } from "./starterShip";
import { tickPowerBudget } from "./powerBudget";

function partOfType(
  ship: ReturnType<typeof buildStarterShip>,
  type: (typeof partType)[keyof typeof partType],
) {
  return [...ship.parts.values()].find((part) => part.partType === type);
}

describe("tickPowerBudget", () => {
  it("keeps the starter ship's core powered and charges the capacitor", () => {
    const ship = buildStarterShip(0, 0);

    tickPowerBudget(ship, 1);

    const core = partOfType(ship, partType.core);
    expect(core?.powered).toBe(true);
    expect(ship.storedEnergy).toBeGreaterThan(0);
  });

  it("never charges the capacitor past its capacity", () => {
    const ship = buildStarterShip(0, 0);

    for (let i = 0; i < 1000; i++) tickPowerBudget(ship, 1);

    expect(ship.storedEnergy).toBe(100);
  });

  it("drains the capacitor when boosted draw exceeds delivered generation", () => {
    const ship = buildStarterShip(0, 0);

    for (let i = 0; i < 10; i++) tickPowerBudget(ship, 1);
    const chargedEnergy = ship.storedEnergy;
    expect(chargedEnergy).toBeGreaterThan(0);

    const laser = partOfType(ship, partType.laser);
    const engine = partOfType(ship, partType.engine);
    if (laser) laser.activation = activation.boosted;
    if (engine) engine.activation = activation.boosted;

    tickPowerBudget(ship, 1);

    expect(ship.storedEnergy).toBeLessThan(chargedEnergy);
  });

  it("shuts off a core once consumption exceeds what generation can deliver", () => {
    const ship = buildStarterShip(0, 0);
    const power = partOfType(ship, partType.power);
    if (power) power.hp = 0; // destroy the only power part

    tickPowerBudget(ship, 1);

    const core = partOfType(ship, partType.core);
    expect(core?.powered).toBe(false);
  });
});
