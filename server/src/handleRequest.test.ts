// Integration tests for the HTTP request handler.
import { createServer } from "node:http";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { handleRequest } from "./handleRequest";

describe("handleRequest", () => {
  const server = createServer(handleRequest);
  let baseUrl: string;

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => {
          const addr = server.address();
          if (typeof addr !== "object" || addr === null) {
            throw new Error("Server not bound to a TCP port");
          }
          baseUrl = `http://127.0.0.1:${String(addr.port)}`;
          resolve();
        });
      }),
  );

  afterAll(
    () =>
      new Promise<void>((resolve) =>
        server.close(() => {
          resolve();
        }),
      ),
  );

  it("GET /health responds 200 with OK", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  it("unknown routes respond 404", async () => {
    const res = await fetch(`${baseUrl}/unknown`);
    expect(res.status).toBe(404);
  });
});
