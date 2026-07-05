// Counts colliding entities against the hard cap (see "Entity scale and
// colliding-entity cap" in gameDesign.md).
import type { MatchState } from "@blasteroids/shared";
import { collidingEntityCap, asteroidMaxCellCount } from "@blasteroids/shared";

export function countCollidingEntities(state: MatchState): number {
  let count = state.floatingParts.size;
  state.players.forEach((player) => {
    if (player.ship) count += player.ship.parts.size;
  });
  state.asteroids.forEach((asteroid) => {
    asteroid.cells.forEach((hp) => {
      if (hp > 0) count++;
    });
  });
  return count;
}

// A new asteroid may spawn only if the largest one possible still fits under
// the cap -- checking against the worst case keeps the check independent of
// the shape actually rolled.
export function canSpawnAsteroid(
  state: MatchState,
  cap: number = collidingEntityCap,
): boolean {
  return countCollidingEntities(state) + asteroidMaxCellCount <= cap;
}
