// Unit tests for the pure grid-march geometry (marchGrid) and the end-to-end tick.
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { MapSchema } from "@colyseus/schema";
import type { Asteroid } from "@blasteroids/shared";
import {
  partType,
  activation,
  suppliesPerCellDestroyed,
  Player,
} from "@blasteroids/shared";
import { buildStarterShip } from "./starterShip";
import { buildAsteroid } from "./starterAsteroid";
import { tickPowerBudget } from "./powerBudget";
import {
  initPhysics,
  createShipBody,
  createAsteroidBody,
  stepPhysics,
} from "./physicsWorld";
import { marchGrid, tickLaserDamage } from "./laserDamage";

describe("marchGrid", () => {
  it("walks straight along +x from a cell center", () => {
    // Starting exactly at cell (0, 0)'s center, heading +x, range 3: should
    // pass through cells 0, 1, 2, 3 in a 5-wide, 1-tall grid.
    const hits = marchGrid(0, 0, 1, 0, 3, 5, 1);

    expect(hits).toEqual([0, 1, 2, 3]);
  });

  it("walks straight along +y from a cell center", () => {
    // Row-major index = row * gridWidth + col, so moving along +y in a
    // 1-wide, 5-tall grid should visit indices 0, 1, 2, 3 (one per row).
    const hits = marchGrid(0, 0, 0, 1, 3, 1, 5);

    expect(hits).toEqual([0, 1, 2, 3]);
  });

  it("walks a diagonal ray through multiple cells", () => {
    const hits = marchGrid(0, 0, Math.SQRT1_2, Math.SQRT1_2, 4, 6, 6);

    expect(hits.length).toBeGreaterThan(1);
    expect(hits[0]).toBe(0); // starts in the origin cell
    // Every visited cell should be a valid, in-bounds index.
    for (const index of hits) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(36);
    }
  });

  it("stops at the grid boundary rather than continuing forever", () => {
    // A 3-wide grid with a huge range should still only return in-bounds cells.
    const hits = marchGrid(0, 0, 1, 0, 100, 3, 1);

    expect(hits).toEqual([0, 1, 2]);
  });

  it("returns nothing when the origin starts outside the grid and the ray points away", () => {
    const hits = marchGrid(-5, 0, -1, 0, 3, 5, 5);

    expect(hits).toEqual([]);
  });

  it("handles a ray starting exactly on a grid edge cell", () => {
    const hits = marchGrid(2, 0, 1, 0, 2, 3, 1);

    // Cell 2 is the last column (0, 1, 2); marching further off the edge
    // shouldn't produce out-of-bounds indices.
    expect(hits).toEqual([2]);
  });
});

