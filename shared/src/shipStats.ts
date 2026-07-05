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

// The loss condition (see "Ship composition" in gameDesign.md): a ship must
// keep at least one core and one power part or its player loses.
export function shipIsViable(ship: Ship): boolean {
  const alive = [...ship.parts.values()].filter((part) => part.hp > 0);
  return (
    alive.some((part) => part.partType === partType.core) &&
    alive.some((part) => part.partType === partType.power)
  );
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
