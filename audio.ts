// Shared sound-effect layer for the book's lessons (§Change 3). Kept entirely
// separate from go-rules.ts: the rules engine stays a pure function with no
// audio/browser side effects, and every lesson controller just reports its
// existing PlaceResult here instead of calling playback functions directly.
//
// Web Audio synthesis, not bundled audio files: a short noise burst through a
// bandpass filter and a gain envelope gives a dry, percussive "click" with no
// asset to fetch, host, or license, and no dependency on a remote URL. Two
// AudioContext calls only, both a direct consequence of the learner's own
// click/keydown handler already running synchronously, so this never runs
// before an interaction and never needs a separate "unlock" step.

import type { PlaceResult } from "./go-rules";

export type SoundEvent = "place" | "capture";

const MUTE_STORAGE_KEY = "learn-go:sound-muted";

let muted = loadMuted();
let audioContext: AudioContext | null = null;

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function hasStorage(): boolean {
  try {
    return hasWindow() && !!window.localStorage;
  } catch {
    return false;
  }
}

function loadMuted(): boolean {
  if (!hasStorage()) return false;
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function saveMuted(value: boolean): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, String(value));
  } catch {
    // localStorage unavailable (e.g. private browsing quota): mute state
    // simply doesn't persist across navigation.
  }
}

/** Pure decision function: which sounds a given move result should trigger, in order. No DOM, no audio — directly unit-testable. */
export function soundsFor(result: PlaceResult): SoundEvent[] {
  if (!result.ok) return [];
  return result.captured.length > 0 ? ["place", "capture"] : ["place"];
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  saveMuted(muted);
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}

function getContext(): AudioContext | null {
  if (!hasWindow()) return null;
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) return null;
  if (!audioContext) audioContext = new AudioContextCtor();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

interface ClickParams {
  frequency: number;
  duration: number;
  gain: number;
}

const PLACE_PARAMS: ClickParams = { frequency: 2400, duration: 0.07, gain: 0.5 };
const CAPTURE_PARAMS: ClickParams = { frequency: 1200, duration: 0.11, gain: 0.4 };

// A brief burst of filtered noise reads as a dry, tactile "click" rather than
// a tonal beep — closer to a stone's percussive contact than any oscillator
// waveform would give.
function playClick(context: AudioContext, params: ClickParams): void {
  const sampleCount = Math.ceil(context.sampleRate * params.duration);
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
  }

  const source = context.createBufferSource();
  source.buffer = buffer;

  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = params.frequency;
  filter.Q.value = 1.1;

  const gain = context.createGain();
  const now = context.currentTime;
  gain.gain.setValueAtTime(params.gain, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + params.duration);

  source.connect(filter).connect(gain).connect(context.destination);
  source.start(now);
  source.stop(now + params.duration);
}

function playSound(sound: SoundEvent): void {
  if (muted) return;
  const context = getContext();
  if (!context) return;
  playClick(context, sound === "place" ? PLACE_PARAMS : CAPTURE_PARAMS);
}

/**
 * Central hook every lesson controller calls with its placeStone() result.
 * A rejected move plays nothing; an accepted move plays its placement click
 * immediately, followed by a short natural delay and a capture click if the
 * move actually removed stones.
 */
export function notifyMoveResult(result: PlaceResult): void {
  const sounds = soundsFor(result);
  if (sounds.length === 0) return;
  playSound("place");
  if (sounds.includes("capture")) {
    if (hasWindow()) {
      window.setTimeout(() => playSound("capture"), 90);
    } else {
      playSound("capture");
    }
  }
}

/** Wires a mute/unmute toggle button up to the shared mute state, syncing its label and pressed state immediately and on every click. */
export function mountSoundToggle(button: HTMLButtonElement | null): void {
  if (!button) return;
  const sync = (): void => {
    button.textContent = muted ? "Sound: off" : "Sound: on";
    button.setAttribute("aria-pressed", String(muted));
    button.setAttribute(
      "aria-label",
      muted ? "Sound effects muted. Activate to unmute." : "Sound effects on. Activate to mute.",
    );
  };
  sync();
  button.addEventListener("click", () => {
    toggleMuted();
    sync();
  });
}
