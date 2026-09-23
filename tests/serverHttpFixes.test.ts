import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import express from "express";
import { checkpointRequestId } from "../server/src/db/classroomSession";

describe("trust proxy derives req.ip from X-Forwarded-For", () => {
  async function withApp(trustProxy: number | boolean, headers: Record<string, string>): Promise<string> {
    const app = express();
    app.set("trust proxy", trustProxy);
    app.get("/ip", (req, res) => res.json({ ip: req.ip }));
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const response = await fetch(`http://127.0.0.1:${port}/ip`, { headers });
      const body = await response.json();
      return body.ip as string;
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  it("resolves the real client IP from X-Forwarded-For when one proxy hop is trusted (Render's edge)", async () => {
    const ip = await withApp(1, { "x-forwarded-for": "203.0.113.7" });
    expect(ip).toBe("203.0.113.7");
  });

  it("falls back to the socket address (not a spoofed header) when trust proxy is unset", async () => {
    const ip = await withApp(false, { "x-forwarded-for": "203.0.113.7" });
    expect(ip).not.toBe("203.0.113.7");
    expect(ip === "127.0.0.1" || ip === "::ffff:127.0.0.1" || ip === "::1").toBe(true);
  });

  it("does not trust a second forwarded hop beyond Render's single proxy", async () => {
    // With trust proxy=1, req.ip is the closest untrusted hop: the last entry
    // in X-Forwarded-For (the address the proxy itself observed), not a
    // client-supplied earlier hop that could be spoofed.
    const ip = await withApp(1, { "x-forwarded-for": "198.51.100.9, 203.0.113.7" });
    expect(ip).toBe("203.0.113.7");
  });
});

describe("dev teacher auth rejects a spoofed loopback address", () => {
  process.env.NODE_ENV = "development";
  process.env.DEV_TEACHER_AUTH = "true";
  // devEnabled/production are computed once at module load, from the env set just above.
  const authModule = import("../server/src/teacher/auth");
  async function withAuthApp(trustProxy: number | boolean, headers: Record<string, string>, body: unknown): Promise<{ status: number }> {
    const { authRouter } = await authModule;
    const app = express();
    app.set("trust proxy", trustProxy);
    app.use(express.json());
    app.use("/api/auth", authRouter);
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const response = await fetch(`http://127.0.0.1:${port}/api/auth/dev`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:5173", ...headers },
        body: JSON.stringify(body ?? {}),
      });
      return { status: response.status };
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  it("still allows a genuine loopback request with no forwarded-for header", async () => {
    const { status } = await withAuthApp(1, {}, { teacher: "A" });
    // Reaches the handler past the loopback gate (200 on success); must not be the 404 the gate returns.
    expect(status).not.toBe(404);
  });

  it("refuses a request carrying X-Forwarded-For even when it claims to be loopback (LAN spoof attempt)", async () => {
    // Before the fix, with trust proxy enabled, req.ip would resolve to the spoofed
    // "127.0.0.1" header value and pass the loopback check even though the real
    // socket is not loopback in production topologies. The fix rejects any request
    // carrying X-Forwarded-For outright, so this must 404 regardless of trust proxy.
    const { status } = await withAuthApp(1, { "x-forwarded-for": "127.0.0.1" }, { teacher: "A" });
    expect(status).toBe(404);
  });
});

describe("checkpoint request_id is deterministic per logical event", () => {
  it("produces the same id for the same session+sequence+eventType, enabling ON CONFLICT dedup on retry", () => {
    const first = checkpointRequestId("session-1", 5, "turn_advanced");
    const second = checkpointRequestId("session-1", 5, "turn_advanced");
    expect(first).toBe(second);
  });
  it("produces different ids for different sequences or event types", () => {
    const base = checkpointRequestId("session-1", 5, "turn_advanced");
    expect(checkpointRequestId("session-1", 6, "turn_advanced")).not.toBe(base);
    expect(checkpointRequestId("session-1", 5, "answer_submitted")).not.toBe(base);
    expect(checkpointRequestId("session-2", 5, "turn_advanced")).not.toBe(base);
  });
});
