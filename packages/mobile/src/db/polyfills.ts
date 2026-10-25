import { getRandomValues, randomUUID } from "expo-crypto";

// @forklift/db generates UUID ids with the Web Crypto API (crypto.randomUUID),
// which Hermes doesn't provide.
if (typeof globalThis.crypto?.randomUUID !== "function") {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      ...globalThis.crypto,
      getRandomValues,
      randomUUID
    }
  });
}
