// Verifies overlap detection, attach placement, and leaving unreachable parts.
import { describe, it, expect } from "vitest";
import {
  FloatingPart,
  MatchState,
  partType,
  createRng,
} from "@blasteroids/shared";
import { buildStarterShip } from "./starterShip";
import { tryScavengeParts } from "./scavengePart";

function floatingPartAt(x: number, y: number, type: number): FloatingPart {
  const floating = new FloatingPart();
  floating.partType = type;
  floating.hp = 42;
  floating.body.x = x;
  floating.body.y = y;
  return floating;
}

describe("tryScavengeParts", () => {
  it("attaches an overlapping floating part with its own hp", () => {
    const ship = buildStarterShip(0, 0);
    const state = new MatchState();
    state.floatingParts.set("float-0", floatingPartAt(0, 0, partType.engine));

    const result = tryScavengeParts(ship, state.floatingParts, createRng(1));

    expect(result.claimedIds).toEqual(["float-0"]);
    expect(result.attached).toHaveLength(1);
    const attachedPart = result.attached[0]?.part;
    expect(attachedPart?.partType).toBe(partType.engine);
    expect(attachedPart?.hp).toBe(42);
    expect(ship.parts.get(result.attached[0]?.key ?? "")).toBe(attachedPart);
  });

  it("leaves a distant floating part in the world", () => {
    const ship = buildStarterShip(0, 0);
    const state = new MatchState();
    state.floatingParts.set("float-0", floatingPartAt(50, 50, partType.engine));

    const result = tryScavengeParts(ship, state.floatingParts, createRng(1));

    expect(result.claimedIds).toEqual([]);
    expect(result.attached).toEqual([]);
    expect(state.floatingParts.has("float-0")).toBe(true);
  });

  it("attaches multiple overlapping parts in one pass, updating slots as it goes", () => {
    const ship = buildStarterShip(0, 0);
    const state = new MatchState();
    state.floatingParts.set("float-0", floatingPartAt(0, 0, partType.core));
    state.floatingParts.set("float-1", floatingPartAt(0, 0, partType.power));

    const result = tryScavengeParts(ship, state.floatingParts, createRng(1));

    expect(result.claimedIds.sort()).toEqual(["float-0", "float-1"]);
    expect(result.attached).toHaveLength(2);
  });
});
