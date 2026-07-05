// Mouse binding for laser control: click to fire, double-click-and-hold to boost.
import type { Room } from "colyseus.js";
import type { MatchState } from "@blasteroids/shared";
import { activation, messageType } from "@blasteroids/shared";
import { createDoubleTapTracker } from "./doubleTapHold";

const leftButton = 0;

export function attachLaserInput(room: Room<MatchState>): () => void {
  const registerDown = createDoubleTapTracker();

  const handleMouseDown = (event: MouseEvent) => {
    if (event.button !== leftButton) return;
    const isDoubleTap = registerDown(performance.now());
    room.send(
      messageType.setLaserActivation,
      isDoubleTap ? activation.boosted : activation.active,
    );
  };

  const handleMouseUp = (event: MouseEvent) => {
    if (event.button !== leftButton) return;
    room.send(messageType.setLaserActivation, activation.inactive);
  };

  window.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("mouseup", handleMouseUp);

  return () => {
    window.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("mouseup", handleMouseUp);
  };
}
