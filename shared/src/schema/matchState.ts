// Root synced state for one match room.
import { Schema, MapSchema, type } from "@colyseus/schema";
import { Player } from "./player.js";
import { Asteroid } from "./asteroid.js";
import { FloatingPart } from "./floatingPart.js";

export class MatchState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>(); // keyed by sessionId
  @type({ map: Asteroid }) asteroids = new MapSchema<Asteroid>();
  @type({ map: FloatingPart }) floatingParts = new MapSchema<FloatingPart>();
}
