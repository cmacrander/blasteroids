// Procedural asteroid generation for real spawns: roundish shapes of varying
// size, scattered across the map with a slow random drift (see "Harvesting"
// in gameDesign.md). starterAsteroid.ts's fixed solid square is a separate,
// deterministic fixture kept only for tests.
import { Asteroid } from "@blasteroids/shared";
import {
  asteroidAreaPerSpawn,
  asteroidMinCellCount,
  asteroidMaxCellCount,
  asteroidMinSpeed,
  asteroidMaxSpeed,
  mapWidth,
  mapHeight,
} from "@blasteroids/shared";

const cellHp = 50;

const neighborOffsets: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

interface CellPos {
  col: number;
  row: number;
}

// How many of the closest candidate cells to randomly choose among each
// step. 1 would grow a perfectly smooth disc; higher softens the outline
// into something rougher while staying roughly round.
const candidatePoolSize = 4;

// Grows a connected blob of exactly `cellCount` cells (indices into a
// gridSize x gridSize grid) by repeatedly attaching one of the closest
// unclaimed cells adjacent to the shape so far, biased toward the center.
function growRoundishShape(cellCount: number, gridSize: number): Set<number> {
  const index = (col: number, row: number) => row * gridSize + col;
  const center = (gridSize - 1) / 2;
  const distanceFromCenter = (pos: CellPos) =>
    Math.hypot(pos.col - center, pos.row - center);

  const startCol = Math.round(center);
  const startRow = Math.round(center);
  const alive = new Set<number>([index(startCol, startRow)]);
  const frontier = new Map<number, CellPos>();

  const addFrontierNeighbors = (col: number, row: number) => {
    for (const [dx, dy] of neighborOffsets) {
      const nCol = col + dx;
      const nRow = row + dy;
      if (nCol < 0 || nCol >= gridSize || nRow < 0 || nRow >= gridSize)
        continue;
      const nIndex = index(nCol, nRow);
      if (alive.has(nIndex)) continue;
      frontier.set(nIndex, { col: nCol, row: nRow });
    }
  };
  addFrontierNeighbors(startCol, startRow);

  while (alive.size < cellCount && frontier.size > 0) {
    const candidates = [...frontier.entries()].sort(
      (a, b) => distanceFromCenter(a[1]) - distanceFromCenter(b[1]),
    );
    const poolSize = Math.min(candidatePoolSize, candidates.length);
    const chosen = candidates[Math.floor(Math.random() * poolSize)];
    if (!chosen) break; // unreachable: poolSize is always >= 1 here
    const [chosenIndex, chosenPos] = chosen;

    alive.add(chosenIndex);
    frontier.delete(chosenIndex);
    addFrontierNeighbors(chosenPos.col, chosenPos.row);
  }

  return alive;
}

export function buildRandomAsteroid(
  x: number,
  y: number,
  cellCount: number,
): Asteroid {
  const radius = Math.sqrt(cellCount / Math.PI);
  const gridSize = 2 * Math.ceil(radius) + 3; // enough room to grow and trim
  const shape = growRoundishShape(cellCount, gridSize);

  let minCol = gridSize;
  let maxCol = -1;
  let minRow = gridSize;
  let maxRow = -1;
  for (const cellIndex of shape) {
    const col = cellIndex % gridSize;
    const row = Math.floor(cellIndex / gridSize);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
  }

  const gridWidth = maxCol - minCol + 1;
  const gridHeight = maxRow - minRow + 1;

  const asteroid = new Asteroid();
  asteroid.body.x = x;
  asteroid.body.y = y;
  asteroid.gridWidth = gridWidth;
  asteroid.gridHeight = gridHeight;
  asteroid.originX = -(gridWidth - 1) / 2;
  asteroid.originY = -(gridHeight - 1) / 2;

  for (let i = 0; i < gridWidth * gridHeight; i++) asteroid.cells.push(0);
  for (const cellIndex of shape) {
    const col = (cellIndex % gridSize) - minCol;
    const row = Math.floor(cellIndex / gridSize) - minRow;
    asteroid.cells[row * gridWidth + col] = cellHp;
  }

  return asteroid;
}

