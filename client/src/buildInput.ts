// Keyboard bindings for building ship parts: one key per part type.
import type { Room } from "colyseus.js";
import type { MatchState } from "@blasteroids/shared";
import { messageType, partType } from "@blasteroids/shared";
import { keyBindings } from "./keyBindings";

const buildKeys = [
  { code: keyBindings.buildCore, type: partType.core },
  { code: keyBindings.buildPower, type: partType.power },
  { code: keyBindings.buildEngine, type: partType.engine },
  { code: keyBindings.buildLaser, type: partType.laser },
];

export function attachBuildInput(room: Room<MatchState>): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.repeat) return;
    const binding = buildKeys.find((entry) => entry.code === event.code);
    if (!binding) return;
    room.send(messageType.buildPart, binding.type);
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}
