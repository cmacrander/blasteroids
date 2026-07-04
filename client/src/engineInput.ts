// Keyboard binding for engine control: hold W to fly, double-tap-and-hold to boost.
import type { Room } from "colyseus.js";
import type { MatchState } from "@blasteroids/shared";
import { activation, messageType } from "@blasteroids/shared";

const doubleTapWindowMs = 300;

export function attachEngineInput(room: Room<MatchState>): () => void {
  let lastKeyDownTime = -Infinity;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.code !== "KeyW" || event.repeat) return;
    const now = performance.now();
    const isDoubleTap = now - lastKeyDownTime <= doubleTapWindowMs;
    lastKeyDownTime = now;
    room.send(
      messageType.setEngineActivation,
      isDoubleTap ? activation.boosted : activation.active,
    );
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.code !== "KeyW") return;
    room.send(messageType.setEngineActivation, activation.inactive);
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
  };
}
