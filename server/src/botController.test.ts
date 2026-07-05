// Verifies bot target selection priorities and aiming.
import { describe, it, expect } from "vitest";
import { activation, botEngageRange } from "@blasteroids/shared";
import { decideBotAction } from "./botController";

const self = { x: 100, y: 100 };

describe("decideBotAction", () => {
  it("fights the nearest ship even when an asteroid is closer", () => {
    const decision = decideBotAction(
      self,
      [{ x: 110, y: 100 }],
      [{ x: 102, y: 100 }],
      true,
    );
    // Target due east: nose must turn a quarter turn clockwise from north.
    expect(decision.targetAngle).toBeCloseTo(-Math.PI / 2, 6);
    expect(decision.engine).toBe(activation.active);
    expect(decision.laser).toBe(activation.active);
  });

  it("picks the closest of several ships", () => {
    const decision = decideBotAction(
      self,
      [
        { x: 100, y: 115 },
        { x: 100, y: 108 },
      ],
      [],
      true,
    );
    // Closest ship is due north: no turn needed.
    expect(decision.targetAngle).toBeCloseTo(0, 6);
  });

  it("mines the nearest asteroid when no ship is in range", () => {
    const decision = decideBotAction(
      self,
      [{ x: 100, y: 100 + botEngageRange + 1 }],
      [{ x: 90, y: 100 }],
      true,
    );
    // Asteroid due west: a quarter turn counterclockwise from north.
    expect(decision.targetAngle).toBeCloseTo(Math.PI / 2, 6);
    expect(decision.engine).toBe(activation.active);
    expect(decision.laser).toBe(activation.active);
  });

  it("drifts with everything switched off when nothing is in range", () => {
    const decision = decideBotAction(
      self,
      [{ x: 100, y: 130 }],
      [{ x: 130, y: 100 }],
      true,
    );
    expect(decision).toEqual({
      targetAngle: null,
      engine: activation.inactive,
      laser: activation.inactive,
    });
  });

  it("treats a target exactly at the engage range as in range", () => {
    const decision = decideBotAction(
      self,
      [],
      [{ x: 100 + botEngageRange, y: 100 }],
      true,
    );
    expect(decision.engine).toBe(activation.active);
  });

  it("flees directly away from a ship when unarmed, ignoring asteroids", () => {
    const decision = decideBotAction(
      self,
      [{ x: 110, y: 100 }],
      [{ x: 90, y: 100 }],
      false,
    );
    // Target due east, so fleeing faces due west: a quarter turn
    // counterclockwise from north.
    expect(decision.targetAngle).toBeCloseTo(Math.PI / 2, 6);
    expect(decision.engine).toBe(activation.active);
    expect(decision.laser).toBe(activation.inactive);
  });

  it("still mines asteroids when unarmed and no ship is in range", () => {
    const decision = decideBotAction(self, [], [{ x: 90, y: 100 }], false);
    expect(decision.targetAngle).toBeCloseTo(Math.PI / 2, 6);
    expect(decision.engine).toBe(activation.active);
    expect(decision.laser).toBe(activation.active);
  });
});
