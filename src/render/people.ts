// Procedural pixel characters. Built from outlined rects so poses, palettes and
// hairstyles can vary without hand-authoring every frame.
import { PAL, rect, rrect, px, type Ctx } from './pix';

export interface Look {
  hair: string;
  hairL: string;
  skin: string;
  skinD: string;
  top: string;
  topD: string;
  pants: string;
  style: 'bob' | 'short' | 'bun' | 'cap' | 'long';
  accent?: string;
}

export const LOOKS: Record<string, Look> = {
  me: { hair: PAL.hair, hairL: PAL.hairL, skin: PAL.skin, skinD: PAL.skinD, top: PAL.teal, topD: PAL.tealD, pants: PAL.dusk, style: 'bob' },
  manager: { hair: '#2a2330', hairL: '#4a4050', skin: '#e8b48c', skinD: '#c98f6c', top: '#5b6bb5', topD: '#3d4a8a', pants: '#2b2d4a', style: 'short', accent: PAL.white },
  bori: { hair: '#b0673a', hairL: '#d08a58', skin: PAL.skin, skinD: PAL.skinD, top: '#f0a64a', topD: '#c47a30', pants: '#4a3a5a', style: 'bun' },
  doyun: { hair: '#1c1c28', hairL: '#3a3a50', skin: '#e0a882', skinD: '#bf8866', top: '#3fae6f', topD: '#23664e', pants: '#2b2d4a', style: 'cap', accent: PAL.red },
  min: { hair: '#5b3927', hairL: '#8a5a3c', skin: PAL.skin, skinD: PAL.skinD, top: PAL.tealL, topD: PAL.teal, pants: PAL.dusk, style: 'long' },
};

export type Pose = 'phone' | 'raise' | 'type' | 'cheer' | 'idle' | 'tablet' | 'point' | 'back';

function hair(c: Ctx, x: number, y: number, L: Look, back: boolean): void {
  // x,y = head box top-left (12x11 incl. outline)
  if (L.style === 'long' || (L.style === 'bob' && back)) {
    rrect(c, x - 1, y + 2, 14, 11, L.hair);
  }
  rrect(c, x - 1, y - 1, 14, 7, L.hair);
  rect(c, x + 2, y, 8, 1, L.hairL);
  if (L.style === 'bob') {
    rect(c, x - 1, y + 4, 3, 6, PAL.ink);
    rect(c, x, y + 4, 2, 5, L.hair);
    rect(c, x + 10, y + 4, 3, 6, PAL.ink);
    rect(c, x + 10, y + 4, 2, 5, L.hair);
    // fringe
    rect(c, x + 2, y + 4, 3, 1, L.hair);
    rect(c, x + 7, y + 4, 2, 1, L.hair);
  } else if (L.style === 'bun') {
    rrect(c, x + 3, y - 5, 6, 5, L.hair);
    px(c, x + 5, y - 4, L.hairL);
    rect(c, x + 1, y + 4, 2, 2, L.hair);
    rect(c, x + 9, y + 4, 2, 2, L.hair);
  } else if (L.style === 'cap') {
    rrect(c, x - 1, y - 2, 14, 6, L.accent ?? PAL.red);
    rect(c, x + 8, y + 3, 7, 2, PAL.ink);
    rect(c, x + 9, y + 3, 5, 1, L.accent ?? PAL.red);
    rect(c, x + 1, y + 4, 2, 2, L.hair);
  } else {
    rect(c, x + 1, y + 4, 2, 1, L.hair);
    rect(c, x + 9, y + 4, 2, 1, L.hair);
  }
}

