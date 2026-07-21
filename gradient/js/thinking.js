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
/* Gradient · thinking.ts — ch 17-20: chain of thought, RLVR/GRPO,
   the thinking budget, superposition & SAE steering.
   Requires core.ts (same bundle). */
const sleepT = (ms) => new Promise(res => window.setTimeout(res, reduced ? Math.min(ms / 4, 120) : ms));
/* ══════════════ 17 · THINKING OUT LOUD ══════════════ */
(function () {
    const ticksA = $('#cot-ticks-a');
    if (!ticksA)
        return;
    const ticksB = $('#cot-ticks-b'), scratch = $('#cot-scratch');
    /* a longer canonical derivation; the reader dials how many of its steps get written */
    const STEP_LINES = [
        'let ball = x  (dollars).',
        'then bat = x + 1.00.',
        'x + (x + 1.00) = 1.10',
        '→ 2x = 0.10',
        '→ x = 0.05   (the ball is 5¢)',
        'check: 5¢ + $1.05 = $1.10 ✓'
    ];
    const stepsEl = $('#in-cot-steps');
    const steps = () => stepsEl ? +stepsEl.value : 3;
    /* 30% at 0 steps (a pure guess) climbing to ~99% — never 0%, even guessing lands sometimes */
    const acc = (s) => 1 - 0.7 * Math.pow(0.5, s);
    let running = false;
    const rng = mulberry32(1234);
    function tick(el, ok, label) {
        const t = document.createElement('span');
        t.className = 'tick ' + (ok ? 'y' : 'n');
        t.textContent = ok ? '✓' : '✗';
        t.title = label;
        el.appendChild(t);
    }
    function expectLine() {
        const s = steps();
        $('#o-cot-steps').textContent = String(s);
        $('#cot-steps-lbl').textContent = String(s);
        $('#cot-expect').textContent = Math.round(acc(s) * 100) + '% at ' + s + ' step' + (s === 1 ? '' : 's');
    }
    async function run() {
        if (running)
            return;
        running = true;
        const s = steps();
        ticksA.innerHTML = '';
        ticksB.innerHTML = '';
        $('#cot-acc-a').textContent = '—';
        $('#cot-acc-b').textContent = '—';
        /* the scratchpad writes itself — exactly as many steps as the reader dialed in */
        scratch.textContent = '';
        const text = s === 0
            ? '(no scratchpad — it just blurts the first answer that comes to mind)'
            : STEP_LINES.slice(0, s).join('\n');
        for (let i = 0; i <= text.length; i += 2) {
            scratch.textContent = text.slice(0, i) + (i < text.length ? '▎' : '');
            await sleepT(20);
        }
        scratch.textContent = text;
        const pB = acc(s);
        let okA = 0, okB = 0;
        for (let i = 0; i < 20; i++) {
            const a = rng() < 0.3, b = rng() < pB;
            tick(ticksA, a, a ? '5¢ — got lucky' : 'blurted 10¢');
            if (a)
                okA++;
            $('#cot-acc-a').textContent = Math.round(okA / (i + 1) * 100) + '%';
            await sleepT(85);
            tick(ticksB, b, b ? '5¢ — derived' : s === 0 ? 'blurted 10¢' : 'slipped a step');
            if (b)
                okB++;
            $('#cot-acc-b').textContent = Math.round(okB / (i + 1) * 100) + '%';
            await sleepT(85);
        }
        running = false;
    }
    $('#btn-cot-run').addEventListener('click', () => { void run(); });
    if (stepsEl)
        stepsEl.addEventListener('input', expectLine);
    expectLine();
    autoOnView($('#w-cot'), () => { if (!running && ticksA.childElementCount === 0)
        void run(); }, 900);
})();
/* ══════════════ 18 · GRPO ══════════════ */
(function () {
    const stratEl = $('#rlvr-strat');
    if (!stratEl)
        return;
    const rollsEl = $('#rlvr-rolls');
    const STRATS = [
        { name: 'blurt an answer', p: 0.15, color: BAD },
        { name: 'estimate, then adjust', p: 0.45, color: GOLD },
        { name: 'work it step by step', p: 0.75, color: SLATE },
        { name: 'steps + check the result', p: 0.92, color: LEAF_D }
    ];
    let w = [0.25, 0.25, 0.25, 0.25], round = 0, auto = null;
    const rng = mulberry32(777);
    const bars = [], pcts = [];
    STRATS.forEach(s => {
        const row = document.createElement('div');
        row.className = 'strat-row';
        const lbl = document.createElement('span');
        lbl.className = 'lbl';
        lbl.textContent = s.name;
        const wrap = document.createElement('div');
        wrap.style.flex = '1';
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.background = s.color;
        wrap.appendChild(bar);
        const pct = document.createElement('span');
        pct.className = 'pct';
        row.appendChild(lbl);
        row.appendChild(wrap);
        row.appendChild(pct);
        stratEl.appendChild(row);
        bars.push(bar);
        pcts.push(pct);
    });
    function render() {
        w.forEach((v, i) => {
            bars[i].style.width = (v * 100) + '%';
            pcts[i].textContent = Math.round(v * 100) + '%';
        });
        $('#rlvr-round').textContent = String(round);
    }
    function sampleStrat() {
        let r = rng();
        for (let i = 0; i < 4; i++) {
            r -= w[i];
            if (r <= 0)
                return i;
        }
        return 3;
    }
    function doRound() {
        round++;
        rollsEl.innerHTML = '';
        const picks = [], rewards = [];
        for (let i = 0; i < 8; i++) {
            const s = sampleStrat();
            const win = rng() < STRATS[s].p;
            picks.push(s);
            rewards.push(win ? 1 : 0);
            const chip = document.createElement('span');
            chip.className = 'roll ' + (win ? 'win' : 'lose');
            chip.style.animationDelay = (i * 0.07) + 's';
            chip.innerHTML = `<span class="dot" style="background:${STRATS[s].color}"></span>${win ? '✓' : '✗'}`;
            chip.title = STRATS[s].name;
            rollsEl.appendChild(chip);
        }
        const mean = rewards.reduce((a, b) => a + b, 0) / 8;
        /* GRPO: advantage = reward − group mean; no value network anywhere */
        picks.forEach((s, i) => { w[s] *= Math.exp(0.55 * (rewards[i] - mean)); });
        const z = w.reduce((a, b) => a + b, 0);
        w = w.map(v => v / z);
        $('#rlvr-mean').textContent = Math.round(mean * 100) + '%';
        render();
    }
    function stopAuto() { if (auto !== null) {
        clearInterval(auto);
        auto = null;
        $('#btn-rlvr-auto').textContent = 'auto-train';
    } }
    $('#btn-rlvr-round').addEventListener('click', () => { stopAuto(); doRound(); });
    $('#btn-rlvr-auto').addEventListener('click', () => {
        if (auto !== null) {
            stopAuto();
            return;
        }
        $('#btn-rlvr-auto').textContent = 'stop';
        let n = 0;
        auto = window.setInterval(() => { doRound(); if (++n >= 12)
            stopAuto(); }, reduced ? 2100 : 1150);
    });
    $('#btn-rlvr-reset').addEventListener('click', () => { stopAuto(); w = [0.25, 0.25, 0.25, 0.25]; round = 0; rollsEl.innerHTML = ''; $('#rlvr-mean').textContent = '—'; render(); });
    visible(stratEl, v => { if (!v)
        stopAuto(); });
    render();
    const touch = userTouch($('#w-rlvr'));
    autoOnView($('#w-rlvr'), () => {
        if (touch.touched || auto !== null)
            return;
        $('#btn-rlvr-auto').textContent = 'stop';
        let n = 0;
        auto = window.setInterval(() => { doRound(); if (++n >= 12)
            stopAuto(); }, reduced ? 2100 : 1150);
    }, 1000);
})();
/* ══════════════ 19 · THE THINKING BUDGET ══════════════ */
(function () {
    const cv = $('#cv-budget');
    if (!cv)
        return;
    const [ctx, W, H] = fit(cv);
    const KS = [0, 1, 2, 3, 4, 5, 6]; /* budget = 256·2^k */
    const budget = (k) => 256 * Math.pow(2, k);
    const CHAIN = 640; /* tokens per sampled chain */
    const serial = (b) => 0.34 + 0.42 * (1 - Math.exp(-b / 2200));
    const pSample = serial(CHAIN); /* one full chain ≈ .445 */
    /* plurality vote: one correct answer vs a popular trap answer (chains
       repeat the same mistake) plus scattered strays — seeded Monte Carlo */
    function voteAcc(n) {
        if (n <= 1)
            return pSample;
        const rng = mulberry32(9000 + n);
        let wins = 0;
        const TRIALS = 400;
        for (let t = 0; t < TRIALS; t++) {
            let correct = 0, trap = 0;
            const stray = [0, 0, 0, 0, 0];
            for (let i = 0; i < n; i++) {
                const r = rng();
                if (r < pSample)
                    correct++;
                else if (r < pSample + (1 - pSample) * 0.42)
                    trap++; /* the 10¢ of this problem */
                else
                    stray[(rng() * 5) | 0]++;
            }
            const top = Math.max(trap, ...stray);
            if (correct > top)
                wins++;
            else if (correct === top)
                wins += 0.5;
        }
        return wins / TRIALS;
    }
    const bestAcc = (n) => Math.min(0.965, (1 - Math.pow(1 - pSample, Math.max(1, n))) * 0.92);
    function nFor(b) { return Math.max(1, Math.floor(b / CHAIN)); }
    const X = (k) => 70 + (k / 6) * (W - 120);
    const Y = (a) => H - 60 - (a - 0.3) / 0.7 * (H - 120);
    function curves() {
        return [
            { name: 'one long chain', color: SLATE, f: b => serial(b) },
            { name: 'majority vote', color: LEAF_D, f: b => b < CHAIN ? serial(b) : voteAcc(nFor(b)) },
            { name: 'best-of-N + verifier', color: GOLD, f: b => b < CHAIN ? serial(b) : bestAcc(nFor(b)) }
        ];
    }
    function draw() {
        ctx.clearRect(0, 0, W, H);
        const k = +$('#in-budget').value, b = budget(k);
        rough(ctx, [[62, Y(0.3)], [62, Y(1.0) - 6]], INK, 2, 2);
        rough(ctx, [[62, Y(0.3)], [W - 40, Y(0.3)]], INK, 2, 3);
        ctx.font = '13px Karla, sans-serif';
        ctx.fillStyle = FAINT;
        KS.forEach(kk => { ctx.textAlign = 'center'; ctx.fillText(budget(kk) >= 1024 ? (budget(kk) / 1024) + 'k' : String(budget(kk)), X(kk), Y(0.3) + 20); });
        ctx.textAlign = 'left';
        ctx.fillText('accuracy', 14, Y(1.0) - 12);
        ctx.fillText('thinking tokens spent per question (log scale) →', W / 2 - 120, H - 12);
        [0.4, 0.6, 0.8, 1.0].forEach(a => { ctx.fillStyle = FAINT; ctx.fillText(Math.round(a * 100) + '%', 26, Y(a) + 4); });
        /* the budget line */
        ctx.strokeStyle = 'rgba(45,42,36,0.45)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(X(k), Y(0.3));
        ctx.lineTo(X(k), Y(1.0));
        ctx.stroke();
        ctx.setLineDash([]);
        /* curves + markers */
        curves().forEach((c, ci) => {
            const pts = [];
            for (let kk = 0; kk <= 6; kk += 0.25)
                pts.push([X(kk), Y(c.f(budget(kk)))]);
            rough(ctx, pts, c.color, 2.6, 40 + ci);
            const a = c.f(b);
            ctx.fillStyle = c.color;
            ctx.strokeStyle = INK;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(X(k), Y(a), 6.5, 0, 7);
            ctx.fill();
            ctx.stroke();
            ctx.font = '14px Karla, sans-serif';
            ctx.fillStyle = c.color;
            ctx.fillText(c.name, W - 230, 34 + ci * 20);
            ctx.fillRect(W - 252, 27 + ci * 20, 14, 8);
        });
        ctx.font = '15px Caveat, cursive';
        ctx.fillStyle = FAINT;
        ctx.fillText('every curve flattens — the skill is knowing where yours bends', 76, 30);
        const n = b < CHAIN ? 1 : nFor(b);
        $('#o-budget').textContent = b.toLocaleString('en-US');
        $('#bud-serial').textContent = Math.round(serial(b) * 100) + '%';
        $('#bud-vote').textContent = Math.round((b < CHAIN ? serial(b) : voteAcc(n)) * 100) + '% · ' + n + ' chain' + (n > 1 ? 's' : '');
        $('#bud-best').textContent = Math.round((b < CHAIN ? serial(b) : bestAcc(n)) * 100) + '%';
    }
    $('#in-budget').addEventListener('input', draw);
    draw();
    const touch = userTouch($('#w-budget'));
    if (!reduced) {
        let dir = 1;
        const timer = window.setInterval(() => {
            if (touch.touched) {
                clearInterval(timer);
                return;
            }
            const s = $('#in-budget');
            let v = +s.value + dir;
            if (v >= 6) {
                v = 6;
                dir = -1;
            }
            else if (v <= 0) {
                v = 0;
                dir = 1;
            }
            s.value = String(v);
            draw();
        }, 1400);
    }
})();
/* ══════════════ 20 · INSIDE THE MIND ══════════════ */
(function () {
    const cv = $('#cv-sae');
    if (!cv)
        return;
    const [ctx, W, H] = fit(cv);
    const FEATS = [
        { name: '🌉 bridge', color: GOLD, ang: -0.2 },
        { name: '🐕 dog', color: LEAF_D, ang: 0.85 },
        { name: '🌅 sunset', color: PLUM, ang: 1.9 },
        { name: '➗ math', color: SLATE, ang: 2.95 },
        { name: '🎵 music', color: SAGE, ang: 4.0 },
        { name: '🌊 ocean', color: BAD, ang: 5.05 }
    ];
    const THOUGHTS = [
        { 1: 0.85, 2: 0.6, 5: 0.55 }, /* dog on the beach at sunset */
        { 3: 0.9, 4: 0.7 }, /* homework with music on */
        { 0: 0.95, 5: 0.25 } /* the golden bridge in fog */
    ];
    let thought = 0;
    function steerFrac() { return +$('#in-steer').value / 100; }
    function coeffs() {
        const c = FEATS.map((_, i) => THOUGHTS[thought][i] || 0);
        c[0] = Math.max(c[0], steerFrac() * 1.1);
        return c;
    }
    function draw() {
        ctx.clearRect(0, 0, W, H);
        const c = coeffs();
        /* left: the 2-neuron plane with 6 packed directions */
        const cx = 165, cy = H / 2 + 8, R = 96;
        ctx.font = '13px Karla, sans-serif';
        ctx.fillStyle = FAINT;
        ctx.fillText('6 ideas crammed into a 2-neuron space', 40, 26);
        FEATS.forEach((f, i) => {
            const ux = Math.cos(f.ang), uy = Math.sin(f.ang);
            ctx.strokeStyle = f.color;
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + ux * R, cy - uy * R);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.font = '12px Karla, sans-serif';
            ctx.fillStyle = c[i] > 0.05 ? INK : FAINT;
            ctx.textAlign = 'center';
            ctx.fillText(f.name, cx + ux * (R + 22), cy - uy * (R + 22) + 4);
            ctx.textAlign = 'left';
        });
        /* the tangled activation vector = sum of active directions */
        let ax = 0, ay = 0;
        FEATS.forEach((f, i) => { ax += Math.cos(f.ang) * c[i]; ay += Math.sin(f.ang) * c[i]; });
        arrow(ctx, cx, cy, cx + ax * R * 0.75, cy - ay * R * 0.75, INK, 3);
        /* middle: what the two raw neurons report */
        const mx = 392;
        ctx.font = '13px Karla, sans-serif';
        ctx.fillStyle = FAINT;
        ctx.fillText('the 2 neurons report:', mx, 26);
        const raw = [Math.abs(ax) / 2, Math.abs(ay) / 2];
        ['neuron 1', 'neuron 2'].forEach((n, i) => {
            const y = 62 + i * 58;
            ctx.fillStyle = INK;
            ctx.font = '12.5px Karla, sans-serif';
            ctx.fillText(n, mx, y - 8);
            ctx.strokeStyle = INK;
            ctx.lineWidth = 2;
            ctx.strokeRect(mx, y, 150, 22);
            ctx.fillStyle = 'rgba(138,129,113,0.75)';
            ctx.fillRect(mx + 2, y + 2, Math.min(1, raw[i]) * 146, 18);
        });
        ctx.font = '15px Caveat, cursive';
        ctx.fillStyle = FAINT;
        ctx.fillText('…mush. which idea is that?', mx, 208);
        /* right: the SAE lens */
        const sx = 636;
        ctx.font = '13px Karla, sans-serif';
        ctx.fillStyle = FAINT;
        ctx.fillText('through the SAE lens:', sx, 26);
        FEATS.forEach((f, i) => {
            const y = 44 + i * 40;
            ctx.font = '12px Karla, sans-serif';
            ctx.fillStyle = c[i] > 0.05 ? INK : FAINT;
            ctx.fillText(f.name, sx, y + 12);
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.8;
            ctx.strokeRect(sx + 78, y, 130, 16);
            if (c[i] > 0.02) {
                ctx.fillStyle = f.color;
                ctx.fillRect(sx + 79.5, y + 1.5, Math.min(1, c[i]) * 127, 13);
            }
        });
        /* the steering wire */
        if (steerFrac() > 0.03) {
            ctx.font = '15px Caveat, cursive';
            ctx.fillStyle = GOLD;
            ctx.fillText('↑ The bridge bar is your hand on the dial', sx + 24, 295);
        }
    }
    const SENTENCE_STEPS = [
        [0.0, 'Took a walk after lunch and jotted a few notes.'],
        [0.15, ' The fog was rolling in off the bay.'],
        [0.4, ' It reminded me of a certain bridge, actually.'],
        [0.65, ' The Golden Gate — those international-orange towers, the cables like harp strings.'],
        [0.9, ' Honestly, everything is the Golden Gate Bridge if you look closely enough.']
    ];
    function sentence() {
        const f = steerFrac();
        let out = '';
        SENTENCE_STEPS.forEach(([th, s]) => { if (f >= th)
            out += s; });
        $('#steer-out').textContent = out;
        $('#o-steer').textContent = Math.round(f * 100) + '%';
    }
    $$('.mind-btn').forEach(b => b.addEventListener('click', () => {
        thought = +(b.dataset.t);
        draw();
    }));
    $('#in-steer').addEventListener('input', () => { draw(); sentence(); });
    draw();
    sentence();
    const touch = userTouch($('#w-mind'));
    if (!reduced) {
        let ti = 0;
        const timer = window.setInterval(() => {
            if (touch.touched) {
                clearInterval(timer);
                return;
            }
            ti = (ti + 1) % 3;
            thought = ti;
            draw();
        }, 3000);
    }
})();