export function randomAsteroidCellCount(): number {
  const span = asteroidMaxCellCount - asteroidMinCellCount + 1;
  return asteroidMinCellCount + Math.floor(Math.random() * span);
}

export function randomAsteroidVelocity(): { x: number; y: number } {
  const angle = Math.random() * Math.PI * 2;
  const speed =
    asteroidMinSpeed + Math.random() * (asteroidMaxSpeed - asteroidMinSpeed);
  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
}

// Scatters spawn points across the map at roughly one per
// asteroidAreaPerSpawn, keeping clear of a circle around `avoidX`/`avoidY`
// (the player spawn point) so nobody starts wedged into a rock.
export function pickAsteroidSpawnPoints(
  avoidX: number,
  avoidY: number,
  avoidRadius: number,
): { x: number; y: number }[] {
  const count = Math.round((mapWidth * mapHeight) / asteroidAreaPerSpawn);
  const margin = 10; // keep clear of the boundary walls
  const maxAttempts = 20;

  const randomPoint = () => ({
    x: margin + Math.random() * (mapWidth - 2 * margin),
    y: margin + Math.random() * (mapHeight - 2 * margin),
  });

  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    let point = randomPoint();
    for (
      let attempt = 0;
      attempt < maxAttempts &&
      Math.hypot(point.x - avoidX, point.y - avoidY) < avoidRadius;
      attempt++
    ) {
      point = randomPoint();
    }
    points.push(point);
  }
  return points;
}

// The four map edges an entrant asteroid can spawn just outside of, paired
// with the direction that aims it back into the map.
const entryEdges: readonly { inwardAngle: number }[] = [
  { inwardAngle: -Math.PI / 2 }, // above the top edge, aimed south
  { inwardAngle: Math.PI / 2 }, // below the bottom edge, aimed north
  { inwardAngle: Math.PI }, // right of the map, aimed west
  { inwardAngle: 0 }, // left of the map, aimed east
];

// A field-replenishment spawn: a point just outside one of the four map
// edges, with a velocity aimed generally back into the map (randomly
// jittered up to 45deg off dead-on, so entrants don't all beeline for the
// opposite edge) at the same slow speed range as any other asteroid.
export function randomAsteroidEntry(margin: number): {
  x: number;
  y: number;
  vx: number;
  vy: number;
} {
  const edgeIndex = Math.floor(Math.random() * entryEdges.length);
  const edge = entryEdges[edgeIndex];
  if (!edge) throw new Error("unreachable: edgeIndex is always in range");

  const alongWidth = -margin + Math.random() * (mapWidth + 2 * margin);
  const alongHeight = -margin + Math.random() * (mapHeight + 2 * margin);

  let position: { x: number; y: number };
  if (edgeIndex === 0) position = { x: alongWidth, y: mapHeight + margin };
  else if (edgeIndex === 1) position = { x: alongWidth, y: -margin };
  else if (edgeIndex === 2) position = { x: mapWidth + margin, y: alongHeight };
  else position = { x: -margin, y: alongHeight };

  const jitter = (Math.random() - 0.5) * (Math.PI / 2); // +/- 45deg
  const angle = edge.inwardAngle + jitter;
  const speed =
    asteroidMinSpeed + Math.random() * (asteroidMaxSpeed - asteroidMinSpeed);

  return {
    x: position.x,
    y: position.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  };
}

// True once an asteroid has drifted far enough past the map edge that it's
// never coming back into play and should be despawned.
export function isFarOutOfBounds(
  x: number,
  y: number,
  margin: number,
): boolean {
  return (
    x < -margin ||
    x > mapWidth + margin ||
    y < -margin ||
    y > mapHeight + margin
  );
}
