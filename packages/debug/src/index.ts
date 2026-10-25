import debug from "debug";

let enabled = false;

export function createDebugger(nameSpace: string): {
  error: debug.Debugger;
  log: debug.Debugger;
  info: debug.Debugger;
} {
  if (!enabled && process.env.ENVIRONMENT === "development") {
    debug.enable("ForkLift:*");
    enabled = true;
  }

  const log = debug(`ForkLift:${nameSpace}:`);
  const error = debug(`ForkLift:${nameSpace}:ERROR`);
  const info = debug(`ForkLift:${nameSpace}:INFO`);

  return {
    error,
    log,
    info
  };
}

export { ApiError } from "./apiError";
