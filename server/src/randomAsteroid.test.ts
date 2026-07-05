// Unit tests for procedural asteroid shape/velocity/placement generation.
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  asteroidMinCellCount,
  asteroidMaxCellCount,
  asteroidMinSpeed,
  asteroidMaxSpeed,
  asteroidAreaPerSpawn,
  mapWidth,
  mapHeight,
} from "@blasteroids/shared";
import {
  buildRandomAsteroid,
  randomAsteroidCellCount,
  randomAsteroidVelocity,
  randomAsteroidEntry,
  pickAsteroidSpawnPoints,
  isFarOutOfBounds,
} from "./randomAsteroid";

const neighborOffsets: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

// Flood-fills from the first alive cell and returns how many alive cells it
// reached, so a test can confirm the whole shape is one connected group.
function connectedAliveCount(
  cells: number[],
  gridWidth: number,
  gridHeight: number,
): number {
  const startIndex = cells.findIndex((hp) => hp > 0);
  if (startIndex < 0) return 0;

  const visited = new Set<number>([startIndex]);
  const stack = [startIndex];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    const col = current % gridWidth;
    const row = Math.floor(current / gridWidth);

    for (const [dx, dy] of neighborOffsets) {
      const nCol = col + dx;
      const nRow = row + dy;
      if (nCol < 0 || nCol >= gridWidth || nRow < 0 || nRow >= gridHeight)
        continue;
      const nIndex = nRow * gridWidth + nCol;
      if (visited.has(nIndex)) continue;
      if ((cells[nIndex] ?? 0) <= 0) continue;
      visited.add(nIndex);
      stack.push(nIndex);
    }
  }
  return visited.size;
}

describe("buildRandomAsteroid", () => {
  it.each([4, 10, 17, 24])(
    "produces exactly %i connected, alive cells",
    (cellCount) => {
      const asteroid = buildRandomAsteroid(0, 0, cellCount);
      const cells = asteroid.cells.toArray();
      const aliveCount = cells.filter((hp) => hp > 0).length;

      expect(aliveCount).toBe(cellCount);
      expect(
        connectedAliveCount(cells, asteroid.gridWidth, asteroid.gridHeight),
      ).toBe(cellCount);
    },
  );

  it("stays roughly round rather than a thin spike, across many trials", () => {
    for (let i = 0; i < 20; i++) {
      const cellCount =
        asteroidMinCellCount +
        Math.floor(
          Math.random() * (asteroidMaxCellCount - asteroidMinCellCount),
        );
      const asteroid = buildRandomAsteroid(0, 0, cellCount);

      const aspectRatio = asteroid.gridWidth / asteroid.gridHeight;
      expect(aspectRatio).toBeGreaterThan(0.3);
      expect(aspectRatio).toBeLessThan(3.3);
    }
  });

  it("centers the grid on the body origin", () => {
    const asteroid = buildRandomAsteroid(50, 60, 12);

    expect(asteroid.body.x).toBe(50);
    expect(asteroid.body.y).toBe(60);
    expect(asteroid.originX).toBeCloseTo(-(asteroid.gridWidth - 1) / 2);
    expect(asteroid.originY).toBeCloseTo(-(asteroid.gridHeight - 1) / 2);
  });
});

describe("randomAsteroidCellCount", () => {
  it("always lands within the configured bounds", () => {
    for (let i = 0; i < 100; i++) {
      const count = randomAsteroidCellCount();
      expect(count).toBeGreaterThanOrEqual(asteroidMinCellCount);
      expect(count).toBeLessThanOrEqual(asteroidMaxCellCount);
      expect(Number.isInteger(count)).toBe(true);
    }
  });
});

describe("randomAsteroidVelocity", () => {
  it("always lands within the configured slow speed range", () => {
    for (let i = 0; i < 100; i++) {
      const velocity = randomAsteroidVelocity();
      const speed = Math.hypot(velocity.x, velocity.y);
      expect(speed).toBeGreaterThanOrEqual(asteroidMinSpeed);
      expect(speed).toBeLessThanOrEqual(asteroidMaxSpeed);
    }
  });
});

describe("pickAsteroidSpawnPoints", () => {
  it("scatters roughly one point per asteroidAreaPerSpawn, clear of the avoid point", () => {
    const avoidX = mapWidth / 2;
    const avoidY = mapHeight / 2;
    const avoidRadius = 15;

    const points = pickAsteroidSpawnPoints(avoidX, avoidY, avoidRadius);

    expect(points.length).toBe(
      Math.round((mapWidth * mapHeight) / asteroidAreaPerSpawn),
    );
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(mapWidth);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(mapHeight);
      expect(
        Math.hypot(point.x - avoidX, point.y - avoidY),
      ).toBeGreaterThanOrEqual(avoidRadius);
    }
  });
});

describe("randomAsteroidEntry", () => {
  it("spawns just outside the map with a velocity aimed back in, over many trials", () => {
    const margin = 10;

    for (let i = 0; i < 100; i++) {
      const entry = randomAsteroidEntry(margin);

      expect(isFarOutOfBounds(entry.x, entry.y, 0)).toBe(true);
      expect(isFarOutOfBounds(entry.x, entry.y, margin)).toBe(false);

      const speed = Math.hypot(entry.vx, entry.vy);
      expect(speed).toBeGreaterThanOrEqual(asteroidMinSpeed);
      expect(speed).toBeLessThanOrEqual(asteroidMaxSpeed);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Pins Math.random's sequence to force each edge in turn: edgeIndex,
  // alongWidth, alongHeight, jitter, speed (in that call order) -- verifying
  // the inward direction per edge directly, rather than trying to infer
  // which edge a result came from (ambiguous near corners, where the
  // "along" coordinate can itself land outside the map on the other axis).
  it.each([
    { edgeRandom: 0, label: "north", inwardAxis: "vy", sign: -1 },
    { edgeRandom: 0.3, label: "south", inwardAxis: "vy", sign: 1 },
    { edgeRandom: 0.6, label: "east", inwardAxis: "vx", sign: -1 },
    { edgeRandom: 0.9, label: "west", inwardAxis: "vx", sign: 1 },
  ])(
    "aims strictly inward when spawning on the $label edge",
    ({ edgeRandom, inwardAxis, sign }) => {
      vi.spyOn(Math, "random")
        .mockReturnValueOnce(edgeRandom) // edge selection
        .mockReturnValueOnce(0.5) // alongWidth
        .mockReturnValueOnce(0.5) // alongHeight
        .mockReturnValueOnce(0.5) // jitter (0deg -- dead-on inward)
        .mockReturnValueOnce(0.5); // speed

      const entry = randomAsteroidEntry(10);

      const value = inwardAxis === "vy" ? entry.vy : entry.vx;
      expect(Math.sign(value)).toBe(sign);
    },
  );
});

describe("isFarOutOfBounds", () => {
  it("is false for points inside the map", () => {
    expect(isFarOutOfBounds(mapWidth / 2, mapHeight / 2, 10)).toBe(false);
  });

  it("is false for points outside the map but within the margin", () => {
    expect(isFarOutOfBounds(-5, mapHeight / 2, 10)).toBe(false);
  });

  it("is true for points beyond the margin", () => {
    expect(isFarOutOfBounds(-15, mapHeight / 2, 10)).toBe(true);
    expect(isFarOutOfBounds(mapWidth + 15, mapHeight / 2, 10)).toBe(true);
  });
});
