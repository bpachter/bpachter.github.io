"use strict";
/* ─────────────────────────────────────────────────────────────
   Gradient · core.ts — shared helpers for every page.
   Hand-written TypeScript, zero runtime dependencies.
   Compiled per-page with `tsc --outFile` (see build.sh).
   ───────────────────────────────────────────────────────────── */
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
/* palette — mirrors style.css */
const INK = '#2d2a24', LEAF = '#8aae68', LEAF_D = '#55793c', SAGE = '#7d9070', SLATE = '#6b7fa3', GOLD = '#c9a227', PLUM = '#9a6fa0', FAINT = '#8a8171', PAPER = '#faf7f0', BAD = '#c05b4d', GOOD = '#5e8d5a';
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
    return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
}
/* crisp canvases: logical size from width/height attrs, scaled for DPR */
function fit(cv) {
    const w = cv.width, h = cv.height, dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = w * dpr;
    cv.height = h * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    return [ctx, w, h];
}
/* hand-drawn line: slight jitter, 2 passes */
function rough(ctx, pts, color, width, seed) {
    const rng = mulberry32(seed || 7);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
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
function arrow(ctx, x1, y1, x2, y2, color, width) {
    rough(ctx, [[x1, y1], [x2, y2]], color, width, (x1 * 7 + y2) | 0);
    const a = Math.atan2(y2 - y1, x2 - x1), s = 9 + width * 1.5;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45));
    ctx.stroke();
}
const fmt = (n, d) => n.toFixed(d === undefined ? 2 : d);
/* scroll reveals: decorations draw in; widgets drift up (JS-gated, safe) */
const revealIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) {
        e.target.classList.add('drawn', 'in');
        revealIO.unobserve(e.target);
    }
}), { threshold: 0.25 });
$$('.draw-me').forEach(p => revealIO.observe(p));
$$('.widget, .part-card').forEach(el => { el.classList.add('fade-up'); revealIO.observe(el); });
setTimeout(() => $$('.hero .draw-me, .part-hero .draw-me').forEach(p => p.classList.add('drawn')), 300);
/* pause loops when offscreen */
function visible(el, cb) {
    new IntersectionObserver(es => cb(es[0].isIntersecting), { threshold: 0.05 }).observe(el);
}
/* run a demo once, hands-free, when the widget scrolls into view —
   unless the reader already touched it. every widget opts in with this. */
function autoOnView(el, cb, delayMs = 700) {
    if (reduced)
        return;
    let fired = false;
    const io = new IntersectionObserver(es => {
        if (es[0].isIntersecting && !fired) {
            fired = true;
            io.disconnect();
            window.setTimeout(cb, delayMs);
        }
    }, { threshold: 0.45 });
    io.observe(el);
}
/* marks a widget as user-owned the first time any control is touched */
function userTouch(el, onTouch) {
    const state = { touched: false };
    const mark = () => { if (!state.touched) {
        state.touched = true;
        if (onTouch)
            onTouch();
    } };
    el.addEventListener('pointerdown', mark, { capture: true });
    el.addEventListener('input', mark, { capture: true });
    return state;
}
function project(cam, p) {
    const [x, y, z] = p;
    const ca = Math.cos(cam.yaw), sa = Math.sin(cam.yaw);
    const x1 = x * ca - z * sa, z1 = x * sa + z * ca;
    const cb = Math.cos(cam.pitch), sb = Math.sin(cam.pitch);
    const y2 = y * cb - z1 * sb, z2 = y * sb + z1 * cb;
    const per = cam.dist / (cam.dist + z2);
    return [cam.cx + x1 * cam.scale * per, cam.cy - y2 * cam.scale * per, per];
}
/* drag-to-orbit; returns cam and whether the user is (or has been) dragging */
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
        cam.pitch = Math.max(0.12, Math.min(1.25, cam.pitch + (e.clientY - py) * 0.006));
        px = e.clientX;
        py = e.clientY;
    });
    const up = () => { st.dragging = false; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    return st;
}
/* Gradient · landing.ts — the loop that answers you, animated end to end.
   Requires core.ts (same bundle). */
