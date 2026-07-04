// One square part rigidly attached to a ship.
import { Schema, type } from "@colyseus/schema";

export class Part extends Schema {
  @type("uint8") partType = 0; // PartType code
  @type("int8") offsetX = 0; // local grid offset within the ship
  @type("int8") offsetY = 0;
  @type("uint8") facing = 0; // Facing code (engine exhaust / laser lens direction)
  @type("uint16") hp = 0;
  @type("uint8") activation = 0; // Activation code; player-requested, meaningful for engine/laser only
  // Whether the part is actually functioning this tick: for a core, whether power
  // budgeting has it switched on; for an engine/laser, whether its requested
  // activation is currently backed by generation or capacitor charge.
  @type("boolean") powered = false;
}
