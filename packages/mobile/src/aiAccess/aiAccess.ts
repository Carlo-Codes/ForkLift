import { getRandomBytes } from "expo-crypto";
import * as Network from "expo-network";
import * as SecureStore from "expo-secure-store";
import {
  AppState, PermissionsAndroid, Platform
} from "react-native";
import type { AppStateStatus, NativeEventSubscription } from "react-native";
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

const createTcpServer: CreateTcpServer = onConnection => TcpSocket.createServer(onConnection);
// Opening and closing the listener run one after another, so a quick trip to
// the background can't reopen the port before it's closed, nor a stop leave a
// late reopen behind.
let listenerSteps: Promise<void> = Promise.resolve();

function serially(step: () => Promise<void>): Promise<void> {
  const next = listenerSteps.then(step);

  listenerSteps = next.catch(() => undefined);

  return next;
}

const openListener = () => serially(async () => {
  // Gone means AI Access switched off while this waited its turn.
  if (appStateSubscription && !http) {
    http = await startAiAccessHttpServer({
      createTcpServer,
      port: AI_ACCESS_PORT,
      getPairingToken,
      onActivity: () => idle?.touch()
    });
  }
});

const closeListener = () => serially(async () => {
  const server = http;

  http = undefined;
  await server?.close();
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
function onAppStateChange(next: AppStateStatus) {
  if (Platform.OS !== "ios") {
    return;
  }

  if (next === "background") {
    void closeListener();
  } else if (next === "active") {
    openListener().catch((e: unknown) => {
      debug.error("couldn't reopen AI Access: %O", e);
      void stopAiAccess();
    });
  }
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
  appStateSubscription?.remove();
  appStateSubscription = undefined;
  await closeListener();
  await stopBackgroundService();
}

export async function startAiAccess(): Promise<void> {
  if (state.status === "on" || state.status === "starting") {
    return;
  }

  setState({ status: "starting" });

  try {
    getPairingToken();
    // Listening for app state first means backgrounding during start still
    // closes the listener on iOS.
    appStateSubscription = AppState.addEventListener("change", onAppStateChange);
    await openListener();

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