(function () {
    const cv = $('#cv-pipe');
    if (!cv)
        return;
    const [ctx, W, H] = fit(cv);
    const STEPS = [
        { cands: [['Because', 0.58], ['Sunlight', 0.22], ['The', 0.11]] },
        { cands: [['sunlight', 0.64], ['blue', 0.15], ['light', 0.10]] },
        { cands: [['scatters', 0.52], ['bounces', 0.24], ['spreads', 0.11]] },
        { cands: [['more', 0.38], ['in', 0.27], ['a', 0.16]] },
        { cands: [['blue', 0.71], ['short', 0.14], ['cool', 0.07]] },
        { cands: [['than', 0.77], ['light', 0.11], ['waves', 0.06]] },
        { cands: [['red', 0.69], ['green', 0.13], ['long', 0.09]] },
        { cands: [['.', 0.82], ['!', 0.09], ['…', 0.05]] }
    ];
    const PROMPT_TOKS = ['why', 'is', 'the', 'sky', 'blue', '?'];
    /* layout */
    const PB = { x: 24, y: 14, w: 340, h: 42 }; /* prompt bubble */
    const S1 = { x: 24, y: 96, w: 158, h: 116 }; /* tokens */
    const S2 = { x: 218, y: 96, w: 128, h: 116 }; /* meanings */
    const S3 = { x: 382, y: 88, w: 172, h: 130 }; /* tower */
    const S4 = { x: 592, y: 92, w: 264, h: 124 }; /* odds */
    const ANS = { x: 24, y: 292 };
    const CYCLE = 1550, HOLD = 1900;
    /* the model doesn't take the top guess — it SAMPLES. temperature reshapes the odds,
       but reshaping alone is order-preserving (argmax never moves), so we actually draw. */
    const rngP = mulberry32(0x5eed);
    const TEMP = () => { const el = $('#in-pipe-temp'); return el ? +el.value : 0.2; };
    let picks = STEPS.map(() => 0);
    function scaledProbs(cands, T) {
        const s = cands.map(([, p]) => Math.pow(p, 1 / Math.max(0.05, T)));
        const z = s.reduce((a, b) => a + b, 0) || 1;
        return s.map(v => v / z);
    }
    function sampleStep(cands, T) {
        const sp = scaledProbs(cands, T);
        let r = rngP();
        for (let i = 0; i < sp.length; i++) {
            r -= sp[i];
            if (r <= 0)
                return i;
        }
        return sp.length - 1;
    }
    function resample() { picks = STEPS.map(s => sampleStep(s.cands, TEMP())); }
    function box(s, active, cap) {
        ctx.fillStyle = active > 0.05 ? `rgba(138,174,104,${0.10 + active * 0.12})` : 'rgba(45,42,36,0.025)';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2 + active * 1.2;
        ctx.beginPath();
        ctx.roundRect(s.x, s.y, s.w, s.h, 12);
        ctx.fill();
        ctx.stroke();
        ctx.font = '15px Caveat, cursive';
        ctx.fillStyle = active > 0.05 ? LEAF_D : FAINT;
        ctx.textAlign = 'center';
        ctx.fillText(cap, s.x + s.w / 2, s.y + s.h + 20);
        ctx.textAlign = 'left';
    }
    const phase = (tt, a, b) => Math.max(0, Math.min(1, (tt - a) / 0.09)) * Math.max(0, Math.min(1, (b + 0.09 - tt) / 0.09));
    function draw(stepIdx, tt, done) {
        ctx.clearRect(0, 0, W, H);
        /* prompt bubble */
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(PB.x, PB.y, PB.w, PB.h, 12);
        ctx.fill();
        ctx.stroke();
        ctx.font = '15.5px Karla, sans-serif';
        ctx.fillStyle = INK;
        ctx.fillText('you:  "why is the sky blue?"', PB.x + 14, PB.y + 26);
        const a1 = done ? 0 : phase(tt, 0.16, 0.34);
        const a2 = done ? 0 : phase(tt, 0.34, 0.52);
        const a3 = done ? 0 : phase(tt, 0.50, 0.72);
        const a4 = done ? 0 : phase(tt, 0.70, 0.94);
        box(S1, a1, '1 · chop into tokens');
        box(S2, a2, '2 · look up meanings');
        box(S3, a3, '3 · the tower thinks');
        box(S4, a4, '4 · odds for the next word');
        /* stage 1: token chips */
        PROMPT_TOKS.forEach((tk, i) => {
            const cx = S1.x + 14 + (i % 3) * 46, cy = S1.y + 16 + Math.floor(i / 3) * 34;
            ctx.fillStyle = ['#e2edd6', '#dbe2ee', '#f3e6c3'][i % 3];
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(cx, cy, 42, 24, 7);
            ctx.fill();
            ctx.stroke();
            ctx.font = '12.5px Karla, sans-serif';
            ctx.fillStyle = INK;
            ctx.textAlign = 'center';
            ctx.fillText(tk, cx + 21, cy + 16);
            ctx.textAlign = 'left';
        });
        ctx.font = '12px Karla, sans-serif';
        ctx.fillStyle = FAINT;
        ctx.fillText('+ the answer so far', S1.x + 14, S1.y + 100);
        /* stage 2: embedding dot-columns */
        for (let i = 0; i < 6; i++) {
            for (let d = 0; d < 5; d++) {
                const v = Math.sin(i * 2.7 + d * 1.3) * 0.5 + 0.5;
                ctx.fillStyle = `rgba(107,127,163,${0.25 + v * 0.6})`;
                ctx.beginPath();
                ctx.arc(S2.x + 20 + i * 18, S2.y + 20 + d * 19, 4.5, 0, 7);
                ctx.fill();
            }
        }
        /* stage 3: the tower — slabs light bottom→top */
        for (let l = 0; l < 4; l++) {
            const lit = a3 > 0 ? Math.max(0, Math.min(1, a3 * 5 - (3 - l) * 1.05)) : 0;
            const sx = S3.x + 18 + (3 - l) * 3, sy = S3.y + 12 + (3 - l) * 28;
            ctx.fillStyle = lit > 0.15 ? `rgba(138,174,104,${0.25 + lit * 0.5})` : 'rgba(236,230,216,0.9)';
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.roundRect(sx, sy, S3.w - 42, 22, 6);
            ctx.fill();
            ctx.stroke();
        }
        ctx.font = '12px Karla, sans-serif';
        ctx.fillStyle = FAINT;
        ctx.fillText('× 24 more', S3.x + 22, S3.y + 126);
        /* stage 4: candidate bars — reshaped by temperature, the sampled one in gold */
        const sIdx = Math.min(stepIdx, STEPS.length - 1);
        const st = STEPS[sIdx];
        const sp = scaledProbs(st.cands, TEMP());
        const pick = picks[sIdx];
        st.cands.forEach(([w,], i) => {
            const by = S4.y + 18 + i * 34, grow = done ? 1 : Math.max(0, Math.min(1, (tt - 0.72) / 0.18));
            const winner = i === pick && (done || tt > 0.9);
            ctx.font = '13px Karla, sans-serif';
            ctx.fillStyle = INK;
            ctx.textAlign = 'right';
            ctx.fillText(w, S4.x + 88, by + 13);
            ctx.textAlign = 'left';
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.6;
            ctx.strokeRect(S4.x + 96, by, 130, 18);
            ctx.fillStyle = winner ? GOLD : LEAF;
            ctx.fillRect(S4.x + 97.5, by + 1.5, 127 * sp[i] * grow, 15);
            ctx.fillStyle = FAINT;
            ctx.font = '12px Karla, sans-serif';
            ctx.fillText(Math.round(sp[i] * 100) + '%', S4.x + 232, by + 13);
        });
        /* arrows between stages */
        const flow = [[S1.x + S1.w, S2.x], [S2.x + S2.w, S3.x], [S3.x + S3.w, S4.x]];
        flow.forEach(([xa, xb], i) => {
            const on = [a1, a2, a3][i + 0] > 0 || [a2, a3, a4][i] > 0;
            arrow(ctx, xa + 6, 154, xb - 8, 154, on ? LEAF_D : 'rgba(138,129,113,0.6)', 2);
        });
        /* prompt → stage 1 */
        arrow(ctx, PB.x + 60, PB.y + PB.h + 2, S1.x + 50, S1.y - 6, 'rgba(138,129,113,0.6)', 2);
        /* winner → answer */
        if (done || tt > 0.93)
            arrow(ctx, S4.x + 60, S4.y + S4.h + 4, ANS.x + 240, ANS.y - 22, GOLD, 2);
        /* answer feeds back into the prompt side — the loop! */
        ctx.strokeStyle = 'rgba(138,129,113,0.55)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(ANS.x + 60, ANS.y + 8);
        ctx.quadraticCurveTo(2, (ANS.y + S1.y) / 2 + 30, S1.x + 20, S1.y + 96);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '13px Caveat, cursive';
        ctx.fillStyle = FAINT;
        ctx.fillText('…and the new word goes back in', 30, ANS.y - 34);
        /* the answer line — follows the sampled path, not always the top guess */
        const nDone = done ? STEPS.length : stepIdx + (tt > 0.97 ? 1 : 0);
        const answer = STEPS.slice(0, nDone).map((s, i) => s.cands[picks[i]][0]);
        ctx.font = '18px Fraunces, serif';
        ctx.fillStyle = INK;
        let out = 'claude:  ';
        answer.forEach(w => { out += (w === '.' || w === '!' ? w : ' ' + w); });
        ctx.fillText(out + (done ? '' : ' ▎'), ANS.x, ANS.y + 6);
    }
    const tempSlider = $('#in-pipe-temp');
    if (tempSlider)
        tempSlider.addEventListener('input', () => {
            $('#o-pipe-temp').textContent = (+tempSlider.value).toFixed(2);
            resample();
            if (reduced)
                draw(STEPS.length - 1, 1, true);
        });
    if (reduced) {
        draw(STEPS.length - 1, 1, true);
        return;
    } /* static: the clean, canonical (greedy) answer */
    let t0 = null, onScreen = false, curPass = -1;
    function loop(ts) {
        if (t0 === null)
            t0 = ts;
        const total = STEPS.length * CYCLE + HOLD;
        const elapsed = ts - t0;
        const passN = Math.floor(elapsed / total);
        if (passN !== curPass) {
            curPass = passN;
            resample();
        } /* fresh sample each full pass */
        const t = elapsed % total;
        const idx = Math.floor(t / CYCLE);
        if (idx >= STEPS.length)
            draw(STEPS.length - 1, 1, true);
        else
            draw(idx, (t % CYCLE) / CYCLE, false);
        if (onScreen)
            requestAnimationFrame(loop);
    }
    visible(cv, v => {
        const was = onScreen;
        onScreen = v;
        if (v && !was) {
            t0 = null;
            requestAnimationFrame(loop);
        }
    });
    draw(0, 0.05, false);
})();
