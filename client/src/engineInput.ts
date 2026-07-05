// Keyboard binding for engine control: hold W to fly, double-tap-and-hold to boost.
import type { Room } from "colyseus.js";
import type { MatchState } from "@blasteroids/shared";
import { activation, messageType } from "@blasteroids/shared";
import { createDoubleTapTracker } from "./doubleTapHold";
import { keyBindings } from "./keyBindings";

export function attachEngineInput(room: Room<MatchState>): () => void {
  const registerDown = createDoubleTapTracker();

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.code !== keyBindings.engines || event.repeat) return;
    const isDoubleTap = registerDown(performance.now());
    room.send(
      messageType.setEngineActivation,
      isDoubleTap ? activation.boosted : activation.active,
    );
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.code !== keyBindings.engines) return;
    room.send(messageType.setEngineActivation, activation.inactive);
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
  };
}
