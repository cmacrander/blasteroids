// Validates and applies player-input messages to a ship's parts.
import type { Ship, PartType } from "@blasteroids/shared";
import { activation, partType } from "@blasteroids/shared";

const activationCodes: number[] = Object.values(activation);

// Applies a validated activation message to every part of the given type
// (engine or laser -- both are just "inactive/active/boosted" controls).
export function applyActivation(
  ship: Ship,
  targetPartType: PartType,
  message: unknown,
): void {
  if (typeof message !== "number" || !activationCodes.includes(message)) return;

  ship.parts.forEach((part) => {
    if (part.partType === targetPartType) part.activation = message;
  });
}

export function parseAimAngle(message: unknown): number | undefined {
  if (typeof message !== "number" || !Number.isFinite(message))
    return undefined;
  return message;
}

export function parsePartType(message: unknown): PartType | undefined {
  return Object.values(partType).find((code) => code === message);
}
