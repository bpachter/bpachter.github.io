/* ─────────────────────────────────────────────────────────────
   Gradient · core.ts — shared helpers for every page.
   Hand-written TypeScript, zero runtime dependencies.
   Compiled per-page with `tsc --outFile` (see build.sh).
   ───────────────────────────────────────────────────────────── */

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];
type P3 = [number, number, number];

const $ = <T extends Element = HTMLElement>(s: string, el?: Element | Document): T =>
  (el || document).querySelector(s) as T;
const $$ = <T extends Element = HTMLElement>(s: string, el?: Element | Document): T[] =>
  Array.from((el || document).querySelectorAll(s)) as T[];

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* palette — mirrors style.css */
const INK = '#2d2a24', LEAF = '#8aae68', LEAF_D = '#55793c', SAGE = '#7d9070',
      SLATE = '#6b7fa3', GOLD = '#c9a227', PLUM = '#9a6fa0', FAINT = '#8a8171',
      PAPER = '#faf7f0', BAD = '#c05b4d', GOOD = '#5e8d5a';

function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
}

/* crisp canvases: logical size from width/height attrs, scaled for DPR */
function fit(cv: HTMLCanvasElement): [Ctx, number, number] {
  const w = cv.width, h = cv.height, dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = w * dpr; cv.height = h * dpr;
  const ctx = cv.getContext('2d')!;
  ctx.scale(dpr, dpr);
  return [ctx, w, h];
}

/* hand-drawn line: slight jitter, 2 passes */
function rough(ctx: Ctx, pts: Pt[], color: string, width: number, seed?: number): void {
  const rng = mulberry32(seed || 7);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    ctx.globalAlpha = pass ? 0.45 : 1;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const j = 1.2, x = p[0] + (rng() - 0.5) * j, y = p[1] + (rng() - 0.5) * j;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function arrow(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, width: number): void {
  rough(ctx, [[x1, y1], [x2, y2]], color, width, (x1 * 7 + y2) | 0);
  const a = Math.atan2(y2 - y1, x2 - x1), s = 9 + width * 1.5;
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
  ctx.moveTo(x2, y2); ctx.lineTo(x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45));
  ctx.moveTo(x2, y2); ctx.lineTo(x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45));
  ctx.stroke();
}
const fmt = (n: number, d?: number): string => n.toFixed(d === undefined ? 2 : d);

/* scroll reveals: decorations draw in; widgets drift up (JS-gated, safe) */
const revealIO = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('drawn', 'in'); revealIO.unobserve(e.target); }
}), { threshold: 0.25 });
$$('.draw-me').forEach(p => revealIO.observe(p));
$$('.widget, .part-card').forEach(el => { el.classList.add('fade-up'); revealIO.observe(el); });
setTimeout(() => $$('.hero .draw-me, .part-hero .draw-me').forEach(p => p.classList.add('drawn')), 300);

/* pause loops when offscreen */
function visible(el: Element, cb: (v: boolean) => void): void {
  new IntersectionObserver(es => cb(es[0].isIntersecting), { threshold: 0.05 }).observe(el);
}

/* run a demo once, hands-free, when the widget scrolls into view —
   unless the reader already touched it. every widget opts in with this. */
function autoOnView(el: Element, cb: () => void, delayMs = 700): void {
  if (reduced) return;
  let fired = false;
  const io = new IntersectionObserver(es => {
    if (es[0].isIntersecting && !fired) {
      fired = true; io.disconnect();
      window.setTimeout(cb, delayMs);
    }
  }, { threshold: 0.45 });
  io.observe(el);
}
/* marks a widget as user-owned the first time any control is touched */
function userTouch(el: Element, onTouch?: () => void): { touched: boolean } {
  const state = { touched: false };
  const mark = () => { if (!state.touched) { state.touched = true; if (onTouch) onTouch(); } };
  el.addEventListener('pointerdown', mark, { capture: true });
  el.addEventListener('input', mark, { capture: true });
  return state;
}

/* ---------- tiny 3-D engine (hand-rolled) ----------
   world: y is up. yaw spins about y, pitch tips toward the viewer.
   returns screen x, y and view-space depth (bigger = nearer). */
interface Cam { yaw: number; pitch: number; cx: number; cy: number; scale: number; dist: number; }
function project(cam: Cam, p: P3): P3 {
  const [x, y, z] = p;
  const ca = Math.cos(cam.yaw), sa = Math.sin(cam.yaw);
  const x1 = x * ca - z * sa, z1 = x * sa + z * ca;
  const cb = Math.cos(cam.pitch), sb = Math.sin(cam.pitch);
  const y2 = y * cb - z1 * sb, z2 = y * sb + z1 * cb;
  const per = cam.dist / (cam.dist + z2);
  return [cam.cx + x1 * cam.scale * per, cam.cy - y2 * cam.scale * per, per];
}
/* drag-to-orbit; returns cam and whether the user is (or has been) dragging */
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
    cam.pitch = Math.max(0.12, Math.min(1.25, cam.pitch + (e.clientY - py) * 0.006));
    px = e.clientX; py = e.clientY;
  });
  const up = () => { st.dragging = false; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  return st;
}
