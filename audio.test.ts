import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { soundsFor } from "./audio";
import type { PlaceResult } from "./go-rules";

const ACCEPTED_NO_CAPTURE: PlaceResult = { ok: true, board: { size: 9, cells: [] }, captured: [] };
const ACCEPTED_WITH_CAPTURE: PlaceResult = {
  ok: true,
  board: { size: 9, cells: [] },
  captured: [{ row: 0, col: 0 }],
};
const REJECTED_OCCUPIED: PlaceResult = { ok: false, reason: "occupied" };
const REJECTED_SUICIDE: PlaceResult = { ok: false, reason: "suicide" };
const REJECTED_KO: PlaceResult = { ok: false, reason: "ko" };

describe("soundsFor: the pure semantic decision, no DOM or audio involved", () => {
  it("a rejected move (any reason) triggers no sounds", () => {
    expect(soundsFor(REJECTED_OCCUPIED)).toEqual([]);
    expect(soundsFor(REJECTED_SUICIDE)).toEqual([]);
    expect(soundsFor(REJECTED_KO)).toEqual([]);
  });

  it("an accepted move with no captures triggers only the placement sound", () => {
    expect(soundsFor(ACCEPTED_NO_CAPTURE)).toEqual(["place"]);
  });

  it("an accepted move that captures stones triggers placement then capture, in order", () => {
    expect(soundsFor(ACCEPTED_WITH_CAPTURE)).toEqual(["place", "capture"]);
  });
});

// The rest of audio.ts keeps module-scoped state (the mute flag, the cached
// AudioContext), so every test below resets the module between runs — via
// vi.resetModules() plus a fresh dynamic import — instead of sharing one
// import's state across tests, which would let an earlier test's mute/context
// leak into a later one.
async function freshAudioModule(): Promise<typeof import("./audio")> {
  vi.resetModules();
  return import("./audio");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mute state", () => {
  it("round-trips through localStorage with a real window", async () => {
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://example.test/" });
    vi.stubGlobal("window", dom.window);
    const { isMuted, setMuted } = await freshAudioModule();

    expect(isMuted()).toBe(false);
    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(dom.window.localStorage.getItem("learn-go:sound-muted")).toBe("true");

    setMuted(false);
    expect(isMuted()).toBe(false);
    expect(dom.window.localStorage.getItem("learn-go:sound-muted")).toBe("false");
  });

  it("setMuted/isMuted do not throw when window is undefined", async () => {
    vi.stubGlobal("window", undefined);
    const { isMuted, setMuted } = await freshAudioModule();

    expect(() => setMuted(true)).not.toThrow();
    expect(isMuted()).toBe(true);
  });
});

describe("mountSoundToggle", () => {
  it("does nothing when the button is missing", async () => {
    const { mountSoundToggle } = await freshAudioModule();
    expect(() => mountSoundToggle(null)).not.toThrow();
  });

  it("reflects mute state in label and aria-pressed, and toggles on click", async () => {
    const dom = new JSDOM('<!doctype html><body><button id="sound-toggle"></button></body>', {
      url: "https://example.test/",
    });
    vi.stubGlobal("window", dom.window);
    const { mountSoundToggle, isMuted } = await freshAudioModule();
    const button = dom.window.document.querySelector<HTMLButtonElement>("#sound-toggle");

    mountSoundToggle(button);
    expect(button?.getAttribute("aria-pressed")).toBe("false");
    expect(button?.textContent).toBe("Sound: on");

    button?.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    expect(button?.getAttribute("aria-pressed")).toBe("true");
    expect(button?.textContent).toBe("Sound: off");
    expect(isMuted()).toBe(true);
  });
});

interface FakeAudioNode {
  connect: (target: unknown) => unknown;
  [key: string]: unknown;
}

class FakeAudioContext {
  sampleRate = 44100;
  currentTime = 0;
  state = "running";
  destination = {};
  bufferSourcesCreated = 0;

  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }

  createBufferSource(): FakeAudioNode {
    this.bufferSourcesCreated += 1;
    return { buffer: null, connect: (target: unknown) => target, start: () => {}, stop: () => {} };
  }

  createBiquadFilter(): FakeAudioNode {
    return { type: "", frequency: { value: 0 }, Q: { value: 0 }, connect: (target: unknown) => target };
  }

  createGain(): FakeAudioNode {
    return {
      gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: (target: unknown) => target,
    };
  }

  resume() {
    return Promise.resolve();
  }
}

function stubBrowserAudio(): { context: FakeAudioContext } {
  const dom = new JSDOM("<!doctype html><body></body>", { url: "https://example.test/" });
  const context = new FakeAudioContext();
  // A plain function (not an arrow) that returns an object overrides `this`
  // when invoked with `new`, so this stands in for the AudioContext
  // constructor without needing a real one.
  function FakeAudioContextCtor(): FakeAudioContext {
    return context;
  }
  (dom.window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContextCtor;
  // Deterministic in place of a real 90ms delay: run the scheduled capture
  // click immediately instead of waiting on real or faked timers.
  vi.spyOn(dom.window, "setTimeout").mockImplementation(((cb: () => void) => {
    cb();
    return 0;
  }) as typeof setTimeout);
  vi.stubGlobal("window", dom.window);
  return { context };
}

describe("notifyMoveResult: playback attempts, given a stubbed AudioContext", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("a rejected move attempts no playback", async () => {
    const { context } = stubBrowserAudio();
    const { notifyMoveResult } = await import("./audio");

    notifyMoveResult(REJECTED_SUICIDE);
    expect(context.bufferSourcesCreated).toBe(0);
  });

  it("an accepted non-capturing move plays exactly one click", async () => {
    const { context } = stubBrowserAudio();
    const { notifyMoveResult } = await import("./audio");

    notifyMoveResult(ACCEPTED_NO_CAPTURE);
    expect(context.bufferSourcesCreated).toBe(1);
  });

  it("an accepted capturing move plays a placement click then a capture click", async () => {
    const { context } = stubBrowserAudio();
    const { notifyMoveResult } = await import("./audio");

    notifyMoveResult(ACCEPTED_WITH_CAPTURE);
    expect(context.bufferSourcesCreated).toBe(2);
  });

  it("muting prevents playback even for an accepted move", async () => {
    const { context } = stubBrowserAudio();
    const { notifyMoveResult, setMuted } = await import("./audio");

    setMuted(true);
    notifyMoveResult(ACCEPTED_WITH_CAPTURE);
    expect(context.bufferSourcesCreated).toBe(0);
  });

  it("does not throw when no window/AudioContext is available (e.g. under plain Node tests)", async () => {
    vi.stubGlobal("window", undefined);
    const { notifyMoveResult } = await import("./audio");

    expect(() => notifyMoveResult(ACCEPTED_WITH_CAPTURE)).not.toThrow();
  });
});
