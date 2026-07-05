// Game view: canvas with a HUD overlay.
import { useEffect, useMemo } from "react";
import type { Room } from "colyseus.js";
import type { MatchState } from "@blasteroids/shared";
import { GameCanvas } from "./GameCanvas";
import { createClientSim } from "./clientSim";
import { attachEngineInput } from "./engineInput";
import { attachLaserInput } from "./laserInput";
import { attachAimInput } from "./aimInput";
import { attachBuildInput } from "./buildInput";
import { attachDefragInput } from "./defragInput";
import { logGameConstants } from "./logGameConstants";

interface Props {
  room: Room<MatchState>;
  onExit: () => void;
}

export function GameView({ room, onExit }: Props) {
  const sim = useMemo(() => createClientSim(room), [room]);

  useEffect(() => attachEngineInput(sim.controls), [sim]);
  useEffect(() => attachAimInput(sim.controls), [sim]);
  useEffect(() => attachLaserInput(room), [room]);
  useEffect(() => attachBuildInput(room), [room]);
  useEffect(() => attachDefragInput(room), [room]);
  useEffect(logGameConstants, []);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <GameCanvas
        room={room}
        state={room.state}
        sessionId={room.sessionId}
        sim={sim}
      />
      <button
        onClick={onExit}
        style={{ position: "absolute", top: 16, right: 16 }}
      >
        Exit game
      </button>
    </div>
  );
}
