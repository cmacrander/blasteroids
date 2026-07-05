// Verifies defrag arrangements: legality, symmetry, connectivity, roles.
import { describe, it, expect } from "vitest";
import {
  defragArrangement,
  bestDefragArrangement,
  applyArrangement,
  countsByType,
  defragDurationSeconds,
} from "./defrag.js";
import { connectedGroups } from "./connectivity.js";
import {
  occupiedCells,
  forbiddenCells,
  cellKey,
  type GridPart,
} from "./partPlacement.js";
import { partType, facing, defragMinSeconds } from "./constants.js";
import { createRng } from "./rng.js";
import { Ship } from "./schema/ship.js";
import { Part } from "./schema/part.js";

function makeCounts(
  cores: number,
  power: number,
  engines: number,
  lasers: number,
): Map<number, number> {
  return new Map([
    [partType.core, cores],
    [partType.power, power],
    [partType.engine, engines],
    [partType.laser, lasers],
  ]);
}

function expectLegal(arrangement: GridPart[]): void {
  const occupied = occupiedCells(arrangement);
  expect(occupied.size).toBe(arrangement.length); // no overlaps
  const forbidden = forbiddenCells(arrangement);
  for (const part of arrangement) {
    expect(forbidden.has(cellKey(part.offsetX, part.offsetY))).toBe(false);
  }
}

describe("defragArrangement", () => {
  it("places every part, connected and legal, for the starter inventory", () => {
    const arrangement = defragArrangement(makeCounts(1, 1, 1, 1), createRng(3));
    expect(arrangement).toHaveLength(4);
    expect(connectedGroups(arrangement)).toHaveLength(1);
    expectLegal(arrangement);
  });

  it("mirrors even counts symmetrically across the column boundary", () => {
    const arrangement = defragArrangement(makeCounts(2, 2, 2, 2), createRng(5));
    expect(arrangement).toHaveLength(8);
    expect(connectedGroups(arrangement)).toHaveLength(1);
    expectLegal(arrangement);

    const keys = new Set(
      arrangement.map(
        (part) =>
          cellKey(part.offsetX, part.offsetY) + `:${String(part.partType)}`,
      ),
    );
    for (const part of arrangement) {
      const mirror =
        cellKey(1 - part.offsetX, part.offsetY) + `:${String(part.partType)}`;
      expect(keys.has(mirror)).toBe(true);
    }
  });

  it("puts engines rearmost facing south and lasers frontmost facing north", () => {
    const arrangement = defragArrangement(makeCounts(2, 2, 2, 2), createRng(9));
    const minY = Math.min(...arrangement.map((part) => part.offsetY));
    const maxY = Math.max(...arrangement.map((part) => part.offsetY));
    for (const part of arrangement) {
      if (part.partType === partType.engine) {
        expect(part.offsetY).toBe(minY);
        expect(part.facing).toBe(facing.south);
      }
      if (part.partType === partType.laser) {
        expect(part.offsetY).toBe(maxY);
        expect(part.facing).toBe(facing.north);
      }
    }
  });

  it("handles a larger, odd-count inventory", () => {
    const arrangement = defragArrangement(makeCounts(3, 5, 4, 3), createRng(1));
    expect(arrangement).toHaveLength(15);
    expect(connectedGroups(arrangement)).toHaveLength(1);
    expectLegal(arrangement);
  });

  it("is deterministic for a given seed", () => {
    const counts = makeCounts(2, 3, 2, 1);
    expect(defragArrangement(counts, createRng(7))).toEqual(
      defragArrangement(counts, createRng(7)),
    );
  });
});

describe("bestDefragArrangement", () => {
  it("returns a complete arrangement for the given parts", () => {
    const parts: GridPart[] = [
      { partType: partType.core, offsetX: 0, offsetY: 0, facing: facing.north },
      {
        partType: partType.power,
        offsetX: 0,
        offsetY: -1,
        facing: facing.north,
      },
      {
        partType: partType.engine,
        offsetX: 0,
        offsetY: -2,
        facing: facing.south,
      },
    ];
    const arrangement = bestDefragArrangement(parts, createRng(11));
    expect(countsByType(arrangement)).toEqual(countsByType(parts));
    expectLegal(arrangement);
  });
});

describe("applyArrangement", () => {
  it("moves parts to slots of their own type, keeping hp", () => {
    const ship = new Ship();
    const core = new Part();
    core.partType = partType.core;
    core.hp = 42;
    ship.parts.set("core", core);
    const engine = new Part();
    engine.partType = partType.engine;
    engine.offsetY = -1;
    engine.facing = facing.south;
    engine.hp = 77;
    ship.parts.set("engine", engine);

    const arrangement: GridPart[] = [
      {
        partType: partType.engine,
        offsetX: 4,
        offsetY: 4,
        facing: facing.south,
      },
      { partType: partType.core, offsetX: 4, offsetY: 5, facing: facing.north },
    ];
    applyArrangement(ship, arrangement);

    expect([core.offsetX, core.offsetY, core.hp]).toEqual([4, 5, 42]);
    expect([engine.offsetX, engine.offsetY, engine.hp]).toEqual([4, 4, 77]);
  });
});

describe("defragDurationSeconds", () => {
  it("scales with part count but never drops below the minimum", () => {
    expect(defragDurationSeconds(4)).toBe(defragMinSeconds);
    expect(defragDurationSeconds(50)).toBeCloseTo(5);
  });
});
