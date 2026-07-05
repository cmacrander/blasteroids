// Verifies attach-slot legality and per-type placement rules.
import { describe, it, expect } from "vitest";
import {
  openSlots,
  forbiddenCells,
  legalAttachSlots,
  chooseAttachSlot,
  cellKey,
  type GridPart,
} from "./partPlacement.js";
import { partType, facing } from "./constants.js";
import { createRng } from "./rng.js";

// The starter ship: laser front, core, power, engine rear (all on x = 0).
function starterParts(): GridPart[] {
  return [
    { partType: partType.laser, offsetX: 0, offsetY: 1, facing: facing.north },
    { partType: partType.core, offsetX: 0, offsetY: 0, facing: facing.north },
    { partType: partType.power, offsetX: 0, offsetY: -1, facing: facing.north },
    {
      partType: partType.engine,
      offsetX: 0,
      offsetY: -2,
      facing: facing.south,
    },
  ];
}

describe("openSlots", () => {
  it("lists unoccupied cells adjacent to any part, without duplicates", () => {
    const slots = openSlots(starterParts());
    const keys = slots.map((slot) => cellKey(slot.x, slot.y));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain(cellKey(0, 2)); // above the laser
    expect(keys).toContain(cellKey(1, 0)); // beside the core
    expect(keys).not.toContain(cellKey(0, 0)); // occupied
  });

  it("is empty for an empty part list", () => {
    expect(openSlots([])).toEqual([]);
  });
});

describe("forbiddenCells", () => {
  it("marks the cells faced by exhausts and lenses", () => {
    const forbidden = forbiddenCells(starterParts());
    expect(forbidden.has(cellKey(0, 2))).toBe(true); // laser lens (north)
    expect(forbidden.has(cellKey(0, -3))).toBe(true); // engine exhaust (south)
    expect(forbidden.size).toBe(2);
  });
});

describe("legalAttachSlots", () => {
  it("excludes cells in front of an exhaust or lens", () => {
    const slots = legalAttachSlots(starterParts(), partType.core);
    const keys = slots.map((slot) => cellKey(slot.offsetX, slot.offsetY));
    expect(keys).not.toContain(cellKey(0, 2));
    expect(keys).not.toContain(cellKey(0, -3));
    expect(keys).toContain(cellKey(1, 0));
  });

  it("never offers an engine slot whose own exhaust edge is blocked", () => {
    const slots = legalAttachSlots(starterParts(), partType.engine);
    const occupiedKeys = new Set(
      starterParts().map((part) => cellKey(part.offsetX, part.offsetY)),
    );
    for (const slot of slots) {
      expect(occupiedKeys.has(cellKey(slot.offsetX, slot.offsetY - 1))).toBe(
        false,
      );
    }
  });
});

describe("chooseAttachSlot", () => {
  const rng = () => createRng(42);

  it("returns null when there is nowhere to attach", () => {
    expect(chooseAttachSlot([], partType.core, rng())).toBeNull();
  });

  it("puts a new engine at the rearmost legal slot, facing south", () => {
    const slot = chooseAttachSlot(starterParts(), partType.engine, rng());
    // Rearmost open non-forbidden slots are (1, -2) and (-1, -2): the cell
    // straight below the engine, (0, -3), is its exhaust cell.
    expect(slot?.offsetY).toBe(-2);
    expect(Math.abs(slot?.offsetX ?? 0)).toBe(1);
    expect(slot?.facing).toBe(facing.south);
  });

  it("puts a new laser at the frontmost legal slot, facing north", () => {
    const slot = chooseAttachSlot(starterParts(), partType.laser, rng());
    // (0, 2) is the lens cell of the existing laser, so the frontmost legal
    // slots are (1, 1) and (-1, 1).
    expect(slot?.offsetY).toBe(1);
    expect(Math.abs(slot?.offsetX ?? 0)).toBe(1);
    expect(slot?.facing).toBe(facing.north);
  });

  it("puts a new core at a most-adjacent slot", () => {
    // An L-shape: the inside corner (1, 1) touches two parts.
    const parts: GridPart[] = [
      { partType: partType.core, offsetX: 0, offsetY: 0, facing: facing.north },
      { partType: partType.core, offsetX: 0, offsetY: 1, facing: facing.north },
      { partType: partType.core, offsetX: 1, offsetY: 0, facing: facing.north },
    ];
    const slot = chooseAttachSlot(parts, partType.core, rng());
    expect(slot).toEqual({ offsetX: 1, offsetY: 1, facing: facing.north });
  });

  it("biases a new power part toward the rear among equal-adjacency slots", () => {
    // A vertical column: every side slot touches exactly one part, so the
    // low-y bias must decide. Rearmost side slots are (1, -1) and (-1, -1);
    // (0, -2) touches one part too and is even lower.
    const parts: GridPart[] = [
      { partType: partType.core, offsetX: 0, offsetY: 1, facing: facing.north },
      { partType: partType.core, offsetX: 0, offsetY: 0, facing: facing.north },
      {
        partType: partType.core,
        offsetX: 0,
        offsetY: -1,
        facing: facing.north,
      },
    ];
    const slot = chooseAttachSlot(parts, partType.power, rng());
    expect(slot?.offsetY).toBe(-2);
  });

  it("is deterministic for a given rng seed", () => {
    const a = chooseAttachSlot(starterParts(), partType.core, createRng(7));
    const b = chooseAttachSlot(starterParts(), partType.core, createRng(7));
    expect(a).toEqual(b);
  });
});
