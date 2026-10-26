// Calls onIdle once timeoutMs pass without a touch. A stopped timer stays
// stopped.
export function createIdleTimer(timeoutMs: number, onIdle: () => void) {
  let handle: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const stop = () => {
    stopped = true;
    clearTimeout(handle);
  };

  const touch = () => {
    if (stopped) {
      return;
    }

    clearTimeout(handle);
    handle = setTimeout(onIdle, timeoutMs);
  };

  touch();

  return {
    touch,
    stop
  };
}
