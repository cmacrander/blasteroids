// Verifies entity counting and the cap gate for asteroid spawning.
import { describe, it, expect } from "vitest";
import {
  MatchState,
  Player,
  Asteroid,
  FloatingPart,
  asteroidMaxCellCount,
} from "@blasteroids/shared";
import { buildStarterShip } from "./starterShip";
import { countCollidingEntities, canSpawnAsteroid } from "./entityCount";

function populatedState(): MatchState {
  const state = new MatchState();

  const player = new Player();
  player.ship = buildStarterShip(0, 0); // 4 parts
  state.players.set("sess1", player);

  const shipless = new Player();
  state.players.set("sess2", shipless);

  const asteroid = new Asteroid();
  asteroid.gridWidth = 2;
  asteroid.gridHeight = 2;
  asteroid.cells.push(50, 0, 3, 0); // 2 live cells
  state.asteroids.set("a0", asteroid);

  state.floatingParts.set("f0", new FloatingPart());
  state.floatingParts.set("f1", new FloatingPart());

  return state;
}

describe("countCollidingEntities", () => {
  it("sums ship parts, live rock cells, and floating parts", () => {
    expect(countCollidingEntities(populatedState())).toBe(4 + 2 + 2);
  });
});

describe("canSpawnAsteroid", () => {
  it("allows a spawn while the largest possible asteroid fits", () => {
    const state = populatedState(); // 8 entities
    expect(canSpawnAsteroid(state, 8 + asteroidMaxCellCount)).toBe(true);
    expect(canSpawnAsteroid(state, 8 + asteroidMaxCellCount - 1)).toBe(false);
  });
});
