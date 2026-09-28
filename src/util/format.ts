// Number formatting. Korean myriad units (만/억/조/…) are the default because that
// is how Korean social apps show counts ("좋아요 1.2만").
export type NumberStyle = 'ko' | 'intl' | 'sci';

let style: NumberStyle = 'ko';
export function setNumberStyle(s: NumberStyle): void {
  style = s;
}
export function getNumberStyle(): NumberStyle {
  return style;
}

const KO_UNITS = ['', '만', '억', '조', '경', '해', '자', '양', '구', '간', '정', '재', '극'];
const INTL_UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

function groupInt(n: number): string {
  const s = Math.floor(n).toString();
  let outS = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) outS += ',';
    outS += s[i];
  }
  return outS;
}

function trimFixed(v: number, digits: number): string {
  // floor instead of round so a displayed amount is never more than you have
  const p = Math.pow(10, digits);
  const f = Math.floor(v * p + 1e-9) / p;
  return f.toFixed(digits).replace(/\.?0+$/, '');
}

function sci(n: number): string {
  const e = Math.floor(Math.log10(n));
  const m = n / Math.pow(10, e);
  return `${trimFixed(m, 2)}e${e}`;
}

/** Format a non-negative quantity. `frac` shows one decimal for small values. */
export function fmt(n: number, frac = false): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '0';
  if (n < 0) return '-' + fmt(-n, frac);
  if (n < 1000) {
    if (frac && n < 100) return trimFixed(n, n < 10 ? 2 : 1);
    return groupInt(n);
  }
  if (style === 'sci') return n < 1e6 ? groupInt(n) : sci(n);
  if (style === 'ko') {
    if (n < 1e4) return groupInt(n);
    const idx = Math.floor(Math.log10(n) / 4);
    if (idx >= KO_UNITS.length) return sci(n);
    const v = n / Math.pow(10, idx * 4);
    let body: string;
    if (v < 10) body = trimFixed(v, 2);
    else if (v < 100) body = trimFixed(v, 1);
    else if (v < 1000) body = Math.floor(v).toString();
    else body = groupInt(v);
    return body + KO_UNITS[idx];
  }
  const idx = Math.floor(Math.log10(n) / 3);
  if (idx >= INTL_UNITS.length) return sci(n);
  const v = n / Math.pow(10, idx * 3);
  const body = v < 10 ? trimFixed(v, 2) : v < 100 ? trimFixed(v, 1) : Math.floor(v).toString();
  return body + INTL_UNITS[idx];
}

/** Exact-ish long form for tooltips. */
export function fmtExact(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  if (n < 1e15) return groupInt(n);
  return sci(n);
}

export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—';
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

export function fmtClock(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
