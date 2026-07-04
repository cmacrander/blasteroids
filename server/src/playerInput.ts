// Validates and applies player-input messages to a ship's parts.
import type { Ship } from "@blasteroids/shared";
import { partType, activation } from "@blasteroids/shared";

const activationCodes: number[] = Object.values(activation);

export function applyEngineActivation(ship: Ship, message: unknown): void {
  if (typeof message !== "number" || !activationCodes.includes(message)) return;

  ship.parts.forEach((part) => {
    if (part.partType === partType.engine) part.activation = message;
  });
}

export function parseAimAngle(message: unknown): number | undefined {
  if (typeof message !== "number" || !Number.isFinite(message))
    return undefined;
  return message;
}
