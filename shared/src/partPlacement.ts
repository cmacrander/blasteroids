// Grid rules for where a part may attach to a ship, shared by building,
// scavenging, and defragmentation (see "Building" in gameDesign.md).
import { partType, facing } from "./constants.js";

// The minimal view of a placed part that placement rules need; satisfied by
// both the Part schema class and plain object literals.
export interface GridPart {
  partType: number;
  offsetX: number;
  offsetY: number;
  facing: number;
}

export interface AttachSlot {
  offsetX: number;
  offsetY: number;
  facing: number;
}

export function cellKey(x: number, y: number): string {
  return `${String(x)},${String(y)}`;
}

function facingOffsetOf(facingCode: number): { dx: number; dy: number } {
  if (facingCode === facing.east) return { dx: 1, dy: 0 };
  if (facingCode === facing.south) return { dx: 0, dy: -1 };
  if (facingCode === facing.west) return { dx: -1, dy: 0 };
  return { dx: 0, dy: 1 }; // north
}

const neighborOffsets = [
  { dx: 0, dy: 1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: -1 },
  { dx: -1, dy: 0 },
];

// Built engines always face back (exhaust south in ship frame), lasers always
// face forward (lens north); cores and power have no meaningful facing.
export function buildFacingFor(newType: number): number {
  return newType === partType.engine ? facing.south : facing.north;
}

export function occupiedCells(parts: GridPart[]): Set<string> {
  return new Set(parts.map((part) => cellKey(part.offsetX, part.offsetY)));
}

// Cells an engine exhaust or laser lens points into: those edges cannot
// connect to other parts (see "Ship parts" in gameDesign.md), so nothing may
// ever be placed in front of them.
export function forbiddenCells(parts: GridPart[]): Set<string> {
  const forbidden = new Set<string>();
  for (const part of parts) {
    if (part.partType !== partType.engine && part.partType !== partType.laser)
      continue;
    const offset = facingOffsetOf(part.facing);
    forbidden.add(cellKey(part.offsetX + offset.dx, part.offsetY + offset.dy));
  }
  return forbidden;
}

export function openSlots(parts: GridPart[]): { x: number; y: number }[] {
  const occupied = occupiedCells(parts);
  const seen = new Set<string>();
  const slots: { x: number; y: number }[] = [];
  for (const part of parts) {
    for (const offset of neighborOffsets) {
      const x = part.offsetX + offset.dx;
      const y = part.offsetY + offset.dy;
      const key = cellKey(x, y);
      if (occupied.has(key) || seen.has(key)) continue;
      seen.add(key);
      slots.push({ x, y });
    }
  }
  return slots;
}

export function adjacencyCount(
  x: number,
  y: number,
  occupied: Set<string>,
): number {
  return neighborOffsets.filter((offset) =>
    occupied.has(cellKey(x + offset.dx, y + offset.dy)),
  ).length;
}

// Every open slot where the new part could legally sit: not in front of any
// exhaust/lens, and (for engines/lasers) with its own forbidden edge open.
export function legalAttachSlots(
  parts: GridPart[],
  newType: number,
): AttachSlot[] {
  const occupied = occupiedCells(parts);
  const forbidden = forbiddenCells(parts);
  const newFacing = buildFacingFor(newType);
  const ownEdge = facingOffsetOf(newFacing);
  const needsOpenEdge =
    newType === partType.engine || newType === partType.laser;

  return openSlots(parts)
    .filter((slot) => {
      if (forbidden.has(cellKey(slot.x, slot.y))) return false;
      if (
        needsOpenEdge &&
        occupied.has(cellKey(slot.x + ownEdge.dx, slot.y + ownEdge.dy))
      )
        return false;
      return true;
    })
    .map((slot) => ({ offsetX: slot.x, offsetY: slot.y, facing: newFacing }));
}

function pickRandom<T>(items: T[], random: () => number): T | undefined {
  return items[Math.floor(random() * items.length)];
}

// Where a new part attaches, as if it were the last part placed by the
// defragmentation algorithm (see "Building" in gameDesign.md): engines take
// the rearmost legal slot, lasers the frontmost, cores the most-adjacent
// slot, and power parts the most-adjacent slot biased toward the rear.
// Returns null when no legal slot exists (the caller should tell the player
// to defragment or build a different part type).
export function chooseAttachSlot(
  parts: GridPart[],
  newType: number,
  random: () => number,
): AttachSlot | null {
  const candidates = legalAttachSlots(parts, newType);
  if (candidates.length === 0) return null;

  if (newType === partType.engine || newType === partType.laser) {
    const pick = newType === partType.engine ? Math.min : Math.max;
    const extremeY = pick(...candidates.map((slot) => slot.offsetY));
    const ties = candidates.filter((slot) => slot.offsetY === extremeY);
    return pickRandom(ties, random) ?? null;
  }

  const occupied = occupiedCells(parts);
  let best: AttachSlot[] = [];
  let bestCount = -1;
  for (const slot of candidates) {
    const count = adjacencyCount(slot.offsetX, slot.offsetY, occupied);
    if (count > bestCount) {
      bestCount = count;
      best = [slot];
    } else if (count === bestCount) {
      best.push(slot);
    }
  }

  if (newType === partType.power) {
    const minY = Math.min(...best.map((slot) => slot.offsetY));
    best = best.filter((slot) => slot.offsetY === minY);
  }

  return pickRandom(best, random) ?? null;
}
