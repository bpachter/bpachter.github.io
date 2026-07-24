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
/* Part III · The Picture — three widgets.
   08 Laniakea       — two-basin watershed: flows, the divide, click-to-drop probes.
   09 Emptier holes  — Boötes vs KBC: expected density → what's actually there.
   10 The suburb     — cluster core vs suburb: a hazard-rate toy (speculation!).
   All schematic: honest shapes and honest ratios, not survey data. */
/* ───────────────────────── 08 · the watershed ───────────────────────── */
(function () {
    const cv = $('#w-lani');
    if (!cv)
        return;
    const rng = mulberry32(88);
    // Wells (pull) and the repeller (push), in canvas-fraction coordinates.
    const GA = { x: 0.66, y: 0.40, g: 1.0 }; // the Great Attractor — our drain
    const PP = { x: 0.13, y: 0.24, g: 0.8 }; // Perseus–Pisces — the next basin over
    const SH = { x: 1.14, y: 0.32, g: 1.7 }; // Shapley, beyond
    const RP = { x: -0.06, y: 0.82, g: 0.7 }; // the Dipole Repeller
    const SOFT = 0.014;
    function vel(x, y) {
        let vx = 0, vy = 0;
        for (const w of [GA, PP, SH]) {
            const dx = w.x - x, dy = w.y - y;
            const d2 = dx * dx + dy * dy + SOFT;
            const f = w.g / d2 * 0.013;
            vx += dx * f;
            vy += dy * f;
        }
        const dx = x - RP.x, dy = y - RP.y;
        const d2 = dx * dx + dy * dy + SOFT;
        const f = RP.g / d2 * 0.013;
        vx += dx * f;
        vy += dy * f;
        const sp = Math.hypot(vx, vy), cap = 0.07;
        if (sp > cap) {
            vx = vx / sp * cap;
            vy = vy / sp * cap;
        }
        return [vx, vy];
    }
    // Which drain does a point feed? Integrate until captured (GA-side vs PP).
    function basin(x0, y0) {
        let x = x0, y = y0;
        for (let i = 0; i < 300; i++) {
            const [vx, vy] = vel(x, y);
            x += vx * 0.11;
            y += vy * 0.11;
            if (Math.hypot(x - PP.x, y - PP.y) < 0.05)
                return 1;
            if (Math.hypot(x - GA.x, y - GA.y) < 0.055 || x > 1.18)
                return 0;
            if (x < -0.15 || y < -0.15 || y > 1.15)
                break;
        }
        // undecided: nearest big well wins
        return Math.hypot(x - PP.x, y - PP.y) < Math.hypot(x - GA.x, y - GA.y) ? 1 : 0;
    }
    // Precompute the basin grid + its boundary (the watershed divide).
    const GX = 56, GY = 36;
    const grid = [];
    for (let j = 0; j < GY; j++)
        for (let i = 0; i < GX; i++)
            grid.push(basin((i + 0.5) / GX, (j + 0.5) / GY));
    const divide = [];
    for (let j = 0; j < GY - 1; j++)
        for (let i = 0; i < GX - 1; i++) {
            const a = grid[j * GX + i];
            if (grid[j * GX + i + 1] !== a || grid[(j + 1) * GX + i] !== a)
                divide.push([(i + 1) / GX, (j + 0.75) / GY]);
        }
    const flows = [];
    function spawn(g) {
        const n = g || { x: 0, y: 0, px: 0, py: 0, b: 0 };
        n.x = rng() * 1.1 - 0.05;
        n.y = rng() * 1.05 - 0.02;
        n.px = n.x;
        n.py = n.y;
        const gi = clamp(Math.floor(n.x * GX), 0, GX - 1), gj = clamp(Math.floor(n.y * GY), 0, GY - 1);
        n.b = grid[gj * GX + gi];
        return n;
    }
    for (let i = 0; i < 230; i++)
        flows.push(spawn());
    const probes = [];
    cv.addEventListener('pointerdown', e => {
        const r = cv.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        probes.push({ pts: [x, y], x, y, done: false });
        if (probes.length > 3)
            probes.shift();
    });
    let showDivide = false;
    const dbtn = $('#lani-divide');
    dbtn.addEventListener('click', () => { showDivide = !showDivide; dbtn.classList.toggle('on', showDivide); });
    autoOnView(cv.closest('.fig'), () => {
        if (!showDivide)
            dbtn.dispatchEvent(new Event('click'));
    }, 2600);
    let last = 0;
    function draw(t) {
        const [ctx, W, H] = fit(cv);
        const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
        last = t;
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(11, 18, 32, 0.25)';
        ctx.fillRect(0, 0, W, H);
        // flows, tinted by their home basin
        for (const g of flows) {
            const [vx, vy] = vel(g.x, g.y);
            g.px = g.x;
            g.py = g.y;
            if (!reduced) {
                g.x += vx * dt * 6.0;
                g.y += vy * dt * 6.0;
            }
            if (Math.hypot(g.x - GA.x, g.y - GA.y) < 0.035 || Math.hypot(g.x - PP.x, g.y - PP.y) < 0.032 ||
                g.x > 1.2 || g.x < -0.12 || g.y < -0.1 || g.y > 1.12) {
                spawn(g);
                continue;
            }
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = g.b === 0 ? TEAL : SKY;
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(g.px * W, g.py * H);
            ctx.lineTo(g.x * W, g.y * H);
            ctx.stroke();
        }
        // probes
        for (const p of probes) {
            if (!p.done && !reduced) {
                for (let k = 0; k < 3; k++) {
                    const [vx, vy] = vel(p.x, p.y);
                    p.x += vx * dt * 2.0;
                    p.y += vy * dt * 2.0;
                    p.pts.push(p.x, p.y);
                    if (Math.hypot(p.x - GA.x, p.y - GA.y) < 0.035 || Math.hypot(p.x - PP.x, p.y - PP.y) < 0.032 ||
                        p.x > 1.2 || p.x < -0.12) {
                        p.done = true;
                        break;
                    }
                }
            }
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = STAR_C;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(p.pts[0] * W, p.pts[1] * H);
            for (let k = 2; k < p.pts.length; k += 2)
                ctx.lineTo(p.pts[k] * W, p.pts[k + 1] * H);
            ctx.stroke();
            ctx.fillStyle = STAR_C;
            ctx.beginPath();
            ctx.arc(p.x * W, p.y * H, 2.4, 0, TAU);
            ctx.fill();
        }
        // the divide
        if (showDivide) {
            ctx.fillStyle = STAR_C;
            for (const d of divide) {
                ctx.globalAlpha = 0.4;
                ctx.beginPath();
                ctx.arc(d[0] * W, d[1] * H, 1.1, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = STAR_C;
            ctx.font = '10.5px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillText('the divide — the edge of Laniakea', 0.30 * W, 0.10 * H);
        }
        // wells + labels
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = GOLD;
        ctx.shadowColor = GOLD;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(GA.x * W, GA.y * H, 5, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.font = '10.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('the Great Attractor', GA.x * W, GA.y * H - 13);
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = SKY;
        ctx.beginPath();
        ctx.arc(PP.x * W, PP.y * H, 4, 0, TAU);
        ctx.fill();
        ctx.textAlign = 'left';
        ctx.fillText('Perseus–Pisces — the next basin over', PP.x * W + 10, PP.y * H + 4);
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = GOLD;
        ctx.textAlign = 'right';
        ctx.fillText('Shapley, beyond →', W - 10, SH.y * H + 42);
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = VIOLET;
        ctx.textAlign = 'left';
        ctx.fillText('← the Dipole Repeller', 10, RP.y * H - 26);
        // us — near the edge of our basin, which is the honest part
        const ux = 0.37, uy = 0.60;
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = TEAL;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(ux * W, uy * H, 5, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = TEAL_B;
        ctx.textAlign = 'left';
        ctx.fillText('you — near the edge, not the middle', ux * W + 11, uy * H + 16);
        // basin watermark
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = TEAL_B;
        ctx.font = '600 22px "Fraunces", Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText('L A N I A K E A', 0.56 * W, 0.78 * H);
        ctx.globalAlpha = 1;
    }
    loopWhenVisible(cv, draw);
})();
/* ───────────────────────── 09 · emptier holes ───────────────────────── */
(function () {
    const cv = $('#w-voids');
    if (!cv)
        return;
    const fig = cv.closest('.fig');
    const slider = $('#vd-t');
    const readB = $('#vd-bootes'), readK = $('#vd-kbc');
    const rng = mulberry32(53);
    // 100 "expected" seats per void; how many are actually filled:
    const KEEP_B = 3, KEEP_K = 65;
    function seats(n) {
        const out = [];
        for (let i = 0; i < n; i++)
            out.push({ a: rng() * TAU, r: Math.sqrt(rng()), tw: 0.5 + rng() * 0.5 });
        return out;
    }
    const B = seats(100), K = seats(100);
    const st = { t: 0, target: 0 };
    const touch = userTouch(fig);
    slider.addEventListener('input', () => { st.t = Number(slider.value) / 1000; st.target = st.t; });
    function panel(ctx, s, keep, cx, cy, R, t, ring) {
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = ring;
        ctx.setLineDash([5, 6]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        let shown = 0;
        for (let i = 0; i < s.length; i++) {
            const seat = s[i];
            const x = cx + Math.cos(seat.a) * seat.r * R * 0.92;
            const y = cy + Math.sin(seat.a) * seat.r * R * 0.92;
            const stays = i < keep;
            // as t rises, the seats that aren't really filled fade to faint ghosts
            const a = stays ? 0.85 * seat.tw : lerp(0.85 * seat.tw, 0.07, t);
            ctx.globalAlpha = a;
            ctx.fillStyle = stays ? STAR_C : FAINT;
            ctx.beginPath();
            ctx.arc(x, y, stays ? 2 : 1.6, 0, TAU);
            ctx.fill();
            if (stays || a > 0.2)
                shown++;
        }
        return shown;
    }
    let last = 0;
    function draw(t) {
        const [ctx, W, H] = fit(cv);
        const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
        last = t;
        if (!touch.touched)
            st.t += (st.target - st.t) * Math.min(1, dt * 1.6);
        ctx.clearRect(0, 0, W, H);
        const bx = W * 0.27, kx = W * 0.72, cy = H * 0.47;
        const bR = Math.min(W, H) * 0.185, kR = Math.min(W, H) * 0.315;
        panel(ctx, B, KEEP_B, bx, cy, bR, st.t, VIOLET);
        panel(ctx, K, KEEP_K, kx, cy, kR, st.t, VIOLET);
        // "you" live in the big one
        const yx = kx + kR * 0.28, yy = cy + kR * 0.18;
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = TEAL;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(yx, yy, 4, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = TEAL_B;
        ctx.font = '10.5px "JetBrains Mono", monospace';
        // label sits to the dot's left so it can't run off the canvas edge
        ctx.textAlign = 'right';
        ctx.fillText('you — and most of Laniakea', yx - 9, yy + 4);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = FAINT;
        ctx.textAlign = 'center';
        ctx.fillText('Boötes void · ≈330 Mly', bx, cy + bR + 22);
        ctx.fillText('the KBC underdensity · ≈2,000 Mly', kx, cy + kR + 22);
        const pctB = Math.round(lerp(100, KEEP_B, st.t)), pctK = Math.round(lerp(100, KEEP_K, st.t));
        readB.textContent = pctB + ' of every 100 expected galaxies';
        readK.textContent = pctK + ' of every 100 expected galaxies';
        if (document.activeElement !== slider)
            slider.value = String(Math.round(st.t * 1000));
        ctx.globalAlpha = 1;
    }
    autoOnView(fig, () => { if (!touch.touched)
        st.target = 1; }, 1200);
    loopWhenVisible(cv, draw);
})();
/* ───────────────────────── 10 · the suburb ───────────────────────── */
(function () {
    const cv = $('#w-suburb');
    if (!cv)
        return;
    const slider = $('#sb-crowd');
    const readout = $('#sb-read');
    const rng = mulberry32(29);
    function town(n, seed) {
        const rr = mulberry32(seed), out = [];
        for (let i = 0; i < n; i++)
            out.push({ x: 0.1 + rr() * 0.8, y: 0.14 + rr() * 0.72, r: 2.2 + rr() * 2.6, ph: rr() * TAU, sp: 0.2 + rr() * 0.8 });
        return out;
    }
    const CORE_MAX = 42;
    const core = town(CORE_MAX, 7);
    const burb = town(5, 9);
    const flashes = [];
    const counts = [0, 0];
    const st = { crowd: 0.6 };
    slider.addEventListener('input', () => { st.crowd = Number(slider.value) / 100; });
    let last = 0;
    function draw(t) {
        const [ctx, W, H] = fit(cv);
        const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
        last = t;
        ctx.clearRect(0, 0, W, H);
        const half = W / 2;
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = LINE_C;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(half, 12);
        ctx.lineTo(half, H - 12);
        ctx.stroke();
        const nCore = Math.round(10 + st.crowd * (CORE_MAX - 10));
        // hazard rate ~ crowding^1.7 (interactions are super-linear); suburb stays calm
        const rateCore = 0.25 + Math.pow(st.crowd, 1.7) * 2.4;
        const rateBurb = 0.12;
        for (const [side, gals, nUse] of [[0, core, nCore], [1, burb, burb.length]]) {
            const x0 = side === 0 ? 0 : half;
            for (let i = 0; i < nUse; i++) {
                const g = gals[i];
                const jit = side === 0 ? 0.006 * Math.sin(t * 0.001 * g.sp + g.ph) : 0.0015 * Math.sin(t * 0.0004 * g.sp + g.ph);
                const gx = x0 + (g.x + jit) * half, gy = (g.y + jit * 0.7) * H;
                ctx.globalAlpha = 0.75;
                ctx.fillStyle = side === 0 ? STAR_C : TEAL_B;
                ctx.beginPath();
                ctx.arc(gx, gy, g.r, 0, TAU);
                ctx.fill();
            }
            if (!reduced) {
                const rate = side === 0 ? rateCore : rateBurb;
                if (rng() < rate * dt) {
                    const g = gals[Math.floor(rng() * nUse)];
                    flashes.push({ x: x0 + g.x * half, y: g.y * H, age: 0, side });
                    counts[side]++;
                }
            }
        }
        for (let i = flashes.length - 1; i >= 0; i--) {
            const f = flashes[i];
            f.age += dt * 1.6;
            if (f.age > 1) {
                flashes.splice(i, 1);
                continue;
            }
            ctx.globalAlpha = (1 - f.age) * 0.8;
            ctx.strokeStyle = f.side === 0 ? '#f0876c' : GOLD;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(f.x, f.y, 4 + f.age * 26, 0, TAU);
            ctx.stroke();
        }
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = FAINT;
        ctx.font = '10.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText('cluster core — busy, bright, dangerous', 14, 22);
        ctx.fillText('disruptions: ' + counts[0], 14, H - 14);
        ctx.textAlign = 'right';
        ctx.fillText('the suburb — quiet, dark, stable', W - 14, 22);
        ctx.fillText('disruptions: ' + counts[1], W - 14, H - 14);
        readout.textContent = 'core disruption rate ≈ ' + fmt(rateCore / rateBurb, 0) + '× the suburb';
        ctx.globalAlpha = 1;
    }
    loopWhenVisible(cv, draw);
})();
