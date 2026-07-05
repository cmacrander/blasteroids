// Unit tests for the pure asteroid boundary-cell grid logic.
import { describe, it, expect } from "vitest";
import { Asteroid } from "@blasteroids/shared";
import {
  boundaryCellIndices,
  isBoundaryCell,
  neighborsOf,
  isAsteroidDestroyed,
} from "./asteroidShell";

function makeAsteroid(
  gridWidth: number,
  gridHeight: number,
  hp: number[],
): Asteroid {
  const asteroid = new Asteroid();
  asteroid.gridWidth = gridWidth;
  asteroid.gridHeight = gridHeight;
  for (const value of hp) asteroid.cells.push(value);
  return asteroid;
}

describe("boundaryCellIndices", () => {
  it("marks only the outer ring of a solid square as boundary", () => {
    // 3x3 solid grid: the center cell (index 4) has all 4 neighbors alive.
    const asteroid = makeAsteroid(3, 3, [50, 50, 50, 50, 50, 50, 50, 50, 50]);

    const boundary = boundaryCellIndices(asteroid);

    expect(boundary.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
  });

  it("treats a dead neighbor the same as a missing one", () => {
    // 3x3 grid with the center cell already dead: its 4 orthogonal
    // neighbors (1, 3, 5, 7) should now also count as boundary.
    const asteroid = makeAsteroid(3, 3, [50, 50, 50, 50, 0, 50, 50, 50, 50]);

    expect(isBoundaryCell(asteroid, 1, 0)).toBe(true); // above center
    expect(isBoundaryCell(asteroid, 0, 0)).toBe(true); // corner, already boundary
  });

  it("is false for a dead cell itself", () => {
    const asteroid = makeAsteroid(3, 3, [50, 50, 50, 50, 0, 50, 50, 50, 50]);

    expect(isBoundaryCell(asteroid, 1, 1)).toBe(false);
  });

  it("reports fewer than 4 neighbors for an edge or corner cell", () => {
    const asteroid = makeAsteroid(3, 3, [50, 50, 50, 50, 50, 50, 50, 50, 50]);

    expect(neighborsOf(asteroid, 0, 0)).toHaveLength(2); // corner
    expect(neighborsOf(asteroid, 1, 0)).toHaveLength(3); // edge
    expect(neighborsOf(asteroid, 1, 1)).toHaveLength(4); // center
  });
});

describe("isAsteroidDestroyed", () => {
  it("is false while any cell still has hp", () => {
    const asteroid = makeAsteroid(2, 1, [0, 50]);

    expect(isAsteroidDestroyed(asteroid)).toBe(false);
  });

  it("is true once every cell has been mined out", () => {
    const asteroid = makeAsteroid(2, 1, [0, 0]);

    expect(isAsteroidDestroyed(asteroid)).toBe(true);
  });
});
