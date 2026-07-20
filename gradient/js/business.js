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
/* Gradient · business.ts — ch 27-31: the flywheel, GraphRAG, the model
   fleet, humans in the org chart, the modern data department.
   Requires core.ts (same bundle). */
const sleepB = (ms) => new Promise(res => window.setTimeout(res, reduced ? Math.min(ms / 4, 120) : ms));
/* ══════════════ 27 · THE FLYWHEEL ══════════════ */
(function () {
    const cv = $('#cv-fly');
    if (!cv)
        return;
    const [ctx, W, H] = fit(cv);
    const rng = mulberry32(2727);
    /* the org ring the flywheel grows */
    const NODES = [];
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        NODES.push({ x: 655 + Math.cos(a) * 150, y: 185 + Math.sin(a) * 128 });
    }
    NODES[0].name = 'Acme';
    NODES[4].name = 'Chipco';
    NODES[8].name = 'Beta';
    const edges = [];
    let docs = 0, nights = 0, okN = 0, rejN = 0, held = [], onScreen = false, ticking = false;
    function newPair() {
        const a = (rng() * 12) | 0;
        let b = (rng() * 12) | 0;
        if (b === a)
            b = (b + 1 + ((rng() * 10) | 0)) % 12;
        return [a, b];
    }
    function draw(msg) {
        ctx.clearRect(0, 0, W, H);
        /* pipeline stations */
        ctx.font = '13px Karla, sans-serif';
        ctx.fillStyle = FAINT;
        ctx.fillText('tonight\'s documents', 40, 40);
        for (let i = 0; i < Math.max(0, 5 - (docs % 5)); i++) {
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.6;
            ctx.fillRect(44 + i * 10, 52 + i * 4, 54, 66);
            ctx.strokeRect(44 + i * 10, 52 + i * 4, 54, 66);
        }
        const st = (x, y, label, on) => {
            ctx.fillStyle = on ? 'rgba(138,174,104,0.3)' : PAPER;
            ctx.strokeStyle = INK;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(x, y, 128, 44, 10);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = INK;
            ctx.font = '12.5px Karla, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(label, x + 64, y + 26);
            ctx.textAlign = 'left';
        };
        st(40, 160, 'extractor agents', ticking);
        st(40, 230, 'verifier agents', ticking);
        st(40, 300, held.length ? 'GATE — HOLDING' : 'the gate', held.length > 0);
        arrow(ctx, 104, 128, 104, 156, FAINT, 1.8);
        arrow(ctx, 104, 206, 104, 226, FAINT, 1.8);
        arrow(ctx, 104, 276, 104, 296, FAINT, 1.8);
        arrow(ctx, 172, 322, 480, 250, held.length ? GOLD : SAGE, 2);
        /* the graph */
        edges.forEach(e => {
            const A = NODES[e.a], B = NODES[e.b];
            if (e.status === 'rej')
                ctx.globalAlpha = Math.max(0, 1 - e.age / 18);
            ctx.strokeStyle = e.status === 'ok' ? 'rgba(85,121,60,0.75)' : e.status === 'held' ? GOLD : e.status === 'rej' ? BAD : 'rgba(107,127,163,0.6)';
            ctx.lineWidth = e.status === 'ok' ? 2.2 : 1.6;
            if (e.status !== 'ok')
                ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(A.x, A.y);
            ctx.lineTo(B.x, B.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        });
        NODES.forEach(n => {
            ctx.fillStyle = PAPER;
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(n.x, n.y, 7, 0, 7);
            ctx.fill();
            ctx.stroke();
            if (n.name) {
                ctx.font = '11.5px Karla, sans-serif';
                ctx.fillStyle = FAINT;
                ctx.fillText(n.name, n.x + 10, n.y + 4);
            }
        });
        if (msg) {
            ctx.font = '17px Caveat, cursive';
            ctx.fillStyle = '#8a6d10';
            ctx.fillText(msg, 190, 340);
        }
        $('#fly-nights').textContent = String(nights);
        $('#fly-ok').textContent = String(okN);
        $('#fly-rej').textContent = String(rejN);
    }
    async function tick() {
        if (ticking)
            return;
        ticking = true;
        while (onScreen) {
            if (held.length) {
                draw('batch held at the gate — waiting on your GO');
                await sleepB(500);
                continue;
            }
            docs++;
            if (docs % 17 === 0) {
                /* the extractor has a weird night: floods the queue */
                for (let i = 0; i < 12; i++) {
                    const [a, b] = newPair();
                    held.push({ a, b, status: 'held', age: 0 });
                }
                held.forEach(e => edges.push(e));
                $('#btn-fly-go').disabled = false;
                draw('12 proposals in one pass?! gate trips — escalated.');
                await sleepB(600);
                continue;
            }
            const [a, b] = newPair();
            const e = { a, b, status: 'prop', age: 0 };
            edges.push(e);
            draw();
            await sleepB(520);
            if (rng() < 0.74) {
                e.status = 'ok';
                okN++;
            }
            else {
                e.status = 'rej';
                rejN++;
            }
            if (docs % 5 === 0)
                nights++;
            /* prune old rejected */
            edges.forEach(x => { if (x.status === 'rej')
                x.age++; });
            for (let i = edges.length - 1; i >= 0; i--)
                if (edges[i].status === 'rej' && edges[i].age > 16)
                    edges.splice(i, 1);
            if (edges.filter(x => x.status === 'ok').length > 34) {
                const first = edges.findIndex(x => x.status === 'ok');
                edges.splice(first, 1);
            }
            draw();
            await sleepB(420);
        }
        ticking = false;
    }
    $('#btn-fly-go').addEventListener('click', async function () {
        this.disabled = true;
        for (const e of held) {
            e.status = 'prop';
            draw();
            await sleepB(150);
            if (rng() < 0.6) {
                e.status = 'ok';
                okN++;
            }
            else {
                e.status = 'rej';
                rejN++;
            }
        }
        held = [];
        draw('batch reviewed under your GO — applied with receipts.');
    });
    visible(cv, v => { const was = onScreen; onScreen = v; if (v && !was && !reduced)
        void tick(); });
    draw();
    if (reduced) { /* static tableau */
        for (let i = 0; i < 9; i++) {
            const [a, b] = newPair();
            edges.push({ a, b, status: i % 4 === 3 ? 'prop' : 'ok', age: 0 });
            okN = 7;
        }
        nights = 2;
        draw();
    }
})();
/* ══════════════ 28 · GRAPHRAG ══════════════ */
(function () {
    const cv = $('#cv-grag');
    if (!cv)
        return;
    const [ctx, W, H] = fit(cv);
    const NS = [
        { x: 130, y: 275, name: 'Fab-9', sub: 'Facility' },
        { x: 330, y: 205, name: 'Chipco', sub: 'Organization' },
        { x: 545, y: 120, name: 'Acme Rockets', sub: 'customer' },
        { x: 560, y: 260, name: 'OrbitalWorks', sub: 'customer' },
        { x: 250, y: 90, name: 'Beta Alloys', sub: 'Organization' }
    ];
    const ES = [
        [0, 1, 'supplies wafers'], [1, 2, 'supplies chips'], [1, 3, 'supplies chips'], [4, 2, 'supplies frames']
    ];
    let mode = 'idle', anim = 0, raf = null;
    function node(n, lit) {
        ctx.fillStyle = lit ? 'rgba(201,162,39,0.28)' : PAPER;
        ctx.strokeStyle = lit ? '#8a6d10' : INK;
        ctx.lineWidth = lit ? 2.6 : 1.8;
        ctx.beginPath();
        ctx.roundRect(n.x - 56, n.y - 20, 112, 40, 11);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.font = '12.5px Fraunces, serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.name, n.x, n.y - 1);
        ctx.font = '10.5px Karla, sans-serif';
        ctx.fillStyle = FAINT;
        ctx.fillText(n.sub, n.x, n.y + 13);
        ctx.textAlign = 'left';
    }
    function draw() {
        ctx.clearRect(0, 0, W, H);
        const litN = new Set(), litE = new Set();
        if (mode === 'graph') {
            if (anim > 0.15)
                litN.add(0);
            if (anim > 0.35) {
                litE.add(0);
                litN.add(1);
            }
            if (anim > 0.6) {
                litE.add(1);
                litE.add(2);
                litN.add(2);
                litN.add(3);
            }
        }
        ES.forEach(([a, b, label], i) => {
            const A = NS[a], B = NS[b];
            const lit = litE.has(i);
            ctx.strokeStyle = lit ? GOLD : 'rgba(125,144,112,0.55)';
            ctx.lineWidth = lit ? 3 : 1.8;
            ctx.beginPath();
            ctx.moveTo(A.x, A.y);
            ctx.lineTo(B.x, B.y);
            ctx.stroke();
            ctx.font = '11px Karla, monospace';
            ctx.fillStyle = lit ? '#8a6d10' : FAINT;
            ctx.textAlign = 'center';
            ctx.fillText(label, (A.x + B.x) / 2, (A.y + B.y) / 2 - 7);
            ctx.textAlign = 'left';
        });
        NS.forEach((n, i) => node(n, litN.has(i)));
        /* right panel */
        const px = 680;
        ctx.font = '13px Karla, sans-serif';
        ctx.fillStyle = FAINT;
        if (mode === 'chunk') {
            ctx.fillText('top chunks by similarity to "flooded":', px - 28, 34);
            const chunks = [
                ['facilities memo:', '"…Fab-9 flooded Tues,', 'pumps on site…"'],
                ['news clip:', '"…historic flooding', 'across the region…"'],
                ['policy doc:', '"…flood insurance', 'renewal terms…"']
            ];
            chunks.forEach((c, i) => {
                const y = 48 + i * 74;
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = INK;
                ctx.lineWidth = 1.6;
                ctx.fillRect(px - 28, y, 200, 62);
                ctx.strokeRect(px - 28, y, 200, 62);
                ctx.fillStyle = FAINT;
                ctx.font = '11px Karla, sans-serif';
                c.forEach((l, li) => { ctx.fillStyle = li === 0 ? INK : FAINT; ctx.fillText(l, px - 18, y + 16 + li * 15); });
            });
            ctx.font = '15px Caveat, cursive';
            ctx.fillStyle = BAD;
            ctx.fillText('✗ lots about floods. zero about customers —', px - 28, 300);
            ctx.fillText('the chain lives across documents.', px - 28, 320);
        }
        else if (mode === 'graph' && anim > 0.8) {
            ctx.font = '15px Caveat, cursive';
            ctx.fillStyle = GOOD;
            ctx.fillText('✓ exposed: Acme Rockets', px - 28, 60);
            ctx.fillText('+ OrbitalWorks — via Chipco,', px - 28, 82);
            ctx.fillText('2 hops.', px - 28, 104);
            ctx.fillStyle = FAINT;
            ctx.fillText('citation: the gold path itself,', px - 28, 138);
            ctx.fillText('every edge w/ receipts (ch 25).', px - 28, 158);
        }
        else if (mode === 'idle') {
            ctx.font = '15px Caveat, cursive';
            ctx.fillStyle = FAINT;
            ctx.fillText('two retrievers, one question →', px - 28, 60);
        }
    }
    function run(m) {
        mode = m;
        anim = 0;
        if (raf !== null)
            cancelAnimationFrame(raf);
        const t0 = performance.now();
        const step = (t) => {
            anim = Math.min(1, (t - t0) / (reduced ? 1 : 2200));
            draw();
            if (anim < 1)
                raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
    }
    $('#btn-grag-chunk').addEventListener('click', () => run('chunk'));
    $('#btn-grag-graph').addEventListener('click', () => run('graph'));
    draw();
    const touch = userTouch($('#w-grag'));
    autoOnView($('#w-grag'), () => {
        if (touch.touched)
            return;
        run('chunk');
        window.setTimeout(() => { if (!touch.touched)
            run('graph'); }, 3400);
    }, 900);
})();
/* ══════════════ 29 · THE MODEL FLEET ══════════════ */
(function () {
    const inLane = $('#fleet-in');
    if (!inLane)
        return;
    const TASKS = [
        { t: 'parse 40 filings', tier: 0, cost: 0, alt: 4.8 },
        { t: 'embed 1,200 chunks', tier: 0, cost: 0, alt: 2.2 },
        { t: 'verify 12 proposed edges', tier: 1, cost: 0.18, alt: 1.4 },
        { t: 'classify 300 orgs', tier: 0, cost: 0, alt: 3.6 },
        { t: 're-check 3 disputed edges', tier: 1, cost: 0.05, alt: 0.4 },
        { t: 'adjudicate a merge conflict', tier: 2, cost: 0.42, alt: 0.42 },
        { t: 'tag 2,000 contract records', tier: 0, cost: 0, alt: 5.1 },
        { t: 'sanity-check the brief', tier: 1, cost: 0.11, alt: 0.3 },
        { t: 'write the what-changed brief', tier: 2, cost: 0.9, alt: 0.9 }
    ];
    const lanes = [$('#fleet-t0'), $('#fleet-t1'), $('#fleet-t2')];
    let running = false;
    function chip(txt, cls) {
        const s = document.createElement('span');
        s.className = 'dchip ' + cls;
        s.textContent = txt;
        return s;
    }
    async function run() {
        if (running)
            return;
        running = true;
        inLane.innerHTML = '';
        lanes.forEach(l => l.innerHTML = '');
        $('#fleet-save').textContent = '';
        let cost = 0, alt = 0;
        for (const t of TASKS) {
            const c = chip(t.t, 'draft');
            inLane.appendChild(c);
            await sleepB(480);
            c.remove();
            lanes[t.tier].appendChild(chip(t.t, 't' + t.tier));
            cost += t.cost;
            alt += t.alt;
            $('#fleet-cost').textContent = '$' + cost.toFixed(2);
            $('#fleet-alt').textContent = '$' + alt.toFixed(2);
            await sleepB(240);
        }
        $('#fleet-save').textContent = '→ ' + Math.round((1 - cost / alt) * 100) + '% saved, judgment un-compromised';
        running = false;
    }
    $('#btn-fleet-run').addEventListener('click', () => { void run(); });
    autoOnView($('#w-fleet'), () => { void run(); }, 900);
})();
/* ══════════════ 30 · THE DELEGATION DIAL ══════════════ */
(function () {
    const cv = $('#cv-org');
    if (!cv)
        return;
    const [ctx, W, H] = fit(cv);
    const rng = mulberry32(3030);
    const LANES = ['extract', 'verify', 'curate', 'brief'];
    const DELS = ['L1 — you approve everything', 'L2 — big & medium ask', 'L3 — gate decides', 'L4 — nothing asks'];
    let pulses = [], okN = 0, intN = 0, onScreen = false;
    const ledger = $('#org-ledger');
    function level() { return +$('#in-del').value; }
    function needsHuman(blast) {
        const L = level();
        if (L === 1)
            return true;
        if (L === 2)
            return blast > 25;
        if (L === 3)
            return blast > 80;
        return false;
    }
    function log(txt, cls = '') {
        const d = document.createElement('div');
        d.className = 'log-line ' + cls;
        d.textContent = txt;
        ledger.prepend(d);
        while (ledger.childElementCount > 6)
            ledger.lastElementChild.remove();
    }
    function draw() {
        ctx.clearRect(0, 0, W, H);
        /* human row */
        ctx.fillStyle = PAPER;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(W / 2 - 90, 24, 180, 42, 12);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.font = '13.5px Fraunces, serif';
        ctx.textAlign = 'center';
        ctx.fillText('you — holding the gates', W / 2, 50);
        /* gate line */
        ctx.strokeStyle = 'rgba(45,42,36,0.5)';
        ctx.setLineDash([7, 6]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(60, 130);
        ctx.lineTo(W - 60, 130);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '13px Caveat, cursive';
        ctx.fillStyle = FAINT;
        ctx.textAlign = 'left';
        ctx.fillText('the gate', 62, 122);
        /* agent lanes */
        LANES.forEach((l, i) => {
            const x = 150 + i * 170;
            ctx.fillStyle = 'rgba(236,230,216,0.9)';
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.roundRect(x - 55, H - 62, 110, 38, 10);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = INK;
            ctx.font = '12px Karla, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(l + ' agents', x, H - 38);
            ctx.textAlign = 'left';
        });
        /* pulses */
        pulses.forEach(p => {
            const x = 150 + p.lane * 170;
            const hum = needsHuman(p.blast);
            ctx.fillStyle = hum ? GOLD : LEAF;
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.5;
            const px = p.state === 'wait' ? W / 2 + ((p.lane - 1.5) * 26) : x;
            ctx.beginPath();
            ctx.arc(px, p.y, 4 + Math.min(6, p.blast / 40), 0, 7);
            ctx.fill();
            ctx.stroke();
        });
        $('#org-ok').textContent = String(okN);
        $('#org-int').textContent = String(intN);
    }
    function step() {
        if (pulses.length < 6 && rng() < 0.3) {
            pulses.push({ lane: (rng() * 4) | 0, y: H - 70, blast: 3 + ((rng() * rng() * 250) | 0), state: 'rise', waitT: 0 });
        }
        pulses.forEach(p => {
            if (p.state === 'rise') {
                p.y -= reduced ? 1.4 : 2.6;
                const stopY = needsHuman(p.blast) ? 70 : 130;
                if (p.y <= stopY) {
                    if (needsHuman(p.blast)) {
                        p.state = 'wait';
                        p.waitT = 0;
                        intN++;
                        log('⏸ awaiting you: ' + LANES[p.lane] + ' change, blast ' + p.blast, '');
                    }
                    else {
                        p.state = 'done';
                        okN++;
                        log('✓ auto-applied within bounds: ' + LANES[p.lane] + ', blast ' + p.blast + ' — logged', 'good');
                    }
                }
            }
            else if (p.state === 'wait') {
                p.waitT++;
                if (p.waitT > (level() === 1 ? 90 : 55)) {
                    p.state = 'done';
                    okN++;
                    log('✓ your GO: ' + LANES[p.lane] + ', blast ' + p.blast, 'good');
                }
            }
        });
        pulses = pulses.filter(p => p.state !== 'done');
        draw();
    }
    let last = 0;
    function loop(ts) {
        if (ts - last > (reduced ? 120 : 60)) {
            last = ts;
            step();
        }
        if (onScreen)
            requestAnimationFrame(loop);
    }
    visible(cv, v => { const was = onScreen; onScreen = v; if (v && !was)
        requestAnimationFrame(loop); });
    $('#in-del').addEventListener('input', () => {
        $('#o-del').textContent = DELS[level() - 1];
        if (level() === 4)
            log('⚠ L4: nothing asks. hope the ledger is enough.', 'bad');
    });
    draw();
})();
/* ══════════════ 31 · THE WHOLE MACHINE ══════════════ */
(function () {
    const cv = $('#cv-dept');
    if (!cv)
        return;
    const [ctx, W, H] = fit(cv);
    const CY = 165, GX = 470;
    let t = 0, onScreen = false;
    const dots = [];
    for (let i = 0; i < 7; i++)
        dots.push({ seg: (i % 2), p: (i * 0.16) % 1, off: (i % 3 - 1) * 14 });
    function box(x, y, w, h, label, sub) {
        ctx.fillStyle = PAPER;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.font = '12.5px Karla, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x + w / 2, y + h / 2 + (sub ? -3 : 4));
        if (sub) {
            ctx.font = '10.5px Karla, sans-serif';
            ctx.fillStyle = FAINT;
            ctx.fillText(sub, x + w / 2, y + h / 2 + 12);
        }
        ctx.textAlign = 'left';
    }
    function draw() {
        ctx.clearRect(0, 0, W, H);
        /* sources */
        ['filings', 'contracts', 'news'].forEach((s, i) => box(40, 70 + i * 62, 92, 40, s));
        box(210, 130, 110, 66, 'one pipeline', 'lineage + alarms');
        /* the graph */
        ctx.strokeStyle = 'rgba(85,121,60,0.5)';
        ctx.lineWidth = 1.4;
        const ring = [];
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            ring.push([GX + Math.cos(a) * 62, CY + Math.sin(a) * 55]);
        }
        for (let i = 0; i < 10; i++) {
            const j = (i + 3) % 10;
            ctx.beginPath();
            ctx.moveTo(ring[i][0], ring[i][1]);
            ctx.lineTo(ring[j][0], ring[j][1]);
            ctx.stroke();
        }
        ring.forEach(p => {
            ctx.fillStyle = LEAF;
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(p[0], p[1], 5, 0, 7);
            ctx.fill();
            ctx.stroke();
        });
        ctx.font = '13.5px Fraunces, serif';
        ctx.fillStyle = INK;
        ctx.textAlign = 'center';
        ctx.fillText('THE GRAPH', GX, CY + 92);
        ctx.font = '10.5px Karla, sans-serif';
        ctx.fillStyle = FAINT;
        ctx.fillText('typed · receipted · bitemporal', GX, CY + 106);
        ctx.textAlign = 'left';
        /* the flywheel orbit */
        const oa = t * 0.014;
        ctx.strokeStyle = SLATE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(GX, CY, 102, 88, 0, oa, oa + 4.6);
        ctx.stroke();
        const ex = GX + Math.cos(oa + 4.6) * 102, ey = CY + Math.sin(oa + 4.6) * 88;
        const ta = oa + 4.6 + Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 9 * Math.cos(ta - 0.4), ey - 9 * Math.sin(ta - 0.4));
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 9 * Math.cos(ta + 0.4), ey - 9 * Math.sin(ta + 0.4));
        ctx.stroke();
        ctx.font = '12px Caveat, cursive';
        ctx.fillStyle = SLATE;
        ctx.textAlign = 'center';
        ctx.fillText('agents: extract · verify · curate — behind the gate', GX, 34);
        ctx.textAlign = 'left';
        /* decisions */
        ['screener', 'weekly brief', 'alerts'].forEach((s, i) => box(742, 70 + i * 62, 100, 40, s));
        ctx.font = '10.5px Karla, sans-serif';
        ctx.fillStyle = FAINT;
        ctx.fillText('every number traceable to a source', 700, 268);
        /* flowing dots */
        dots.forEach(d => {
            d.p += reduced ? 0.002 : 0.0042;
            if (d.p > 1) {
                d.p = 0;
                d.off = (((t | 0) % 3) - 1) * 14;
            }
            let x, y;
            if (d.seg === 0) {
                x = 135 + d.p * (GX - 62 - 135);
                y = 150 + d.off * 2 * (1 - d.p) + (CY - 150) * d.p;
            }
            else {
                x = GX + 62 + d.p * (740 - GX - 62);
                y = CY + (90 + d.off * 30 - CY) * d.p * 0.9;
            }
            ctx.fillStyle = d.seg === 0 ? SAGE : GOLD;
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 7);
            ctx.fill();
            ctx.stroke();
        });
        t++;
    }
    function loop() { draw(); if (onScreen)
        requestAnimationFrame(loop); }
    visible(cv, v => { const was = onScreen; onScreen = v; if (v && !was && !reduced)
        requestAnimationFrame(loop); });
    draw();
})();
