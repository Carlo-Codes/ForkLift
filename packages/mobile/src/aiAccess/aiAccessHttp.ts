import { Buffer } from "buffer";

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { createDebugger } from "@forklift/debug";

import { createAiAccessMcpServer } from "./aiAccessTools";

const debug = createDebugger("aiAccessHttp");
const MAX_HEAD_BYTES = 16 * 1024;
const MAX_BODY_BYTES = 1024 * 1024;
const SOCKET_TIMEOUT_MS = 30_000;

// The few socket calls the server makes, shared by Node's net (tests) and
// react-native-tcp-socket (the phone), which mirrors it.
export interface TcpSocketLike {
  on(event: "data", listener: (data: Buffer | string) => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  on(event: "close", listener: () => void): unknown;
  setTimeout(ms: number, callback: () => void): unknown;
  write(data: Buffer): unknown;
  end(): unknown;
  destroy(): unknown;
}

interface TcpServerLike {
  listen(options: { port: number; host: string }, callback: () => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  address(): { port: number } | string | null;
  close(callback?: () => void): unknown;
}

export type CreateTcpServer = (onConnection: (socket: TcpSocketLike) => void) => TcpServerLike;

export interface AiAccessHttpServer {
  port: number;
  close: () => Promise<void>;
}

interface HttpRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string;
}

interface HttpResponse {
  status: number;
  headers?: Record<string, string>;
  body?: string;
}

type Parsed = { kind: "incomplete" } | { kind: "error"; response: HttpResponse } | { kind: "request"; request: HttpRequest };

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  202: "Accepted",
  400: "Bad Request",
  401: "Unauthorized",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  411: "Length Required",
  413: "Content Too Large",
  415: "Unsupported Media Type",
  431: "Request Header Fields Too Large",
  500: "Internal Server Error"
};

// The request headers the MCP transport reads; nothing else is passed on.
const FORWARDED_HEADERS = [
  "accept",
  "content-type",
  "mcp-protocol-version",
  "mcp-session-id",
  "last-event-id"
];

