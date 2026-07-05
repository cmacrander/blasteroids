// Mouse binding for scavenging: right-click attaches overlapping floating parts.
import type { Room } from "colyseus.js";
import type { MatchState } from "@blasteroids/shared";
import { messageType } from "@blasteroids/shared";

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

  window.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("contextmenu", handleContextMenu);
  return () => {
    window.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("contextmenu", handleContextMenu);
  };
}
