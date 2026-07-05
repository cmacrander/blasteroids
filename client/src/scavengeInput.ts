// Scavenge binding: right-click or the space bar attach overlapping floating parts.
import type { Room } from "colyseus.js";
import type { MatchState } from "@blasteroids/shared";
import { messageType } from "@blasteroids/shared";
import { keyBindings } from "./keyBindings";

const rightButton = 2;

export function attachScavengeInput(room: Room<MatchState>): () => void {
  const handleMouseDown = (event: MouseEvent) => {
    if (event.button !== rightButton) return;
    room.send(messageType.scavenge);
  };
  // The browser's right-click context menu must not appear over the canvas.
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.code !== keyBindings.scavenge) return;
    event.preventDefault(); // space must not scroll the page
    if (event.repeat) return;
    room.send(messageType.scavenge);
  };

  window.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("contextmenu", handleContextMenu);
  window.addEventListener("keydown", handleKeyDown);
  return () => {
    window.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("contextmenu", handleContextMenu);
    window.removeEventListener("keydown", handleKeyDown);
  };
}
