// Fixed match parameters and enum codes shared by client and server.

export const mapWidth = 1000;
export const mapHeight = 1000;

export const simulationHz = 60;
export const patchHz = 20;

export const partType = { core: 0, power: 1, engine: 2, laser: 3 } as const;
export type PartType = (typeof partType)[keyof typeof partType];

export const facing = { north: 0, east: 1, south: 2, west: 3 } as const;
export type Facing = (typeof facing)[keyof typeof facing];
