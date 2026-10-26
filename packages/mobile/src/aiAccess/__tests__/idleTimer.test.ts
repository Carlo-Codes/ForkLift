import { jest } from "@jest/globals";

import { createIdleTimer } from "../idleTimer";

describe("idle timer", () => {
  const MINUTE = 60_000;
  let onIdle: jest.Mock<() => void>;

  beforeEach(() => {
    jest.useFakeTimers();
    onIdle = jest.fn();
  });

  afterEach(() => jest.useRealTimers());

  it("goes off after the timeout with no activity", () => {
    createIdleTimer(30 * MINUTE, onIdle);

    jest.advanceTimersByTime(30 * MINUTE - 1);
    expect(onIdle).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("starts the timeout afresh on activity", () => {
    const timer = createIdleTimer(30 * MINUTE, onIdle);

    jest.advanceTimersByTime(20 * MINUTE);
    timer.touch();
    jest.advanceTimersByTime(20 * MINUTE);

    expect(onIdle).not.toHaveBeenCalled();

    jest.advanceTimersByTime(10 * MINUTE);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("never goes off once stopped", () => {
    const timer = createIdleTimer(30 * MINUTE, onIdle);

    timer.stop();
    timer.touch();
    jest.advanceTimersByTime(60 * MINUTE);

    expect(onIdle).not.toHaveBeenCalled();
  });
});
