// Attaches floating parts overlapping the player's ship (see "Scavenging" in gameDesign.md).
import type { Ship, FloatingPart } from "@blasteroids/shared";
import { Part, chooseAttachSlot, scavengeRange } from "@blasteroids/shared";

function shipPartWorldPositions(ship: Ship): { x: number; y: number }[] {
  const cos = Math.cos(ship.body.angle);
  const sin = Math.sin(ship.body.angle);
  const positions: { x: number; y: number }[] = [];
  ship.parts.forEach((part) => {
    positions.push({
      x: ship.body.x + part.offsetX * cos - part.offsetY * sin,
      y: ship.body.y + part.offsetX * sin + part.offsetY * cos,
    });
  });
  return positions;
}

function overlapsShip(
  floating: FloatingPart,
  shipPartPositions: { x: number; y: number }[],
): boolean {
  return shipPartPositions.some(
    (pos) =>
      Math.hypot(floating.body.x - pos.x, floating.body.y - pos.y) <=
      scavengeRange,
  );
}

export interface ScavengedPart {
  key: string;
  part: Part;
}

export interface ScavengeResult {
  attached: ScavengedPart[];
  claimedIds: string[];
}

// Attempts to attach every floating part overlapping the ship, one at a time
// so each attach sees the slots the previous one just filled, using the same
// attach rule as building (engines rearmost, lasers frontmost). A part with
// no legal slot is left floating for a later attempt.
export function tryScavengeParts(
  ship: Ship,
  floatingParts: Map<string, FloatingPart>,
  random: () => number = Math.random,
): ScavengeResult {
  const shipPartPositions = shipPartWorldPositions(ship);
  const attached: ScavengedPart[] = [];
  const claimedIds: string[] = [];

  floatingParts.forEach((floating, id) => {
    if (!overlapsShip(floating, shipPartPositions)) return;

    const slot = chooseAttachSlot(
      [...ship.parts.values()],
      floating.partType,
      random,
    );
    if (!slot) return;

    const part = new Part();
    part.partType = floating.partType;
    part.offsetX = slot.offsetX;
    part.offsetY = slot.offsetY;
    part.facing = slot.facing;
    part.hp = floating.hp;

    const key = `scavenged-${id}`;
    ship.parts.set(key, part);
    attached.push({ key, part });
    claimedIds.push(id);
  });

  return { attached, claimedIds };
}
