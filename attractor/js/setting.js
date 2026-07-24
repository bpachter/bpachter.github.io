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
/* Part I · The Setting — three widgets.
   01 The Hole      — powers-of-ten pull-back, 1 AU → 2.6 Gly (log zoom).
   02 The Web       — orbitable 3-D cosmic web grown by void repulsion.
   03 Two Forces    — gravity vs dark energy tug-of-war with a live integrator.
   All schematic: honest shapes and honest ratios, not survey data. */
/* ───────────────────────── 01 · the pull-back ───────────────────────── */
(function () {
    const cv = $('#w-scale');
    if (!cv)
        return;
    const fig = cv.closest('.fig');
    const slider = $('#scale-z');
    const readout = $('#scale-read');
    const LOG_MIN = -4.8; // FOV ≈ 1 AU
    const LOG_MAX = 9.42; // FOV ≈ 2.6 Gly — the KBC ring fits
    const rng = mulberry32(11);
    // Precomputed clouds, all in light-years, centered on YOU.
    const nearStars = [];
    for (let i = 0; i < 90; i++)
        nearStars.push([gauss(rng) * 11, gauss(rng) * 11, 0.5 + rng()]);
    // The galaxy, offset: its center sits ~26 kly away from you.
    const GC = [-20000, 16000];
    const mwArm = [];
    for (let i = 0; i < 1300; i++) {
        const r = 50000 * Math.sqrt(rng());
        const th = (r / 50000) * 4.6 + (i % 2) * Math.PI + gauss(rng) * 0.24;
        mwArm.push([r * Math.cos(th), r * Math.sin(th)]);
    }
    const mwBulge = [];
    for (let i = 0; i < 220; i++)
        mwBulge.push([gauss(rng) * 7000, gauss(rng) * 5600]);
    const dwarfs = [];
    for (let i = 0; i < 26; i++)
        dwarfs.push([gauss(rng) * 1.1e6, gauss(rng) * 1.1e6]);
    const m31 = [];
    for (let i = 0; i < 150; i++)
        m31.push([1.9e6 + gauss(rng) * 1.0e5, -1.6e6 + gauss(rng) * 6.0e4]);
    const m33 = [];
    for (let i = 0; i < 80; i++)
        m33.push([2.35e6 + gauss(rng) * 5.0e4, -0.95e6 + gauss(rng) * 3.4e4]);
    // Web inside the underdensity (sparse) and the denser shell beyond the ring.
    const webIn = [];
    {
        const cs = [];
        for (let i = 0; i < 15; i++)
            cs.push([(rng() * 2 - 1) * 0.8, (rng() * 2 - 1) * 0.8]);
        for (let i = 0; i < 430; i++) {
            let x = rng() * 2 - 1, y = rng() * 2 - 1;
            for (let k = 0; k < 5; k++) {
                let bi = 0, bd = 1e9;
                for (let c = 0; c < cs.length; c++) {
                    const dd = (x - cs[c][0]) * (x - cs[c][0]) + (y - cs[c][1]) * (y - cs[c][1]);
                    if (dd < bd) {
                        bd = dd;
                        bi = c;
                    }
                }
                const d = Math.sqrt(bd) || 1e-4, R = 0.34;
                if (d < R) {
                    x += ((x - cs[bi][0]) / d) * (R - d) * 0.5;
                    y += ((y - cs[bi][1]) / d) * (R - d) * 0.5;
                }
            }
            webIn.push([x * 0.95e9, y * 0.95e9]);
        }
    }
    const webOut = [];
    {
        const clumps = [];
        for (let i = 0; i < 26; i++) {
            const a = rng() * TAU, r = 1.06e9 + rng() * 0.42e9;
            clumps.push([r * Math.cos(a), r * Math.sin(a)]);
        }
        for (let i = 0; i < 620; i++) {
            const c = clumps[(i * 7919) % clumps.length];
            webOut.push([c[0] + gauss(rng) * 9e7, c[1] + gauss(rng) * 9e7]);
        }
    }
    const st = { z: LOG_MIN, mode: 'auto', target: NaN };
    const touch = userTouch(fig, () => { st.mode = 'idle'; st.target = NaN; });
    function fovLabel(fov) {
        if (fov < 0.55)
            return fmt(fov * 63241, 1) + ' AU';
        if (fov < 1e3)
            return fmt(fov, fov < 20 ? 1 : 0) + ' light-years';
        if (fov < 1e6)
            return fmt(fov / 1e3, 0) + ' thousand ly';
        if (fov < 1e9)
            return fmt(fov / 1e6, fov < 2e7 ? 1 : 0) + ' million ly';
        return fmt(fov / 1e9, 2) + ' billion ly';
    }
    function label(ctx, s, x, y, color, a) {
        ctx.globalAlpha = a;
        ctx.fillStyle = color;
        ctx.font = '10.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(s, x, y);
        ctx.globalAlpha = 1;
    }
    /** alpha window: fade a layer in above lo, out above hi (z in log-ly). */
    function win(z, lo, hi) {
        return clamp((z - lo) * 2.4, 0, 1) * clamp((hi - z) * 2.4, 0, 1);
    }
    let last = 0;
    function draw(t) {
        const [ctx, W, H] = fit(cv);
        const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
        last = t;
        if (st.mode === 'auto' && !reduced) {
            st.z += dt * ((LOG_MAX - LOG_MIN) / 30);
            if (st.z >= LOG_MAX) {
                st.z = LOG_MAX;
                st.mode = 'idle';
            }
        }
        if (!isNaN(st.target)) {
            st.z += (st.target - st.z) * Math.min(1, dt * 3);
            if (Math.abs(st.target - st.z) < 0.01) {
                st.z = st.target;
                st.target = NaN;
            }
        }
        const fov = Math.pow(10, st.z); // field width in ly
        const s = W / fov; // px per ly
        const cx = W / 2, cy = H / 2;
        ctx.clearRect(0, 0, W, H);
        // solar system: orbit rings (Earth, Jupiter, Neptune) + Sun
        const orbits = [[1.58e-5, 'Earth'], [8.2e-5, 'Jupiter'], [4.74e-4, 'Neptune']];
        for (let oi = 0; oi < orbits.length; oi++) {
            const r = orbits[oi][0], nm = orbits[oi][1];
            const rp = r * s;
            if (rp < 2 || rp > W * 2.5)
                continue;
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = FAINT;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, rp, 0, TAU);
            ctx.stroke();
            const ang = 0.9 + oi * 1.9;
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = SKY;
            ctx.beginPath();
            ctx.arc(cx + rp * Math.cos(ang), cy + rp * Math.sin(ang), 2, 0, TAU);
            ctx.fill();
            if (rp > 40 && rp < W * 0.52)
                label(ctx, nm, cx, cy - rp - 6, FAINT, 0.8);
        }
        // Sun at center while we're at solar/stellar scales
        const aSun = win(st.z, -5.2, 1.9);
        if (aSun > 0) {
            ctx.globalAlpha = aSun;
            ctx.fillStyle = GOLD;
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(1.6, clamp(4.6e-7 * s, 1.6, 9)), 0, TAU);
            ctx.fill();
        }
        // Oort cloud
        const rOort = 1.6 * s;
        if (rOort > 8 && rOort < W * 2) {
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = FAINT;
            ctx.setLineDash([2, 5]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, rOort, 0, TAU);
            ctx.stroke();
            ctx.setLineDash([]);
            if (rOort < W * 0.5)
                label(ctx, 'Oort cloud', cx, cy - rOort - 6, FAINT, 0.6);
        }
        // near stars
        const aNs = win(st.z, 0.35, 3.6);
        if (aNs > 0) {
            ctx.fillStyle = STAR_C;
            for (const p of nearStars) {
                ctx.globalAlpha = aNs * 0.5 * p[2];
                ctx.beginPath();
                ctx.arc(cx + p[0] * s, cy + p[1] * s, 1.2, 0, TAU);
                ctx.fill();
            }
        }
        // the galaxy (offset — you live in the suburbs here too)
        const aMw = win(st.z, 3.4, 7.6);
        if (aMw > 0) {
            ctx.save();
            ctx.translate(cx + GC[0] * s, cy + GC[1] * s);
            ctx.rotate(-0.5);
            ctx.scale(1, 0.56);
            ctx.fillStyle = STAR_C;
            for (const p of mwArm) {
                ctx.globalAlpha = aMw * 0.32;
                ctx.beginPath();
                ctx.arc(p[0] * s, p[1] * s, 1, 0, TAU);
                ctx.fill();
            }
            ctx.fillStyle = GOLD;
            for (const p of mwBulge) {
                ctx.globalAlpha = aMw * 0.26;
                ctx.beginPath();
                ctx.arc(p[0] * s, p[1] * s, 1, 0, TAU);
                ctx.fill();
            }
            ctx.restore();
            if (50000 * s > 30 && 50000 * s < W * 0.7)
                label(ctx, 'the Milky Way', cx + GC[0] * s, cy + GC[1] * s - 56000 * s * 0.56, FAINT, aMw * 0.85);
        }
        // Local Group
        const aLg = win(st.z, 5.6, 8.6);
        if (aLg > 0) {
            ctx.fillStyle = STAR_C;
            for (const p of dwarfs) {
                ctx.globalAlpha = aLg * 0.4;
                ctx.beginPath();
                ctx.arc(cx + p[0] * s, cy + p[1] * s, 1.1, 0, TAU);
                ctx.fill();
            }
            ctx.fillStyle = TEAL_B;
            for (const p of m31) {
                ctx.globalAlpha = aLg * 0.3;
                ctx.beginPath();
                ctx.arc(cx + p[0] * s, cy + p[1] * s, 1, 0, TAU);
                ctx.fill();
            }
            for (const p of m33) {
                ctx.globalAlpha = aLg * 0.24;
                ctx.beginPath();
                ctx.arc(cx + p[0] * s, cy + p[1] * s, 0.9, 0, TAU);
                ctx.fill();
            }
            if (2.5e6 * s > 60 && 2.5e6 * s < W * 0.8)
                label(ctx, 'Andromeda', cx + 1.9e6 * s, cy - 1.6e6 * s - 10, FAINT, aLg * 0.85);
        }
        // the web — sparse inside, denser beyond the ring
        const aWeb = win(st.z, 7.6, 12);
        if (aWeb > 0) {
            ctx.fillStyle = SKY;
            for (const p of webIn) {
                ctx.globalAlpha = aWeb * 0.26;
                ctx.beginPath();
                ctx.arc(cx + p[0] * s, cy + p[1] * s, 1, 0, TAU);
                ctx.fill();
            }
            for (const p of webOut) {
                ctx.globalAlpha = aWeb * 0.44;
                ctx.beginPath();
                ctx.arc(cx + p[0] * s, cy + p[1] * s, 1.1, 0, TAU);
                ctx.fill();
            }
            const rk = 1.0e9 * s;
            if (rk > 60) {
                ctx.globalAlpha = aWeb * 0.55;
                ctx.strokeStyle = VIOLET;
                ctx.setLineDash([6, 7]);
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(cx, cy, rk, 0, TAU);
                ctx.stroke();
                ctx.setLineDash([]);
                // keep the ring label on-canvas even when the ring overflows the frame
                label(ctx, 'the KBC underdensity — ≈2 billion ly across', cx, Math.max(cy - rk + 18, 17), VIOLET, aWeb * 0.9);
            }
        }
        // YOU, always: crosshair
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = TEAL;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 11, cy);
        ctx.lineTo(cx - 3, cy);
        ctx.moveTo(cx + 3, cy);
        ctx.lineTo(cx + 11, cy);
        ctx.moveTo(cx, cy - 11);
        ctx.lineTo(cx, cy - 3);
        ctx.moveTo(cx, cy + 3);
        ctx.lineTo(cx, cy + 11);
        ctx.stroke();
        label(ctx, 'you', cx + 20, cy + 4, TEAL_B, 0.95);
        readout.textContent = 'field of view ≈ ' + fovLabel(fov);
        if (document.activeElement !== slider)
            slider.value = String(Math.round(((st.z - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 1000));
    }
    slider.addEventListener('input', () => {
        st.mode = 'idle';
        st.target = NaN;
        st.z = LOG_MIN + (Number(slider.value) / 1000) * (LOG_MAX - LOG_MIN);
    });
    $$('.z-chip', fig).forEach(b => b.addEventListener('click', () => {
        st.mode = 'idle';
        st.target = Number(b.dataset.z);
    }));
    if (reduced) {
        st.mode = 'idle';
        st.z = LOG_MAX;
    }
    autoOnView(fig, () => { if (!touch.touched && !reduced)
        st.mode = 'auto'; }, 500);
    loopWhenVisible(cv, draw);
})();
/* ───────────────────────── 02 · the web, in 3-D ───────────────────────── */
(function () {
    const cv = $('#w-web');
    if (!cv)
        return;
    const rng = mulberry32(42);
    // Void centers with radii; galaxies relaxed out of them → filaments emerge.
    const voids = [];
    for (let i = 0; i < 22; i++)
        voids.push([(rng() * 2 - 1) * 0.85, (rng() * 2 - 1) * 0.85, (rng() * 2 - 1) * 0.85, 0.3 + rng() * 0.22]);
    const pts = [];
    for (let i = 0; i < 820; i++) {
        let x = rng() * 2 - 1, y = rng() * 2 - 1, z = rng() * 2 - 1;
        for (let k = 0; k < 6; k++) {
            let bi = 0, bd = 1e9;
            for (let c = 0; c < voids.length; c++) {
                const dx = x - voids[c][0], dy = y - voids[c][1], dz = z - voids[c][2];
                const dd = dx * dx + dy * dy + dz * dz;
                if (dd < bd) {
                    bd = dd;
                    bi = c;
                }
            }
            const d = Math.sqrt(bd) || 1e-4, R = voids[bi][3];
            if (d < R) {
                const f = (R - d) * 0.55 / d;
                x += (x - voids[bi][0]) * f;
                y += (y - voids[bi][1]) * f;
                z += (z - voids[bi][2]) * f;
            }
        }
        pts.push([clamp(x, -1.05, 1.05), clamp(y, -1.05, 1.05), clamp(z, -1.05, 1.05)]);
    }
    // filament edges + degrees (one-time O(n²) is fine at this size)
    const edges = [];
    const deg = new Array(pts.length).fill(0);
    for (let i = 0; i < pts.length && edges.length < 1600; i++) {
        for (let j = i + 1; j < pts.length; j++) {
            if (deg[i] > 3)
                break;
            if (deg[j] > 3)
                continue;
            const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1], dz = pts[i][2] - pts[j][2];
            if (dx * dx + dy * dy + dz * dz < 0.0289) {
                edges.push([i, j]);
                deg[i]++;
                deg[j]++;
            }
        }
    }
    // the biggest knot plays the Attractor; you live inside a void with two friends
    let attr = 0;
    for (let i = 1; i < pts.length; i++)
        if (deg[i] > deg[attr])
            attr = i;
    const home = voids[7];
    const you = [
        [home[0], home[1], home[2]],
        [home[0] + 0.045, home[1] - 0.02, home[2] + 0.015],
        [home[0] - 0.03, home[1] + 0.035, home[2] - 0.02],
    ];
    const cam = { yaw: 0.7, pitch: 0.32, cx: 0, cy: 0, scale: 100, dist: 3.6 };
    const orb = orbit(cv, cam);
    let showVoids = false;
    const vbtn = $('#web-voids');
    vbtn.addEventListener('click', () => { showVoids = !showVoids; vbtn.classList.toggle('on', showVoids); });
    let last = 0;
    function draw(t) {
        const [ctx, W, H] = fit(cv);
        const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
        last = t;
        if (!orb.everDragged && !reduced)
            cam.yaw += dt * 0.1;
        cam.cx = W / 2;
        cam.cy = H / 2;
        cam.scale = Math.min(W, H) * 0.62;
        ctx.clearRect(0, 0, W, H);
        ctx.lineWidth = 1;
        for (const [i, j] of edges) {
            const a = project(cam, pts[i]), b = project(cam, pts[j]);
            ctx.globalAlpha = 0.028 + 0.075 * clamp(((a[2] + b[2]) / 2 - 0.75) * 2, 0, 1);
            ctx.strokeStyle = SKY;
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.stroke();
        }
        if (showVoids) {
            ctx.setLineDash([3, 6]);
            for (const v of voids) {
                const p = project(cam, [v[0], v[1], v[2]]);
                ctx.globalAlpha = 0.1 + 0.14 * clamp((p[2] - 0.75) * 2, 0, 1);
                ctx.strokeStyle = VIOLET;
                ctx.beginPath();
                ctx.arc(p[0], p[1], v[3] * cam.scale * p[2], 0, TAU);
                ctx.stroke();
            }
            ctx.setLineDash([]);
        }
        for (let i = 0; i < pts.length; i++) {
            const p = project(cam, pts[i]);
            const dn = clamp((p[2] - 0.72) * 1.9, 0, 1);
            ctx.globalAlpha = 0.16 + 0.6 * dn;
            ctx.fillStyle = deg[i] > 2 ? STAR_C : SKY;
            ctx.beginPath();
            ctx.arc(p[0], p[1], 0.7 + 1.6 * dn, 0, TAU);
            ctx.fill();
        }
        // the Attractor knot
        {
            const p = project(cam, pts[attr]);
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = GOLD;
            ctx.shadowColor = GOLD;
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(p[0], p[1], 3.4 + 2 * p[2], 0, TAU);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.font = '10.5px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillText('a great attractor', p[0] + 10, p[1] + 3);
        }
        // you (and the Local Group), alone in a void
        {
            const p0 = project(cam, you[0]);
            ctx.fillStyle = TEAL_B;
            for (const q of you) {
                const p = project(cam, q);
                ctx.globalAlpha = 0.95;
                ctx.beginPath();
                ctx.arc(p[0], p[1], 2, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = TEAL_B;
            ctx.font = '10.5px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillText('you', p0[0] + 9, p0[1] - 6);
        }
        ctx.globalAlpha = 1;
    }
    loopWhenVisible(cv, draw);
})();
/* ───────────────────────── 03 · the tug-of-war ───────────────────────── */
(function () {
    const cv = $('#w-tug');
    if (!cv)
        return;
    const fig = cv.closest('.fig');
    const sepEl = $('#tug-sep');
    const massEl = $('#tug-mass');
    const sepVal = $('#tug-sep-v'), massVal = $('#tug-mass-v');
    const readout = $('#tug-read');
    const goBtn = $('#tug-go'), reBtn = $('#tug-reset');
    // Toy units: separation in Mly. a = −A·m/d² + B·d  (B = 1).
    // A tuned so two Milky-Way-ish galaxies (m = 2) are bound within ≈3.5 Mly —
    // the same ballpark as the real Local Group's edge. Schematic, not to scale.
    const A = 21.4;
    const rStar = (m) => Math.cbrt(A * m);
    const rng = mulberry32(5);
    const sprite = [];
    for (let i = 0; i < 46; i++) {
        const r = Math.sqrt(rng());
        const th = r * 6.8 + (i % 2) * Math.PI + gauss(rng) * 0.3;
        sprite.push([r * Math.cos(th), r * Math.sin(th)]);
    }
    const st = { mode: 'idle', d: 2.5, v: 0, burst: 0 };
    const touch = userTouch(fig);
    function params() { return [Number(sepEl.value), Number(massEl.value)]; }
    function syncLabels() {
        const [d0, m] = params();
        sepVal.textContent = fmt(d0, 1) + ' Mly';
        massVal.textContent = fmt(m, 1) + ' galaxies';
        if (st.mode === 'idle')
            st.d = d0;
        const rs = rStar(m);
        const grav = A * m / (st.d * st.d), dark = st.d;
        const win = grav >= dark;
        readout.className = 'readout ' + (win ? 'win-g' : 'win-d');
        readout.innerHTML = win
            ? '<b>gravity wins</b> — bound · crossover ≈ ' + fmt(rs, 1) + ' Mly'
            : '<b>dark energy wins</b> — unbound · crossover ≈ ' + fmt(rs, 1) + ' Mly';
    }
    function reset() { st.mode = 'idle'; st.v = 0; st.burst = 0; syncLabels(); }
    sepEl.addEventListener('input', reset);
    massEl.addEventListener('input', reset);
    goBtn.addEventListener('click', () => {
        if (st.mode === 'run')
            return;
        const [d0] = params();
        st.d = d0;
        st.v = 0;
        st.burst = 0;
        st.mode = 'run';
    });
    reBtn.addEventListener('click', reset);
    function galaxy(ctx, x, y, sc, spin, tint) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(spin);
        ctx.scale(1, 0.62);
        ctx.fillStyle = tint;
        for (const p of sprite) {
            ctx.globalAlpha = 0.68;
            ctx.beginPath();
            ctx.arc(p[0] * sc, p[1] * sc, 1.1, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = STAR_C;
        ctx.beginPath();
        ctx.arc(0, 0, 2.2, 0, TAU);
        ctx.fill();
        ctx.restore();
    }
    let last = 0;
    function draw(t) {
        const [ctx, W, H] = fit(cv);
        const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
        last = t;
        const [, m] = params();
        if (st.mode === 'run') {
            const a = -A * m / (st.d * st.d) + st.d;
            st.v += a * dt * 0.9;
            st.d += st.v * dt * 0.9;
            if (st.d <= 0.5) {
                st.d = 0.5;
                st.mode = 'merged';
            }
            if (st.d >= 13.2) {
                st.d = 13.2;
                st.mode = 'gone';
            }
        }
        if (st.mode === 'merged' && st.burst < 1)
            st.burst = Math.min(1, st.burst + dt * 1.4);
        ctx.clearRect(0, 0, W, H);
        const midY = H * 0.46;
        const ppm = (W - 120) / 13; // px per Mly of separation
        const rs = rStar(m);
        const sc = 4 + 13 * Math.cbrt(m / 2);
        // axis + crossover brackets
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = LINE_C;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(50, midY + 56);
        ctx.lineTo(W - 50, midY + 56);
        ctx.stroke();
        for (let mm = 0; mm <= 13; mm += 2) {
            const x = W / 2 - (mm * ppm) / 2, x2 = W / 2 + (mm * ppm) / 2;
            ctx.beginPath();
            ctx.moveTo(x, midY + 52);
            ctx.lineTo(x, midY + 60);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x2, midY + 52);
            ctx.lineTo(x2, midY + 60);
            ctx.stroke();
        }
        ctx.setLineDash([4, 5]);
        ctx.globalAlpha = 0.65;
        ctx.strokeStyle = FAINT;
        const bx1 = W / 2 - (rs * ppm) / 2, bx2 = W / 2 + (rs * ppm) / 2;
        ctx.beginPath();
        ctx.moveTo(bx1, midY - 58);
        ctx.lineTo(bx1, midY + 56);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx2, midY - 58);
        ctx.lineTo(bx2, midY + 56);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = FAINT;
        ctx.font = '10.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('bound inside these brackets', W / 2, midY - 64);
        const xL = W / 2 - (st.d * ppm) / 2, xR = W / 2 + (st.d * ppm) / 2;
        if (st.mode === 'merged') {
            // one bigger galaxy + a fading blast ring
            galaxy(ctx, W / 2, midY, sc * 1.35, t * 0.0004, TEAL_B);
            if (st.burst < 1) {
                ctx.globalAlpha = (1 - st.burst) * 0.8;
                ctx.strokeStyle = STAR_C;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(W / 2, midY, 10 + st.burst * 90, 0, TAU);
                ctx.stroke();
            }
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = FAINT;
            ctx.textAlign = 'center';
            ctx.fillText('merged — one galaxy now (this is Andromeda and us, eventually)', W / 2, midY + 84);
        }
        else {
            const grav = A * m / (st.d * st.d), dark = st.d;
            const mx = Math.max(grav, dark);
            // force meters
            ctx.textAlign = 'left';
            ctx.font = '10.5px "JetBrains Mono", monospace';
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = TEAL;
            ctx.fillRect(56, 22, (grav / mx) * 120, 5);
            ctx.fillStyle = VIOLET;
            ctx.fillRect(56, 40, (dark / mx) * 120, 5);
            ctx.fillStyle = FAINT;
            ctx.fillText('gravity', 56, 16);
            ctx.fillText('dark energy', 56, 58);
            // galaxies + arrows
            galaxy(ctx, xL, midY, sc, t * 0.00045, TEAL_B);
            galaxy(ctx, xR, midY, sc, -t * 0.0004, TEAL_B);
            const ga = clamp((grav / mx) * 34 + 8, 8, 42), da = clamp((dark / mx) * 34 + 8, 8, 42);
            arrow(ctx, xL + sc + 6, midY, xL + sc + 6 + ga, midY, TEAL, 2);
            arrow(ctx, xR - sc - 6, midY, xR - sc - 6 - ga, midY, TEAL, 2);
            arrow(ctx, xL - sc - 6, midY, xL - sc - 6 - da, midY, VIOLET, 2);
            arrow(ctx, xR + sc + 6, midY, xR + sc + 6 + da, midY, VIOLET, 2);
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = FAINT;
            ctx.textAlign = 'center';
            ctx.fillText('us', xL, midY + sc + 22);
            ctx.fillText('them', xR, midY + sc + 22);
            if (st.mode === 'gone') {
                ctx.fillText('gone — expansion carried them over the horizon', W / 2, midY + 84);
            }
        }
        ctx.globalAlpha = 1;
    }
    syncLabels();
    autoOnView(fig, () => { if (!touch.touched && !reduced)
        goBtn.dispatchEvent(new Event('click')); }, 1400);
    loopWhenVisible(cv, draw);
})();
