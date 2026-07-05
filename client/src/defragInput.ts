// Keyboard binding for defragmentation.
import type { Room } from "colyseus.js";
import type { MatchState } from "@blasteroids/shared";
import { messageType } from "@blasteroids/shared";
import { keyBindings } from "./keyBindings";

export function attachDefragInput(room: Room<MatchState>): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.code !== keyBindings.defragment) return;
    event.preventDefault(); // Tab must not move browser focus
    if (event.repeat) return;
    room.send(messageType.defragment);
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}
