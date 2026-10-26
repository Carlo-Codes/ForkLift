import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { createDebugger } from "@forklift/debug";

import { createAiAccessMcpServer } from "./aiAccessTools";

const debug = createDebugger("aiAccessHttp");
const MAX_BODY_LENGTH = 1024 * 1024;

// The part of Node's http server API AI Access uses, which both node:http
// (tests) and react-native-nitro-http-server (the phone) provide.
interface IncomingMessageLike {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  setEncoding(encoding: "utf8"): unknown;
  on(event: "data", listener: (chunk: string | { toString(encoding: "utf8"): string }) => void): unknown;
  on(event: "end", listener: () => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  destroy(): unknown;
}

interface ServerResponseLike {
  writeHead(status: number, headers: Record<string, string>): unknown;
  end(body: string): unknown;
}

interface HttpServerLike {
  listen(port: number, host: string, callback: () => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  address(): { port: number } | string | null;
  close(callback?: () => void): unknown;
}

export type CreateHttpServer = (
  listener: (request: IncomingMessageLike, response: ServerResponseLike) => void
) => HttpServerLike;

export interface AiAccessHttpServer {
  port: number;
  close: () => Promise<void>;
}

interface AiAccessRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string;
}

interface AiAccessResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

type RouteHandler = (request: AiAccessRequest) => Promise<AiAccessResponse>;

// The request headers the MCP transport reads; nothing else is passed on.
const FORWARDED_HEADERS = [
  "accept",
  "content-type",
  "mcp-protocol-version",
  "mcp-session-id",
  "last-event-id"
];

const jsonRpcError = (status: number, code: number, message: string, headers?: Record<string, string>): AiAccessResponse => ({
  status,
  headers: {
    "content-type": "application/json",
    ...headers
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    error: {
      code,
      message
    },
    id: null
  })
});

// Compares every character so how long a guess takes says nothing about how
// close it is.
function isToken(candidate: string, token: string): boolean {
  if (token === "" || candidate.length !== token.length) {
    return false;
  }

  let difference = 0;

  for (let i = 0; i < token.length; i++) {
    difference |= candidate.charCodeAt(i) ^ token.charCodeAt(i);
  }

  return difference === 0;
}

// Stateless Streamable HTTP with plain JSON answers: a fresh server and
// transport per request, so there's no session to keep and no event stream.
async function handleMcp(request: AiAccessRequest): Promise<AiAccessResponse> {
  let parsedBody: unknown;

  try {
    parsedBody = JSON.parse(request.body);
  } catch {
    return jsonRpcError(400, -32700, "Parse error: the body isn't JSON");
  }

  const headers = new Headers();

  for (const name of FORWARDED_HEADERS) {
    if (request.headers[ name ] !== undefined) {
      headers.set(name, request.headers[ name ]);
    }
  }

  const server = createAiAccessMcpServer();

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  try {
    await server.connect(transport);

    const response = await transport.handleRequest(new Request("http://localhost/mcp", {
      method: "POST",
      headers
    }), { parsedBody });

    const responseHeaders: Record<string, string> = {};

    response.headers.forEach((value, name) => {
      if (name !== "content-length" && name !== "connection") {
        responseHeaders[ name ] = value;
      }
    });

    return {
      status: response.status,
      headers: responseHeaders,
      body: await response.text()
    };
  } finally {
    await server.close();
  }
}

// Every route AI Access serves, by path then method. A new route goes here and
// is behind the pairing token like the rest.
const ROUTES: Record<string, Record<string, RouteHandler>> = { "/mcp": { POST: handleMcp } };

// Only requests bearing the current pairing token reach a route, and each one
// counts as activity. The token is read per request, so regenerating it shuts
// out the old one at once.
function createRouter(getPairingToken: () => string, onActivity: () => void): RouteHandler {
  return async request => {
    const bearer = /^Bearer (\S+)$/i.exec(request.headers.authorization ?? "")?.[ 1 ] ?? "";

    if (!isToken(bearer, getPairingToken())) {
      debug.info("rejected a request without the pairing token");

      return jsonRpcError(401, -32001, "Unauthorized: send the pairing token as a Bearer token", { "www-authenticate": "Bearer" });
    }

    onActivity();

    const methods = ROUTES[ request.path ];

    if (!methods) {
      return jsonRpcError(404, -32000, "Not found: the MCP endpoint is /mcp");
    }

    const handle = methods[ request.method ];

    if (!handle) {
      const allowed = Object.keys(methods).join(", ");

      return jsonRpcError(405, -32000, `Method not allowed: use ${allowed}`, { allow: allowed });
    }

    return handle(request);
  };
}

const flattenHeaders = (headers: IncomingMessageLike["headers"]) => Object.fromEntries(Object.entries(headers)
  .filter((entry): entry is [string, string | string[]] => entry[ 1 ] !== undefined)
  .map(([ name, value ]) => [ name.toLowerCase(), Array.isArray(value) ? value.join(", ") : value ]));

export function startAiAccessHttpServer({
  createHttpServer, host = "0.0.0.0", port, getPairingToken, onActivity = () => undefined
}: {
  createHttpServer: CreateHttpServer;
  host?: string;
  port: number;
  getPairingToken: () => string;
  onActivity?: () => void;
}): Promise<AiAccessHttpServer> {
  const route = createRouter(getPairingToken, onActivity);

  const server = createHttpServer((request, response) => {
    const reply = ({
      status, headers, body
    }: AiAccessResponse) => {
      response.writeHead(status, headers);
      response.end(body);
    };

    let body = "";
    let tooLarge = false;

    request.setEncoding("utf8");

    request.on("data", chunk => {
      body += typeof chunk === "string" ? chunk : chunk.toString("utf8");

      if (body.length > MAX_BODY_LENGTH && !tooLarge) {
        tooLarge = true;
        reply(jsonRpcError(413, -32000, "Request body too large"));
        request.destroy();
      }
    });
    request.on("error", error => debug.error("request error: %s", error.message));

    request.on("end", () => {
      if (tooLarge) {
        return;
      }

      route({
        method: request.method ?? "GET",
        path: (request.url ?? "/").split("?")[ 0 ]!,
        headers: flattenHeaders(request.headers),
        body
      }).then(reply, (error: unknown) => {
        debug.error("request failed: %O", error);
        reply(jsonRpcError(500, -32603, "Internal error"));
      });
    });
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);

    server.listen(port, host, () => {
      const address = server.address();

      debug.info("AI Access listening on %s:%d", host, port);

      resolve({
        port: typeof address === "object" && address ? address.port : port,
        close: () => new Promise(done => {
          server.close(() => done());
        })
      });
    });
  });
}
