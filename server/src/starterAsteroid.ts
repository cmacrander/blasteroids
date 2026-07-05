// Builds a simple solid-square asteroid: an NxN grid of rock cells. Fixed and
// deterministic on purpose -- tests rely on this exact shape/size; real
// gameplay spawns use randomAsteroid.ts's roundish, variously-sized ones.
import { Asteroid } from "@blasteroids/shared";

const gridSize = 4;
const cellHp = 50;

export function buildAsteroid(x: number, y: number): Asteroid {
  const asteroid = new Asteroid();
  asteroid.body.x = x;
  asteroid.body.y = y;
  asteroid.gridWidth = gridSize;
  asteroid.gridHeight = gridSize;
  // Centers the grid on the body origin: cell (col, row) sits at
  // (originX + col, originY + row), so the whole square is symmetric.
  asteroid.originX = -(gridSize - 1) / 2;
  asteroid.originY = -(gridSize - 1) / 2;

  for (let i = 0; i < gridSize * gridSize; i++) {
    asteroid.cells.push(cellHp);
  }

  return asteroid;
}
