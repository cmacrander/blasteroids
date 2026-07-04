// Per-player match fields; ship is absent while dead/awaiting respawn.
import { Schema, type } from "@colyseus/schema";
import { Ship } from "./ship.js";

export class Player extends Schema {
  @type("string") uid = ""; // firebase user id
  @type("uint32") score = 0;
  @type("uint32") supplies = 0;
  @type("uint32") lastProcessedInput = 0;
  @type(Ship) ship?: Ship | undefined; // cleared (assigned undefined) when the ship is lost
}
