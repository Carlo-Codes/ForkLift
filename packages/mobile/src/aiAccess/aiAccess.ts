import { getRandomBytes } from "expo-crypto";
import * as Network from "expo-network";
import * as SecureStore from "expo-secure-store";
import { PermissionsAndroid, Platform } from "react-native";
import BackgroundService from "react-native-background-actions";
import { createServer } from "react-native-nitro-http-server";

import { createDebugger } from "@forklift/debug";

import { startAiAccessHttpServer } from "./aiAccessHttp";
import type { AiAccessHttpServer, CreateHttpServer } from "./aiAccessHttp";
import { createIdleTimer } from "./idleTimer";

const debug = createDebugger("aiAccess");

export const AI_ACCESS_PORT = 8765;
export const AI_ACCESS_IDLE_MINUTES = 30;

const TOKEN_KEY = "aiAccessPairingToken";

export type AiAccessState =
  { status: "off"; switchedOffIdle?: boolean } |
  { status: "starting" } |
  { status: "on"; address?: string; onWifi: boolean; token: string } |
  { status: "error"; message: string };

let state: AiAccessState = { status: "off" };
let token: string | undefined;
const listeners = new Set<() => void>();
let http: AiAccessHttpServer | undefined;
let idle: ReturnType<typeof createIdleTimer> | undefined;
let releaseBackgroundTask: (() => void) | undefined;

function setState(next: AiAccessState) {
  state = next;
  listeners.forEach(listener => listener());
}

export function getAiAccessState(): AiAccessState {
  return state;
}

export function subscribeAiAccess(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

function storeNewPairingToken(): string {
  token = Array.from(getRandomBytes(32), b => b.toString(16).padStart(2, "0")).join("");
  SecureStore.setItem(TOKEN_KEY, token);

  return token;
}

// The pairing token lives in the device's secure storage, not the database, so
// it never leaves the phone in a backup. It's kept across switching AI Access
// off and on, so the AI client stays paired until the lifter regenerates it.
export function getPairingToken(): string {
  token ??= SecureStore.getItem(TOKEN_KEY) ?? undefined;

  return token ?? storeNewPairingToken();
}

export function regeneratePairingToken(): string {
  const next = storeNewPairingToken();

  debug.info("regenerated the pairing token");

  if (state.status === "on") {
    setState({
      ...state,
      token: next
    });
  }

  return next;
}

// iOS suspends the app soon after it leaves the screen, which tears down the
// listening socket; autoRestart has the library listen again, at the same
// address, when ForkLift is back in front.
const createHttpServer: CreateHttpServer = listener => createServer({ autoRestart: true }, listener);

// Android keeps the server running in the background with a foreground
// service, whose task is simply to stay pending until AI Access switches off.
async function startBackgroundService() {
  if (Platform.OS !== "android") {
    return;
  }

  if (Platform.Version >= 33) {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }

  await BackgroundService.start(() => new Promise<void>(resolve => {
    releaseBackgroundTask = resolve;
  }), {
    taskName: "AIAccess",
    taskTitle: "AI Access is on",
    taskDesc: "An AI assistant on your Wi-Fi can read your ForkLift data.",
    taskIcon: {
      name: "ic_launcher",
      type: "mipmap"
    },
    color: "#E8590C",
    linkingURI: "forklift://settings",
    foregroundServiceType: [ "dataSync" ]
  });
}

async function stopBackgroundService() {
  if (Platform.OS !== "android") {
    return;
  }

  releaseBackgroundTask?.();
  releaseBackgroundTask = undefined;
  await BackgroundService.stop();
}

async function serverAddress(): Promise<{ address?: string; onWifi: boolean }> {
  const [ ip, network ] = await Promise.all([ Network.getIpAddressAsync(), Network.getNetworkStateAsync() ]);

  return {
    address: ip && ip !== "0.0.0.0" ? `http://${ip}:${AI_ACCESS_PORT}/mcp` : undefined,
    onWifi: network.type === Network.NetworkStateType.WIFI
  };
}

async function shutDown() {
  idle?.stop();
  idle = undefined;

  const server = http;

  http = undefined;
  await server?.close();
  await stopBackgroundService();
}

export async function startAiAccess(): Promise<void> {
  if (state.status === "on" || state.status === "starting") {
    return;
  }

  setState({ status: "starting" });

  try {
    getPairingToken();

    http = await startAiAccessHttpServer({
      createHttpServer,
      port: AI_ACCESS_PORT,
      getPairingToken,
      onActivity: () => idle?.touch()
    });

    idle = createIdleTimer(AI_ACCESS_IDLE_MINUTES * 60_000, () => {
      debug.info("switching AI Access off after %d idle minutes", AI_ACCESS_IDLE_MINUTES);
      void stopAiAccess({ idle: true });
    });
    await startBackgroundService();

    setState({
      status: "on",
      ...await serverAddress(),
      token: getPairingToken()
    });
  } catch (e) {
    debug.error("couldn't start AI Access: %O", e);
    await shutDown().catch(() => undefined);

    setState({
      status: "error",
      message: e instanceof Error ? e.message : String(e)
    });
  }
}

export async function stopAiAccess({ idle: switchedOffIdle = false } = {}): Promise<void> {
  await shutDown();

  setState({
    status: "off",
    switchedOffIdle
  });
}
