// Rigid-body transform and velocity for any simulated entity.
import { Schema, type } from "@colyseus/schema";

export class Body extends Schema {
  @type("float32") x = 0;
  @type("float32") y = 0;
  @type("float32") angle = 0; // radians
  @type("float32") vx = 0;
  @type("float32") vy = 0;
  @type("float32") angularVelocity = 0;
}
