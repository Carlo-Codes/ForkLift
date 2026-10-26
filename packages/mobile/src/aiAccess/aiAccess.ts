import { getRandomBytes } from "expo-crypto";
import * as Network from "expo-network";
import * as SecureStore from "expo-secure-store";
import {
  AppState, PermissionsAndroid, Platform
} from "react-native";
import type { NativeEventSubscription } from "react-native";
import BackgroundService from "react-native-background-actions";
import TcpSocket from "react-native-tcp-socket";

import { createDebugger } from "@forklift/debug";

import { startAiAccessHttpServer } from "./aiAccessHttp";
import type { AiAccessHttpServer, CreateTcpServer } from "./aiAccessHttp";
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
let appStateSubscription: NativeEventSubscription | undefined;
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

const createPairingToken = () => Array.from(getRandomBytes(32), b => b.toString(16).padStart(2, "0")).join("");

// The pairing token lives in the device's secure storage, not the database, so
// it never leaves the phone in a backup. It's kept across switching AI Access
// off and on, so the AI client stays paired until the lifter regenerates it.
export function getPairingToken(): string {
  token ??= SecureStore.getItem(TOKEN_KEY) ?? undefined;

  if (!token) {
    token = createPairingToken();
    SecureStore.setItem(TOKEN_KEY, token);
  }

  return token;
}

export function regeneratePairingToken(): string {
  token = createPairingToken();
  SecureStore.setItem(TOKEN_KEY, token);
  debug.info("regenerated the pairing token");

  if (state.status === "on") {
    setState({
      ...state,
      token
    });
  }

  return token;
}

const createTcpServer: CreateTcpServer = onConnection => TcpSocket.createServer(onConnection);

const listen = () => startAiAccessHttpServer({
  createTcpServer,
  port: AI_ACCESS_PORT,
  getPairingToken,
  onActivity: () => idle?.touch()
});

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

// iOS runs AI Access only while ForkLift is open: a suspended app's listening
// socket can be reclaimed, so it's closed in the background and opened again,
// at the same address, on return.
function onAppStateChange(next: string) {
  if (Platform.OS !== "ios" || state.status !== "on") {
    return;
  }

  if (next === "background" && http) {
    const server = http;

    http = undefined;
    void server.close();
  } else if (next === "active" && !http) {
    listen().then(server => {
      http = server;
    }, (e: unknown) => {
      debug.error("couldn't reopen AI Access: %O", e);
      void stopAiAccess();
    });
  }
}

async function addressOf(): Promise<{ address?: string; onWifi: boolean }> {
  const [ ip, network ] = await Promise.all([ Network.getIpAddressAsync(), Network.getNetworkStateAsync() ]);

  return {
    address: ip && ip !== "0.0.0.0" ? `http://${ip}:${AI_ACCESS_PORT}/mcp` : undefined,
    onWifi: network.type === Network.NetworkStateType.WIFI
  };
}

async function shutDown() {
  idle?.stop();
  idle = undefined;
  appStateSubscription?.remove();
  appStateSubscription = undefined;

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
    http = await listen();

    idle = createIdleTimer(AI_ACCESS_IDLE_MINUTES * 60_000, () => {
      debug.info("switching AI Access off after %d idle minutes", AI_ACCESS_IDLE_MINUTES);
      void stopAiAccess({ idle: true });
    });
    appStateSubscription = AppState.addEventListener("change", onAppStateChange);
    await startBackgroundService();

    setState({
      status: "on",
      ...await addressOf(),
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
