// A detached part: own body, non-colliding, scavengeable.
import { Schema, type } from "@colyseus/schema";
import { Body } from "./body.js";

export class FloatingPart extends Schema {
  @type("uint8") partType = 0; // PartType code
  @type("uint8") facing = 0; // Facing code
  @type("uint16") hp = 0;
  @type(Body) body = new Body();
}
