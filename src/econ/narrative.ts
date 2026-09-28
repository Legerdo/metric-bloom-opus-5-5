import { ECHO_EPISODES, ECHO_ROUTES, echoRoute } from '../content/echo';
import type { GameState } from './state';

export interface NarrativeState {
  choices: string[];
  pending: boolean;
  elapsed: number;
}

export const createNarrative = (): NarrativeState => ({ choices: [], pending: false, elapsed: 0 });

export function pendingEpisode(s: GameState) {
  return s.meta.narrative.pending ? ECHO_EPISODES[s.meta.narrative.choices.length] : undefined;
}

/** Only time in the active game advances the story. Decisions never expire. */
export function advanceNarrative(s: GameState, dt: number, offline: boolean): string | null {
  const n = s.meta.narrative;
  if (offline || s.meta.ended || n.pending || n.choices.length >= ECHO_EPISODES.length) return null;
  n.elapsed = Math.min(3600, n.elapsed + dt);
  const automated = Object.values(s.run.lines).some((v) => v > 0) || s.run.net;
  const gate = [s.meta.peakFollowers >= 1000 && automated, s.meta.peakFollowers >= 5000, s.run.net || s.meta.peakFollowers >= 30000][n.choices.length];
  const delay = [15, 90, 120][n.choices.length];
  if (!gate || n.elapsed < delay) return null;
  n.pending = true;
  return ECHO_EPISODES[n.choices.length].id;
}

/** Reward calculations and UI text share the same route definitions. */
export function narrativeEffects(s: GameState) {
  const route = echoRoute(s.meta.narrative.choices);
  return route ? ECHO_ROUTES[route] : { manual: 1, hearts: 1, bond: 1, auto: 1 };
}
