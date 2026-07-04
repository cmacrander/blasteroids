// Builds the starter ship every player spawns with: one of each part.
import { Ship, Part, partType, facing } from "@blasteroids/shared";

const starterHp = 100;

// Grid offsets use +y as the ship's forward (north) direction: the laser sits at
// the front with its lens facing out, the engine at the rear with exhaust facing out.
const layout = [
  {
    key: "laser",
    type: partType.laser,
    offsetX: 0,
    offsetY: 1,
    facing: facing.north,
  },
  {
    key: "core",
    type: partType.core,
    offsetX: 0,
    offsetY: 0,
    facing: facing.north,
  },
  {
    key: "power",
    type: partType.power,
    offsetX: 0,
    offsetY: -1,
    facing: facing.north,
  },
  {
    key: "engine",
    type: partType.engine,
    offsetX: 0,
    offsetY: -2,
    facing: facing.south,
  },
] as const;

export function buildStarterShip(x: number, y: number): Ship {
  const ship = new Ship();
  ship.body.x = x;
  ship.body.y = y;

  for (const spec of layout) {
    const part = new Part();
    part.partType = spec.type;
    part.offsetX = spec.offsetX;
    part.offsetY = spec.offsetY;
    part.facing = spec.facing;
    part.hp = starterHp;
    // The starter core boots up powered on; power budgeting can never switch a
    // core on from a fully unpowered ship, since generation requires an active
    // core in the first place (see tickPowerBudget).
    if (spec.type === partType.core) part.powered = true;
    ship.parts.set(spec.key, part);
  }

  return ship;
}
