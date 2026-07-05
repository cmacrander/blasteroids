// Verifies the detach-or-destroy roll and the flood-fill group-cut rule.
import { describe, it, expect } from "vitest";
import { Ship, Part, partType, facing } from "@blasteroids/shared";
import { resolveDestroyedParts, scatterAllParts } from "./shipDamage";

function addPart(
  ship: Ship,
  key: string,
  type: number,
  offsetX: number,
  offsetY: number,
): Part {
  const part = new Part();
  part.partType = type;
  part.offsetX = offsetX;
  part.offsetY = offsetY;
  part.facing = facing.north;
  part.hp = 100;
  ship.parts.set(key, part);
  return part;
}

// partDetachChance is 0.3: a roll of 0 detaches, a roll of 0.9 destroys.
const alwaysDetach = () => 0;
const neverDetach = () => 0.9;

describe("resolveDestroyedParts", () => {
  it("removes the destroyed part and reports the detach roll", () => {
    const ship = new Ship();
    addPart(ship, "a", partType.core, 0, 0);
    addPart(ship, "b", partType.power, 0, 1);

    const removed = resolveDestroyedParts(ship, ["b"], alwaysDetach);

    expect(removed).toHaveLength(1);
    expect(removed[0]?.key).toBe("b");
    expect(removed[0]?.detached).toBe(true);
    expect(ship.parts.has("b")).toBe(false);
    expect(ship.parts.has("a")).toBe(true);
  });

  it("keeps only the group with the most cores after a cut", () => {
    // A vertical line: core - power - core - core. Destroying the power part
    // splits {bottom core} from {two top cores}; the latter must survive.
    const ship = new Ship();
    addPart(ship, "bottomCore", partType.core, 0, 0);
    addPart(ship, "bridge", partType.power, 0, 1);
    addPart(ship, "midCore", partType.core, 0, 2);
    addPart(ship, "topCore", partType.core, 0, 3);

    const removed = resolveDestroyedParts(ship, ["bridge"], neverDetach);

    expect(ship.parts.has("midCore")).toBe(true);
    expect(ship.parts.has("topCore")).toBe(true);
    expect(ship.parts.has("bottomCore")).toBe(false);
    expect(removed.map((entry) => entry.key).sort()).toEqual([
      "bottomCore",
      "bridge",
    ]);
  });

  it("survives a multi-way cut, keeping exactly one group", () => {
    // A plus shape: destroying the center splits four single-part groups.
    const ship = new Ship();
    addPart(ship, "center", partType.power, 0, 0);
    addPart(ship, "north", partType.core, 0, 1);
    addPart(ship, "south", partType.power, 0, -1);
    addPart(ship, "east", partType.power, 1, 0);
    addPart(ship, "west", partType.power, -1, 0);

    resolveDestroyedParts(ship, ["center"], neverDetach);

    // The only core is in the north group, so it must be the survivor.
    expect(ship.parts.has("north")).toBe(true);
    expect(ship.parts.size).toBe(1);
  });

  it("ignores keys that are not on the ship", () => {
    const ship = new Ship();
    addPart(ship, "a", partType.core, 0, 0);
    const removed = resolveDestroyedParts(ship, ["ghost"], neverDetach);
    expect(removed).toEqual([]);
    expect(ship.parts.size).toBe(1);
  });
});

describe("scatterAllParts", () => {
  it("empties the ship, rolling each part independently", () => {
    const ship = new Ship();
    addPart(ship, "a", partType.core, 0, 0);
    addPart(ship, "b", partType.power, 0, 1);

    const removed = scatterAllParts(ship, alwaysDetach);

    expect(ship.parts.size).toBe(0);
    expect(removed).toHaveLength(2);
    expect(removed.every((entry) => entry.detached)).toBe(true);
  });
});
