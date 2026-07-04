// Colyseus client instance shared across the app.
import { Client } from "colyseus.js";
import { serverUrl } from "./serverUrl";

export const colyseusClient = new Client(serverUrl);