function face(c: Ctx, x: number, y: number, L: Look, blink: boolean, happy: boolean): void {
  rrect(c, x, y + 1, 12, 11, L.skin);
  // shading under hair
  rect(c, x + 1, y + 5, 10, 1, L.skinD);
  if (blink) {
    rect(c, x + 3, y + 7, 2, 1, PAL.ink);
    rect(c, x + 7, y + 7, 2, 1, PAL.ink);
  } else if (happy) {
    px(c, x + 3, y + 7, PAL.ink);
    px(c, x + 4, y + 6, PAL.ink);
    px(c, x + 5, y + 7, PAL.ink);
    px(c, x + 7, y + 7, PAL.ink);
    px(c, x + 8, y + 6, PAL.ink);
    px(c, x + 9, y + 7, PAL.ink);
  } else {
    rect(c, x + 3, y + 6, 2, 2, PAL.ink);
    rect(c, x + 7, y + 6, 2, 2, PAL.ink);
    px(c, x + 3, y + 6, PAL.white);
    px(c, x + 7, y + 6, PAL.white);
  }
  px(c, x + 2, y + 9, PAL.pinkL);
  px(c, x + 9, y + 9, PAL.pinkL);
  if (happy) {
    rect(c, x + 5, y + 9, 2, 1, PAL.redD);
    px(c, x + 4, y + 8, PAL.redD);
    px(c, x + 7, y + 8, PAL.redD);
  } else {
    rect(c, x + 5, y + 9, 2, 1, L.skinD);
  }
}

/**
 * Seated upper body (protagonist at the desk). (x, y) = head box top-left.
 * The desk is drawn afterwards and hides everything below y+24.
 */
export function drawSeated(c: Ctx, x: number, y: number, L: Look, pose: Pose, t: number, opts: { blink?: boolean; happy?: boolean; screen?: string } = {}): void {
  const bob = pose === 'cheer' ? -1 : Math.sin(t * 2.2) > 0.6 ? 1 : 0;
  y += bob;
  if (pose === 'back') {
    // seen from behind
    rrect(c, x - 2, y + 11, 16, 14, L.top);
    rect(c, x + 1, y + 12, 10, 1, L.topD);
    hair(c, x, y, L, true);
    rrect(c, x - 1, y, 14, 12, L.hair);
    rect(c, x + 2, y + 1, 8, 1, L.hairL);
    return;
  }
  // body
  rrect(c, x - 2, y + 11, 16, 14, L.top);
  rect(c, x - 1, y + 12, 14, 1, L.topD);
  rect(c, x + 3, y + 12, 6, 2, L.topD);
  px(c, x + 4, y + 14, PAL.white);
  px(c, x + 7, y + 14, PAL.white);
  rect(c, x + 5, y + 11, 2, 1, L.skinD);
  // arms
  const screen = opts.screen ?? PAL.skyPale;
  if (pose === 'phone') {
    rect(c, x - 2, y + 16, 3, 6, L.topD);
    rect(c, x + 11, y + 16, 3, 6, L.topD);
    rrect(c, x + 3, y + 15, 6, 8, PAL.grayDD);
    rect(c, x + 4, y + 16, 4, 5, screen);
    rect(c, x + 1, y + 19, 3, 3, L.skin);
    rect(c, x + 8, y + 19, 3, 3, L.skin);
  } else if (pose === 'raise') {
    rect(c, x - 2, y + 16, 3, 6, L.topD);
    rect(c, x + 12, y + 7, 3, 9, L.topD);
    rrect(c, x + 12, y + 1, 6, 8, PAL.grayDD);
    rect(c, x + 13, y + 2, 4, 5, screen);
    rect(c, x + 12, y + 7, 3, 3, L.skin);
  } else if (pose === 'cheer') {
    rect(c, x - 4, y + 4, 3, 10, L.topD);
    rect(c, x + 13, y + 4, 3, 10, L.topD);
    rect(c, x - 4, y + 2, 3, 3, L.skin);
    rect(c, x + 13, y + 2, 3, 3, L.skin);
  } else if (pose === 'type') {
    rect(c, x - 3, y + 17, 3, 6, L.topD);
    rect(c, x + 12, y + 17, 3, 6, L.topD);
    rect(c, x - 1, y + 22, 3, 2, L.skin);
    rect(c, x + 10, y + 22, 3, 2, L.skin);
  } else {
    rect(c, x - 2, y + 16, 3, 7, L.topD);
    rect(c, x + 11, y + 16, 3, 7, L.topD);
  }
  hair(c, x, y, L, true);
  face(c, x, y, L, !!opts.blink, !!opts.happy);
  hair(c, x, y, L, false);
}

