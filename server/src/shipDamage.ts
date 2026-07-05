// Resolves ship parts reaching 0 HP: the detach-or-destroy roll and the
// flood-fill group-cut rule (see "Ship parts" and "Ship composition" in
// gameDesign.md).
import type { Ship, Part } from "@blasteroids/shared";
import {
  partType,
  partDetachChance,
  connectedGroups,
} from "@blasteroids/shared";

// A part removed from a ship this tick; detached ones become FloatingParts
// (the caller owns the world-position math and schema bookkeeping).
export interface RemovedPart {
  key: string;
  part: Part;
  detached: boolean;
}

function roll(part: Part, key: string, random: () => number): RemovedPart {
  return { key, part, detached: random() < partDetachChance };
}

// Removes the given 0-HP parts from the ship, then applies the group-cut
// rule: if the removals disconnected the remaining parts, only the group
// with the most cores survives as the live ship (random tiebreak); every
// part of every other group is itself removed via the detach-or-destroy
// roll. Returns everything removed.
export function resolveDestroyedParts(
  ship: Ship,
  destroyedKeys: string[],
  random: () => number,
): RemovedPart[] {
  const removed: RemovedPart[] = [];

  for (const key of destroyedKeys) {
    const part = ship.parts.get(key);
    if (!part) continue;
    removed.push(roll(part, key, random));
    ship.parts.delete(key);
  }
  if (removed.length === 0) return removed;

  const remaining: { key: string; part: Part }[] = [];
  ship.parts.forEach((part, key) => {
    remaining.push({ key, part });
  });
  const groups = connectedGroups(
    remaining.map((entry) => ({
      partType: entry.part.partType,
      offsetX: entry.part.offsetX,
      offsetY: entry.part.offsetY,
      facing: entry.part.facing,
      key: entry.key,
      part: entry.part,
    })),
  );
  if (groups.length <= 1) return removed;

  const coreCount = (group: { part: Part }[]) =>
    group.filter((entry) => entry.part.partType === partType.core).length;
  const mostCores = Math.max(...groups.map(coreCount));
  const winners = groups.filter((group) => coreCount(group) === mostCores);
  const survivor = winners[Math.floor(random() * winners.length)];

  for (const group of groups) {
    if (group === survivor) continue;
    for (const entry of group) {
      removed.push(roll(entry.part, entry.key, random));
      ship.parts.delete(entry.key);
    }
  }

  return removed;
}

// A lost ship scatters everything it had left: every remaining part takes
// the same detach-or-destroy roll (used for game over and disconnects).
export function scatterAllParts(
  ship: Ship,
  random: () => number,
): RemovedPart[] {
  const removed: RemovedPart[] = [];
  ship.parts.forEach((part, key) => {
    removed.push(roll(part, key, random));
  });
  ship.parts.clear();
  return removed;
}
