/**
 * Sound effects (expo-audio, verified in the SDK 57 docs — included in Expo
 * Go, so no dev build needed).
 *
 * The clips are SYNTHESIZED, not sampled: `scripts/build-sounds.sh` builds
 * them with ffmpeg as plucked sine tones in A minor pentatonic. That keeps
 * them unambiguously ours to ship in a paid app (no stock-library licence
 * to honour), keeps them tiny, and lets them match the design — dark and
 * sharp rather than the cinematic whoosh every free SFX pack is full of.
 * Pitch rises with significance: tick < set done < go < workout done < PR.
 *
 * Two rules this module exists to enforce:
 *  1. NEVER interrupt the user's music. People lift to Spotify; an app that
 *     pauses it to go "ding" gets uninstalled. The audio mode is set to mix
 *     with others, so our blips layer on top.
 *  2. Players are created ONCE and reused. Building an AudioPlayer per set
 *     would leak native players over a long session.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

export type SoundName = "setDone" | "restTick" | "restGo" | "workoutDone" | "pr";

const SOURCES: Record<SoundName, number> = {
  setDone: require("../../assets/sounds/set-done.m4a"),
  restTick: require("../../assets/sounds/rest-tick.m4a"),
  restGo: require("../../assets/sounds/rest-go.m4a"),
  workoutDone: require("../../assets/sounds/workout-done.m4a"),
  pr: require("../../assets/sounds/pr.m4a"),
};

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let modeSet = false;
let enabled = true;

/** Mirrors `Settings.sound`; the store pushes it here on load and on change. */
export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

export function soundEnabled(): boolean {
  return enabled;
}

async function ensureMode(): Promise<void> {
  if (modeSet) return;
  modeSet = true;
  try {
    await setAudioModeAsync({
      // Play through the silent switch: someone in a gym with their phone on
      // silent still wants the rest timer.
      playsInSilentMode: true,
      // The whole point — layer over the user's music instead of pausing it.
      interruptionMode: "mixWithOthers",
      shouldPlayInBackground: false,
    });
  } catch {
    // An audio-mode failure must never break logging a set.
  }
}

/**
 * Fire a sound. Safe to call from anywhere: silent when muted, never throws,
 * never awaited by the UI.
 */
export function play(name: SoundName): void {
  if (!enabled) return;
  void ensureMode();
  try {
    let p = players[name];
    if (!p) {
      p = createAudioPlayer(SOURCES[name]);
      players[name] = p;
    }
    // Rewind first: tapping through sets faster than a clip is long must
    // retrigger it, not be swallowed because the player is already at the end.
    p.seekTo(0);
    p.play();
  } catch {
    // Ignore — audio is a garnish, not a feature anything depends on.
  }
}

/**
 * The rest-timer countdown. Called every second with the seconds remaining;
 * ticks at 3-2-1 and lands on "go" at zero. Idempotent per second — the
 * caller may re-render freely.
 */
let lastCounted: number | null = null;

export function countdown(secondsLeft: number): void {
  if (!enabled) return;
  if (lastCounted === secondsLeft) return;
  lastCounted = secondsLeft;
  if (secondsLeft === 3 || secondsLeft === 2 || secondsLeft === 1) play("restTick");
}

/** Reset between rests so the next one counts from scratch. */
export function resetCountdown(): void {
  lastCounted = null;
}
