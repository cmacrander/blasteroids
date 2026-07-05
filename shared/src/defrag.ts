// Defragmentation: computes tidy, symmetric rearrangements of a ship's parts
// (see the pseudocode under "Scavenging" in gameDesign.md).
import { partType } from "./constants.js";
import { defragMinSeconds, defragSecondsPerPart } from "./constants.js";
import {
  legalAttachSlots,
  occupiedCells,
  adjacencyCount,
  buildFacingFor,
  type GridPart,
  type AttachSlot,
} from "./partPlacement.js";
import type { Ship } from "./schema/ship.js";
import { createRng } from "./rng.js";

type SlotRule = "best" | "bestLowY" | "minY" | "maxY";
type Constraint = (slot: AttachSlot) => boolean;

const anywhere: Constraint = () => true;
const rightHalf: Constraint = (slot) => slot.offsetX > 0;

function pickRandom<T>(items: T[], random: () => number): T | undefined {
  return items[Math.floor(random() * items.length)];
}

// Places one part of the given type into `placed`, mutating it. An empty grid
// is seeded directly (at (1, 0) for right-half phases) per the implementation
// notes in gameDesign.md. If the constraint leaves no legal slot, it falls
// back to any legal slot rather than dropping the part.
function placeOne(
  placed: GridPart[],
  newType: number,
  constraint: Constraint,
  rule: SlotRule,
  random: () => number,
): void {
  if (placed.length === 0) {
    placed.push({
      partType: newType,
      offsetX: constraint === rightHalf ? 1 : 0,
      offsetY: 0,
      facing: buildFacingFor(newType),
    });
    return;
  }

  const legal = legalAttachSlots(placed, newType);
  let candidates = legal.filter(constraint);
  if (candidates.length === 0) candidates = legal;
  if (candidates.length === 0) return;

  let picked: AttachSlot | undefined;
  if (rule === "minY" || rule === "maxY") {
    const extreme = (rule === "minY" ? Math.min : Math.max)(
      ...candidates.map((slot) => slot.offsetY),
    );
    picked = pickRandom(
      candidates.filter((slot) => slot.offsetY === extreme),
      random,
    );
  } else {
    const occupied = occupiedCells(placed);
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
    if (rule === "bestLowY") {
      const minY = Math.min(...best.map((slot) => slot.offsetY));
      best = best.filter((slot) => slot.offsetY === minY);
    }
    picked = pickRandom(best, random);
  }

  if (!picked) return;
  placed.push({
    partType: newType,
    offsetX: picked.offsetX,
    offsetY: picked.offsetY,
    facing: picked.facing,
  });
}

export function countsByType(parts: GridPart[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const part of parts) {
    counts.set(part.partType, (counts.get(part.partType) ?? 0) + 1);
  }
  return counts;
}

// One candidate arrangement for the given part counts. Phases: cores compact,
// power compact biased rearward, engines rearmost, lasers frontmost -- all in
// the right half -- then a mirror, then odd remainders anywhere. The mirror
// maps x to 1 - x (across the boundary between columns 0 and 1, not across a
// center column) so the two halves share edges and stay one connected ship.
export function defragArrangement(
  counts: Map<number, number>,
  random: () => number,
): GridPart[] {
  const half = (type: number) => Math.floor((counts.get(type) ?? 0) / 2);
  const placed: GridPart[] = [];

  const phases: { type: number; rule: SlotRule }[] = [
    { type: partType.core, rule: "best" },
    { type: partType.power, rule: "bestLowY" },
    { type: partType.engine, rule: "minY" },
    { type: partType.laser, rule: "maxY" },
  ];
  for (const phase of phases) {
    for (let i = 0; i < half(phase.type); i++) {
      placeOne(placed, phase.type, rightHalf, phase.rule, random);
    }
  }

  const mirrored = placed.map((part) => ({
    ...part,
    offsetX: 1 - part.offsetX,
  }));
  placed.push(...mirrored);

  for (const phase of phases) {
    if ((counts.get(phase.type) ?? 0) % 2 === 1) {
      placeOne(placed, phase.type, anywhere, "best", random);
    }
  }

  return placed;
}

// Total shared edges: the compactness score used to auto-pick a candidate.
function arrangementScore(parts: GridPart[]): number {
  const occupied = occupiedCells(parts);
  return parts.reduce(
    (sum, part) => sum + adjacencyCount(part.offsetX, part.offsetY, occupied),
    0,
  );
}

// Generates three candidates with different seeds (per gameDesign.md) and
// returns the most compact one; the selection UI is deferred, see the doc.
export function bestDefragArrangement(
  parts: GridPart[],
  random: () => number,
): GridPart[] {
  const counts = countsByType(parts);
  let best: GridPart[] = [];
  let bestScore = -1;
  for (let i = 0; i < 3; i++) {
    const seed = Math.floor(random() * 0xffffffff);
    const candidate = defragArrangement(counts, createRng(seed));
    const score = arrangementScore(candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

// Moves each of the ship's existing parts (with their hp and powered state)
// into a slot of its type in the arrangement.
export function applyArrangement(ship: Ship, arrangement: GridPart[]): void {
  const slotsByType = new Map<number, GridPart[]>();
  for (const slot of arrangement) {
    const list = slotsByType.get(slot.partType) ?? [];
    list.push(slot);
    slotsByType.set(slot.partType, list);
  }

  ship.parts.forEach((part) => {
    const slot = slotsByType.get(part.partType)?.shift();
    if (!slot) return;
    part.offsetX = slot.offsetX;
    part.offsetY = slot.offsetY;
    part.facing = slot.facing;
  });
}

export function defragDurationSeconds(partCount: number): number {
  return Math.max(defragMinSeconds, defragSecondsPerPart * partCount);
}
