// Verifies the loss condition: a ship needs a living core and power part.
import { describe, it, expect } from "vitest";
import { Ship } from "./schema/ship.js";
import { Part } from "./schema/part.js";
import { partType } from "./constants.js";
import { shipIsViable } from "./shipStats.js";

function shipWith(types: number[]): Ship {
  const ship = new Ship();
  types.forEach((type, index) => {
    const part = new Part();
    part.partType = type;
    part.hp = 100;
    ship.parts.set(String(index), part);
  });
  return ship;
}

describe("shipIsViable", () => {
  it("holds with at least one core and one power part", () => {
    expect(shipIsViable(shipWith([partType.core, partType.power]))).toBe(true);
  });

  it("fails without a core", () => {
    expect(shipIsViable(shipWith([partType.power, partType.engine]))).toBe(
      false,
    );
  });

  it("fails without a power part", () => {
    expect(shipIsViable(shipWith([partType.core, partType.laser]))).toBe(false);
  });

  it("ignores parts at 0 HP", () => {
    const ship = shipWith([partType.core, partType.power]);
    const core = ship.parts.get("0");
    if (core) core.hp = 0;
    expect(shipIsViable(ship)).toBe(false);
  });
});
