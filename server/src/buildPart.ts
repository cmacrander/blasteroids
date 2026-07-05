// Applies a validated build request: affordability, placement, deduction.
import type { Player, BuildRejection } from "@blasteroids/shared";
import {
  Part,
  chooseAttachSlot,
  partBuildCost,
  partMaxHp,
} from "@blasteroids/shared";

export type BuildResult =
  | { ok: true; key: string; part: Part }
  | { ok: false; reason: BuildRejection["reason"] };

export function tryBuildPart(
  player: Player,
  requestedType: number,
  key: string,
  random: () => number = Math.random,
): BuildResult {
  const ship = player.ship;
  if (!ship) return { ok: false, reason: "noSlot" };
  if (player.supplies < partBuildCost)
    return { ok: false, reason: "unaffordable" };

  const slot = chooseAttachSlot(
    [...ship.parts.values()],
    requestedType,
    random,
  );
  if (!slot) return { ok: false, reason: "noSlot" };

  player.supplies -= partBuildCost;

  const part = new Part();
  part.partType = requestedType;
  part.offsetX = slot.offsetX;
  part.offsetY = slot.offsetY;
  part.facing = slot.facing;
  part.hp = partMaxHp;
  ship.parts.set(key, part);

  return { ok: true, key, part };
}
