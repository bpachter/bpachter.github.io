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
/* Gradient · language.ts — ch 05-08: tokenizer, embeddings, attention,
   the 3-D multi-head tower, n-gram generation. Requires core.ts. */
/* ══════════════ 05a · TOKENIZER ══════════════ */
(function () {
    const input = $('#in-tok');
    if (!input)
        return;
    const VOCAB = ('the,and,is,in,of,to,a,it,that,for,on,with,as,was,are,be,this,at,by,from,or,an,we,you,' +
        'trans,form,er,ing,ed,es,s,ly,un,re,pre,de,dis,over,under,out,up,down,inter,sub,super,anti,auto,' +
        'tion,ation,ition,ness,ment,able,ible,ful,less,ive,al,ic,ous,ist,ism,ity,ify,ification,ize,ization,' +
        'learn,think,believ,work,net,neural,machine,model,token,word,language,gradient,descent,attention,' +
        'compute,data,train,deep,layer,weight,loss,mind,brain,neuron,robot,ball,heavy,light,new,old,big,small,' +
        'hyper,micro,mega,multi,self,co,bi,tri,king,queen,man,woman,cat,dog,puppy,kitten,house,time,day,person,' +
        'gen,er,ate,vis,ual,pro,con,com,ex,en,em,im,ir,il,mid,semi,non,post,fore,ante,graph,phon,photo,tele,' +
        'ther,wh,sh,ch,qu,ck,ough,igh,tion').split(',');
    const vset = new Map();
    VOCAB.forEach((v, i) => { if (!vset.has(v))
        vset.set(v, i + 1000); });
    const COLORS = ['#e2edd6', '#dfe8d8', '#dbe2ee', '#f3e6c3', '#e8dcef'];
    function segmentWord(word) {
        const out = [];
        let i = 0;
        const lower = word.toLowerCase();
        while (i < lower.length) {
            let piece = null;
            for (let len = Math.min(12, lower.length - i); len >= 2; len--) {
                const cand = lower.slice(i, i + len);
                if (vset.has(cand)) {
                    piece = cand;
                    break;
                }
            }
            if (!piece)
                piece = lower[i];
            out.push({ text: word.slice(i, i + piece.length), id: vset.get(piece) || (200 + piece.charCodeAt(0) % 300) });
            i += piece.length;
        }
        return out;
    }
    function render() {
        const text = input.value;
        const outEl = $('#tok-out');
        outEl.innerHTML = '';
        let count = 0;
        text.split(/(\s+|[.,!?;])/).filter(t => t && !/^\s+$/.test(t)).forEach(word => {
            const pieces = /^[.,!?;]$/.test(word) ? [{ text: word, id: 900 + word.charCodeAt(0) }] : segmentWord(word);
            pieces.forEach((p, i) => {
                const chip = document.createElement('span');
                chip.className = 'tok';
                chip.style.background = COLORS[(p.id + i) % COLORS.length];
                chip.style.animationDelay = (count * 0.03) + 's';
                chip.innerHTML = p.text.replace(/</g, '&lt;') + '<small>#' + p.id + '</small>';
                outEl.appendChild(chip);
                count++;
            });
        });
        $('#tok-chars').textContent = String(text.length);
        $('#tok-count').textContent = String(count);
    }
    input.addEventListener('input', render);
    render();
})();
/* ══════════════ 05b · EMBEDDINGS ══════════════ */
(function () {
    const cv = $('#cv-emb');
    if (!cv)
        return;
    const [ctx, W, H] = fit(cv);
    const words = {
        king: [0.62, 0.55], queen: [0.80, 0.75], man: [0.18, 0.28], woman: [0.36, 0.48],
        prince: [0.52, 0.36], princess: [0.70, 0.56],
        dog: [-0.55, 0.20], puppy: [-0.68, 0.40], cat: [-0.34, 0.10], kitten: [-0.47, 0.30], wolf: [-0.66, 0.04],
        apple: [-0.18, -0.62], banana: [-0.02, -0.70], bread: [-0.34, -0.70],
        computer: [0.50, -0.46], robot: [0.64, -0.34], network: [0.40, -0.60],
        run: [0.02, 0.78], walk: [-0.14, 0.66], swim: [0.16, 0.64]
    };
    const X = (x) => W / 2 + x * (W / 2.35), Y = (y) => H / 2 - y * (H / 2.35);
    let anim = null;
    function base() {
        ctx.clearRect(0, 0, W, H);
        ctx.font = '13px Karla, sans-serif';
        for (const [w, [x, y]] of Object.entries(words)) {
            ctx.fillStyle = SLATE;
            ctx.beginPath();
            ctx.arc(X(x), Y(y), 4, 0, 7);
            ctx.fill();
            ctx.fillStyle = INK;
            ctx.fillText(w, X(x) + 8, Y(y) + 4);
        }
        ctx.font = '16px Caveat, cursive';
        ctx.fillStyle = FAINT;
        ctx.fillText('animals', X(-0.62), Y(0.62));
        ctx.fillText('royalty', X(0.68), Y(0.92));
        ctx.fillText('food', X(-0.30), Y(-0.86));
        ctx.fillText('tech', X(0.44), Y(-0.76));
    }
    function runAnalogy(a, b, c, target) {
        if (anim !== null)
            cancelAnimationFrame(anim);
        const A = words[a], B = words[b], C = words[c], T = words[target];
        let t0 = null;
        function frame(ts) {
            if (t0 === null)
                t0 = ts;
            const t = Math.min((ts - t0) / (reduced ? 1 : 1900), 1);
            base();
            const p1 = Math.min(t * 2, 1), p2 = Math.max(0, Math.min(t * 2 - 0.85, 1));
            arrow(ctx, X(B[0]), Y(B[1]), X(B[0] + (A[0] - B[0]) * p1), Y(B[1] + (A[1] - B[1]) * p1), LEAF_D, 3);
            if (p2 > 0) {
                arrow(ctx, X(C[0]), Y(C[1]), X(C[0] + (A[0] - B[0]) * p2), Y(C[1] + (A[1] - B[1]) * p2), SAGE, 3);
            }
            if (t >= 1) {
                ctx.strokeStyle = GOLD;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(X(T[0]) + 14, Y(T[1]) - 1, 26, 0.3, 6.6);
                ctx.stroke();
                ctx.font = '19px Caveat, cursive';
                ctx.fillStyle = LEAF_D;
                ctx.fillText('same arrow!', X(C[0] + (A[0] - B[0]) / 2) - 30, Y(C[1] + (A[1] - B[1]) / 2) - 14);
                return;
            }
            anim = requestAnimationFrame(frame);
        }
        anim = requestAnimationFrame(frame);
    }
    $('#btn-emb-analogy').addEventListener('click', () => runAnalogy('king', 'man', 'woman', 'queen'));
    $('#btn-emb-analogy2').addEventListener('click', () => runAnalogy('puppy', 'dog', 'cat', 'kitten'));
    $('#btn-emb-clear').addEventListener('click', () => { if (anim !== null)
        cancelAnimationFrame(anim); base(); });
    base();
    const touch = userTouch($('#w-emb'));
    autoOnView($('#w-emb'), () => { if (!touch.touched)
        runAnalogy('king', 'man', 'woman', 'queen'); }, 1000);
})();
/* ══════════════ 06 · ATTENTION ══════════════ */
(function () {
    const cv = $('#cv-attn');
    if (!cv)
        return;
    const [ctx, W, H] = fit(cv);
    const S = ['The', 'robot', 'picked', 'up', 'the', 'ball', 'because', 'it', 'was', 'heavy'];
    const R = (pairs, self) => {
        const row = new Array(10).fill(-2);
        pairs.forEach(([j, v]) => row[j] = v);
        return { row, self: self === undefined ? 0.6 : self };
    };
    const rows = [
        R([[1, 1.6]]),
        R([[0, 1.0], [2, 1.2]]),
        R([[1, 2.4], [5, 2.0], [3, 1.5]]),
        R([[2, 2.2]]),
        R([[5, 2.2]]),
        R([[2, 1.8], [4, 1.2], [1, 0.9]]),
        R([[9, 1.4], [7, 1.0]]),
        R([[5, 3.1], [1, 1.5], [9, 1.6]]),
        R([[7, 1.6], [9, 1.8]]),
        R([[5, 2.4], [7, 2.0]])
    ];
    let sel = 7, causal = false;
    const sentEl = $('#attn-sent');
    S.forEach((w, i) => {
        const el = document.createElement('span');
        el.className = 'w';
        el.textContent = w;
        el.dataset.i = String(i);
        el.addEventListener('click', () => { if (causal && i > sel && el.classList.contains('masked'))
            return; sel = i; render(); });
        sentEl.appendChild(el);
    });
    function weights(i) {
        const r = rows[i].row.slice();
        r[i] = rows[i].self;
        const idx = [];
        for (let j = 0; j < 10; j++)
            if (!causal || j <= i)
                idx.push(j);
        const m = Math.max(...idx.map(j => r[j]));
        let sum = 0;
        const e = {};
        idx.forEach(j => { e[j] = Math.exp(r[j] - m); sum += e[j]; });
        idx.forEach(j => e[j] /= sum);
        return e;
    }
    function render() {
        $$('.w', sentEl).forEach((el, i) => {
            el.classList.toggle('sel', i === sel);
            el.classList.toggle('masked', causal && i > sel);
        });
        const rect = cv.getBoundingClientRect();
        const xs = $$('.w', sentEl).map(el => {
            const r = el.getBoundingClientRect();
            return (r.left + r.width / 2 - rect.left) * (W / rect.width);
        });
        ctx.clearRect(0, 0, W, H);
        const wts = weights(sel);
        const entries = Object.entries(wts).map(([j, v]) => [+j, v]).sort((a, b) => b[1] - a[1]);
        entries.forEach(([j, v]) => {
            if (v < 0.02)
                return;
            const x1 = xs[sel], x2 = xs[j];
            ctx.strokeStyle = j === sel ? SAGE : LEAF_D;
            ctx.globalAlpha = 0.25 + v * 0.75;
            ctx.lineWidth = 1.5 + v * 11;
            ctx.lineCap = 'round';
            ctx.beginPath();
            const mid = (x1 + x2) / 2, drop = 30 + Math.abs(x2 - x1) * 0.22;
            ctx.moveTo(x1, 8);
            ctx.quadraticCurveTo(mid, 8 + drop, x2, 8);
            ctx.stroke();
        });
        ctx.globalAlpha = 1;
        /* top-3 labels, each tucked under its own arc's apex */
        ctx.font = '15px Caveat, cursive';
        ctx.fillStyle = INK;
        entries.slice(0, 3).forEach(([j, v]) => {
            if (j === sel)
                return;
            const drop = 30 + Math.abs(xs[j] - xs[sel]) * 0.22;
            ctx.fillText(Math.round(v * 100) + '%', xs[j] - 12, Math.min(8 + drop / 2 + 26, H - 8));
        });
        ctx.font = '16px Caveat, cursive';
        ctx.fillStyle = FAINT;
        ctx.fillText('softmax( q·k / √d ) — live', W - 200, 24);
    }
    $('#btn-attn-causal').addEventListener('click', function () {
        causal = !causal;
        this.textContent = 'causal mask: ' + (causal ? 'on' : 'off');
        this.setAttribute('aria-pressed', String(causal));
        render();
    });
    addEventListener('resize', render);
    window.setTimeout(render, 60);
    /* hands-free: wander the sentence until the reader clicks */
    const touch = userTouch($('#w-attn'));
    if (!reduced) {
        const tour = [7, 5, 2, 9, 0];
        let ti = 0;
        const timer = window.setInterval(() => {
            if (touch.touched) {
                clearInterval(timer);
                return;
            }
            ti = (ti + 1) % tour.length;
            sel = tour[ti];
            render();
        }, 2600);
    }
})();
/* ══════════════ 07 · INSIDE THE TOWER (3-D) ══════════════ */
(function () {
    const cv = $('#cv-heads');
    if (!cv)
        return;
    const [ctx, W, H] = fit(cv);
    const TOK = ['the', 'robot', 'picked', 'up', 'the', 'ball'];
    const LAYERS = 4, HEADS = 4;
    const HCOL = [LEAF, SLATE, GOLD, PLUM];
    const headOn = [true, true, true, true];
    /* per-head attention edges  i→j (query→key) with base weight */
    const EDGES = [
        [[1, 0, 0.9], [2, 1, 0.9], [3, 2, 0.9], [4, 3, 0.9], [5, 4, 0.9]], /* prev-word */
        [[2, 1, 0.8], [2, 5, 0.9], [3, 2, 0.8], [5, 2, 0.6]], /* verb→object */
        [[5, 0, 0.5], [5, 1, 0.8], [4, 1, 0.4], [1, 5, 0.5]], /* long-range */
        [[5, 1, 0.35], [5, 2, 0.35], [4, 0, 0.3], [3, 1, 0.3], [2, 0, 0.3]] /* broad */
    ];
    /* how strongly each head speaks at each layer: local early, global late */
    const LAYER_MIX = [
        [1.0, 0.75, 0.45, 0.25], /* h0 */
        [0.4, 1.0, 0.85, 0.55], /* h1 */
        [0.15, 0.5, 0.9, 1.0], /* h2 */
        [0.5, 0.6, 0.8, 0.9] /* h3 */
    ];
    const XSP = 96, YSP = 96, YOFF = -150;
    const cam = { yaw: -0.45, pitch: 0.34, cx: W / 2, cy: H / 2, scale: 1, dist: 1500 };
    const drag = orbit(cv, cam);
    const nodeAt = (i, layer) => [(i - 2.5) * XSP, layer * YSP + YOFF, 0];
    function bezier3(a, b, bulgeY, z, n) {
        const out = [];
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + bulgeY, z];
        for (let k = 0; k <= n; k++) {
            const t = k / n, u = 1 - t;
            out.push([
                u * u * a[0] + 2 * u * t * m[0] + t * t * b[0],
                u * u * a[1] + 2 * u * t * m[1] + t * t * b[1],
                u * u * a[2] + 2 * u * t * m[2] + t * t * b[2]
            ]);
        }
        return out;
    }
    let t = 0;
    function draw() {
        ctx.clearRect(0, 0, W, H);
        const phase = (t / 190) % (LAYERS + 1.2); /* which layer is "thinking" */
        /* residual columns first (the spine each word rides up) */
        for (let i = 0; i < TOK.length; i++) {
            ctx.strokeStyle = 'rgba(138,129,113,0.4)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (let l = 0; l < LAYERS; l++) {
                const [sx, sy] = project(cam, nodeAt(i, l));
                l ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
            }
            ctx.stroke();
        }
        /* a packet of meaning riding up each column */
        if (!reduced) {
            const py = Math.min(phase / LAYERS, 1) * (LAYERS - 1);
            for (let i = 0; i < TOK.length; i++) {
                const [sx, sy, per] = project(cam, [(i - 2.5) * XSP, py * YSP + YOFF, 0]);
                ctx.fillStyle = 'rgba(85,121,60,0.5)';
                ctx.beginPath();
                ctx.arc(sx, sy, 4.5 * per, 0, 7);
                ctx.fill();
            }
        }
        /* arcs per layer per head — draw far heads first for depth order */
        const headOrder = [...Array(HEADS).keys()].sort((a, b) => {
            const za = project(cam, [0, 0, (a - 1.5) * 34])[2];
            const zb = project(cam, [0, 0, (b - 1.5) * 34])[2];
            return za - zb;
        });
        for (let l = 0; l < LAYERS; l++) {
            const glow = Math.max(0, 1 - Math.abs(phase - l) * 1.4); /* this layer's turn to think */
            for (const h of headOrder) {
                if (!headOn[h])
                    continue;
                const mix = LAYER_MIX[h][l];
                if (mix < 0.18)
                    continue;
                for (const [qi, kj, w] of EDGES[h]) {
                    const a = nodeAt(qi, l), b = nodeAt(kj, l);
                    const pts3 = bezier3(a, b, 30 + Math.abs(qi - kj) * 7, (h - 1.5) * 34, 14);
                    ctx.strokeStyle = HCOL[h];
                    ctx.globalAlpha = (0.16 + 0.5 * w * mix) * (0.55 + 0.45 * glow);
                    ctx.lineWidth = (1 + 3.2 * w * mix) * (0.8 + 0.5 * glow);
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    pts3.forEach((p, k) => {
                        const [sx, sy] = project(cam, p);
                        k ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
                    });
                    ctx.stroke();
                }
            }
        }
        ctx.globalAlpha = 1;
        /* nodes + layer labels */
        for (let l = 0; l < LAYERS; l++) {
            const glow = Math.max(0, 1 - Math.abs(phase - l) * 1.4);
            for (let i = 0; i < TOK.length; i++) {
                const [sx, sy, per] = project(cam, nodeAt(i, l));
                ctx.fillStyle = glow > 0.25 ? PAPER : '#f1ece0';
                ctx.strokeStyle = INK;
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.arc(sx, sy, (5.5 + glow * 2.5) * per, 0, 7);
                ctx.fill();
                ctx.stroke();
            }
            const [lx, ly] = project(cam, [-3.4 * XSP, l * YSP + YOFF, 0]);
            ctx.font = '14px Caveat, cursive';
            ctx.fillStyle = FAINT;
            ctx.fillText('layer ' + (l + 1), lx - 10, ly + 4);
        }
        /* token labels under the bottom layer */
        for (let i = 0; i < TOK.length; i++) {
            const [sx, sy] = project(cam, [(i - 2.5) * XSP, YOFF - 26, 0]);
            ctx.font = '15px Fraunces, serif';
            ctx.fillStyle = INK;
            ctx.textAlign = 'center';
            ctx.fillText(TOK[i], sx, sy);
            ctx.textAlign = 'left';
        }
        const [tx, ty] = project(cam, [0, LAYERS * YSP + YOFF + 4, 0]);
        ctx.font = '17px Caveat, cursive';
        ctx.fillStyle = FAINT;
        ctx.textAlign = 'center';
        ctx.fillText('↑ out the top: each word, now carrying its whole story', tx, ty - 14);
        ctx.textAlign = 'left';
    }
    let onScreen = false;
    function loop() {
        if (!reduced && !drag.dragging)
            cam.yaw += drag.everDragged ? 0.0008 : 0.0026;
        t++;
        draw();
        if (onScreen)
            requestAnimationFrame(loop);
    }
    visible(cv, v => { const was = onScreen; onScreen = v; if (v && !was)
        requestAnimationFrame(loop); });
    $$('#heads-legend input').forEach(inp => inp.addEventListener('change', () => {
        headOn[+(inp.dataset.h)] = inp.checked;
    }));
    draw();
})();
/* ══════════════ 08 · N-GRAM GENERATION ══════════════ */
(function () {
    const cv = $('#cv-gen');
    if (!cv)
        return;
    const [ctx, W, H] = fit(cv);
    const text = $$('.chapter p, .chapter h2, .part-sub').map(el => el.textContent || '').join(' ');
    const toks = text.toLowerCase().replace(/[—–]/g, ' ').replace(/[.!?]/g, ' . ')
        .replace(/[^a-z0-9'\s.]/g, ' ').split(/\s+/).filter(Boolean);
    const uni = {}, bi = {}, tri = {};
    const starts = [];
    for (let i = 0; i < toks.length; i++) {
        const a = toks[i];
        uni[a] = (uni[a] || 0) + 1;
        if (i + 1 < toks.length) {
            const b = toks[i + 1];
            (bi[a] = bi[a] || {})[b] = (bi[a][b] || 0) + 1;
            if (a === '.' && b !== '.') {
                if (i + 2 < toks.length && toks[i + 2] !== '.')
                    starts.push([b, toks[i + 2]]);
            }
            if (i + 2 < toks.length) {
                const key = a + ' ' + b, c = toks[i + 2];
                (tri[key] = tri[key] || {})[c] = (tri[key][c] || 0) + 1;
            }
        }
    }
    const uniTotal = toks.length;
    const topUni = Object.entries(uni).filter(([w]) => w !== '.').sort((a, b) => b[1] - a[1]).slice(0, 40).map(e => e[0]);
    const sum = (o) => Object.values(o).reduce((s, v) => s + v, 0);
    function rawDist(w1, w2) {
        const cand = new Set(topUni);
        const t = tri[w1 + ' ' + w2] || {}, b = bi[w2] || {};
        Object.keys(t).forEach(k => cand.add(k));
        Object.keys(b).forEach(k => cand.add(k));
        const tS = sum(t) || 1, bS = sum(b) || 1;
        const out = [];
        cand.forEach(w => {
            const p = 0.70 * ((t[w] || 0) / tS) + 0.24 * ((b[w] || 0) / bS) + 0.06 * ((uni[w] || 0) / uniTotal);
            if (p > 0)
                out.push([w, p]);
        });
        const z = out.reduce((s, e) => s + e[1], 0);
        out.forEach(e => e[1] /= z);
        return out.sort((a, b2) => b2[1] - a[1]);
    }
    function shape(dist) {
        const T = +$('#in-temp').value, k = +$('#in-topk').value, p = +$('#in-topp').value;
        let d = dist.map(([w, pr]) => [w, Math.pow(pr, 1 / T)]);
        let z = d.reduce((s, e) => s + e[1], 0);
        d.forEach(e => e[1] /= z);
        d.sort((a, b) => b[1] - a[1]);
        if (k > 0)
            d = d.slice(0, k);
        if (p < 1) {
            let cum = 0;
            const keep = [];
            for (const e of d) {
                keep.push(e);
                cum += e[1];
                if (cum >= p)
                    break;
            }
            d = keep;
        }
        z = d.reduce((s, e) => s + e[1], 0);
        d.forEach(e => e[1] /= z);
        return d;
    }
    let ctxWords = [], autoTimer = null, lastSample = null;
    const rng2 = mulberry32(0x9e37);
    function drawBars(raw, shaped, sampled) {
        ctx.clearRect(0, 0, W, H);
        const shapeMap = Object.fromEntries(shaped);
        const show = raw.slice(0, 12);
        const rowH = Math.min(24, (H - 38) / show.length), maxP = Math.max(show[0] ? show[0][1] : 0.01, shaped[0] ? shaped[0][1] : 0.01);
        ctx.font = '13.5px Karla, sans-serif';
        show.forEach(([w, pr], i) => {
            const y = 10 + i * rowH, label = w === '.' ? '(end)' : w;
            ctx.fillStyle = INK;
            ctx.fillText(label.slice(0, 13), 8, y + rowH * 0.62);
            const x0 = 118, maxW = W - 190;
            ctx.strokeStyle = FAINT;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x0, y + 2, Math.max(2, pr / maxP * maxW), rowH - 7);
            const sp = shapeMap[w] || 0;
            ctx.fillStyle = w === sampled ? GOLD : LEAF;
            if (sp > 0)
                ctx.fillRect(x0, y + 2, Math.max(2, sp / maxP * maxW), rowH - 7);
            ctx.fillStyle = FAINT;
            ctx.fillText((sp * 100).toFixed(1) + '%', x0 + maxW + 8, y + rowH * 0.62);
        });
        ctx.font = '15px Caveat, cursive';
        ctx.fillStyle = FAINT;
        ctx.fillText('outline = raw model · filled = after your dials', W - 300, H - 8);
    }
    function renderOut() {
        const el = $('#gen-out');
        el.innerHTML = '';
        ctxWords.forEach((w, i) => {
            const span = document.createElement('span');
            span.className = i < 2 ? 'seed' : 'new';
            span.textContent = (w === '.' ? '.' : (i ? ' ' : '') + w);
            el.appendChild(span);
        });
        const cur = document.createElement('span');
        cur.className = 'cursor';
        el.appendChild(cur);
        const kv = $('#kv-row');
        $$('.kv-cell', kv).forEach(c => c.remove());
        const n = Math.min(ctxWords.length, 34);
        for (let i = 0; i < n; i++) {
            const c = document.createElement('span');
            c.className = 'kv-cell';
            kv.appendChild(c);
        }
        if (ctxWords.length > 34) {
            const more = document.createElement('span');
            more.className = 'kv-label kv-cell';
            more.textContent = '+' + (ctxWords.length - 34);
            kv.appendChild(more);
        }
    }
    function reseed() {
        stopAuto();
        const s = starts[(rng2() * starts.length) | 0] || ['the', 'model'];
        ctxWords = [s[0], s[1]];
        lastSample = null;
        renderOut();
        refreshBars();
    }
    function refreshBars() {
        const [w1, w2] = ctxWords.slice(-2);
        const raw = rawDist(w1, w2);
        drawBars(raw, shape(raw), lastSample);
    }
    function step() {
        const [w1, w2] = ctxWords.slice(-2);
        const raw = rawDist(w1, w2);
        const shaped = shape(raw);
        let r = rng2(), pick = shaped[shaped.length - 1][0];
        for (const [w, p] of shaped) {
            r -= p;
            if (r <= 0) {
                pick = w;
                break;
            }
        }
        ctxWords.push(pick);
        lastSample = pick;
        drawBars(raw, shaped, pick);
        renderOut();
    }
    function stopAuto() { if (autoTimer !== null) {
        clearInterval(autoTimer);
        autoTimer = null;
        $('#btn-gen-go').textContent = 'generate';
    } }
    function startAuto(count = 26) {
        if (autoTimer !== null)
            return;
        $('#btn-gen-go').textContent = 'stop';
        let n = 0;
        autoTimer = window.setInterval(() => { step(); if (++n >= count)
            stopAuto(); }, reduced ? 320 : 150);
    }
    $('#btn-gen-go').addEventListener('click', () => { autoTimer !== null ? stopAuto() : startAuto(); });
    $('#btn-gen-step').addEventListener('click', () => { stopAuto(); step(); });
    $('#btn-gen-reseed').addEventListener('click', reseed);
    ['in-temp', 'in-topk', 'in-topp'].forEach(id => $('#' + id).addEventListener('input', () => {
        $('#o-temp').textContent = fmt(+$('#in-temp').value, 2);
        const k = +$('#in-topk').value;
        $('#o-topk').textContent = k === 0 ? 'off' : String(k);
        $('#o-topp').textContent = fmt(+$('#in-topp').value, 2);
        refreshBars();
    }));
    visible(cv, v => { if (!v)
        stopAuto(); });
    reseed();
    const touch = userTouch($('#w-gen'));
    autoOnView($('#w-gen'), () => { if (!touch.touched)
        startAuto(12); }, 1200);
})();
