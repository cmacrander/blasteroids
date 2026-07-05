// Verifies build requests: cost, placement, and the two rejection reasons.
import { describe, it, expect } from "vitest";
import {
  Player,
  Ship,
  partType,
  partBuildCost,
  partMaxHp,
  createRng,
} from "@blasteroids/shared";
import { buildStarterShip } from "./starterShip";
import { tryBuildPart } from "./buildPart";

function richPlayer(): Player {
  const player = new Player();
  player.ship = buildStarterShip(0, 0);
  player.supplies = partBuildCost * 2;
  return player;
}

describe("tryBuildPart", () => {
  it("attaches a paid-for part with full hp", () => {
    const player = richPlayer();
    const result = tryBuildPart(player, partType.core, "built-0", createRng(1));

    expect(result.ok).toBe(true);
    expect(player.supplies).toBe(partBuildCost);
    const part = player.ship?.parts.get("built-0");
    expect(part?.partType).toBe(partType.core);
    expect(part?.hp).toBe(partMaxHp);
  });

  it("rejects when supplies cannot cover the cost", () => {
    const player = richPlayer();
    player.supplies = partBuildCost - 1;
    const result = tryBuildPart(player, partType.core, "built-0", createRng(1));

    expect(result).toEqual({ ok: false, reason: "unaffordable" });
    expect(player.ship?.parts.has("built-0")).toBe(false);
  });

  it("rejects with noSlot when nothing can attach, charging nothing", () => {
    const player = richPlayer();
    // A partless ship has no open slots at all -- the degenerate stand-in for
    // a layout whose every open slot is forbidden.
    player.ship = new Ship();
    const result = tryBuildPart(player, partType.core, "built-0", createRng(1));

    expect(result).toEqual({ ok: false, reason: "noSlot" });
    expect(player.supplies).toBe(partBuildCost * 2);
  });

  it("rejects when the player has no ship", () => {
    const player = new Player();
    player.supplies = partBuildCost;
    const result = tryBuildPart(player, partType.core, "built-0", createRng(1));
    expect(result).toEqual({ ok: false, reason: "noSlot" });
  });
});
