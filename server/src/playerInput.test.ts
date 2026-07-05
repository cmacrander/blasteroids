// Unit tests for validating and applying player-input messages.
import { describe, it, expect } from "vitest";
import { partType, activation } from "@blasteroids/shared";
import { buildStarterShip } from "./starterShip";
import { applyActivation, parseAimAngle } from "./playerInput";

function findPart(
  ship: ReturnType<typeof buildStarterShip>,
  type: (typeof partType)[keyof typeof partType],
) {
  return [...ship.parts.values()].find((part) => part.partType === type);
}

describe("applyActivation", () => {
  it("sets activation on every part of the target type", () => {
    const ship = buildStarterShip(0, 0);

    applyActivation(ship, partType.engine, activation.boosted);

    expect(findPart(ship, partType.engine)?.activation).toBe(
      activation.boosted,
    );
  });

  it("applies independently per part type", () => {
    const ship = buildStarterShip(0, 0);

    applyActivation(ship, partType.laser, activation.active);

    expect(findPart(ship, partType.laser)?.activation).toBe(activation.active);
    expect(findPart(ship, partType.engine)?.activation).toBe(
      activation.inactive,
    );
  });

  it("ignores messages that aren't a known activation code", () => {
    const ship = buildStarterShip(0, 0);
    const engine = findPart(ship, partType.engine);
    if (engine) engine.activation = activation.active;

    applyActivation(ship, partType.engine, 99);
    applyActivation(ship, partType.engine, "boosted");
    applyActivation(ship, partType.engine, undefined);

    expect(engine?.activation).toBe(activation.active);
  });
});

describe("parseAimAngle", () => {
  it("accepts a finite number", () => {
    expect(parseAimAngle(1.5)).toBe(1.5);
  });

  it("rejects non-numbers and non-finite values", () => {
    expect(parseAimAngle("1.5")).toBeUndefined();
    expect(parseAimAngle(undefined)).toBeUndefined();
    expect(parseAimAngle(NaN)).toBeUndefined();
    expect(parseAimAngle(Infinity)).toBeUndefined();
  });
});
