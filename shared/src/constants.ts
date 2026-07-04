// Fixed match parameters and enum codes shared by client and server.

export const mapWidth = 1000;
export const mapHeight = 1000;

export const simulationHz = 60;
export const patchHz = 20;

export const partType = { core: 0, power: 1, engine: 2, laser: 3 } as const;
export type PartType = (typeof partType)[keyof typeof partType];

export const facing = { north: 0, east: 1, south: 2, west: 3 } as const;
export type Facing = (typeof facing)[keyof typeof facing];

// Engine/laser activation; always "inactive" for core and power parts, which
// have no player-requested state (cores are toggled by power budgeting, and
// power parts are always producing).
export const activation = { inactive: 0, active: 1, boosted: 2 } as const;
export type Activation = (typeof activation)[keyof typeof activation];

// Max energy a ship's capacitor can store; see "Power budgeting" in gameDesign.md.
export const capacitorCapacity = 100;

// Power budgeting rates (watts), see "Power budgeting" in gameDesign.md. A starter
// ship has exactly one core, pinning efficiency at baselineEfficiency, so
// powerGenerationRate is sized to comfortably cover one core plus one active
// engine and one active laser at that efficiency (20 * 0.25 = 5W delivered vs
// 2 + 1 + 1 = 4W drawn), leaving surplus to charge the capacitor. Boosting
// pushes draw over what's delivered, draining the capacitor as intended.
export const baselineEfficiency = 0.25;
export const powerGenerationRate = 20; // produced per power part, before efficiency
export const coreConsumptionRate = 2; // per active core
export const engineConsumptionRate = 1; // per active engine
export const engineBoostConsumptionRate = 3; // per boosted engine
export const laserConsumptionRate = 1; // per active laser
export const laserBoostConsumptionRate = 3; // per boosted laser
