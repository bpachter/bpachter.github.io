"use strict";
/* The Great Attractor — shared core.
   Concatenated ahead of each page file by build.sh (no module system: plain
   script scope, works from file:// and Pages alike). Palette is read from the
   CSS tokens so style.css stays the single source of truth. */
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.prototype.slice.call((el || document).querySelectorAll(s));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const __cs = getComputedStyle(document.documentElement);
const tok = (n, fb) => (__cs.getPropertyValue(n) || fb).trim() || fb;
const TEAL = tok('--teal', '#2dd4bf');
const TEAL_B = tok('--teal-bright', '#5eead4');
const VIOLET = tok('--violet', '#8b7cf8');
const SKY = tok('--sky', '#38bdf8');
const GOLD = tok('--gold', '#f0c96c');
const STAR_C = tok('--star', '#e9f1fc');
const FAINT = tok('--faint', '#6f8199');
const LINE_C = tok('--line', '#1b2940');
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const fmt = (n, d) => n.toFixed(d === undefined ? 2 : d);
const TAU = Math.PI * 2;
/** Deterministic rng so every visitor sees the same universe. */
function mulberry32(a) {
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function gauss(rng) {
    return (rng() + rng() + rng() + rng() - 2) * 1.732;
}
/** Size a canvas to its CSS box at devicePixelRatio; returns [ctx, cssW, cssH]. */
function fit(cv) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    const w = Math.max(10, Math.round(r.width));
    const h = Math.max(10, Math.round(r.height));
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (cv.width !== pw || cv.height !== ph) {
        cv.width = pw;
        cv.height = ph;
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [ctx, w, h];
}
function arrow(ctx, x1, y1, x2, y2, color, width) {
    const a = Math.atan2(y2 - y1, x2 - x1), hl = 5 + width * 2;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - hl * Math.cos(a - 0.42), y2 - hl * Math.sin(a - 0.42));
    ctx.lineTo(x2 - hl * Math.cos(a + 0.42), y2 - hl * Math.sin(a + 0.42));
    ctx.closePath();
    ctx.fill();
}
/* ---------- scroll plumbing ---------- */
const revealIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) {
        e.target.classList.add('in');
        revealIO.unobserve(e.target);
    }
}), { threshold: 0.12 });
addEventListener('DOMContentLoaded', () => { $$('.reveal').forEach(el => revealIO.observe(el)); });
function visible(el, cb) {
    new IntersectionObserver(es => es.forEach(e => cb(e.isIntersecting)), { threshold: 0.05 }).observe(el);
}
/** Run a rAF draw loop only while el is on screen. */
function loopWhenVisible(el, draw) {
    let on = false, raf = 0;
    const tick = (t) => { if (!on)
        return; draw(t); raf = requestAnimationFrame(tick); };
    visible(el, v => {
        if (v && !on) {
            on = true;
            raf = requestAnimationFrame(tick);
        }
        else if (!v && on) {
            on = false;
            cancelAnimationFrame(raf);
        }
    });
}
/** Fire cb once, shortly after el first scrolls into view (the auto-demo). */
function autoOnView(el, cb, delayMs = 700) {
    let fired = false;
    visible(el, v => { if (v && !fired) {
        fired = true;
        setTimeout(cb, delayMs);
    } });
}
/** Track "the user has taken over" — any pointer/slider interaction inside el. */
function userTouch(el, onTouch) {
    const st = { touched: false };
    const mark = () => { if (!st.touched) {
        st.touched = true;
        if (onTouch)
            onTouch();
    } };
    ['pointerdown', 'input'].forEach(ev => el.addEventListener(ev, mark, { passive: true }));
    return st;
}
function project(cam, p) {
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const x = p[0] * cy - p[2] * sy;
    let z = p[0] * sy + p[2] * cy;
    const y = p[1] * cp - z * sp;
    z = p[1] * sp + z * cp;
    const d = cam.dist / (cam.dist + z);
    return [cam.cx + x * cam.scale * d, cam.cy + y * cam.scale * d, d];
}
function orbit(cv, cam) {
    const st = { dragging: false, everDragged: false };
    let px = 0, py = 0;
    cv.addEventListener('pointerdown', e => {
        st.dragging = true;
        st.everDragged = true;
        px = e.clientX;
        py = e.clientY;
        cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', e => {
        if (!st.dragging)
            return;
        cam.yaw += (e.clientX - px) * 0.008;
        cam.pitch = clamp(cam.pitch + (e.clientY - py) * 0.006, -1.35, 1.35);
        px = e.clientX;
        py = e.clientY;
    });
    const up = () => { st.dragging = false; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    return st;
}
/* Landing hero — a starfield with a secret.
   Every point drifts, slowly and coherently, toward one point just off the
   right edge of the frame. The whole thesis of the site in one background.
   Respects prefers-reduced-motion (renders a static field instead). */
(function () {
    const cv = $('#hero-cv');
    if (!cv)
        return;
    const rng = mulberry32(7);
    const N = 320;
    let stars = [];
    let W = 0, H = 0;
    function seed(w, h) {
        stars = [];
        for (let i = 0; i < N; i++)
            stars.push({ x: rng() * w, y: rng() * h, z: 0.15 + rng() * 0.85 });
    }
    function ensure() {
        const [ctx, w, h] = fit(cv);
        if (w !== W || h !== H) {
            W = w;
            H = h;
            seed(w, h);
        }
        return ctx;
    }
    let last = 0;
    function draw(t) {
        const ctx = ensure();
        const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
        last = t;
        ctx.clearRect(0, 0, W, H);
        // The attractor: just past the right edge, where we can't quite see.
        const tx = W * 1.16, ty = H * 0.4;
        const glow = ctx.createRadialGradient(tx, ty, 0, tx, ty, Math.max(W, H) * 0.55);
        glow.addColorStop(0, 'rgba(240,201,108,0.14)');
        glow.addColorStop(1, 'rgba(240,201,108,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);
        for (const s of stars) {
            const dx = tx - s.x, dy = ty - s.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (!reduced) {
                // Faster when deeper in the field (parallax) and when closer to the pull.
                const sp = (5 + 34 * s.z) * (0.35 + 230 / (dist + 150));
                s.x += (dx / dist) * sp * dt;
                s.y += (dy / dist) * sp * dt;
                if (dist < 34) {
                    s.x = rng() * W * 0.55 - W * 0.08;
                    s.y = rng() * H;
                }
            }
            const r = 0.6 + 1.5 * s.z;
            ctx.globalAlpha = (0.22 + 0.6 * s.z) * clamp(dist / 170, 0.12, 1);
            ctx.fillStyle = s.z > 0.84 ? TEAL_B : STAR_C;
            ctx.beginPath();
            ctx.arc(s.x, s.y, r, 0, TAU);
            ctx.fill();
            if (s.z > 0.76 && !reduced) {
                ctx.globalAlpha *= 0.32;
                ctx.strokeStyle = TEAL;
                ctx.lineWidth = r * 0.75;
                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(s.x - (dx / dist) * 8 * s.z, s.y - (dy / dist) * 8 * s.z);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
    }
    if (reduced) {
        const once = () => { last = 0; requestAnimationFrame(tt => draw(tt)); };
        once();
        addEventListener('resize', once);
    }
    else {
        loopWhenVisible(cv, draw);
        addEventListener('resize', () => { W = -1; });
    }
})();
