// Picks a spawn location for a (re)spawning ship: clear of asteroids and
// other ships, comfortably inside the map.
import type { MatchState } from "@blasteroids/shared";
import { mapWidth, mapHeight } from "@blasteroids/shared";

const edgeMargin = 20;
const asteroidClearance = 15;
const shipClearance = 10;
const attempts = 30;

export function findShipSpawn(
  state: MatchState,
  random: () => number = Math.random,
): { x: number; y: number } {
  for (let i = 0; i < attempts; i++) {
    const x = edgeMargin + random() * (mapWidth - 2 * edgeMargin);
    const y = edgeMargin + random() * (mapHeight - 2 * edgeMargin);
    if (isClear(state, x, y)) return { x, y };
  }
  return { x: mapWidth / 2, y: mapHeight / 2 };
}

function isClear(state: MatchState, x: number, y: number): boolean {
  let clear = true;
  state.asteroids.forEach((asteroid) => {
    if (
      Math.hypot(asteroid.body.x - x, asteroid.body.y - y) < asteroidClearance
    )
      clear = false;
  });
  state.players.forEach((player) => {
    const ship = player.ship;
    if (ship && Math.hypot(ship.body.x - x, ship.body.y - y) < shipClearance)
      clear = false;
  });
  return clear;
}
