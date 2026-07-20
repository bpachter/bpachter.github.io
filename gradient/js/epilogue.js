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
/* Gradient · epilogue.ts — ch 32: one question, the whole machine.
   Every station on the loop is a chapter of the library.
   Requires core.ts (same bundle). */
(function () {
    const cv = $('#cv-all');
    if (!cv)
        return;
    const [ctx, W, H] = fit(cv);
    const CX = W / 2, CY = 228, RX = 338, RY = 158;
    const STAGES = [
        { label: 'tokens', now: '8:04 am — the question becomes tokens', expl: 'the words are chopped into chunks and mapped to coordinates. meaning as geometry.', chips: [{ t: '05 · words become numbers', href: '../language/#ch5' }] },
        { label: 'the tower', now: 'up the tower', expl: 'every token watches every other; dozens of layers refine what each word means here.', chips: [{ t: '06 · attention', href: '../language/#ch6' }, { t: '07 · the tower in 3-D', href: '../language/#ch7' }, { t: '10 · the engine room', href: '../frontier/#ch10' }] },
        { label: 'thinking', now: 'it pauses to think', expl: 'scratchpad first: reason, check, then speak — thinking tokens spent on purpose.', chips: [{ t: '17 · thinking out loud', href: '../thinking/#ch17' }, { t: '19 · the thinking budget', href: '../thinking/#ch19' }] },
        { label: 'the agent', now: 'the agent reaches for a tool', expl: 'this needs live data, not vibes. it writes an order slip for the graph.', chips: [{ t: '11 · the loop', href: '../agents/#ch11' }, { t: '12 · tools & MCP', href: '../agents/#ch12' }] },
        { label: 'the graph', now: 'GraphRAG walks the graph', expl: 'Fab-9 → Chipco → two customers: the blast radius, receipts on every edge.', chips: [{ t: '22 · the walk', href: '../graph/#ch22' }, { t: '25 · receipts', href: '../graph/#ch25' }, { t: '28 · GraphRAG', href: '../business/#ch28' }] },
        { label: 'the gate', now: 'the gate checks the act', expl: 'notify two account owners? small blast radius, within bounds — applied and logged.', chips: [{ t: '14 · guardrails', href: '../agents/#ch14' }, { t: '30 · humans in the org chart', href: '../business/#ch30' }] },
        { label: 'the fleet', now: 'the fleet kept it cheap', expl: 'local models did the reading, a verifier doubted it, the frontier wrote the brief.', chips: [{ t: '10g · quantization', href: '../frontier/#quant' }, { t: '29 · the model fleet', href: '../business/#ch29' }] },
        { label: 'the answer', now: 'the answer streams out', expl: 'token by token, citations attached — one skill, wearing the whole machine.', chips: [{ t: '08 · the autocomplete machine', href: '../language/#ch8' }, { t: '25 · receipts', href: '../graph/#ch25' }] },
        { label: 'the flywheel', now: 'and that night, the flywheel turns', expl: 'extract → verify → gate, unattended: the graph is richer by morning, so tomorrow\'s answer is better.', chips: [{ t: '27 · the flywheel', href: '../business/#ch27' }, { t: '13 · the context engineer', href: '../agents/#ch13' }] }
    ];
    const N = STAGES.length;
    const ang = (i) => -Math.PI / 2 + (i / N) * Math.PI * 2;
    const pos = (i) => [CX + Math.cos(ang(i)) * RX, CY + Math.sin(ang(i)) * RY];
    let stage = 0, playing = true, pulse = 1, sinceAdvance = 0, answerLen = 0, onScreen = false;
    const ANSWER = 'exposed: Acme Rockets + OrbitalWorks, via Chipco [1][2] — owners notified.';
    /* ── tiny icons, one per station ── */
    function icon(i, x, y, on, past) {
        const a = on ? 1 : past ? 0.55 : 0.22;
        ctx.globalAlpha = a;
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = INK;
        if (i === 0) { /* token chips */
            ['#e2edd6', '#dbe2ee', '#f3e6c3'].forEach((c, k) => {
                ctx.fillStyle = c;
                ctx.beginPath();
                ctx.roundRect(x - 27 + k * 19, y - 8, 16, 15, 4);
                ctx.fill();
                ctx.stroke();
            });
        }
        else if (i === 1) { /* tower slabs */
            for (let k = 0; k < 3; k++) {
                ctx.fillStyle = on && k === 1 ? 'rgba(138,174,104,0.5)' : PAPER;
                ctx.beginPath();
                ctx.roundRect(x - 20 + k * 2.5, y + 8 - k * 11, 36, 9, 3);
                ctx.fill();
                ctx.stroke();
            }
        }
        else if (i === 2) { /* thought bubble */
            ctx.fillStyle = 'rgba(230,239,218,0.95)';
            ctx.beginPath();
            ctx.roundRect(x - 22, y - 12, 44, 22, 11);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = INK;
            ctx.font = '13px Caveat, cursive';
            ctx.textAlign = 'center';
            ctx.fillText('hmm…', x, y + 4);
            ctx.textAlign = 'left';
        }
        else if (i === 3) { /* order slip */
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.roundRect(x - 16, y - 13, 32, 26, 4);
            ctx.fill();
            ctx.stroke();
            ctx.font = '13px Karla, monospace';
            ctx.fillStyle = INK;
            ctx.textAlign = 'center';
            ctx.fillText('{ }', x, y + 4);
            ctx.textAlign = 'left';
        }
        else if (i === 4) { /* mini graph */
            const P = [[x - 22, y + 8], [x - 2, y - 8], [x + 18, y - 2], [x + 14, y + 12]];
            const lit = on || past;
            [[0, 1], [1, 2], [1, 3]].forEach(([q, r], ei) => {
                ctx.strokeStyle = lit && ei < 2 ? GOLD : 'rgba(125,144,112,0.8)';
                ctx.lineWidth = lit && ei < 2 ? 2.4 : 1.4;
                ctx.beginPath();
                ctx.moveTo(P[q][0], P[q][1]);
                ctx.lineTo(P[r][0], P[r][1]);
                ctx.stroke();
            });
            P.forEach(p => {
                ctx.fillStyle = LEAF;
                ctx.strokeStyle = INK;
                ctx.lineWidth = 1.3;
                ctx.beginPath();
                ctx.arc(p[0], p[1], 4, 0, 7);
                ctx.fill();
                ctx.stroke();
            });
        }
        else if (i === 5) { /* gate posts */
            ctx.strokeStyle = INK;
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.moveTo(x - 14, y - 14);
            ctx.lineTo(x - 14, y + 14);
            ctx.moveTo(x + 14, y - 14);
            ctx.lineTo(x + 14, y + 14);
            ctx.stroke();
            ctx.font = '15px Karla, sans-serif';
            ctx.fillStyle = GOOD;
            ctx.textAlign = 'center';
            ctx.fillText(on || past ? '✓' : '·', x, y + 5);
            ctx.textAlign = 'left';
        }
        else if (i === 6) { /* fleet tiers */
            [4, 6, 8].forEach((r, k) => {
                ctx.fillStyle = [LEAF, SAGE, GOLD][k];
                ctx.strokeStyle = INK;
                ctx.lineWidth = 1.3;
                ctx.beginPath();
                ctx.arc(x - 18 + k * 18, y, r, 0, 7);
                ctx.fill();
                ctx.stroke();
            });
        }
        else if (i === 7) { /* answer lines */
            ctx.strokeStyle = 'rgba(45,42,36,0.7)';
            ctx.lineWidth = 2;
            [0, 1, 2].forEach(k => {
                ctx.beginPath();
                ctx.moveTo(x - 20, y - 8 + k * 8);
                ctx.lineTo(x - 20 + (k === 2 ? 22 : 40), y - 8 + k * 8);
                ctx.stroke();
            });
            if (on || past) {
                ctx.font = '13px Karla, sans-serif';
                ctx.fillStyle = GOOD;
                ctx.fillText('✓', x + 24, y + 9);
            }
        }
        else { /* flywheel */
            ctx.strokeStyle = on ? LEAF_D : SLATE;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.arc(x, y, 13, 0.6, 5.6);
            ctx.stroke();
            const tx = x + Math.cos(5.6) * 13, ty = y + Math.sin(5.6) * 13;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx - 6, ty - 3);
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx + 1, ty - 7);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }
    function draw() {
        ctx.clearRect(0, 0, W, H);
        /* the track */
        ctx.strokeStyle = 'rgba(138,129,113,0.4)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.ellipse(CX, CY, RX, RY, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        /* stations */
        for (let i = 0; i < N; i++) {
            const [x, y] = pos(i);
            const on = i === stage, past = i < stage || (stage === N - 1 && pulse >= 1);
            if (on) {
                ctx.fillStyle = 'rgba(138,174,104,0.16)';
                ctx.beginPath();
                ctx.arc(x, y, 40, 0, 7);
                ctx.fill();
            }
            icon(i, x, y, on, past);
            const lx = CX + Math.cos(ang(i)) * (RX + 42), ly = CY + Math.sin(ang(i)) * (RY + 32);
            ctx.font = (on ? '700 ' : '') + '12.5px Karla, sans-serif';
            ctx.fillStyle = on ? LEAF_D : FAINT;
            ctx.textAlign = 'center';
            ctx.fillText(STAGES[i].label, lx, Math.max(14, Math.min(H - 6, ly + 4)));
            ctx.textAlign = 'left';
        }
        /* the pulse, travelling the arc into the current station */
        const a0 = ang((stage + N - 1) % N), a1 = ang(stage) + (stage === 0 ? 0 : 0);
        let aa = a0 + (a1 - a0 + (a1 < a0 ? Math.PI * 2 : 0)) * Math.min(1, pulse);
        ctx.fillStyle = GOLD;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(CX + Math.cos(aa) * RX, CY + Math.sin(aa) * RY, 7, 0, 7);
        ctx.fill();
        ctx.stroke();
        /* center: the question and, later, the answer */
        ctx.font = '16px Fraunces, serif';
        ctx.fillStyle = INK;
        ctx.textAlign = 'center';
        ctx.fillText('"Fab-9 flooded — who\'s exposed?"', CX, CY - 26);
        ctx.font = '12px Karla, sans-serif';
        ctx.fillStyle = FAINT;
        ctx.fillText('monday, 8:04 am', CX, CY - 8);
        if (stage >= 7) {
            const txt = ANSWER.slice(0, answerLen | 0);
            ctx.font = '13.5px Karla, sans-serif';
            ctx.fillStyle = LEAF_D;
            const mid = Math.ceil(txt.length / 2);
            ctx.fillText(txt.slice(0, mid), CX, CY + 22);
            ctx.fillText(txt.slice(mid), CX, CY + 40);
        }
        if (stage === N - 1) {
            ctx.font = '15px Caveat, cursive';
            ctx.fillStyle = FAINT;
            ctx.fillText('…and by tuesday the graph knows more than it did today.', CX, CY + 70);
        }
        ctx.textAlign = 'left';
    }
    function caption() {
        const s = STAGES[stage];
        $('#all-now').textContent = s.now;
        $('#all-expl').textContent = s.expl;
        const chips = $('#all-chips');
        chips.innerHTML = '';
        s.chips.forEach(c => {
            const a = document.createElement('a');
            a.href = c.href;
            a.textContent = c.t;
            chips.appendChild(a);
        });
    }
    function setStage(i) {
        stage = ((i % N) + N) % N;
        pulse = 0;
        sinceAdvance = 0;
        if (stage < 7)
            answerLen = 0;
        caption();
        draw();
    }
    let last = 0;
    function loop(ts) {
        const dt = last ? Math.min(ts - last, 60) : 16;
        last = ts;
        pulse = Math.min(1, pulse + dt / 700);
        if (stage >= 7 && answerLen < ANSWER.length)
            answerLen += dt / 26;
        if (playing) {
            sinceAdvance += dt;
            if (sinceAdvance > (stage === N - 1 ? 4200 : 2900))
                setStage(stage + 1);
        }
        draw();
        if (onScreen && !reduced)
            requestAnimationFrame(loop);
    }
    $('#btn-all-play').addEventListener('click', function () {
        playing = !playing;
        this.textContent = playing ? 'pause' : 'play';
        sinceAdvance = 0;
    });
    $('#btn-all-prev').addEventListener('click', () => setStage(stage - 1));
    $('#btn-all-next').addEventListener('click', () => setStage(stage + 1));
    $('#btn-all-restart').addEventListener('click', () => setStage(0));
    visible(cv, v => { const was = onScreen; onScreen = v; if (v && !was && !reduced) {
        last = 0;
        requestAnimationFrame(loop);
    } });
    if (reduced) {
        stage = N - 1;
        pulse = 1;
        answerLen = ANSWER.length;
        playing = false;
        $('#btn-all-play').textContent = 'play';
    }
    caption();
    draw();
})();