/** Standing full-body figure, ~14x26. (x,y) = head box top-left. */
export function drawStanding(c: Ctx, x: number, y: number, L: Look, pose: Pose, t: number, opts: { blink?: boolean; happy?: boolean; flip?: boolean } = {}): void {
  const bob = Math.sin(t * 2) > 0.7 ? 1 : 0;
  // legs
  rect(c, x + 2, y + 21, 3, 6, PAL.ink);
  rect(c, x + 7, y + 21, 3, 6, PAL.ink);
  rect(c, x + 3, y + 21, 1, 5, L.pants);
  rect(c, x + 8, y + 21, 1, 5, L.pants);
  rect(c, x + 1, y + 26, 4, 1, PAL.ink);
  rect(c, x + 7, y + 26, 4, 1, PAL.ink);
  y += bob;
  rrect(c, x - 1, y + 11, 14, 12, L.top);
  rect(c, x, y + 12, 12, 1, L.topD);
  rect(c, x + 5, y + 11, 2, 1, L.skinD);
  if (pose === 'tablet') {
    rect(c, x - 2, y + 13, 3, 7, L.topD);
    rect(c, x + 11, y + 13, 3, 6, L.topD);
    rrect(c, x + 2, y + 14, 9, 7, PAL.grayDD);
    const on = Math.sin(t * 5) > 0;
    rect(c, x + 3, y + 15, 7, 5, on ? PAL.tealL : PAL.skyPale);
    rect(c, x + 1, y + 18, 2, 2, L.skin);
    rect(c, x + 10, y + 18, 2, 2, L.skin);
  } else if (pose === 'point') {
    const side = opts.flip ? -1 : 1;
    rect(c, side > 0 ? x - 2 : x + 11, y + 13, 3, 8, L.topD);
    // raised arm towards the board
    const ax = side > 0 ? x + 11 : x - 5;
    rect(c, ax, y + 9, 6, 3, L.topD);
    rect(c, side > 0 ? ax + 5 : ax - 1, y + 8, 2, 3, L.skin);
  } else if (pose === 'cheer') {
    rect(c, x - 3, y + 5, 3, 9, L.topD);
    rect(c, x + 12, y + 5, 3, 9, L.topD);
    rect(c, x - 3, y + 3, 3, 3, L.skin);
    rect(c, x + 12, y + 3, 3, 3, L.skin);
  } else {
    rect(c, x - 2, y + 13, 3, 8, L.topD);
    rect(c, x + 11, y + 13, 3, 8, L.topD);
    rect(c, x - 2, y + 20, 3, 2, L.skin);
    rect(c, x + 11, y + 20, 3, 2, L.skin);
  }
  hair(c, x, y, L, true);
  face(c, x, y, L, !!opts.blink, !!opts.happy);
  hair(c, x, y, L, false);
}

/** 3x7 tiny person for city streets. */
export function drawTiny(c: Ctx, x: number, y: number, top: string, hairCol: string, frame: number): void {
  px(c, x + 1, y, hairCol);
  px(c, x + 1, y + 1, PAL.skin);
  rect(c, x, y + 2, 3, 3, top);
  if (frame % 2 === 0) {
    px(c, x, y + 5, PAL.ink);
    px(c, x + 2, y + 6, PAL.ink);
  } else {
    px(c, x + 2, y + 5, PAL.ink);
    px(c, x, y + 6, PAL.ink);
  }
  px(c, x + 1, y + 5, PAL.ink);
}
