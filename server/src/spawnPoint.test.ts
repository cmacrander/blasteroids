// Verifies spawn placement stays in bounds and clear of obstacles.
import { describe, it, expect } from "vitest";
import {
  MatchState,
  Player,
  Asteroid,
  mapWidth,
  mapHeight,
  createRng,
} from "@blasteroids/shared";
import { buildStarterShip } from "./starterShip";
import { findShipSpawn } from "./spawnPoint";

describe("findShipSpawn", () => {
  it("returns an in-bounds point on an empty map", () => {
    const spawn = findShipSpawn(new MatchState(), createRng(1));
    expect(spawn.x).toBeGreaterThan(0);
    expect(spawn.x).toBeLessThan(mapWidth);
    expect(spawn.y).toBeGreaterThan(0);
    expect(spawn.y).toBeLessThan(mapHeight);
  });

  it("avoids asteroids and other ships", () => {
    const state = new MatchState();
    const asteroid = new Asteroid();
    asteroid.body.x = 100;
    asteroid.body.y = 100;
    state.asteroids.set("a0", asteroid);

    const other = new Player();
    other.ship = buildStarterShip(60, 60);
    state.players.set("other", other);

    for (let seed = 0; seed < 20; seed++) {
      const spawn = findShipSpawn(state, createRng(seed));
      expect(Math.hypot(spawn.x - 100, spawn.y - 100)).toBeGreaterThanOrEqual(
        15,
      );
      expect(Math.hypot(spawn.x - 60, spawn.y - 60)).toBeGreaterThanOrEqual(10);
    }
  });
});
