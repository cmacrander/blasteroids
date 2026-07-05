// Derived per-ship stats computed from current part composition, shared by
// client (HUD) and server (power budgeting) so the formula lives in one place.
import { partType, capacitorCapacityPerPowerPart } from "./constants.js";
import type { Ship } from "./schema/ship.js";

export function powerPartCount(ship: Ship): number {
  let count = 0;
  ship.parts.forEach((part) => {
    if (part.hp > 0 && part.partType === partType.power) count++;
  });
  return count;
}

export function capacitorCapacityFor(ship: Ship): number {
  return powerPartCount(ship) * capacitorCapacityPerPowerPart;
}