const jsonRpcError = (status: number, code: number, message: string, headers?: Record<string, string>): HttpResponse => ({
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

const failed = (status: number, message: string): Parsed => ({
  kind: "error",
  response: jsonRpcError(status, -32000, message)
});

// Just enough HTTP/1.1 for an MCP client: one request per connection, its
// body sized by Content-Length.
function parseRequest(buffer: Buffer): Parsed {
  const headEnd = buffer.indexOf("\r\n\r\n");

  if (headEnd === -1) {
    return buffer.length > MAX_HEAD_BYTES ? failed(431, "Request headers too large") : { kind: "incomplete" };
  }

  const [ requestLine = "", ...headerLines ] = buffer.subarray(0, headEnd).toString("latin1")
    .split("\r\n");

  const [ method, target ] = /^([A-Z]+) (\S+) HTTP\/1\.[01]$/.exec(requestLine)?.slice(1) ?? [];

  if (!method || !target) {
    return failed(400, "Malformed request");
  }

  const headers: Record<string, string> = {};

  for (const line of headerLines) {
    const colon = line.indexOf(":");

    if (colon <= 0) {
      return failed(400, "Malformed header");
    }

    const name = line.slice(0, colon).trim()
      .toLowerCase();

    const value = line.slice(colon + 1).trim();

    headers[ name ] = headers[ name ] === undefined ? value : `${headers[ name ]}, ${value}`;
  }

  if (headers[ "transfer-encoding" ] !== undefined) {
    return failed(411, "Send the body with a Content-Length");
  }

  const length = Number(headers[ "content-length" ] ?? 0);

  if (!Number.isInteger(length) || length < 0) {
    return failed(400, "Malformed Content-Length");
  }

  if (length > MAX_BODY_BYTES) {
    return failed(413, "Request body too large");
  }

  const bodyStart = headEnd + 4;

  if (buffer.length < bodyStart + length) {
    return { kind: "incomplete" };
  }

  return {
    kind: "request",
    request: {
      method,
      path: target.split("?")[ 0 ]!,
      headers,
      body: buffer.subarray(bodyStart, bodyStart + length).toString("utf8")
    }
  };
}

function serialize({
  status, headers = {}, body = ""
}: HttpResponse): Buffer {
  const head = [
    `HTTP/1.1 ${status} ${STATUS_TEXT[ status ] ?? ""}`,
    ...Object.entries(headers).map(([ name, value ]) => `${name}: ${value}`),
    `content-length: ${Buffer.byteLength(body, "utf8")}`,
    "connection: close"
  ].join("\r\n");

  return Buffer.from(`${head}\r\n\r\n${body}`, "utf8");
}

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
async function handleMcp(request: HttpRequest): Promise<HttpResponse> {
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

async function route(
  request: HttpRequest,
  getPairingToken: () => string,
  onActivity: () => void
): Promise<HttpResponse> {
  const bearer = /^Bearer (\S+)$/i.exec(request.headers.authorization ?? "")?.[ 1 ] ?? "";

  if (!isToken(bearer, getPairingToken())) {
    debug.info("rejected a request without the pairing token");

    return jsonRpcError(401, -32001, "Unauthorized: send the pairing token as a Bearer token", { "www-authenticate": "Bearer" });
  }

  onActivity();

  if (request.path !== "/mcp") {
    return jsonRpcError(404, -32000, "Not found: the MCP endpoint is /mcp");
  }

  if (request.method !== "POST") {
    return jsonRpcError(405, -32000, "Method not allowed: this server takes POST only", { allow: "POST" });
  }

  return handleMcp(request);
}

// Serves AI Access's MCP endpoint at /mcp on the given TCP server. Only
// requests bearing the current pairing token are answered, and each one
// counts as activity; the token is read per request, so regenerating it
// shuts out the old one at once.
export function startAiAccessHttpServer({
  createTcpServer, host = "0.0.0.0", port, getPairingToken, onActivity = () => undefined
}: {
  createTcpServer: CreateTcpServer;
  host?: string;
  port: number;
  getPairingToken: () => string;
  onActivity?: () => void;
}): Promise<AiAccessHttpServer> {
  const sockets = new Set<TcpSocketLike>();

  const onConnection = (socket: TcpSocketLike) => {
    let buffer = Buffer.alloc(0);
    let answered = false;

    sockets.add(socket);
    socket.setTimeout(SOCKET_TIMEOUT_MS, () => socket.destroy());
    socket.on("close", () => sockets.delete(socket));

    socket.on("error", error => {
      debug.error("socket error: %s", error.message);
      socket.destroy();
    });

    const reply = (response: HttpResponse) => {
      socket.write(serialize(response));
      socket.end();
    };

    socket.on("data", data => {
      if (answered) {
        return;
      }

      buffer = Buffer.concat([ buffer, typeof data === "string" ? Buffer.from(data, "utf8") : data ]);

      const parsed = parseRequest(buffer);

      if (parsed.kind === "incomplete") {
        return;
      }

      answered = true;

      if (parsed.kind === "error") {
        reply(parsed.response);

        return;
      }

      route(parsed.request, getPairingToken, onActivity).then(reply, (error: unknown) => {
        debug.error("request failed: %O", error);
        reply(jsonRpcError(500, -32603, "Internal error"));
      });
    });
  };

  return new Promise((resolve, reject) => {
    const tcpServer = createTcpServer(onConnection);

    tcpServer.on("error", reject);

    tcpServer.listen({
      port,
      host
    }, () => {
      const address = tcpServer.address();

      debug.info("AI Access listening on %s:%d", host, port);

      resolve({
        port: typeof address === "object" && address ? address.port : port,
        close: () => new Promise(done => {
          tcpServer.close(() => done());

          for (const socket of sockets) {
            socket.destroy();
          }
        })
      });
    });
  });
}
