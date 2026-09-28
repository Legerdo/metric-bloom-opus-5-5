import { afterEach, describe, expect, it } from 'vitest';
import { fmt, fmtClock, fmtTime, setNumberStyle } from '../src/util/format';

afterEach(() => setNumberStyle('ko'));

describe('number formatting', () => {
  it('uses Korean myriad units by default', () => {
    expect(fmt(0)).toBe('0');
    expect(fmt(999)).toBe('999');
    expect(fmt(9999)).toBe('9,999');
    expect(fmt(12345)).toBe('1.23만');
    expect(fmt(3.4e8)).toBe('3.4억');
    expect(fmt(2e12)).toBe('2조');
  });

  it('never rounds up past what you have', () => {
    expect(fmt(19999)).toBe('1.99만');
  });

  it('supports K/M/B and scientific styles', () => {
    setNumberStyle('intl');
    expect(fmt(12500)).toBe('12.5K');
    expect(fmt(3.4e8)).toBe('340M');
    setNumberStyle('sci');
    expect(fmt(3.4e8)).toBe('3.4e8');
  });

  it('handles huge, invalid and fractional values', () => {
    expect(fmt(1e60)).toMatch(/e60$/);
    expect(fmt(NaN)).toBe('0');
    expect(fmt(Infinity)).toBe('∞');
    expect(fmt(1.234, true)).toBe('1.23');
    expect(fmt(-5)).toBe('-5');
  });

  it('formats time', () => {
    expect(fmtTime(59)).toBe('59초');
    expect(fmtTime(125)).toBe('2분 5초');
    expect(fmtTime(3725)).toBe('1시간 2분');
    expect(fmtClock(3725)).toBe('1:02:05');
  });
});
