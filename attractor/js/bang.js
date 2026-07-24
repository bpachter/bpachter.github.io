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
/* Part V · The Bang — four widgets. The finale.
   15 Einstein's blunder — balance Λ against gravity, nudge it, watch it run away.
   16 Measuring the sky  — Cepheid pulse-meter: period → luminosity → distance.
   17 The redshift       — build the Hubble diagram; the slope emerges.
   18 Everywhere at once — the infinite grid; click any dot to be the center.
   All schematic: honest shapes and honest ratios, not survey data. */
/* ───────────────────────── 15 · Einstein's balance ───────────────────────── */
(function () {
    const cv = $('#w-balance');
    if (!cv)
        return;
    const fig = cv.closest('.fig');
    const slider = $('#bal-l');
    const runBtn = $('#bal-run');
    const nudgeBtn = $('#bal-nudge');
    const readout = $('#bal-read');
    const rng = mulberry32(15);
    // R̈ = −A/R² + Λ·R with A = 1; a static universe at R = 1 needs Λ* = 1 exactly.
    const ring = [];
    for (let i = 0; i < 42; i++) {
        const a = (i / 42) * TAU;
        ring.push([Math.cos(a) * (0.9 + rng() * 0.2), Math.sin(a) * (0.9 + rng() * 0.2)]);
    }
    const st = { R: 1, V: 0, mode: 'idle', hist: [], flash: 0 };
    const touch = userTouch(fig);
    function lam() { return Number(slider.value) / 1000; } // 850..1150 → 0.85..1.15 ×Λ*
    function reset() { st.R = 1; st.V = 0; st.mode = 'idle'; st.hist = []; st.flash = 0; sync(); }
    function sync() {
        runBtn.textContent = st.mode === 'run' ? 'reset' : 'run';
        const l = lam();
        if (st.mode === 'idle')
            readout.textContent = Math.abs(l - 1) < 0.0005 ? 'Λ set to perfect balance — for now' : (l < 1 ? 'Λ too weak — gravity will win' : 'Λ too strong — repulsion will win');
        else if (st.mode === 'run')
            readout.textContent = Math.abs(st.V) < 0.004 && Math.abs(st.R - 1) < 0.02 ? 'holding… (a pencil standing on its tip)' : (st.V < 0 ? 'collapsing —' + ' gravity is winning' : 'running away — repulsion is winning');
        else if (st.mode === 'crunch')
            readout.textContent = 'crunch. gravity won';
        else
            readout.textContent = 'runaway. repulsion won — sound familiar? (dark energy)';
    }
    slider.addEventListener('input', () => { if (st.mode !== 'idle')
        reset();
    else
        sync(); });
    runBtn.addEventListener('click', () => { if (st.mode === 'run')
        reset();
    else {
        st.mode = 'run';
        sync();
    } });
    nudgeBtn.addEventListener('click', () => {
        if (st.mode !== 'run') {
            st.mode = 'run';
        }
        st.R *= 1.012; // the tiniest outward breath
        sync();
    });
    let last = 0;
    function draw(t) {
        const [ctx, W, H] = fit(cv);
        const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
        last = t;
        if (st.mode === 'run' && !reduced) {
            const acc = -1 / (st.R * st.R) + lam() * st.R;
            st.V += acc * dt * 0.55;
            st.R += st.V * dt * 0.55;
            st.hist.push(st.R);
            if (st.hist.length > 460)
                st.hist.shift();
            if (st.R < 0.22) {
                st.mode = 'crunch';
                st.flash = 1;
                sync();
            }
            if (st.R > 2.6) {
                st.mode = 'gone';
                sync();
            }
        }
        if (st.flash > 0)
            st.flash = Math.max(0, st.flash - dt * 1.2);
        ctx.clearRect(0, 0, W, H);
        // left: the universe as a ring of galaxies at radius R
        const cx = W * 0.27, cy = H * 0.5, S = Math.min(W * 0.24, H * 0.4);
        ctx.fillStyle = STAR_C;
        for (const p of ring) {
            ctx.globalAlpha = 0.75;
            ctx.beginPath();
            ctx.arc(cx + p[0] * st.R * S, cy + p[1] * st.R * S, 1.6, 0, TAU);
            ctx.fill();
        }
        if (st.flash > 0) {
            ctx.globalAlpha = st.flash * 0.85;
            ctx.strokeStyle = '#f0876c';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, 8 + (1 - st.flash) * 60, 0, TAU);
            ctx.stroke();
        }
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = FAINT;
        ctx.font = '10.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('a universe (size R)', cx, H - 14);
        // right: R vs time trace
        const px0 = W * 0.52, px1 = W - 30, py0 = H - 40, py1 = 26;
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = LINE_C;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px0, py0);
        ctx.lineTo(px1, py0);
        ctx.moveTo(px0, py0);
        ctx.lineTo(px0, py1);
        ctx.stroke();
        // the balance line R = 1
        const yOf = (R) => py0 - ((clamp(R, 0, 2.6)) / 2.6) * (py0 - py1);
        ctx.setLineDash([3, 5]);
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = FAINT;
        ctx.beginPath();
        ctx.moveTo(px0, yOf(1));
        ctx.lineTo(px1, yOf(1));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = FAINT;
        ctx.textAlign = 'left';
        ctx.fillText('static', px0 + 6, yOf(1) - 6);
        if (st.hist.length > 1) {
            ctx.globalAlpha = 0.95;
            ctx.strokeStyle = st.V < 0 ? '#f0876c' : TEAL_B;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            for (let i = 0; i < st.hist.length; i++) {
                const x = px0 + (i / 459) * (px1 - px0);
                if (i === 0)
                    ctx.moveTo(x, yOf(st.hist[i]));
                else
                    ctx.lineTo(x, yOf(st.hist[i]));
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = FAINT;
        ctx.textAlign = 'center';
        ctx.fillText('size over time', (px0 + px1) / 2, H - 14);
        ctx.globalAlpha = 1;
    }
    autoOnView(fig, () => {
        if (touch.touched || reduced)
            return;
        st.mode = 'run';
        sync();
        setTimeout(() => { if (!touch.touched && st.mode === 'run')
            nudgeBtn.dispatchEvent(new Event('click')); }, 3200);
    }, 900);
    loopWhenVisible(cv, draw);
    sync();
})();
/* ───────────────────────── 16 · the Cepheid pulse-meter ───────────────────────── */
(function () {
    const cv = $('#w-cepheid');
    if (!cv)
        return;
    const fig = cv.closest('.fig');
    const readout = $('#cep-read');
    const rng = mulberry32(16);
    // the smudge: Andromeda as the 1923 eye saw it
    const smudge = [];
    for (let i = 0; i < 420; i++)
        smudge.push([gauss(rng) * 0.16, gauss(rng) * 0.075, 0.3 + rng() * 0.7]);
    const STARS = [
        { name: 'A', P: 3, x: -0.10, y: 0.028, d: 2.44 },
        { name: 'B', P: 15, x: 0.05, y: -0.04, d: 2.52 },
        { name: 'C', P: 40, x: 0.14, y: 0.05, d: 2.58 },
    ];
    const lum = (P) => 2600 * Math.pow(P / 10, 1.15); // suns, Leavitt's law (schematic slope)
    const st = { sel: 1 };
    $$('.cep-chip', fig).forEach((b, i) => b.addEventListener('click', () => {
        st.sel = i;
        $$('.cep-chip', fig).forEach((bb, j) => bb.classList.toggle('on', j === i));
    }));
    function bright(P, day) {
        // Cepheid shape: quick rise, slow decline
        const ph = (day / P) % 1;
        return 0.5 + 0.5 * Math.sin(ph * TAU + 0.45 * Math.sin(ph * TAU));
    }
    function draw(t) {
        const [ctx, W, H] = fit(cv);
        const day = (t / 1000) * 5; // one second ≈ five days
        ctx.clearRect(0, 0, W, H);
        const cxs = W * 0.26, cys = H * 0.42, S = Math.min(W, H);
        // the smudge
        ctx.save();
        ctx.translate(cxs, cys);
        ctx.rotate(-0.4);
        ctx.fillStyle = STAR_C;
        for (const p of smudge) {
            ctx.globalAlpha = 0.24 * p[2];
            ctx.beginPath();
            ctx.arc(p[0] * S * 1.6, p[1] * S * 1.6, 1, 0, TAU);
            ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = FAINT;
        ctx.font = '10.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('the “nebula” — Andromeda, as 1923 saw it', cxs, H - 14);
        // the three Cepheids, pulsing on their true clocks
        STARS.forEach((s, i) => {
            const b = bright(s.P, day);
            const x = cxs + (s.x * Math.cos(-0.4) - s.y * Math.sin(-0.4)) * S * 1.6;
            const y = cys + (s.x * Math.sin(-0.4) + s.y * Math.cos(-0.4)) * S * 1.6;
            const selp = i === st.sel;
            ctx.globalAlpha = 0.35 + 0.65 * b;
            ctx.fillStyle = GOLD;
            ctx.shadowColor = GOLD;
            ctx.shadowBlur = selp ? 12 : 5;
            ctx.beginPath();
            ctx.arc(x, y, 2 + 2.4 * b + (selp ? 0.8 : 0), 0, TAU);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = selp ? 0.95 : 0.55;
            ctx.fillStyle = selp ? TEAL_B : FAINT;
            ctx.textAlign = 'left';
            ctx.fillText(s.name, x + 8, y - 6);
            if (selp) {
                ctx.globalAlpha = 0.8;
                ctx.strokeStyle = TEAL;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(x, y, 9, 0, TAU);
                ctx.stroke();
            }
        });
        // strip chart for the selected star
        const sel = STARS[st.sel];
        const px0 = W * 0.52, px1 = W - 28, py0 = H * 0.72, amp = H * 0.2;
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = LINE_C;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px0, py0);
        ctx.lineTo(px1, py0);
        ctx.stroke();
        const win = 95; // days on screen
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        for (let x = px0; x <= px1; x += 2) {
            const dpast = day - (px1 - x) / (px1 - px0) * win;
            const y = py0 - bright(sel.P, dpast) * amp;
            if (x === px0)
                ctx.moveTo(x, y);
            else
                ctx.lineTo(x, y);
        }
        ctx.stroke();
        // period bracket over the last full cycle
        const bx1 = px1 - (day % sel.P) / win * (px1 - px0);
        const bx0 = bx1 - sel.P / win * (px1 - px0);
        if (bx0 > px0) {
            ctx.globalAlpha = 0.7;
            ctx.strokeStyle = TEAL;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(bx0, py0 + 12);
            ctx.lineTo(bx0, py0 + 18);
            ctx.lineTo(bx1, py0 + 18);
            ctx.lineTo(bx1, py0 + 12);
            ctx.stroke();
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = TEAL_B;
            ctx.textAlign = 'center';
            ctx.fillText('P ≈ ' + sel.P + ' days', (bx0 + bx1) / 2, py0 + 32);
        }
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = FAINT;
        ctx.textAlign = 'center';
        ctx.fillText('brightness — the pulse (1 s ≈ 5 days)', (px0 + px1) / 2, H - 14);
        const L = lum(sel.P);
        readout.innerHTML = 'star ' + sel.name + ': period <b>' + sel.P + ' d</b> → true brightness <b>≈' +
            fmt(L / 1000, 1) + ' thousand suns</b> → distance <b>≈' + fmt(sel.d, 2) + ' million ly</b>';
        ctx.globalAlpha = 1;
    }
    loopWhenVisible(cv, draw);
    $$('.cep-chip', fig)[1].classList.add('on');
})();
/* ───────────────────────── 17 · build the Hubble diagram ───────────────────────── */
(function () {
    const cv = $('#w-hubble');
    if (!cv)
        return;
    const fig = cv.closest('.fig');
    const nextBtn = $('#hub-next');
    const allBtn = $('#hub-all');
    const resetBtn = $('#hub-reset');
    const readout = $('#hub-read');
    const rng = mulberry32(29);
    const gals = [];
    for (let i = 0; i < 12; i++) {
        const d = 25 + rng() * 285; // Mpc
        gals.push({
            x: 0.05 + rng() * 0.36,
            y: 0.12 + rng() * 0.68,
            d,
            v: 70 * d * (1 + (rng() - 0.5) * 0.16), // peculiar-velocity scatter
            done: false,
        });
    }
    const order = gals.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = order[i];
        order[i] = order[j];
        order[j] = tmp;
    }
    const st = { n: 0, auto: false, timer: 0 };
    const touch = userTouch(fig);
    function measureNext() {
        if (st.n >= order.length)
            return;
        gals[order[st.n]].done = true;
        st.n++;
        update();
    }
    function slope() {
        let sd = 0, sv = 0;
        for (const g of gals)
            if (g.done) {
                sd += g.d * g.d;
                sv += g.d * g.v;
            }
        return sd ? sv / sd : 0;
    }
    function update() {
        if (st.n < 6)
            readout.textContent = st.n + ' measured — keep going, the pattern needs a few more';
        else
            readout.innerHTML = 'slope ≈ <b>' + fmt(slope(), 0) + ' km/s per Mpc</b> — every megaparsec adds that much recession speed';
    }
    nextBtn.addEventListener('click', measureNext);
    allBtn.addEventListener('click', () => { st.auto = true; });
    resetBtn.addEventListener('click', () => { gals.forEach(g => { g.done = false; }); st.n = 0; st.auto = false; update(); });
    let last = 0;
    function draw(t) {
        const [ctx, W, H] = fit(cv);
        const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
        last = t;
        if (st.auto && !reduced) {
            st.timer += dt;
            if (st.timer > 0.35) {
                st.timer = 0;
                measureNext();
                if (st.n >= order.length)
                    st.auto = false;
            }
        }
        ctx.clearRect(0, 0, W, H);
        // left: the sky
        for (const g of gals) {
            const x = g.x * W, y = g.y * H;
            const r = clamp(9 - g.d / 42, 2, 9);
            ctx.globalAlpha = g.done ? 0.95 : 0.55;
            ctx.fillStyle = g.done ? TEAL_B : STAR_C;
            ctx.beginPath();
            ctx.arc(x, y, r * 0.55, 0, TAU);
            ctx.fill();
            if (g.done) {
                ctx.globalAlpha = 0.6;
                ctx.strokeStyle = TEAL;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(x, y, r * 0.55 + 4, 0, TAU);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = FAINT;
        ctx.font = '10.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('the sky — smaller means farther', W * 0.23, H - 12);
        // right: the diagram
        const px0 = W * 0.52, px1 = W - 34, py0 = H - 46, py1 = 24;
        const X = (d) => px0 + (d / 320) * (px1 - px0);
        const Y = (v) => py0 - (v / 24000) * (py0 - py1);
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = LINE_C;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px0, py0);
        ctx.lineTo(px1, py0);
        ctx.moveTo(px0, py0);
        ctx.lineTo(px0, py1);
        ctx.stroke();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = FAINT;
        ctx.textAlign = 'center';
        ctx.fillText('distance →', (px0 + px1) / 2, py0 + 24);
        ctx.save();
        ctx.translate(px0 - 14, (py0 + py1) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('speed away →', 0, 0);
        ctx.restore();
        // fitted line once the pattern is real
        if (st.n >= 6) {
            const h = slope();
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = GOLD;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(X(0), Y(0));
            ctx.lineTo(X(320), Y(h * 320));
            ctx.stroke();
        }
        for (const g of gals) {
            if (!g.done)
                continue;
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = TEAL_B;
            ctx.beginPath();
            ctx.arc(X(g.d), Y(g.v), 3, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
    autoOnView(fig, () => { if (!touch.touched && !reduced)
        st.auto = true; }, 1300);
    loopWhenVisible(cv, draw);
    update();
})();
/* ───────────────────────── 18 · everywhere at once ───────────────────────── */
(function () {
    const cv = $('#w-grid');
    if (!cv)
        return;
    const backBtn = $('#grid-back');
    const readout = $('#grid-read');
    const SP = 58; // comoving lattice spacing, px at a = 1
    function jit(i, j) {
        const r = mulberry32((i * 73856093) ^ (j * 19349663) ^ 0x9e3779b9);
        return [(r() - 0.5) * 22, (r() - 0.5) * 22];
    }
    const st = { a: 0.62, mode: 'fwd', ci: 0, cj: 0, hold: 0, fade: 1 };
    backBtn.addEventListener('click', () => { if (st.mode !== 'back') {
        st.mode = 'back';
    } });
    cv.addEventListener('pointerdown', e => {
        const r = cv.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        // nearest lattice dot becomes the new center of the universe
        const W = r.width, H = r.height;
        const s = SP * st.a;
        st.ci = st.ci + Math.round((x - W / 2) / s);
        st.cj = st.cj + Math.round((y - H / 2) / s);
    });
    let last = 0;
    function draw(t) {
        const [ctx, W, H] = fit(cv);
        const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
        last = t;
        if (!reduced) {
            if (st.mode === 'fwd') {
                st.a *= 1 + dt * 0.14;
                if (st.a > 2.1) {
                    st.fade = Math.max(0, st.fade - dt * 3);
                    if (st.fade <= 0) {
                        st.a = 0.62;
                    }
                }
                else if (st.fade < 1)
                    st.fade = Math.min(1, st.fade + dt * 3);
            }
            else if (st.mode === 'back') {
                st.a *= 1 - dt * 0.6;
                if (st.a < 0.075) {
                    st.a = 0.075;
                    st.mode = 'hold';
                    st.hold = 0;
                }
            }
            else {
                st.hold += dt;
                if (st.hold > 1.6)
                    st.mode = 'fwd';
            }
        }
        ctx.clearRect(0, 0, W, H);
        const s = SP * st.a;
        const ni = Math.ceil(W / 2 / s) + 1, nj = Math.ceil(H / 2 / s) + 1;
        for (let di = -ni; di <= ni; di++) {
            for (let dj = -nj; dj <= nj; dj++) {
                const i = st.ci + di, j = st.cj + dj;
                const [jx, jy] = jit(i, j);
                const x = W / 2 + di * s + jx * st.a;
                const y = H / 2 + dj * s + jy * st.a;
                if (x < -8 || x > W + 8 || y < -8 || y > H + 8)
                    continue;
                const dist = Math.hypot(x - W / 2, y - H / 2);
                const isYou = di === 0 && dj === 0;
                ctx.globalAlpha = st.fade * (isYou ? 0.95 : 0.6);
                ctx.fillStyle = isYou ? TEAL_B : STAR_C;
                ctx.beginPath();
                ctx.arc(x, y, isYou ? 3 : 1.6, 0, TAU);
                ctx.fill();
                // recession arrows: speed grows with distance — Hubble's law, emerging from a grid
                if (!isYou && st.mode === 'fwd' && (i + j) % 3 === 0 && dist > 60 && dist < 240) {
                    const ux = (x - W / 2) / dist, uy = (y - H / 2) / dist;
                    ctx.globalAlpha = st.fade * 0.3;
                    arrow(ctx, x + ux * 6, y + uy * 6, x + ux * (6 + dist * 0.11), y + uy * (6 + dist * 0.11), TEAL, 1);
                }
            }
        }
        // the center ring
        ctx.globalAlpha = st.fade * 0.9;
        ctx.strokeStyle = TEAL;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, 8, 0, TAU);
        ctx.stroke();
        ctx.font = '10.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = TEAL_B;
        ctx.fillText('the center (you — or whoever you click)', W / 2 + 14, H / 2 + 20);
        if (st.mode === 'hold' || (st.mode === 'back' && st.a < 0.2)) {
            ctx.globalAlpha = 0.92;
            ctx.fillStyle = GOLD;
            ctx.textAlign = 'center';
            ctx.font = '600 13px "JetBrains Mono", monospace';
            ctx.fillText('hot · dense · EVERYWHERE — no center, no edge', W / 2, 30);
        }
        readout.textContent = st.mode === 'fwd'
            ? 'every dot sees the same thing: everyone else receding, faster with distance'
            : (st.mode === 'back' ? 'running the film backward…' : 'this is the bang — a moment, not a place. now watch it expand');
        ctx.globalAlpha = 1;
    }
    loopWhenVisible(cv, draw);
})();
