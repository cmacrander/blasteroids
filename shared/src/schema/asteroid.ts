// A passive rock body plus a logical per-cell damage grid.
import { Schema, ArraySchema, type } from "@colyseus/schema";
import { Body } from "./body.js";

export class Asteroid extends Schema {
  @type(Body) body = new Body();
  @type("uint16") gridWidth = 0;
  @type("uint16") gridHeight = 0;
  @type("float32") originX = 0; // local position of cell (0,0) center vs body origin
  @type("float32") originY = 0;
  @type(["uint8"]) cells = new ArraySchema<number>(); // row-major hp; 0 = destroyed
}
