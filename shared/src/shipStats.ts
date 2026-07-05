// Derived per-ship stats computed from current part composition, shared by
// client (HUD) and server (power budgeting) so the formula lives in one place.
import {
  partType,
  capacitorCapacityPerPowerPart,
  baselineEfficiency,
} from "./constants.js";
import type { Ship } from "./schema/ship.js";

// Diminishing returns: each active core beyond the first adds a shrinking bonus.
export function powerEfficiency(activeCoreCount: number): number {
  return 1 - (1 - baselineEfficiency) ** activeCoreCount;
}

export function activeCoreCount(ship: Ship): number {
  return [...ship.parts.values()].filter(
    (part) => part.partType === partType.core && part.powered,
  ).length;
}

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
