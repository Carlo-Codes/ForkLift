import net from "node:net";

import { jest } from "@jest/globals";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { setupTestDb } from "@forklift/db/server";

import { startAiAccessHttpServer } from "../aiAccessHttp";
import type { AiAccessHttpServer, CreateTcpServer } from "../aiAccessHttp";

describe("AI Access over HTTP", () => {
  let teardown: () => void;
  let server: AiAccessHttpServer;
  let token: string;
  let onActivity: jest.Mock<() => void>;

  const url = () => `http://127.0.0.1:${server.port}/mcp`;

  const connect = async (bearer: string) => {
    const client = new Client({
      name: "test",
      version: "1.0.0"
    });

    await client.connect(new StreamableHTTPClientTransport(new URL(url()), {
      requestInit: { headers: { Authorization: `Bearer ${bearer}` } }
    }));

    return client;
  };

  const initialize = (headers: Record<string, string>) => fetch(url(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: {
          name: "test",
          version: "1.0.0"
        }
      }
    })
  });

  beforeEach(async () => {
    ({ teardown } = setupTestDb());
    token = "first-token";
    onActivity = jest.fn();
    server = await startAiAccessHttpServer({
      createTcpServer: net.createServer as unknown as CreateTcpServer,
      host: "127.0.0.1",
      port: 0,
      getPairingToken: () => token,
      onActivity
    });
  });

  afterEach(async () => {
    await server.close();
    teardown();
  });

  it("serves the tools to a client with the pairing token, as activity", async () => {
    const client = await connect("first-token");
    const { tools } = await client.listTools();

    expect(tools.map(t => t.name)).toContain("list_plans");
    expect(onActivity).toHaveBeenCalled();

    await client.close();
  });

  it.each([
    [ "a wrong token", { Authorization: "Bearer guess" } ],
    [ "no token", {} ]
  ])("rejects a request with %s, which isn't activity", async (_, headers) => {
    const response = await initialize(headers);

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
    expect(onActivity).not.toHaveBeenCalled();
  });

  it("rejects the old token once it's regenerated, and takes the new one", async () => {
    token = "second-token";

    expect((await initialize({ Authorization: "Bearer first-token" })).status).toBe(401);
    expect((await initialize({ Authorization: "Bearer second-token" })).status).toBe(200);
  });

  it("offers no event stream", async () => {
    const response = await fetch(url(), {
      headers: {
        Authorization: "Bearer first-token",
        Accept: "text/event-stream"
      }
    });

    expect(response.status).toBe(405);
  });

  it("serves nothing but /mcp", async () => {
    const response = await fetch(`http://127.0.0.1:${server.port}/`, {
      headers: { Authorization: "Bearer first-token" }
    });

    expect(response.status).toBe(404);
  });
});
