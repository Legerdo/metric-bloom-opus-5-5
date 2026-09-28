// Reusable pixel UI widgets. Each keeps references to its dynamic nodes so the
// UI can update numbers at ~8 Hz without rebuilding DOM (keeps hover/focus).
import { fmt, fmtTime } from '../util/format';
import { h, setClass, setText } from './dom';
import { icon } from './icons';

export class CostBtn {
  el: HTMLButtonElement;
  private lab: HTMLSpanElement;
  private hWrap: HTMLSpanElement;
  private hVal: HTMLSpanElement;
  private bWrap: HTMLSpanElement;
  private bVal: HTMLSpanElement;
  private eta: HTMLSpanElement;

  constructor(label: string, onClick: () => void, cls = 'btn') {
    this.lab = h('span', { text: label });
    this.hVal = h('span');
    this.hWrap = h('span', { class: 'cw' }, icon('heart', 1), this.hVal);
    this.bVal = h('span');
    this.bWrap = h('span', { class: 'cw' }, icon('bond', 1), this.bVal);
    this.eta = h('span', { class: 'eta' });
    this.el = h('button', { class: cls, type: 'button', onclick: () => onClick() }, this.lab, this.hWrap, this.bWrap, this.eta);
  }

  set(label: string | null, hearts: number, bond: number, enabled: boolean, etaSec?: number): void {
    if (label !== null) setText(this.lab, label);
    this.hWrap.style.display = hearts > 0 ? '' : 'none';
    this.bWrap.style.display = bond > 0 ? '' : 'none';
    if (hearts > 0) setText(this.hVal, fmt(hearts));
    if (bond > 0) setText(this.bVal, fmt(bond));
    const showEta = !enabled && etaSec !== undefined && Number.isFinite(etaSec) && etaSec > 0 && etaSec < 3600 * 10;
    setText(this.eta, showEta ? `(${fmtTime(etaSec!)})` : '');
    if (this.el.disabled === enabled) this.el.disabled = !enabled;
  }
}

export class TextBtn {
  el: HTMLButtonElement;
  constructor(label: string, onClick: () => void, cls = 'btn', title?: string) {
    this.el = h('button', { class: cls, type: 'button', onclick: () => onClick(), title }, label);
  }
  set(label: string, enabled = true, selected = false): void {
    setText(this.el, label);
    if (this.el.disabled === enabled) this.el.disabled = !enabled;
    setClass(this.el, 'sel', selected);
  }
}

export interface CardRefs {
  el: HTMLDivElement;
  nm: HTMLSpanElement;
  lv: HTMLSpanElement;
  ds: HTMLDivElement;
  st: HTMLDivElement;
  btns: HTMLDivElement;
  right: HTMLDivElement;
}

export function card(iconName: string | null, name: string, desc: string): CardRefs {
  const lv = h('span', { class: 'lv' });
  const nm = h('span', { class: 'nm' }, name, ' ', lv);
  const right = h('div', { class: 'rt' });
  const ds = h('div', { class: 'ds', text: desc });
  const st = h('div', { class: 'st' });
  const btns = h('div', { class: 'btns' });
  const el = h('div', { class: 'card' }, iconName ? icon(iconName, 2) : h('span'), nm, right, ds, st, btns);
  return { el, nm, lv, ds, st, btns, right };
}

export function toggle(label: string, checked: boolean, onChange: (v: boolean) => void): { el: HTMLLabelElement; input: HTMLInputElement } {
  const input = h('input', { type: 'checkbox' }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  const el = h('label', { class: 'toggle' }, input, h('span', { text: label }));
  return { el, input };
}

export function bar(cls = ''): { el: HTMLDivElement; set: (f: number) => void } {
  const fill = h('i');
  const el = h('div', { class: 'bar ' + cls }, fill);
  let last = -1;
  return {
    el,
    set: (f: number) => {
      const v = Math.round(Math.max(0, Math.min(1, f)) * 200) / 2;
      if (v !== last) {
        last = v;
        fill.style.width = `${v}%`;
      }
    },
  };
}

export function section(title: string, iconName?: string, note?: string | Node): HTMLDivElement {
  return h(
    'div',
    { class: 'sec' },
    h('h3', {}, iconName ? icon(iconName, 2) : null, title),
    note ? (typeof note === 'string' ? h('p', { class: 'note', text: note }) : note) : null,
  );
}

export function selectRow<T extends string | number>(options: { v: T; label: string }[], get: () => T, set: (v: T) => void): { el: HTMLDivElement; update: () => void } {
  const btns = options.map((o) => new TextBtn(o.label, () => set(o.v)));
  const el = h('div', { class: 'select' }, ...btns.map((b) => b.el));
  return {
    el,
    update: () => {
      const cur = get();
      btns.forEach((b, i) => b.set(options[i].label, true, options[i].v === cur));
    },
  };
}
