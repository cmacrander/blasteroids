// Keyboard binding for engine control: hold W to fly, double-tap-and-hold to
// boost. Writes into the client sim's controls; the sim sends the input
// packets (see clientSim.ts).
import { activation } from "@blasteroids/shared";
import { createDoubleTapTracker } from "./doubleTapHold";
import { keyBindings } from "./keyBindings";
import type { LocalControls } from "./clientSim";

export function attachEngineInput(controls: LocalControls): () => void {
  const registerDown = createDoubleTapTracker();

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.code !== keyBindings.engines || event.repeat) return;
    const isDoubleTap = registerDown(performance.now());
    controls.engineActivation = isDoubleTap
      ? activation.boosted
      : activation.active;
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.code !== keyBindings.engines) return;
    controls.engineActivation = activation.inactive;
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
  };
}
