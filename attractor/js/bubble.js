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
/* Part IV · The Bubble — four widgets.
   11 The black sky          — a wave stretching in transit: visible → IR → microwave.
   12 Deeper than seeing     — the instrument ladder catches what the eye cannot.
   13 The wall of first light — the observer-centered bubble, orbitable in 3-D.
   14 The impossible distance — a photon on a stretching band: 13.8 Gly vs ~40 now.
   All schematic: honest shapes and honest ratios, not survey data. */
/* Shared: log-slider position (0..1000) ↔ stretch factor S = 1+z (1 .. ~1120). */
function stretchFromSlider(v) {
    return Math.pow(10, (v / 1000) * 3.05);
}
function sliderFromStretch(s) {
    return clamp(Math.round((Math.log10(s) / 3.05) * 1000), 0, 1000);
}
function bandName(s) {
    if (s < 1.05)
        return 'visible — barely shifted';
    if (s < 1.8)
        return 'visible, reddened';
    if (s < 50)
        return 'infrared — JWST territory';
    if (s < 1000)
        return 'far infrared';
    return 'sub-mm — the CMB’s neighborhood';
}
/* ───────────────────────── 11 · ripples, stretched ───────────────────────── */
(function () {
    const cv = $('#w-pond');
    if (!cv)
        return;
    const fig = cv.closest('.fig');
    const slider = $('#pond-z');
    const readout = $('#pond-read');
    const rng = mulberry32(41);
    const sprite = [];
    for (let i = 0; i < 40; i++) {
        const r = Math.sqrt(rng());
        const a = r * 6.5 + (i % 2) * Math.PI + gauss(rng) * 0.3;
        sprite.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    const st = { S: 1.02, target: NaN, auto: true };
    const touch = userTouch(fig, () => { st.auto = false; st.target = NaN; });
    slider.addEventListener('input', () => { st.S = stretchFromSlider(Number(slider.value)); });
    $$('.pond-chip', fig).forEach(b => b.addEventListener('click', () => {
        st.auto = false;
        st.target = Number(b.dataset.s);
    }));
    function visRamp(u) {
        // within the visible band: teal (bluer) → gold (redder)
        return 'rgb(' + Math.round(lerp(45, 240, u)) + ',' + Math.round(lerp(212, 201, u)) + ',' + Math.round(lerp(191, 108, u)) + ')';
    }
    let last = 0;
    function draw(t) {
        const [ctx, W, H] = fit(cv);
        const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
        last = t;
        if (st.auto && !reduced) {
            st.S *= 1 + dt * 0.28;
            if (st.S >= 1120) {
                st.S = 1120;
                st.auto = false;
            }
        }
        if (!isNaN(st.target)) {
            const ls = Math.log(st.S), lt = Math.log(st.target);
            const nl = ls + (lt - ls) * Math.min(1, dt * 3);
            st.S = Math.exp(nl);
            if (Math.abs(lt - nl) < 0.01) {
                st.S = st.target;
                st.target = NaN;
            }
        }
        const S = st.S;
        ctx.clearRect(0, 0, W, H);
        const midY = H * 0.44, x0 = 92, x1 = W - 82;
        // source galaxy
        ctx.fillStyle = STAR_C;
        for (const p of sprite) {
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.arc(56 + p[0] * 22, midY + p[1] * 13, 1, 0, TAU);
            ctx.fill();
        }
        // you: an eye
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = TEAL;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(W - 46, midY, 17, 10, 0, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = TEAL_B;
        ctx.beginPath();
        ctx.arc(W - 46, midY, 4, 0, TAU);
        ctx.fill();
        // the wave, stretching in transit (a chirp: local wavelength grows toward you)
        const lam0 = 13;
        let phase = 0;
        let px = x0, py = midY;
        for (let x = x0; x <= x1; x += 2) {
            const u = (x - x0) / (x1 - x0);
            const sLoc = 1 + (S - 1) * Math.pow(u, 1.5);
            phase += 2 / (lam0 * sLoc);
            const amp = 15 / Math.pow(sLoc, 0.22);
            const y = midY - Math.sin(phase * TAU) * amp;
            if (sLoc < 1.8) {
                ctx.strokeStyle = visRamp((sLoc - 1) / 0.8);
                ctx.globalAlpha = 0.9;
                ctx.setLineDash([]);
            }
            else if (sLoc < 1000) {
                ctx.strokeStyle = FAINT;
                ctx.globalAlpha = 0.75;
                ctx.setLineDash([]);
            }
            else {
                ctx.strokeStyle = VIOLET;
                ctx.globalAlpha = 0.8;
                ctx.setLineDash([4, 4]);
            }
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(x, y);
            ctx.stroke();
            px = x;
            py = y;
        }
        ctx.setLineDash([]);
        // threshold markers along the journey
        ctx.font = '10.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        for (const [sThr, lab] of [[1.8, 'leaves the visible'], [1000, 'enters the microwave']]) {
            if (S <= sThr)
                continue;
            const u = Math.pow((sThr - 1) / (S - 1), 1 / 1.5);
            const x = x0 + u * (x1 - x0);
            ctx.globalAlpha = 0.6;
            ctx.strokeStyle = FAINT;
            ctx.beginPath();
            ctx.moveTo(x, midY - 44);
            ctx.lineTo(x, midY + 44);
            ctx.stroke();
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = FAINT;
            ctx.fillText(lab, x, midY + 60);
        }
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = FAINT;
        ctx.fillText('the source', 56, midY + 38);
        ctx.fillText('you', W - 46, midY + 34);
        readout.textContent = 'stretch ×' + (S < 10 ? fmt(S, 2) : fmt(S, 0)) + ' — arrives as ' + bandName(S);
        if (document.activeElement !== slider)
            slider.value = String(sliderFromStretch(S));
    }
    autoOnView(fig, () => { if (!touch.touched && !reduced)
        st.auto = true; }, 700);
    loopWhenVisible(cv, draw);
})();
/* ───────────────────────── 12 · the instrument ladder ───────────────────────── */
(function () {
    const cv = $('#w-ladder');
    if (!cv)
        return;
    const fig = cv.closest('.fig');
    const slider = $('#lad-z');
    const readout = $('#lad-read');
    // log10(λ in meters): axis from 100 nm (-7) to 10 cm (-1)
    const L0 = -7, L1 = -1;
    const INST = [
        { name: 'your eye', lo: Math.log10(380e-9), hi: Math.log10(750e-9) },
        { name: 'night vision', lo: Math.log10(700e-9), hi: Math.log10(14e-6) },
        { name: 'JWST', lo: Math.log10(600e-9), hi: Math.log10(28.5e-6) },
        { name: 'far-IR space telescope', lo: Math.log10(55e-6), hi: Math.log10(670e-6) },
        { name: 'microwave dish', lo: Math.log10(300e-6), hi: Math.log10(0.1) },
    ];
    const BANDS = [
        [Math.log10(100e-9), Math.log10(380e-9), 'UV'],
        [Math.log10(380e-9), Math.log10(750e-9), 'VISIBLE'],
        [Math.log10(750e-9), Math.log10(1e-3), 'INFRARED'],
        [Math.log10(1e-3), Math.log10(0.1), 'MICROWAVE'],
    ];
    function fmtLam(m) {
        if (m < 1e-6)
            return fmt(m * 1e9, 0) + ' nm';
        if (m < 1e-3)
            return fmt(m * 1e6, m < 1e-5 ? 1 : 0) + ' μm';
        if (m < 1e-2)
            return fmt(m * 1e3, 1) + ' mm';
        return fmt(m * 100, 1) + ' cm';
    }
    const st = { S: 1.02, auto: true };
    const touch = userTouch(fig, () => { st.auto = false; });
    slider.addEventListener('input', () => { st.S = stretchFromSlider(Number(slider.value)); });
    let last = 0;
    function draw(t) {
        const [ctx, W, H] = fit(cv);
        const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
        last = t;
        if (st.auto && !reduced) {
            st.S *= 1 + dt * 0.22;
            if (st.S >= 1120) {
                st.S = 1120;
                st.auto = false;
            }
        }
        const S = st.S;
        ctx.clearRect(0, 0, W, H);
        const ax0 = 60, ax1 = W - 40, axY = H - 64;
        const X = (lg) => ax0 + ((lg - L0) / (L1 - L0)) * (ax1 - ax0);
        // spectral bands
        ctx.font = '10.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        for (const [lo, hi, nm] of BANDS) {
            ctx.globalAlpha = 0.08;
            ctx.fillStyle = nm === 'VISIBLE' ? TEAL : (nm === 'MICROWAVE' ? VIOLET : STAR_C);
            ctx.fillRect(X(lo), axY - 8, X(hi) - X(lo), 16);
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = FAINT;
            ctx.fillText(nm, (X(lo) + X(hi)) / 2, axY + 26);
        }
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = LINE_C;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ax0, axY);
        ctx.lineTo(ax1, axY);
        ctx.stroke();
        // the arriving wavelength (visible 550 nm at departure)
        const lam = 550e-9 * S;
        const lg = Math.log10(lam);
        const mx = X(clamp(lg, L0, L1));
        // trail from departure seat
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = GOLD;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(X(Math.log10(550e-9)), axY);
        ctx.lineTo(mx, axY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = GOLD;
        ctx.shadowColor = GOLD;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(mx, axY, 5, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        // instruments: rows of brackets that light up when they can catch it
        const caught = [];
        INST.forEach((ins, i) => {
            const y = 34 + i * ((H - 130) / (INST.length - 1));
            const on = lg >= ins.lo && lg <= ins.hi;
            if (on)
                caught.push(ins.name);
            ctx.globalAlpha = on ? 0.95 : 0.3;
            ctx.strokeStyle = on ? TEAL : FAINT;
            ctx.lineWidth = on ? 2 : 1.2;
            const xa = X(ins.lo), xb = X(Math.min(ins.hi, L1));
            ctx.beginPath();
            ctx.moveTo(xa, y + 6);
            ctx.lineTo(xa, y);
            ctx.lineTo(xb, y);
            ctx.lineTo(xb, y + 6);
            ctx.stroke();
            ctx.fillStyle = on ? TEAL_B : FAINT;
            ctx.font = (on ? '600 ' : '') + '10.5px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillText(ins.name, xa, y - 6);
            // drop line to the marker's column for the active instrument
            if (on) {
                ctx.globalAlpha = 0.25;
                ctx.strokeStyle = TEAL;
                ctx.beginPath();
                ctx.moveTo(mx, y);
                ctx.lineTo(mx, axY - 8);
                ctx.stroke();
            }
        });
        readout.textContent = 'λ ≈ ' + fmtLam(lam) + ' — caught by: ' + (caught.length ? caught.join(', ') : 'nothing on this ladder');
        if (document.activeElement !== slider)
            slider.value = String(sliderFromStretch(S));
        ctx.globalAlpha = 1;
    }
    autoOnView(fig, () => { if (!touch.touched && !reduced)
        st.auto = true; }, 900);
    loopWhenVisible(cv, draw);
})();
/* ───────────────────────── 13 · the bubble in 3-D ───────────────────────── */
(function () {
    const cv = $('#w-bubble');
    if (!cv)
        return;
    const rng = mulberry32(97);
    // galaxies inside the bubble (uniform in the ball)
    const inner = [];
    for (let i = 0; i < 620; i++) {
        const th = rng() * TAU, ph = Math.acos(2 * rng() - 1), r = Math.cbrt(rng()) * 0.93;
        inner.push([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)]);
    }
    // the wall: CMB shell speckle
    const N = 900;
    const shell = [];
    const shellC = [];
    const modes = [];
    for (let i = 0; i < 5; i++) {
        const th = rng() * TAU, ph = Math.acos(2 * rng() - 1);
        modes.push([Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph), 3 + rng() * 5, rng() * TAU]);
    }
    for (let i = 0; i < N; i++) {
        const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996;
        const p = [Math.cos(th) * r, y, Math.sin(th) * r];
        shell.push(p);
        let v = 0;
        for (const m of modes)
            v += Math.sin((p[0] * m[0] + p[1] * m[1] + p[2] * m[2]) * m[3] + m[4]);
        const u = clamp((v / 2.4 + 1) / 2, 0, 1);
        shellC.push(u < 0.5
            ? 'rgba(139,124,248,' + fmt(0.5 + u * 0.4, 2) + ')'
            : 'rgba(240,201,108,' + fmt(0.3 + (u - 0.5) * 0.8, 2) + ')');
    }
    // someone else's bubble, same radius, centered on a distant galaxy
    const OG = [0.55, 0.13, -0.32];
    const other = [];
    for (let i = 0; i < 240; i++) {
        const y = 1 - (i / 239) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996;
        other.push([OG[0] + Math.cos(th) * r, OG[1] + y, OG[2] + Math.sin(th) * r]);
    }
    const cam = { yaw: 0.5, pitch: 0.16, cx: 0, cy: 0, scale: 100, dist: 4.4 };
    const orb = orbit(cv, cam);
    let showOther = false;
    const obtn = $('#bub-other');
    obtn.addEventListener('click', () => { showOther = !showOther; obtn.classList.toggle('on', showOther); });
    let last = 0;
    function draw(t) {
        const [ctx, W, H] = fit(cv);
        const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
        last = t;
        if (!orb.everDragged && !reduced)
            cam.yaw += dt * 0.06;
        cam.cx = W / 2;
        cam.cy = H / 2;
        cam.scale = Math.min(W, H) * 0.40;
        ctx.clearRect(0, 0, W, H);
        // interior galaxies
        for (const p of inner) {
            const q = project(cam, p);
            const dn = clamp((q[2] - 0.75) * 2.2, 0, 1);
            ctx.globalAlpha = 0.1 + 0.4 * dn;
            ctx.fillStyle = SKY;
            ctx.beginPath();
            ctx.arc(q[0], q[1], 0.7 + 1.2 * dn, 0, TAU);
            ctx.fill();
        }
        // the wall
        for (let i = 0; i < N; i++) {
            const q = project(cam, shell[i]);
            const dn = clamp((q[2] - 0.72) * 2.0, 0, 1);
            if (dn < 0.03)
                continue;
            ctx.globalAlpha = 0.14 + 0.5 * dn;
            ctx.fillStyle = shellC[i];
            ctx.beginPath();
            ctx.arc(q[0], q[1], 1 + 1.7 * dn, 0, TAU);
            ctx.fill();
        }
        // someone else's bubble spills past our wall
        if (showOther) {
            const oc = project(cam, OG);
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = TEAL_B;
            ctx.beginPath();
            ctx.arc(oc[0], oc[1], 2.6, 0, TAU);
            ctx.fill();
            for (const p of other) {
                const q = project(cam, p);
                const dn = clamp((q[2] - 0.68) * 2.0, 0, 1);
                ctx.globalAlpha = 0.08 + 0.22 * dn;
                ctx.fillStyle = TEAL_B;
                ctx.beginPath();
                ctx.arc(q[0], q[1], 1, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = TEAL_B;
            ctx.font = '10.5px "JetBrains Mono", monospace';
            // below their dot, aligned away from the nearest edge, clear of "you"
            ctx.textAlign = oc[0] > W * 0.55 ? 'right' : 'left';
            ctx.fillText('another observer — their wall holds space we never see', oc[0] + (oc[0] > W * 0.55 ? -10 : 10), oc[1] + 20);
        }
        // you + radius
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = TEAL;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cam.cx, cam.cy, 5, 0, TAU);
        ctx.stroke();
        const rp = project(cam, [0.985, -0.1, 0.12]);
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = FAINT;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(cam.cx, cam.cy);
        ctx.lineTo(rp[0], rp[1]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = FAINT;
        ctx.font = '10.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText('46.5 billion light-years', (cam.cx + rp[0]) / 2 + 8, (cam.cy + rp[1]) / 2 - 6);
        ctx.fillStyle = TEAL_B;
        // left of center so it can't collide with the radius line or the other observer
        ctx.textAlign = 'right';
        ctx.fillText('you — the center of your universe', cam.cx - 12, cam.cy + 18);
        ctx.globalAlpha = 1;
    }
    loopWhenVisible(cv, draw);
})();
/* ───────────────────────── 14 · the impossible distance ───────────────────────── */
(function () {
    const cv = $('#w-band');
    if (!cv)
        return;
    const fig = cv.closest('.fig');
    const playBtn = $('#band-play');
    const resetBtn = $('#band-reset');
    const readout = $('#band-read');
    const rng = mulberry32(23);
    const sprite = [];
    for (let i = 0; i < 36; i++) {
        const r = Math.sqrt(rng());
        const a = r * 6.5 + (i % 2) * Math.PI + gauss(rng) * 0.3;
        sprite.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    // Toy matter-only universe: a(t) = (t/T)^(2/3), c = 1, distances in Gly, time in Gyr.
    const T = 13.8, t0 = 0.00038;
    const a = (t) => Math.pow(t / T, 2 / 3);
    // comoving seat of the source, chosen so the photon lands on you exactly at T
    const CHI0 = 3 * T * (1 - Math.pow(t0 / T, 1 / 3)); // ≈ 40 Gly
    const chiPhoton = (t) => CHI0 - 3 * T * (Math.pow(t / T, 1 / 3) - Math.pow(t0 / T, 1 / 3));
    const st = { p: 0, playing: false, done: false };
    const touch = userTouch(fig);
    function syncPlay() { playBtn.textContent = st.playing ? 'pause' : (st.done ? 'replay' : 'play'); playBtn.classList.toggle('on', st.playing); }
    playBtn.addEventListener('click', () => {
        if (st.done) {
            st.p = 0;
            st.done = false;
        }
        st.playing = !st.playing;
        syncPlay();
    });
    resetBtn.addEventListener('click', () => { st.p = 0; st.playing = false; st.done = false; syncPlay(); });
    let last = 0;
    function draw(tm) {
        const [ctx, W, H] = fit(cv);
        const dt = last ? Math.min(0.05, (tm - last) / 1000) : 0.016;
        last = tm;
        if (st.playing && !reduced) {
            st.p += dt / 17;
            if (st.p >= 1) {
                st.p = 1;
                st.playing = false;
                st.done = true;
                syncPlay();
            }
        }
        // cubic easing: the early universe crawls by, the late universe glides
        const t = t0 + (T - t0) * Math.pow(st.p, 3);
        const at = a(t);
        const chiP = clamp(chiPhoton(t), 0, CHI0);
        ctx.clearRect(0, 0, W, H);
        const youX = W - 74, bandY = H * 0.46;
        // camera: pin the source near the left edge whatever the universe's size
        const span = Math.max(0.05, CHI0 * at);
        const K = (W - 170) / span;
        // the band + comoving ticks (every 5 Gly of comoving distance)
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = LINE_C;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(youX - CHI0 * at * K, bandY);
        ctx.lineTo(youX, bandY);
        ctx.stroke();
        ctx.font = '10.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        for (let m = 5; m < CHI0; m += 5) {
            const x = youX - m * at * K;
            ctx.globalAlpha = 0.45;
            ctx.strokeStyle = LINE_C;
            ctx.beginPath();
            ctx.moveTo(x, bandY - 5);
            ctx.lineTo(x, bandY + 5);
            ctx.stroke();
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = FAINT;
            ctx.fillText(fmt(m * at, m * at < 10 ? 1 : 0) + ' Gly', x, bandY + 22);
        }
        // the source
        const srcX = youX - CHI0 * at * K;
        ctx.fillStyle = GOLD;
        for (const p of sprite) {
            ctx.globalAlpha = 0.75;
            ctx.beginPath();
            ctx.arc(srcX + p[0] * 15, bandY - 40 + p[1] * 9, 1, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = FAINT;
        ctx.fillText('the source', srcX, bandY - 62);
        // you
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = TEAL;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(youX, bandY - 40, 6, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = FAINT;
        ctx.fillText('you', youX, bandY - 62);
        // the photon
        const phX = youX - chiP * at * K;
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = GOLD;
        ctx.shadowColor = GOLD;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(phX, bandY - 40, 4, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        arrow(ctx, phX + 8, bandY - 40, phX + 26, bandY - 40, GOLD, 1.6);
        // the story in numbers
        const odo = t - t0;
        const srcNow = CHI0 * at;
        readout.innerHTML =
            'time <b>' + (t < 1 ? fmt(t * 1000, 0) + ' Myr' : fmt(t, 1) + ' Gyr') + '</b>' +
                ' · universe ×<b>' + (at < 0.01 ? fmt(at, 4) : fmt(at, 2)) + '</b> its final size' +
                ' · photon odometer <b>' + fmt(odo, odo < 10 ? 2 : 1) + ' Gly</b>' +
                ' · source is now <b>' + fmt(srcNow, srcNow < 10 ? 2 : 1) + ' Gly</b> away';
        if (st.done) {
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = TEAL_B;
            ctx.textAlign = 'center';
            ctx.fillText('13.8-billion-year-old light, from a source now ~40 Gly away — with the full expansion history, 46.5', W / 2, H - 16);
        }
        ctx.globalAlpha = 1;
    }
    autoOnView(fig, () => { if (!touch.touched && !reduced && !st.playing)
        playBtn.dispatchEvent(new Event('click')); }, 1100);
    loopWhenVisible(cv, draw);
})();
