// Debug aid: print the tunable game-balance constants actually compiled into
// the running client, so a stale build is obvious from the browser console
// instead of silently producing confusing gameplay.
import {
  baselineEfficiency,
  powerGenerationRate,
  coreConsumptionRate,
  engineConsumptionRate,
  engineBoostConsumptionRate,
  laserConsumptionRate,
  laserBoostConsumptionRate,
  partMass,
  engineThrustRate,
  engineBoostThrustRate,
  maxSpeed,
  maxAngularSpeed,
  engineTurnTorque,
  laserRange,
} from "@blasteroids/shared";

export function logGameConstants(): void {
  console.table({
    baselineEfficiency,
    powerGenerationRate,
    coreConsumptionRate,
    engineConsumptionRate,
    engineBoostConsumptionRate,
    laserConsumptionRate,
    laserBoostConsumptionRate,
    partMass,
    engineThrustRate,
    engineBoostThrustRate,
    maxSpeed,
    maxAngularSpeed,
    engineTurnTorque,
    laserRange,
  });
}
