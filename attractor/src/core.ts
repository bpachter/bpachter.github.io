/* The Great Attractor — shared core.
   Concatenated ahead of each page file by build.sh (no module system: plain
   script scope, works from file:// and Pages alike). Palette is read from the
   CSS tokens so style.css stays the single source of truth. */

type Ctx = CanvasRenderingContext2D;
type P3 = [number, number, number];

const $ = <T extends Element = HTMLElement>(s: string, el?: Element | Document): T =>
  (el || document).querySelector(s) as T;
const $$ = <T extends Element = HTMLElement>(s: string, el?: Element | Document): T[] =>
  Array.prototype.slice.call((el || document).querySelectorAll(s));

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const __cs = getComputedStyle(document.documentElement);
const tok = (n: string, fb: string): string => (__cs.getPropertyValue(n) || fb).trim() || fb;
const TEAL = tok('--teal', '#2dd4bf');
const TEAL_B = tok('--teal-bright', '#5eead4');
const VIOLET = tok('--violet', '#8b7cf8');
const SKY = tok('--sky', '#38bdf8');
const GOLD = tok('--gold', '#f0c96c');
const STAR_C = tok('--star', '#e9f1fc');
const FAINT = tok('--faint', '#6f8199');
const LINE_C = tok('--line', '#1b2940');

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const fmt = (n: number, d?: number): string => n.toFixed(d === undefined ? 2 : d);
const TAU = Math.PI * 2;

/** Deterministic rng so every visitor sees the same universe. */
function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng: () => number): number {
  return (rng() + rng() + rng() + rng() - 2) * 1.732;
}

/** Size a canvas to its CSS box at devicePixelRatio; returns [ctx, cssW, cssH]. */
function fit(cv: HTMLCanvasElement): [Ctx, number, number] {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect();
  const w = Math.max(10, Math.round(r.width));
  const h = Math.max(10, Math.round(r.height));
  const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  const ctx = cv.getContext('2d') as Ctx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [ctx, w, h];
}

function arrow(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, width: number): void {
  const a = Math.atan2(y2 - y1, x2 - x1), hl = 5 + width * 2;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - hl * Math.cos(a - 0.42), y2 - hl * Math.sin(a - 0.42));
  ctx.lineTo(x2 - hl * Math.cos(a + 0.42), y2 - hl * Math.sin(a + 0.42));
  ctx.closePath(); ctx.fill();
}

/* ---------- scroll plumbing ---------- */
const revealIO = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); }
}), { threshold: 0.12 });
addEventListener('DOMContentLoaded', () => { $$('.reveal').forEach(el => revealIO.observe(el)); });

function visible(el: Element, cb: (v: boolean) => void): void {
  new IntersectionObserver(es => es.forEach(e => cb(e.isIntersecting)), { threshold: 0.05 }).observe(el);
}

/** Run a rAF draw loop only while el is on screen. */
function loopWhenVisible(el: Element, draw: (t: number) => void): void {
  let on = false, raf = 0;
  const tick = (t: number): void => { if (!on) return; draw(t); raf = requestAnimationFrame(tick); };
  visible(el, v => {
    if (v && !on) { on = true; raf = requestAnimationFrame(tick); }
    else if (!v && on) { on = false; cancelAnimationFrame(raf); }
  });
}

/** Fire cb once, shortly after el first scrolls into view (the auto-demo). */
function autoOnView(el: Element, cb: () => void, delayMs = 700): void {
  let fired = false;
  visible(el, v => { if (v && !fired) { fired = true; setTimeout(cb, delayMs); } });
}

/** Track "the user has taken over" — any pointer/slider interaction inside el. */
function userTouch(el: Element, onTouch?: () => void): { touched: boolean } {
  const st = { touched: false };
  const mark = (): void => { if (!st.touched) { st.touched = true; if (onTouch) onTouch(); } };
  (['pointerdown', 'input'] as const).forEach(ev =>
    el.addEventListener(ev, mark, { passive: true }));
  return st;
}

/* ---------- tiny 3-D ---------- */
interface Cam { yaw: number; pitch: number; cx: number; cy: number; scale: number; dist: number; }
function project(cam: Cam, p: P3): P3 {
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const x = p[0] * cy - p[2] * sy;
  let z = p[0] * sy + p[2] * cy;
  const y = p[1] * cp - z * sp;
  z = p[1] * sp + z * cp;
  const d = cam.dist / (cam.dist + z);
  return [cam.cx + x * cam.scale * d, cam.cy + y * cam.scale * d, d];
}
function orbit(cv: HTMLCanvasElement, cam: Cam): { dragging: boolean; everDragged: boolean } {
  const st = { dragging: false, everDragged: false };
  let px = 0, py = 0;
  cv.addEventListener('pointerdown', e => {
    st.dragging = true; st.everDragged = true; px = e.clientX; py = e.clientY;
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    if (!st.dragging) return;
    cam.yaw += (e.clientX - px) * 0.008;
    cam.pitch = clamp(cam.pitch + (e.clientY - py) * 0.006, -1.35, 1.35);
    px = e.clientX; py = e.clientY;
  });
  const up = (): void => { st.dragging = false; };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  return st;
}