describe("tickLaserDamage", () => {
  beforeAll(async () => {
    await initPhysics();
  });

  function findPart(
    ship: ReturnType<typeof buildStarterShip>,
    type: (typeof partType)[keyof typeof partType],
  ) {
    return [...ship.parts.values()].find((part) => part.partType === type);
  }

  it("damages a cell in the beam's path, destroys it, and awards supplies exactly once", () => {
    // The asteroid's 4-wide grid (originX -1.5) puts column 1's center at
    // asteroidX - 0.5; offsetting the ship by -0.5 lines the beam up with
    // that column's center exactly, rather than straight down a cell-boundary
    // seam (x = asteroidX, ambiguous for the grid march).
    const ship = buildStarterShip(19.5, 20);
    const laser = findPart(ship, partType.laser);
    if (laser) laser.activation = activation.active;
    tickPowerBudget(ship, 1); // sets `powered` before tickLaserDamage reads it

    const body = createShipBody("laser-damage-test", ship);
    // The laser sits at the ship's north edge (offsetY +1) facing north, so
    // placing the asteroid a few units further north puts it in the beam.
    const asteroid = buildAsteroid(20, 24);
    createAsteroidBody("laser-damage-test-asteroid", asteroid);
    stepPhysics(); // let Rapier's query structures register the new colliders

    const asteroids = new MapSchema<Asteroid>();
    asteroids.set("laser-damage-test-asteroid", asteroid);

    const player = new Player();
    player.ship = ship;

    const targetIndex = 1 * asteroid.gridWidth + 1; // a cell facing the ship
    const startingHp = asteroid.cells[targetIndex];
    expect(startingHp).toBeGreaterThan(0);

    // The beam pierces the whole column it enters (see "Harvesting" in
    // gameDesign.md: the grid march applies damage cell by cell along the
    // full remaining range), so more than one cell in this column can end up
    // destroyed -- run enough ticks to fully deplete the target cell, then
    // check supplies against however many cells actually died.
    let destroyedAt = -1;
    for (let i = 0; i < 3000; i++) {
      tickLaserDamage(player, ship, body, asteroids, 1 / 60);
      if ((asteroid.cells[targetIndex] ?? 0) <= 0) {
        destroyedAt = i;
        break;
      }
    }

    expect(destroyedAt).toBeGreaterThanOrEqual(0);
    expect(asteroid.cells[targetIndex]).toBe(0);

    const destroyedCellCount = asteroid.cells.filter((hp) => hp <= 0).length;
    expect(player.supplies).toBe(destroyedCellCount * suppliesPerCellDestroyed);

    // Ticking further after all reachable cells are dead shouldn't award more.
    for (let i = 0; i < 10; i++) {
      tickLaserDamage(player, ship, body, asteroids, 1 / 60);
    }
    const finalDestroyedCount = asteroid.cells.filter((hp) => hp <= 0).length;
    expect(player.supplies).toBe(
      finalDestroyedCount * suppliesPerCellDestroyed,
    );
  });

  it("does nothing when the laser is inactive", () => {
    const ship = buildStarterShip(60, 20);
    tickPowerBudget(ship, 1);

    const body = createShipBody("laser-inactive-test", ship);
    const asteroid = buildAsteroid(60, 23);
    createAsteroidBody("laser-inactive-test-asteroid", asteroid);
    stepPhysics();

    const asteroids = new MapSchema<Asteroid>();
    asteroids.set("laser-inactive-test-asteroid", asteroid);
    const player = new Player();
    player.ship = ship;

    const targetIndex = 1 * asteroid.gridWidth + 1;
    const startingHp = asteroid.cells[targetIndex];

    for (let i = 0; i < 60; i++)
      tickLaserDamage(player, ship, body, asteroids, 1 / 60);

    expect(asteroid.cells[targetIndex]).toBe(startingHp);
    expect(player.supplies).toBe(0);
  });

  describe("explosion spawning", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    function setUpFiringShip(x: number, y: number, idSuffix: string) {
      const ship = buildStarterShip(x - 0.5, y - 4);
      const laser = findPart(ship, partType.laser);
      if (laser) laser.activation = activation.active;
      tickPowerBudget(ship, 1);

      const body = createShipBody(`explosion-test-${idSuffix}`, ship);
      const asteroid = buildAsteroid(x, y);
      createAsteroidBody(`explosion-test-asteroid-${idSuffix}`, asteroid);
      stepPhysics();

      const asteroids = new MapSchema<Asteroid>();
      asteroids.set(`explosion-test-asteroid-${idSuffix}`, asteroid);
      const player = new Player();
      player.ship = ship;

      return { ship, body, asteroids, player };
    }

    it("spawns a world-space explosion when the probability roll succeeds", () => {
      vi.spyOn(Math, "random").mockReturnValue(0); // always below explosionChance
      const { ship, body, asteroids, player } = setUpFiringShip(20, 60, "hit");

      // Per-tick damage is a fraction of an HP (see the pendingDamage
      // accumulator), so it takes a few ticks before any whole-number damage
      // -- and therefore an explosion roll -- actually lands.
      const explosions = [];
      for (let i = 0; i < 30; i++) {
        explosions.push(
          ...tickLaserDamage(player, ship, body, asteroids, 1 / 60),
        );
      }

      expect(explosions.length).toBeGreaterThan(0);
      for (const explosion of explosions) {
        expect(Number.isFinite(explosion.x)).toBe(true);
        expect(Number.isFinite(explosion.y)).toBe(true);
      }
    });

    it("spawns nothing when the probability roll fails", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.999); // always above explosionChance
      const { ship, body, asteroids, player } = setUpFiringShip(20, 80, "miss");

      const explosions = tickLaserDamage(player, ship, body, asteroids, 1 / 60);

      expect(explosions).toEqual([]);
    });
  });
});
