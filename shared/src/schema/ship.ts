// A player's single live rigid body, composed of parts keyed by stable id.
import { Schema, MapSchema, type } from "@colyseus/schema";
import { Body } from "./body.js";
import { Part } from "./part.js";

export class Ship extends Schema {
  @type(Body) body = new Body();
  @type({ map: Part }) parts = new MapSchema<Part>();
}
