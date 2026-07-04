// Root app component — gates on auth, then connects to the game server.
import { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import type { Room } from "colyseus.js";
import { auth, signInWithGoogle, signOut } from "./firebaseAuth";
import { colyseusClient } from "./serverConnection";

type ConnStatus = "connecting" | "connected" | "error";

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) return;

    let active = true;
    let room: Room | null = null;

    const connect = async () => {
      try {
        const r = await colyseusClient.joinOrCreate("game");
        if (!active) {
          void r.leave();
          return;
        }
        room = r;
        setStatus("connected");
        r.onMessage<unknown>("hello", (msg) => {
          if (typeof msg === "string") setGreeting(msg);
        });
      } catch {
        if (active) setStatus("error");
      }
    };

    void connect();

    return () => {
      active = false;
      if (room) void room.leave();
    };
  }, [user]);

  if (user === undefined) return <p>Loading...</p>;

  if (user === null) {
    return (
      <button
        onClick={() => {
          void signInWithGoogle();
        }}
      >
        Sign in with Google
      </button>
    );
  }

  return (
    <div>
      <p>{user.email}</p>
      <button
        onClick={() => {
          void signOut();
        }}
      >
        Sign out
      </button>
      <p>Server: {status}</p>
      {greeting !== null && <p>{greeting}</p>}
    </div>
  );
}
