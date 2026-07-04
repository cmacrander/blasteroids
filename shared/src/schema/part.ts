// One square part rigidly attached to a ship.
import { Schema, type } from "@colyseus/schema";

export class Part extends Schema {
  @type("uint8") partType = 0; // PartType code
  @type("int8") offsetX = 0; // local grid offset within the ship
  @type("int8") offsetY = 0;
  @type("uint8") facing = 0; // Facing code (engine exhaust / laser lens direction)
  @type("uint16") hp = 0;
  @type("boolean") powered = false;
}
