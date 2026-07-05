// Game view: canvas with a HUD overlay.
import { useEffect, useMemo, useState } from "react";
import type { Room } from "colyseus.js";
import type { MatchState } from "@blasteroids/shared";
import { messageType } from "@blasteroids/shared";
import { GameCanvas } from "./GameCanvas";
import { createClientSim } from "./clientSim";
import { attachEngineInput } from "./engineInput";
import { attachLaserInput } from "./laserInput";
import { attachAimInput } from "./aimInput";
import { attachBuildInput } from "./buildInput";
import { attachDefragInput } from "./defragInput";
import { attachScavengeInput } from "./scavengeInput";
import { logGameConstants } from "./logGameConstants";

interface Props {
  room: Room<MatchState>;
  onExit: () => void;
}

export function GameView({ room, onExit }: Props) {
  const sim = useMemo(() => createClientSim(room), [room]);
  const [shipLost, setShipLost] = useState(false);

  useEffect(() => attachEngineInput(sim.controls), [sim]);
  useEffect(() => attachAimInput(sim.controls), [sim]);
  useEffect(() => attachLaserInput(room), [room]);
  useEffect(() => attachBuildInput(room), [room]);
  useEffect(() => attachDefragInput(room), [room]);
  useEffect(() => attachScavengeInput(room), [room]);
  useEffect(logGameConstants, []);

  useEffect(() => {
    room.onStateChange(() => {
      const player = room.state.players.get(room.sessionId);
      setShipLost(player !== undefined && player.ship === undefined);
    });
    // colyseus.js has no listener removal; harmless for the room's lifetime.
  }, [room]);

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
      {shipLost && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            color: "#fff",
            textShadow: "0 0 4px #000",
          }}
        >
          <p style={{ fontSize: 24 }}>Your ship was destroyed</p>
          <button
            onClick={() => {
              room.send(messageType.respawn);
            }}
            style={{ fontSize: 20, padding: "8px 24px" }}
          >
            Respawn
          </button>
        </div>
      )}
    </div>
  );
}
