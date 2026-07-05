// Unit tests for the map boundary walls and asteroid shell created by initPhysics().
import { describe, it, expect, beforeAll } from "vitest";
import { mapWidth } from "@blasteroids/shared";
import { buildStarterShip } from "./starterShip";
import { buildAsteroid } from "./starterAsteroid";
import {
  initPhysics,
  createShipBody,
  createAsteroidBody,
  onAsteroidCellDestroyed,
  raycastLaser,
  stepPhysics,
} from "./physicsWorld";

beforeAll(async () => {
  await initPhysics();
});

describe("boundary walls", () => {
  it("stops a ship at the map edge instead of bouncing or tunneling through", () => {
    const ship = buildStarterShip(mapWidth - 2, 100);
    const body = createShipBody("wall-test", ship);
    body.setLinvel({ x: 50, y: 0 }, true); // heading straight at the east wall

    for (let i = 0; i < 120; i++) stepPhysics();

    const pos = body.translation();
    expect(pos.x).toBeLessThan(mapWidth + 1); // didn't tunnel through

    const v = body.linvel();
    expect(Math.abs(v.x)).toBeLessThan(1); // stopped, not still moving or bounced back
  });
});

describe("asteroid collision shell", () => {
  it("is hit by a raycast aimed at it", () => {
    const asteroid = buildAsteroid(50, 50);
    createAsteroidBody("shell-test-1", asteroid);
    stepPhysics(); // Rapier's query structures need one step to register new colliders

    const hit = raycastLaser({ x: 40, y: 50 }, { x: 1, y: 0 }, 20, "nobody");

    if (hit?.kind !== "asteroid") throw new Error("expected an asteroid hit");
    expect(hit.asteroidId).toBe("shell-test-1");
  });

  it("removes a destroyed cell's collider and promotes a newly-exposed neighbor", () => {
    const asteroid = buildAsteroid(70, 50);
    createAsteroidBody("shell-test-2", asteroid);
    stepPhysics();

    // The asteroid is a 4x4 grid centered on its body; the west-edge column
    // (col 0) is the closest boundary to a ray coming from the west.
    const westEdgeIndex = 1 * asteroid.gridWidth + 0; // row 1, col 0
    asteroid.cells[westEdgeIndex] = 0;
    onAsteroidCellDestroyed("shell-test-2", asteroid, westEdgeIndex);
    stepPhysics(); // register the collider removal/addition for the next raycast

    // A ray that would have hit the now-destroyed west-edge cell should
    // instead pass through to hit its interior neighbor (col 1), which
    // should have been promoted into the shell.
    const hit = raycastLaser(
      { x: 60, y: 50 + asteroid.originY + 1 },
      { x: 1, y: 0 },
      20,
      "nobody",
    );

    if (hit?.kind !== "asteroid") throw new Error("expected an asteroid hit");
    expect(hit.asteroidId).toBe("shell-test-2");
    expect(hit.cellIndex).toBe(1 * asteroid.gridWidth + 1); // col 1, promoted
  });
});
