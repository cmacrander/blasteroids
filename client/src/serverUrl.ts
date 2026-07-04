// WebSocket URL for the Colyseus game server.
// In dev, traffic routes through the Vite proxy at /colyseus.
// In production, set VITE_SERVER_URL to the deployed server (e.g. wss://api.example.com).
export const serverUrl =
  import.meta.env.VITE_SERVER_URL ?? "ws://localhost:3000/colyseus";
