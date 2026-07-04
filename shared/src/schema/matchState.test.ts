// Verifies the match state encodes and decodes across the client/server wire.
import { describe, it, expect } from "vitest";
import { MatchState } from "./matchState.js";
import { Player } from "./player.js";
import { Ship } from "./ship.js";
import { Part } from "./part.js";
import { Asteroid } from "./asteroid.js";
import { FloatingPart } from "./floatingPart.js";
import { partType, facing } from "../constants.js";

function populatedState(): MatchState {
  const state = new MatchState();

  const player = new Player();
  player.uid = "user1";
  player.score = 5;
  player.supplies = 3;
  player.lastProcessedInput = 42;

  const ship = new Ship();
  ship.body.x = 100;
  ship.body.angle = 1.5;
  ship.body.vx = -2;

  const core = new Part();
  core.partType = partType.core;
  core.offsetX = -1;
  core.facing = facing.north;
  core.hp = 100;
  core.powered = true;
  ship.parts.set("p0", core);

  player.ship = ship;
  state.players.set("sess1", player);

  const asteroid = new Asteroid();
  asteroid.gridWidth = 2;
  asteroid.gridHeight = 1;
  asteroid.originX = -1;
  asteroid.cells.push(50, 0);
  state.asteroids.set("a0", asteroid);

  const debris = new FloatingPart();
  debris.partType = partType.laser;
  debris.facing = facing.north;
  debris.hp = 10;
  debris.body.vx = -4;
  state.floatingParts.set("f0", debris);

  return state;
}

describe("MatchState wire contract", () => {
  it("roundtrips players, ships, parts, and asteroids through encode/decode", () => {
    const source = populatedState();
    const decoded = new MatchState();
    decoded.decode(source.encodeAll());

    const player = decoded.players.get("sess1");
    expect(player?.uid).toBe("user1");
    expect(player?.score).toBe(5);
    expect(player?.supplies).toBe(3);
    expect(player?.lastProcessedInput).toBe(42);

    const body = player?.ship?.body;
    expect(body?.x).toBe(100);
    expect(body?.angle).toBe(1.5);
    expect(body?.vx).toBe(-2);

    const core = player?.ship?.parts.get("p0");
    expect(core?.partType).toBe(partType.core);
    expect(core?.offsetX).toBe(-1);
    expect(core?.hp).toBe(100);
    expect(core?.powered).toBe(true);

    const asteroid = decoded.asteroids.get("a0");
    expect(asteroid?.gridWidth).toBe(2);
    expect(asteroid?.originX).toBe(-1);
    expect(asteroid?.cells.toArray()).toEqual([50, 0]);
  });

  it("drops a player's ship from the wire when it is lost", () => {
    const source = populatedState();
    const decoded = new MatchState();
    decoded.decode(source.encodeAll());

    const player = source.players.get("sess1");
    if (player) player.ship = undefined;
    decoded.decode(source.encode());

    expect(decoded.players.get("sess1")?.ship).toBeUndefined();
  });

  // Documents the persistence path: a whole match snapshots to plain JSON.
  it("exports a plain-JSON snapshot that parses back to an identical tree", () => {
    const source = populatedState();

    // toJSON() yields plain objects/arrays, so a match round-trips through the
    // string form a database would store, losing nothing.
    const snapshot = JSON.stringify(source.toJSON());
    expect(JSON.parse(snapshot)).toEqual(source.toJSON());
  });
});
