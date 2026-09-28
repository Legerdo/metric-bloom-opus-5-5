// Pixel icons for the DOM UI, rendered once to data URLs.
import { PAL } from '../render/pix';

const MAP: Record<string, string> = {
  k: PAL.ink,
  p: PAL.pink,
  P: PAL.pinkL,
  w: PAL.white,
  t: PAL.teal,
  T: PAL.tealL,
  g: PAL.greenL,
  G: PAL.green,
  e: PAL.green,
  E: PAL.greenL,
  y: PAL.lamp,
  o: PAL.orange,
  r: PAL.red,
  v: PAL.violet,
  V: PAL.lavender,
  s: PAL.skin,
  c: PAL.cream,
  a: PAL.gray,
};

export const ICONS: Record<string, string[]> = {
  heart: ['.kkk.kkk.', 'kpwpkpppk', 'kpppppppk', 'kpppppppk', '.kpppppk.', '..kpppk..', '...kpk...', '....k....'],
  follower: ['...kkk...', '..kttTk..', '..ktttk..', '...kkk...', '..kkkkk..', '.ktttttk.', 'ktttttttk', 'ktttttttk', 'kkkkkkkkk'],
  bond: ['.kkkkkkk.', 'kGGGGGGGk', 'kGgggggGk', 'kgwgwgwgk', 'kgggggggk', '.kkkggkk.', '....kgk..', '.....kk..'],
  seed: ['.kk...kk.', 'kEEk.kEEk', 'kEeEkEeEk', '.kEEkEEk.', '..kkekk..', '....e....', '..kkkkk..', '.koooook.', '..kkkkk..'],
  creator: ['......kk.', '.....kPPk', '....kyykk', '...kyyyk.', '..kyyyk..', '.kyyyk...', '.kwyk....', 'kkkk.....', '.........'],
  community: ['....k....', '...kpk...', '..kpppk..', '.kpppppk.', 'kkkkkkkkk', '.kwwkyyk.', '.kwwkyyk.', '.kkkkkkk.'],
  heat: ['....k....', '...kok...', '..kook...', '..koyok..', '.koyyyok.', '.koyyyok.', '..koyok..', '...kkk...'],
  depth: ['......kk.', '....kkEEk', '...kEEEEk', '..kEEeEk.', '.kEEeEEk.', '.kEeEEk..', '.kekkk...', 'kek......', 'kk.......'],
  novel: ['....k....', '...kTk...', 'kkkTTTkkk', '.kTTwTTk.', '..kTTTk..', '.kTk.kTk.', '.kk...kk.'],
  close: ['.kk...kk.', 'kPPk.kTTk', 'kPPk.kTTk', '.kk...kk.', 'kkkk.kkkk', 'kppkkkttk', 'kpppktttk', 'kkkkkkkkk'],
  gear: ['...kkk...', '.k.kak.k.', 'kakaaakak', '.kaakaak.', 'kaak.kaak', '.kaakaak.', 'kakaaakak', '.k.kak.k.', '...kkk...'],
  lock: ['..kkkkk..', '.kk...kk.', '.k.....k.', 'kkkkkkkkk', 'kyyyyyyyk', 'kyyykyyyk', 'kyyykyyyk', 'kyyyyyyyk', 'kkkkkkkkk'],
  bell: ['....k....', '...kyk...', '..kyyyk..', '..kyyyk..', '.kyyyyyk.', '.kyyyyyk.', 'kkkkkkkkk', '....k....'],
  clock: ['..kkkkk..', '.kwwwwwk.', 'kwwwkwwwk', 'kwwwkwwwk', 'kwwwkkkwk', 'kwwwwwwwk', '.kwwwwwk.', '..kkkkk..'],
  lamp: ['..kkkkk..', '.kyyyyyk.', 'kyyyyyyyk', 'kkkkkkkkk', '....k....', '....k....', '..kkkkk..'],
  text: ['kkkkkkk..', 'kwwwwwkk.', 'kwkkkwwkk', 'kwwwwwwwk', 'kwkkkkkwk', 'kwwwwwwwk', 'kwkkkwwwk', 'kwwwwwwwk', 'kkkkkkkkk'],
  photo: ['.kkk.....', 'kkkkkkkkk', 'kaaakkkak', 'kaakTTkak', 'kaakTTkak', 'kaaakkaak', 'kkkkkkkkk'],
  video: ['kkkkkkkkk', 'kvvvvvvvk', 'kvvwvvvvk', 'kvvwwvvvk', 'kvvwwwvvk', 'kvvwwvvvk', 'kvvwvvvvk', 'kkkkkkkkk'],
  live: ['...kkk...', '..krrrk..', '..krwrk..', '..krrrk..', '.k.kkk.k.', '.kk...kk.', '..kkkkk..', '....k....', '..kkkkk..'],
  bloom: ['..k...k..', '.kpk.kok.', '.kppkook.', '..kkykk..', '.kttkeek.', '.ktk.kek.', '..k...k..'],
  chip: ['.k.k.k.k.', 'kkkkkkkkk', '.kvvvvvk.', 'kkvVVVvkk', '.kvVVVvk.', 'kkvvvvvkk', '.kkkkkkk.', '.k.k.k.k.'],
  star: ['....k....', '...kyk...', 'kkkyyykkk', '.kyywyyk.', '..kyyyk..', '.kyk.kyk.', '.kk...kk.'],
  trend: ['.kk.kk...', '.ky.ky...', 'kkkkkkk..', '.ky.ky...', 'kkkkkkk..', '.ky.ky...', '.kk.kk...'],
  sound: ['...k.....', '..kk..k..', 'kkyk...k.', 'kyyk.k.k.', 'kyyk.k.k.', 'kkyk...k.', '..kk..k..', '...k.....'],
};

const cache = new Map<string, string>();

export function iconURL(name: string, scale = 2): string {
  const key = name + '@' + scale;
  const hit = cache.get(key);
  if (hit) return hit;
  const rows = ICONS[name] ?? ICONS.star;
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const cv = document.createElement('canvas');
  cv.width = w * scale;
  cv.height = h * scale;
  const c = cv.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      const col = MAP[ch];
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  const url = cv.toDataURL();
  cache.set(key, url);
  return url;
}

export function icon(name: string, scale = 2, cls = 'ico'): HTMLImageElement {
  const img = document.createElement('img');
  img.src = iconURL(name, scale);
  img.className = cls;
  img.alt = '';
  img.draggable = false;
  return img;
}

/** 9-slice pixel frame as a data URL for CSS border-image. */
export function frameURL(fill: string, line: string, hi: string, sh: string): string {
  const key = `frame:${fill}:${line}:${hi}:${sh}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const n = 8;
  const cv = document.createElement('canvas');
  cv.width = n;
  cv.height = n;
  const c = cv.getContext('2d')!;
  c.fillStyle = line;
  c.fillRect(1, 0, n - 2, n);
  c.fillRect(0, 1, n, n - 2);
  c.fillStyle = fill;
  c.fillRect(1, 1, n - 2, n - 2);
  c.fillStyle = hi;
  c.fillRect(1, 1, n - 2, 1);
  c.fillRect(1, 1, 1, n - 2);
  c.fillStyle = sh;
  c.fillRect(1, n - 2, n - 2, 1);
  c.fillRect(n - 2, 1, 1, n - 2);
  const url = cv.toDataURL();
  cache.set(key, url);
  return url;
}
