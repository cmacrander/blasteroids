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

// Names of messages the client sends to the server room.
export const messageType = {
  setEngineActivation: "setEngineActivation",
} as const;
export type MessageType = (typeof messageType)[keyof typeof messageType];

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

// Ship physics: see "Ships" in gameDesign.md. A starter ship has 4 parts (4000 kg)
// and exactly one core, pinning efficiency at baselineEfficiency (0.25), so
// engineThrustRate is sized to net exactly 1 m/s^2 once realized thrust is cut
// to a quarter: (16000 * 0.25) / 4000 = 1. Boosted thrust is deliberately a
// smaller multiplier (1.5x) than boosted power draw (3x): boosting should
// drain the capacitor fast for only a modest speed gain, reserved for
// emergencies rather than a default way to fly.
export const partMass = 1000; // kg per part (1 metric ton)
export const engineThrustRate = 16000; // N, rated thrust while active (pre-efficiency)
export const engineBoostThrustRate = 24000; // N, rated thrust while boosted (pre-efficiency)
export const maxSpeed = 30; // m/s speed cap
