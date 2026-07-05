// Fixed match parameters and enum codes shared by client and server.

export const mapWidth = 200;
export const mapHeight = 200;

export const simulationHz = 60;
export const patchHz = 20;

export const partType = { core: 0, power: 1, engine: 2, laser: 3 } as const;
export type PartType = (typeof partType)[keyof typeof partType];

// Display names keyed by part-type code, for HUD text and warnings.
export const partTypeNames: Record<number, string> = {
  [partType.core]: "core",
  [partType.power]: "power",
  [partType.engine]: "engine",
  [partType.laser]: "laser",
};

export const facing = { north: 0, east: 1, south: 2, west: 3 } as const;
export type Facing = (typeof facing)[keyof typeof facing];

// Engine/laser activation; always "inactive" for core and power parts, which
// have no player-requested state (cores are toggled by power budgeting, and
// power parts are always producing).
export const activation = { inactive: 0, active: 1, boosted: 2 } as const;
export type Activation = (typeof activation)[keyof typeof activation];

// Names of messages sent between client and server room. Most are player
// input (client -> server); spawnExplosion is server -> client, a one-off
// visual event rather than synced state (see explosionChance below).
export const messageType = {
  playerInput: "playerInput",
  setLaserActivation: "setLaserActivation",
  spawnExplosion: "spawnExplosion",
  buildPart: "buildPart",
  buildRejected: "buildRejected",
  defragment: "defragment",
} as const;
export type MessageType = (typeof messageType)[keyof typeof messageType];

// Client -> server, one per client prediction tick: sequence-numbered engine
// activation and aim angle (see "Client-side prediction and reconciliation"
// in gameDesign.md). The server acks via Player.lastProcessedInput.
export interface PlayerInputMessage {
  seq: number;
  engine: number;
  aim: number;
}

// Server -> client payload explaining a rejected buildPart request.
export interface BuildRejection {
  partType: number;
  reason: "unaffordable" | "noSlot";
}

// Max energy a ship's capacitor can store scales with how much power
// infrastructure it has, not a flat amount: see capacitorCapacityFor in
// shipStats.ts. A small ship (few power parts) has a small buffer, so
// boosting drains it fast; a bigger ship has more capacity to draw on.
export const capacitorCapacityPerPowerPart = 30;

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
export const engineBoostConsumptionRate = 5; // per boosted engine
export const laserConsumptionRate = 1; // per active laser
export const laserBoostConsumptionRate = 5; // per boosted laser

// Ship physics: see "Ships" in gameDesign.md. A starter ship has 4 parts (4000 kg)
// and exactly one core, pinning efficiency at baselineEfficiency (0.25), so
// engineThrustRate is sized to net 3 m/s^2 once realized thrust is cut to a
// quarter: (48000 * 0.25) / 4000 = 3 -- enough to reach maxSpeed in 10s from
// rest. Boosted thrust is deliberately a smaller multiplier (1.5x) than
// boosted power draw (3x): boosting should drain the capacitor fast for only
// a modest speed gain, reserved for emergencies rather than a default way to
// fly.
export const partMass = 1000; // kg per part (1 metric ton)
export const engineThrustRate = 48000; // N, rated thrust while active (pre-efficiency)
export const engineBoostThrustRate = 72000; // N, rated thrust while boosted (pre-efficiency)
export const maxSpeed = 30; // m/s speed cap
export const maxAngularSpeed = Math.PI; // rad/s, half a turn per second

// Rotation is free (no power cost, independent of engine activation): every
// attached engine acts as a maneuvering thruster contributing torque = this
// value * its lever arm from the ship's center of mass. Sized so the starter
// ship (1 engine, 1.5m lever arm, ~5667 kg*m^2 moment of inertia) reaches
// maxAngularSpeed in about a second: 12000 * 1.5 / 5667 ~= 3.18 rad/s^2.
export const engineTurnTorque = 12000;

// Fixed beam length (world units, straight from the lens), matching the
// laserActive/laserBoosted sprite's drawn length exactly -- unlike thrust and
// damage, range does not scale with power efficiency.
export const laserRange = 15;

// Harvesting: see "Harvesting" in gameDesign.md. Both rates are pre-efficiency,
// scaled by the same powerEfficiency(activeCoreCount) curve as thrust -- a
// starter ship's single core cuts these to a quarter.
export const laserDamageRate = 20; // HP/s per active laser
export const laserBoostDamageRate = 60; // HP/s per boosted laser (3x active)
export const suppliesPerCellDestroyed = 2;

// Chance, per damage application (not per tick of firing -- a single tick can
// damage several cells at once), that it spawns a visible explosion. Damage
// itself already happens every tick a beam connects; spawning a sprite that
// often would be constant visual noise, so this thins it out to an
// occasional flash while still reading as "something is taking damage".
export const explosionChance = 0.15;

// Field population: roughly one asteroid per this many square units of map
// area (200x200 map / 2500 = 16 asteroids), scattered at spawn with a random
// roundish shape between the cell-count bounds below and a slow drift.
export const asteroidAreaPerSpawn = 2500;
export const asteroidMinCellCount = 4;
export const asteroidMaxCellCount = 24;
export const asteroidMinSpeed = 0.5; // world units/s
export const asteroidMaxSpeed = 2; // world units/s -- always slow vs ships (maxSpeed 30)

// Asteroids drift forever and never bounce off the boundary walls (that's
// the same kinematic-body property that gives ships no momentum transfer on
// impact -- see physicsWorld.ts), so the field would otherwise slowly leak
// out of bounds, and a fully-mined asteroid would otherwise sit in state
// forever as an empty shell. Every despawn (drifted too far out, or fully
// destroyed) immediately spawns one replacement just outside the map aimed
// inward, so the in-map count stays exactly constant rather than just
// trending toward some average.
export const asteroidEntryMargin = 10; // spawn this far outside the map edge
export const asteroidDespawnMargin = 40; // remove once drifted this far out

// Every part type costs the same to build (see "Building" in gameDesign.md);
// the supply meter shows gradations at multiples of this.
export const partBuildCost = 20;

// HP a part has when freshly built or spawned.
export const partMaxHp = 100;

// Defragmentation downtime: the ship drifts with engines and lasers off (and
// stays vulnerable) for a duration that scales with ship size.
export const defragSecondsPerPart = 0.1;
export const defragMinSeconds = 2;

// Flat and permanent: unlike capacitorCapacityFor, this does not scale with
// ship size. 10x the cost of a single part.
export const suppliesCap = partBuildCost * 10;
