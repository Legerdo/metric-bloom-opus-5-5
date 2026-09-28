import { describe, expect, it } from 'vitest';
import { createGame } from '../src/econ/state';
import { decodeImport, deserialize, encodeExport, loadFrom, saveTo, serialize, BACKUP_KEY, SAVE_KEY, type StorageLike } from '../src/econ/save';
import { runBot } from '../src/sim/bot';
import { derive } from '../src/econ/calc';
import { tick } from '../src/econ/engine';

class MemStorage implements StorageLike {
  m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

describe('save / load', () => {
  it('round-trips a late-game state exactly', () => {
    const res = runBot('typical', 240, 99, (s) => s.run.net && s.run.creators > 1000);
    const s = res.state;
    const back = deserialize(serialize(s), 0)!;
    expect(back).not.toBeNull();
    expect(back.run).toEqual(s.run);
    expect(back.meta).toEqual(s.meta);
    expect(derive(back).hps).toBeCloseTo(derive(s).hps, 6);
    // and keeps simulating identically
    tick(s, 0.1);
    tick(back, 0.1);
    expect(back.run.hearts).toBeCloseTo(s.run.hearts, 6);
  });

  it('survives corrupted and partial data', () => {
    expect(deserialize('not json')).toBeNull();
    const partial = deserialize(JSON.stringify({ v: 1, run: { hearts: 'x', followers: -5, lines: { text: 3 } } }), 0)!;
    expect(partial.run.hearts).toBe(0);
    expect(partial.run.followers).toBe(0);
    expect(partial.run.lines.text).toBe(3);
    const nan = deserialize(JSON.stringify({ v: 1, run: { hearts: null, bond: 1e400 } }), 0)!;
    expect(Number.isFinite(nan.run.hearts)).toBe(true);
    expect(Number.isFinite(nan.run.bond)).toBe(true);
  });

  it('migrates an older schema without meta', () => {
    const s = deserialize(JSON.stringify({ v: 0, run: { hearts: 50 } }), 0)!;
    expect(s.run.hearts).toBe(50);
    expect(s.meta.runs).toBe(0);
  });

  it('falls back to the backup save when the main one is broken', () => {
    const st = new MemStorage();
    const s = createGame(1, 0);
    s.run.hearts = 77;
    saveTo(st, s);
    s.run.hearts = 88;
    saveTo(st, s);
    st.setItem(SAVE_KEY, '{broken');
    const r = loadFrom(st, 0);
    expect(r.source).toBe('backup');
    expect(r.state.run.hearts).toBe(77);
    expect(st.getItem(BACKUP_KEY)).not.toBeNull();
  });

  it('export / import codes round-trip, including Korean text', () => {
    const s = createGame(5, 0);
    s.run.trend.tag = '#퇴근길하늘';
    s.run.hearts = 123;
    const code = encodeExport(s);
    expect(code.startsWith('MB1:')).toBe(true);
    const back = decodeImport(code, 0)!;
    expect(back.run.trend.tag).toBe('#퇴근길하늘');
    expect(back.run.hearts).toBe(123);
    expect(decodeImport('MB1:%%%')).toBeNull();
  });
});
