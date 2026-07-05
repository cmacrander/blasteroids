// Pure grid-geometry helpers for an asteroid's collision shell: a cell needs
// a perimeter collider only if it's alive and has at least one missing
// neighbor (out of grid bounds, or a neighbor that's destroyed).
import type { Asteroid } from "@blasteroids/shared";

export function cellIndexAt(
  asteroid: Asteroid,
  col: number,
  row: number,
): number {
  return row * asteroid.gridWidth + col;
}

interface GridCell {
  col: number;
  row: number;
  index: number;
}

const neighborOffsets: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

function isAlive(asteroid: Asteroid, index: number): boolean {
  const hp = asteroid.cells[index];
  return hp !== undefined && hp > 0;
}

// In-bounds neighbors of (col, row), regardless of whether they're alive.
export function neighborsOf(
  asteroid: Asteroid,
  col: number,
  row: number,
): GridCell[] {
  const result: GridCell[] = [];
  for (const [dx, dy] of neighborOffsets) {
    const nCol = col + dx;
    const nRow = row + dy;
    if (nCol < 0 || nCol >= asteroid.gridWidth) continue;
    if (nRow < 0 || nRow >= asteroid.gridHeight) continue;
    result.push({
      col: nCol,
      row: nRow,
      index: cellIndexAt(asteroid, nCol, nRow),
    });
  }
  return result;
}

export function isBoundaryCell(
  asteroid: Asteroid,
  col: number,
  row: number,
): boolean {
  const index = cellIndexAt(asteroid, col, row);
  if (!isAlive(asteroid, index)) return false;

  const neighbors = neighborsOf(asteroid, col, row);
  if (neighbors.length < neighborOffsets.length) return true; // touches grid edge

  return neighbors.some((n) => !isAlive(asteroid, n.index));
}

export function boundaryCellIndices(asteroid: Asteroid): number[] {
  const result: number[] = [];
  for (let row = 0; row < asteroid.gridHeight; row++) {
    for (let col = 0; col < asteroid.gridWidth; col++) {
      if (isBoundaryCell(asteroid, col, row)) {
        result.push(cellIndexAt(asteroid, col, row));
      }
    }
  }
  return result;
}

// True once every cell has been mined out -- nothing left to hit or collide
// with, so the asteroid is done and should be removed from play.
export function isAsteroidDestroyed(asteroid: Asteroid): boolean {
  return asteroid.cells.every((hp) => hp <= 0);
}
