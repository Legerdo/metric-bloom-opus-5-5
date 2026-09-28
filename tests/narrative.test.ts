import { describe, expect, it } from 'vitest';
import { ECHO_ROUTES, echoRoute } from '../src/content/echo';
import { endingData } from '../src/content/ending';
import { derive, replyBond } from '../src/econ/calc';
import { chooseStory, post, simulateOffline, tick, type Out } from '../src/econ/engine';
import { pendingEpisode } from '../src/econ/narrative';
import { deserialize, serialize } from '../src/econ/save';
import { runBot } from '../src/sim/bot';

function ready() {
  return runBot('typical', 60, 42, (s) => !!pendingEpisode(s)).state;
}

describe('ECHO narrative', () => {
  it('unfolds through normal growth, preserves an unanswered episode, and rejects duplicate or stale choices', () => {
    const s = ready();
    expect(pendingEpisode(s)?.id).toBe('draft');
    expect(s.meta.peakFollowers).toBeGreaterThanOrEqual(1000);
    const out: Out = [];
    for (let i = 0; i < 30; i++) tick(s, 1, out);
    expect(out.filter((e) => e.t === 'story')).toHaveLength(0);
    expect(chooseStory(s, 'inbox', 'pin')).toBe(false);
    expect(chooseStory(s, 'draft', 'voice')).toBe(false);
    const before = s.run.bondEarned;
    const reward = replyBond(s, 'normal', true) * 12;
    expect(chooseStory(s, 'draft', 'check')).toBe(true);
    expect(s.run.bondEarned - before).toBeCloseTo(reward);
    const saved = serialize(s);
    expect(chooseStory(s, 'draft', 'check')).toBe(false);
    expect(serialize(s)).toBe(saved);
    tick(s, 1);
    expect(pendingEpisode(s)).toBeUndefined();
  });

  it('does not consume events while offline or hidden and retains pending choices on reload', () => {
    const s = ready();
    chooseStory(s, 'draft', 'observe');
    const hearts = s.meta.totalHearts;
    simulateOffline(s, 1800);
    expect(s.meta.totalHearts).toBeGreaterThan(hearts);
    expect(s.meta.narrative).toEqual({ choices: ['observe'], pending: false, elapsed: 0 });
    tick(s, 120, undefined, { background: true });
    expect(s.meta.narrative.elapsed).toBe(0);
    const pending = ready();
    expect(deserialize(serialize(pending))!.meta.narrative).toEqual(pending.meta.narrative);
  });

  it('keeps old saves compatible and only restores a valid sequence of decisions', () => {
    const s = ready();
    const legacy = JSON.parse(serialize(s));
    delete legacy.meta.narrative;
    const restored = deserialize(JSON.stringify(legacy))!;
    expect(restored.run).toEqual(deserialize(serialize(s))!.run);
    expect(restored.meta.narrative).toEqual({ choices: [], pending: false, elapsed: 0 });
    legacy.meta.narrative = { choices: ['check', 'invalid', 'echo'], pending: true, elapsed: -1 };
    expect(deserialize(JSON.stringify(legacy))!.meta.narrative).toEqual({ choices: ['check'], pending: true, elapsed: 0 });
  });

  for (const route of ['voice', 'duet', 'echo'] as const) {
    it(`${route}: choices survive independence, alter the actual economy, and reach a distinct ending`, () => {
      let beforeIndependence: string[] = [];
      const result = runBot('typical', 180, 42, (s) => {
        const episode = pendingEpisode(s);
        if (episode) {
          const id = episode.id === 'identity' ? route : episode.choices[0].id;
          expect(chooseStory(s, episode.id, id)).toBe(true);
        }
        if (s.meta.runs === 0) beforeIndependence = [...s.meta.narrative.choices];
        if (s.meta.runs > 0) expect(s.meta.narrative.choices.slice(0, beforeIndependence.length)).toEqual(beforeIndependence);
        return false;
      });
      expect(result.nanSeen).toBe(false);
      expect(result.endTime).not.toBeNull();
      expect(result.endTime!).toBeLessThan(180 * 60);
      const s = result.state;
      expect(echoRoute(s.meta.narrative.choices)).toBe(route);
      expect(endingData(s).lines).toContain(ECHO_ROUTES[route].ending);
      const back = deserialize(serialize(s))!;
      expect(back.meta.narrative).toEqual(s.meta.narrative);
      const base = structuredClone(s);
      base.meta.narrative.choices = [];
      const actual = derive(s);
      const neutral = derive(base);
      const effect = ECHO_ROUTES[route];
      expect(actual.hps / neutral.hps).toBeCloseTo(effect.hearts * effect.auto);
      expect(replyBond(s, 'normal', true) / replyBond(base, 'normal', true)).toBeCloseTo(effect.bond * effect.manual);
      const h = s.run.hearts;
      post(s);
      expect((s.run.hearts - h) / (actual.manualHearts + actual.net.hps * 0.1 * (s.run.ups.n_spot ? 3 : 1) * effect.manual)).toBeCloseTo(1);
    }, 20000);
  }
});
