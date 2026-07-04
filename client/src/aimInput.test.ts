// Regression tests for the cursor-to-target-angle conversion: given a cursor
// position, does the resulting angle actually point the ship's nose at it?
import { describe, it, expect } from "vitest";
import { computeAimAngle } from "./aimInput";

// The ship's nose direction as a function of body.angle (see rotation.ts /
// movement.ts's facingRadians): the nose points north when angle is 0.
function noseDirection(angle: number): [number, number] {
  return [-Math.sin(angle), Math.cos(angle)];
}

describe("computeAimAngle", () => {
  const center = { x: 960, y: 540 };

  it.each([
    {
      label: "north (cursor above center)",
      cursor: { x: 960, y: 200 },
      expectedNose: [0, 1],
    },
    {
      label: "east (cursor right of center)",
      cursor: { x: 1400, y: 540 },
      expectedNose: [1, 0],
    },
    {
      label: "south (cursor below center)",
      cursor: { x: 960, y: 900 },
      expectedNose: [0, -1],
    },
    {
      label: "west (cursor left of center)",
      cursor: { x: 500, y: 540 },
      expectedNose: [-1, 0],
    },
    {
      label: "northeast diagonal",
      cursor: { x: 1260, y: 240 }, // +300 x, -300 y (screen) from center: equal offsets
      expectedNose: [Math.SQRT1_2, Math.SQRT1_2],
    },
  ])("points the nose at the cursor: $label", ({ cursor, expectedNose }) => {
    const angle = computeAimAngle(cursor.x, cursor.y, center.x, center.y);
    const [noseX, noseY] = noseDirection(angle);

    expect(noseX).toBeCloseTo(expectedNose[0], 6);
    expect(noseY).toBeCloseTo(expectedNose[1], 6);
  });
});
