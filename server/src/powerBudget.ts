// Per-tick power budgeting for one ship: cores, then capacitor charge/drain for engines/lasers.
import type { Ship, Part } from "@blasteroids/shared";
import {
  partType,
  activation,
  baselineEfficiency,
  powerGenerationRate,
  coreConsumptionRate,
  engineConsumptionRate,
  engineBoostConsumptionRate,
  laserConsumptionRate,
  laserBoostConsumptionRate,
  capacitorCapacity,
} from "@blasteroids/shared";

// Diminishing returns: each active core beyond the first adds a shrinking bonus.
export function powerEfficiency(activeCoreCount: number): number {
  return 1 - (1 - baselineEfficiency) ** activeCoreCount;
}

function drawRateFor(part: Part): number {
  if (part.partType === partType.engine) {
    if (part.activation === activation.boosted)
      return engineBoostConsumptionRate;
    if (part.activation === activation.active) return engineConsumptionRate;
  }
  if (part.partType === partType.laser) {
    if (part.activation === activation.boosted)
      return laserBoostConsumptionRate;
    if (part.activation === activation.active) return laserConsumptionRate;
  }
  return 0;
}

export function tickPowerBudget(ship: Ship, dt: number): void {
  const cores: Part[] = [];
  const powerParts: Part[] = [];
  const drawParts: Part[] = [];

  ship.parts.forEach((part) => {
    if (part.hp <= 0) return;
    if (part.partType === partType.core) cores.push(part);
    else if (part.partType === partType.power) powerParts.push(part);
    else drawParts.push(part);
  });

  // Power parts are always producing while attached; visually they're never "dim".
  powerParts.forEach((part) => {
    part.powered = true;
  });
  const rawGeneration = powerParts.length * powerGenerationRate;

  let activeCoreCount = cores.filter((core) => core.powered).length;
  const effectiveGeneration = () =>
    rawGeneration * powerEfficiency(activeCoreCount);
  const coreConsumption = () => activeCoreCount * coreConsumptionRate;

  // Cores are checked only against instantaneous generation, never the capacitor:
  // shut off the most-recently-attached active core, one at a time, re-checking
  // (efficiency drops as cores come off) until consumption fits within generation.
  while (activeCoreCount > 0 && coreConsumption() > effectiveGeneration()) {
    const coreToShutOff = [...cores].reverse().find((core) => core.powered);
    if (!coreToShutOff) break;
    coreToShutOff.powered = false;
    activeCoreCount--;
  }

  // Restore the earliest-attached inactive core, at most one per tick, once
  // there's enough spare generation to cover it.
  if (effectiveGeneration() - coreConsumption() > coreConsumptionRate) {
    const coreToRestore = cores.find((core) => !core.powered);
    if (coreToRestore) coreToRestore.powered = true;
  }

  const surplusAfterCores = effectiveGeneration() - coreConsumption();
  const demand = drawParts.reduce((sum, part) => sum + drawRateFor(part), 0);
  const net = surplusAfterCores - demand;

  if (net >= 0) {
    drawParts.forEach((part) => {
      part.powered = part.activation !== activation.inactive;
    });
    ship.storedEnergy = Math.min(
      capacitorCapacity,
      ship.storedEnergy + net * dt,
    );
    return;
  }

  const deficit = -net * dt;
  if (ship.storedEnergy >= deficit) {
    ship.storedEnergy -= deficit;
    drawParts.forEach((part) => {
      part.powered = part.activation !== activation.inactive;
    });
  } else {
    ship.storedEnergy = 0;
    drawParts.forEach((part) => {
      part.powered = false;
    });
  }
}
