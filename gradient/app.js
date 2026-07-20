/* ─────────────────────────────────────────────────────────────
   Gradient — all sims hand-written, zero dependencies.
   Chapters: perceptron · gradient descent · live XOR training ·
   tokens & embeddings · attention · n-gram sampling · LoRA/MoE.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // ---------- shared helpers ----------
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rng) { return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng()); }

  const INK = '#2d2a24', CORAL = '#d97757', CORAL_D = '#b85c3e', SAGE = '#7d9070',
        SLATE = '#6b7fa3', GOLD = '#c9a227', FAINT = '#8a8171', PAPER = '#faf7f0';

  // crisp canvases: logical size from width/height attrs, scaled for DPR
  function fit(cv) {
    const w = cv.width, h = cv.height, dpr = Math.min(devicePixelRatio || 1, 2);
    cv.dataset.w = w; cv.dataset.h = h;
    cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    return [ctx, w, h];
  }

  // hand-drawn line: slight jitter, 2 passes
  function rough(ctx, pts, color, width, seed) {
    const rng = mulberry32(seed || 7);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
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
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    ctx.moveTo(x2, y2); ctx.lineTo(x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45));
    ctx.moveTo(x2, y2); ctx.lineTo(x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45));
    ctx.stroke();
  }
  const fmt = (n, d) => n.toFixed(d === undefined ? 2 : d);

  // scroll reveals: decorations draw in; widgets drift up (JS-gated, safe)
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('drawn', 'in'); io.unobserve(e.target); }
  }), { threshold: 0.25 });
  $$('.draw-me').forEach(p => io.observe(p));
  $$('.widget, .note-card').forEach(el => { el.classList.add('fade-up'); io.observe(el); });
  $$('.note-card').forEach((el, i) => { el.style.transform = `rotate(${((i * 37) % 5 - 2) * 0.7}deg)`; });
  setTimeout(() => $$('.hero .draw-me').forEach(p => p.classList.add('drawn')), 300);

  // pause loops when offscreen
  function visible(el, cb) {
    const o = new IntersectionObserver(es => cb(es[0].isIntersecting), { threshold: 0.05 });
    o.observe(el);
  }

  /* ══════════════ 01 · PERCEPTRON ══════════════ */
  (function () {
    const cv = $('#cv-perc'); if (!cv) return;
    const [ctx, W, H] = fit(cv);
    const rng = mulberry32(42);
    const pts = [];
    for (let i = 0; i < 46; i++) pts.push({ x: -0.45 + gauss(rng) * 0.21, y: -0.30 + gauss(rng) * 0.21, l: -1 });
    for (let i = 0; i < 46; i++) pts.push({ x: 0.50 + gauss(rng) * 0.21, y: 0.34 + gauss(rng) * 0.21, l: 1 });
    let w1 = 1, w2 = -1, b = 0, learning = false, epoch = 0;
    const X = x => W / 2 + x * (W / 2.6), Y = y => H / 2 - y * (H / 2.6);

    const sliders = { w1: $('#in-w1'), w2: $('#in-w2'), b: $('#in-b') };
    const outs = { w1: $('#o-w1'), w2: $('#o-w2'), b: $('#o-b') };
    function syncUI() {
      sliders.w1.value = w1; sliders.w2.value = w2; sliders.b.value = b;
      outs.w1.textContent = fmt(w1, 1); outs.w2.textContent = fmt(w2, 1); outs.b.textContent = fmt(b, 1);
    }
    Object.keys(sliders).forEach(k => sliders[k].addEventListener('input', () => {
      learning = false; w1 = +sliders.w1.value; w2 = +sliders.w2.value; b = +sliders.b.value; syncUI(); draw();
    }));

    function acc() {
      let c = 0;
      pts.forEach(p => { if (Math.sign(w1 * p.x + w2 * p.y + b) === p.l) c++; });
      return c / pts.length;
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      // shade the two half-planes
      const mag = Math.hypot(w1, w2) || 1e-6;
      for (const side of [1, -1]) {
        ctx.fillStyle = side === 1 ? 'rgba(217,119,87,0.10)' : 'rgba(107,127,163,0.10)';
        ctx.beginPath();
        // sample coarse grid mask via clipping trick: draw big polygon split by the line
        const n = { x: w1 / mag, y: w2 / mag };
        const c = { x: -b * w1 / (mag * mag), y: -b * w2 / (mag * mag) }; // point on line (data coords)
        const d = { x: -n.y, y: n.x };
        const p1 = { x: c.x + d.x * 10, y: c.y + d.y * 10 }, p2 = { x: c.x - d.x * 10, y: c.y - d.y * 10 };
        const off = { x: n.x * 10 * side, y: n.y * 10 * side };
        ctx.moveTo(X(p1.x), Y(p1.y)); ctx.lineTo(X(p2.x), Y(p2.y));
        ctx.lineTo(X(p2.x + off.x), Y(p2.y + off.y)); ctx.lineTo(X(p1.x + off.x), Y(p1.y + off.y));
        ctx.closePath(); ctx.fill();
      }
      // decision line
      {
        const mag2 = Math.hypot(w1, w2) || 1e-6;
        const n = { x: w1 / mag2, y: w2 / mag2 };
        const c = { x: -b * w1 / (mag2 * mag2), y: -b * w2 / (mag2 * mag2) };
        const d = { x: -n.y, y: n.x };
        rough(ctx, [[X(c.x + d.x * 3), Y(c.y + d.y * 3)], [X(c.x - d.x * 3), Y(c.y - d.y * 3)]], INK, 3, 11);
      }
      // points
      pts.forEach(p => {
        const pred = Math.sign(w1 * p.x + w2 * p.y + b);
        ctx.beginPath();
        if (p.l === 1) { ctx.fillStyle = CORAL; ctx.arc(X(p.x), Y(p.y), 6, 0, 7); ctx.fill(); }
        else { ctx.fillStyle = SLATE; ctx.fillRect(X(p.x) - 5, Y(p.y) - 5, 10, 10); }
        if (pred !== p.l) { ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 10, 0, 7); ctx.stroke(); }
      });
      $('#perc-acc').textContent = Math.round(acc() * 100) + '%';
    }
    function learnStep() {
      if (!learning) return;
      let mistakes = 0; const lr = 0.06;
      pts.forEach(p => {
        if (Math.sign(w1 * p.x + w2 * p.y + b) !== p.l) {
          mistakes++; w1 += lr * p.l * p.x; w2 += lr * p.l * p.y; b += lr * p.l * 0.6;
        }
      });
      epoch++;
      syncUI(); draw();
      if (mistakes === 0 || epoch > 260) { learning = false; return; }
      requestAnimationFrame(learnStep);
    }
    $('#btn-perc-learn').addEventListener('click', () => { if (!learning) { learning = true; epoch = 0; learnStep(); } });
    $('#btn-perc-reset').addEventListener('click', () => { learning = false; w1 = 1; w2 = -1; b = 0; syncUI(); draw(); });
    syncUI(); draw();
  })();

  /* ══════════════ 02 · GRADIENT DESCENT ══════════════ */
  (function () {
    const cv = $('#cv-gd'); if (!cv) return;
    const [ctx, W, H] = fit(cv);
    const f = w => 0.045 * w * w + 1.1 * Math.sin(1.35 * w);
    const fp = w => 0.09 * w + 1.485 * Math.cos(1.35 * w);
    const WMIN = -9, WMAX = 9, FMIN = -1.35, FMAX = 4.6;
    const X = w => (w - WMIN) / (WMAX - WMIN) * (W - 40) + 20;
    const Y = v => H - 34 - (v - FMIN) / (FMAX - FMIN) * (H - 70);
    let w = 7.6, trail = [], auto = null, noise = false;
    const rng = mulberry32(9);

    function draw(msg) {
      ctx.clearRect(0, 0, W, H);
      const pts = [];
      for (let x = WMIN; x <= WMAX; x += 0.08) pts.push([X(x), Y(f(x))]);
      rough(ctx, pts, SLATE, 3, 3);
      ctx.font = '17px Caveat, cursive'; ctx.fillStyle = FAINT;
      ctx.fillText('the loss landscape', X(-8.6), Y(4.1));
      ctx.fillText('deep valley', X(-2.4), Y(-1.25));
      ctx.fillText('sneaky local valley', X(2.2), Y(-0.78));
      trail.forEach((t, i) => {
        ctx.globalAlpha = (i + 1) / trail.length * 0.45;
        ctx.fillStyle = CORAL; ctx.beginPath(); ctx.arc(X(t), Y(f(t)), 4, 0, 7); ctx.fill();
      });
      ctx.globalAlpha = 1;
      const g = fp(w), len = Math.min(Math.abs(g) * 30, 70) * -Math.sign(g);
      arrow(ctx, X(w), Y(f(w)) - 16, X(w) + len, Y(f(w)) - 16 - len * g * 0.12, GOLD, 2.5);
      ctx.fillStyle = CORAL; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(X(w), Y(f(w)) - 9, 9, 0, 7); ctx.fill(); ctx.stroke();
      $('#gd-loss').textContent = fmt(f(w)); $('#gd-slope').textContent = fmt(fp(w));
      $('#gd-msg').textContent = msg || '';
    }
    function step() {
      const lr = +$('#in-lr').value;
      trail.push(w); if (trail.length > 42) trail.shift();
      const prev = f(w);
      w -= lr * fp(w);
      if (noise) w += gauss(rng) * 0.24;
      let msg = '';
      if (w < WMIN + 0.2 || w > WMAX - 0.2) { w = Math.max(WMIN + 0.2, Math.min(WMAX - 0.2, w)); msg = 'diverged! lower the learning rate'; stop(); }
      else if (f(w) > prev + 0.4) msg = 'overshot the valley!';
      draw(msg);
    }
    function stop() { if (auto) { clearInterval(auto); auto = null; $('#btn-gd-auto').textContent = 'descend'; } }
    $('#btn-gd-step').addEventListener('click', () => { stop(); step(); });
    $('#btn-gd-auto').addEventListener('click', function () {
      if (auto) stop();
      else { this.textContent = 'pause'; auto = setInterval(step, reduced ? 400 : 130); }
    });
    $('#btn-gd-noise').addEventListener('click', function () {
      noise = !noise; this.textContent = 'noise: ' + (noise ? 'on' : 'off'); this.setAttribute('aria-pressed', noise);
    });
    $('#btn-gd-reset').addEventListener('click', () => { stop(); w = 7.6; trail = []; draw(); });
    $('#in-lr').addEventListener('input', () => $('#o-lr').textContent = fmt(+$('#in-lr').value));
    visible(cv, v => { if (!v) stop(); });
    draw();
  })();

  /* ══════════════ 03 · XOR — LIVE TRAINING ══════════════ */
  (function () {
    const cv = $('#cv-xor'); if (!cv) return;
    const [ctx, W, H] = fit(cv);
    const rng = mulberry32(77);
    const data = [];
    while (data.length < 170) {
      const x = rng() * 2 - 1, y = rng() * 2 - 1;
      if (Math.abs(x) < 0.14 || Math.abs(y) < 0.14) continue;
      data.push({ x, y, l: (x > 0) !== (y > 0) ? 1 : 0 });
    }
    const HN = 8;
    let act = 'tanh', W1, B1, W2, B2, steps = 0, running = false, lossHist = [];
    const acts = {
      sigmoid: { f: z => 1 / (1 + Math.exp(-z)), d: (z, h) => h * (1 - h), lr: 2.2 },
      tanh:    { f: Math.tanh,                    d: (z, h) => 1 - h * h,   lr: 0.55 },
      relu:    { f: z => Math.max(0, z),          d: z => (z > 0 ? 1 : 0),  lr: 0.22 }
    };
    function init() {
      const scale = act === 'relu' ? Math.sqrt(2 / 2) : Math.sqrt(1 / 2);
      W1 = []; B1 = []; W2 = []; B2 = 0;
      for (let j = 0; j < HN; j++) {
        W1.push([gauss(rng) * scale, gauss(rng) * scale]);
        B1.push(0.01 * gauss(rng));
        W2.push(gauss(rng) * Math.sqrt(1 / HN));
      }
      steps = 0; lossHist = [];
    }
    function forward(x, y) {
      const z1 = [], h = [];
      for (let j = 0; j < HN; j++) { z1[j] = W1[j][0] * x + W1[j][1] * y + B1[j]; h[j] = acts[act].f(z1[j]); }
      let z2 = B2; for (let j = 0; j < HN; j++) z2 += W2[j] * h[j];
      return { z1, h, p: 1 / (1 + Math.exp(-z2)) };
    }
    function trainBatch() {
      const lr = acts[act].lr, n = data.length;
      const gW1 = W1.map(() => [0, 0]), gB1 = new Array(HN).fill(0), gW2 = new Array(HN).fill(0);
      let gB2 = 0, loss = 0;
      for (const d of data) {
        const { z1, h, p } = forward(d.x, d.y);
        loss += -(d.l * Math.log(p + 1e-9) + (1 - d.l) * Math.log(1 - p + 1e-9));
        const dz2 = p - d.l;
        gB2 += dz2;
        for (let j = 0; j < HN; j++) {
          gW2[j] += dz2 * h[j];
          const dz1 = dz2 * W2[j] * acts[act].d(z1[j], h[j]);
          gW1[j][0] += dz1 * d.x; gW1[j][1] += dz1 * d.y; gB1[j] += dz1;
        }
      }
      for (let j = 0; j < HN; j++) {
        W2[j] -= lr * gW2[j] / n; B1[j] -= lr * gB1[j] / n;
        W1[j][0] -= lr * gW1[j][0] / n; W1[j][1] -= lr * gW1[j][1] / n;
      }
      B2 -= lr * gB2 / n; steps++;
      return loss / n;
    }
    const PX = x => W / 2 + x * (W / 2.5), PY = y => H / 2 - y * (H / 2.5);
    const heat = document.createElement('canvas'); heat.width = 64; heat.height = 40;
    const hctx = heat.getContext('2d');
    function draw(loss) {
      // decision heatmap
      const img = hctx.createImageData(64, 40);
      for (let iy = 0; iy < 40; iy++) for (let ix = 0; ix < 64; ix++) {
        const x = (ix / 63) * 2.24 - 1.12, y = 1.12 - (iy / 39) * 2.24;
        const p = forward(x, y).p, i = (iy * 64 + ix) * 4;
        // blend slate(0) → paper(0.5) → coral(1)
        const t = p * 2 - 1;
        img.data[i]     = t > 0 ? 250 - (250 - 217) * t : 250 - (250 - 107) * -t;
        img.data[i + 1] = t > 0 ? 247 - (247 - 119) * t : 247 - (247 - 127) * -t;
        img.data[i + 2] = t > 0 ? 240 - (240 - 87) * t  : 240 - (240 - 163) * -t;
        img.data[i + 3] = 235;
      }
      hctx.putImageData(img, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(heat, PX(-1.12), PY(1.12), PX(1.12) - PX(-1.12), PY(-1.12) - PY(1.12));
      data.forEach(d => {
        ctx.beginPath(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
        if (d.l === 1) { ctx.fillStyle = CORAL; ctx.arc(PX(d.x), PY(d.y), 5, 0, 7); ctx.fill(); ctx.stroke(); }
        else { ctx.fillStyle = SLATE; ctx.fillRect(PX(d.x) - 4.5, PY(d.y) - 4.5, 9, 9); ctx.strokeRect(PX(d.x) - 4.5, PY(d.y) - 4.5, 9, 9); }
      });
      // loss sparkline inset
      const bx = W - 214, by = 16, bw = 198, bh = 74;
      ctx.fillStyle = 'rgba(250,247,240,0.92)'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
      ctx.font = '15px Caveat, cursive'; ctx.fillStyle = FAINT; ctx.fillText('loss over time', bx + 10, by + 17);
      if (lossHist.length > 1) {
        const m = Math.max(...lossHist, 0.75);
        const pts = lossHist.map((v, i) => [bx + 8 + (i / (lossHist.length - 1)) * (bw - 16), by + bh - 8 - (v / m) * (bh - 30)]);
        rough(ctx, pts, CORAL, 2, 5);
      }
      let correct = 0; data.forEach(d => { if ((forward(d.x, d.y).p > 0.5 ? 1 : 0) === d.l) correct++; });
      $('#xor-loss').textContent = loss !== undefined ? fmt(loss, 3) : '—';
      $('#xor-steps').textContent = steps;
      $('#xor-acc').textContent = Math.round(correct / data.length * 100) + '%';
    }
    let raf = null;
    function loop() {
      if (!running) return;
      let loss;
      const per = reduced ? 8 : 26;
      for (let i = 0; i < per; i++) loss = trainBatch();
      if (steps % 52 < per) lossHist.push(loss);
      if (lossHist.length > 90) lossHist.shift();
      draw(loss);
      if (act === 'relu' && steps > 3000 && loss > 0.65) init(); // dead-ReLU rescue
      if (loss < 0.015 || steps > 24000) { running = false; $('#btn-xor-train').textContent = 'train'; return; }
      raf = requestAnimationFrame(loop);
    }
    $('#btn-xor-train').addEventListener('click', function () {
      running = !running; this.textContent = running ? 'pause' : 'train';
      if (running) loop();
    });
    $('#btn-xor-reset').addEventListener('click', () => { running = false; $('#btn-xor-train').textContent = 'train'; init(); draw(); });
    $$('#seg-act button').forEach(btn => btn.addEventListener('click', () => {
      $$('#seg-act button').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      act = btn.dataset.act; running = false; $('#btn-xor-train').textContent = 'train'; init(); draw();
    }));
    visible(cv, v => { if (!v && running) { running = false; $('#btn-xor-train').textContent = 'train'; } });
    init(); draw();
  })();

  /* ══════════════ 04a · TOKENIZER ══════════════ */
  (function () {
    const input = $('#in-tok'); if (!input) return;
    const VOCAB = ('the,and,is,in,of,to,a,it,that,for,on,with,as,was,are,be,this,at,by,from,or,an,we,you,' +
      'trans,form,er,ing,ed,es,s,ly,un,re,pre,de,dis,over,under,out,up,down,inter,sub,super,anti,auto,' +
      'tion,ation,ition,ness,ment,able,ible,ful,less,ive,al,ic,ous,ist,ism,ity,ify,ification,ize,ization,' +
      'learn,think,believ,work,net,neural,machine,model,token,word,language,gradient,descent,attention,' +
      'compute,data,train,deep,layer,weight,loss,mind,brain,neuron,robot,ball,heavy,light,new,old,big,small,' +
      'hyper,micro,mega,multi,self,co,bi,tri,king,queen,man,woman,cat,dog,puppy,kitten,house,time,day,person,' +
      'gen,er,ate,vis,ual,pro,con,com,ex,en,em,im,ir,il,mid,semi,non,post,fore,ante,graph,phon,photo,tele,' +
      'ther,wh,sh,ch,qu,ck,ough,igh,tion').split(',');
    const vset = new Map(); VOCAB.forEach((v, i) => { if (!vset.has(v)) vset.set(v, i + 1000); });
    const COLORS = ['#f6d9cd', '#dfe8d8', '#dbe2ee', '#f3e6c3', '#e8dcef'];

    function segmentWord(word) {
      const out = []; let i = 0;
      const lower = word.toLowerCase();
      while (i < lower.length) {
        let piece = null;
        for (let len = Math.min(12, lower.length - i); len >= 2; len--) {
          const cand = lower.slice(i, i + len);
          if (vset.has(cand)) { piece = cand; break; }
        }
        if (!piece) piece = lower[i];
        out.push({ text: word.slice(i, i + piece.length), id: vset.get(piece) || (200 + piece.charCodeAt(0) % 300) });
        i += piece.length;
      }
      return out;
    }
    function render() {
      const text = input.value;
      const outEl = $('#tok-out'); outEl.innerHTML = '';
      let count = 0;
      text.split(/(\s+|[.,!?;])/).filter(t => t && !/^\s+$/.test(t)).forEach(word => {
        const pieces = /^[.,!?;]$/.test(word) ? [{ text: word, id: 900 + word.charCodeAt(0) }] : segmentWord(word);
        pieces.forEach((p, i) => {
          const chip = document.createElement('span');
          chip.className = 'tok';
          chip.style.background = COLORS[(p.id + i) % COLORS.length];
          chip.style.animationDelay = (count * 0.03) + 's';
          chip.innerHTML = p.text.replace(/</g, '&lt;') + '<small>#' + p.id + '</small>';
          outEl.appendChild(chip); count++;
        });
      });
      $('#tok-chars').textContent = text.length;
      $('#tok-count').textContent = count;
    }
    input.addEventListener('input', render);
    render();
  })();

  /* ══════════════ 04b · EMBEDDINGS ══════════════ */
  (function () {
    const cv = $('#cv-emb'); if (!cv) return;
    const [ctx, W, H] = fit(cv);
    const words = {
      king: [0.62, 0.55], queen: [0.80, 0.75], man: [0.18, 0.28], woman: [0.36, 0.48],
      prince: [0.52, 0.36], princess: [0.70, 0.56],
      dog: [-0.55, 0.20], puppy: [-0.68, 0.40], cat: [-0.34, 0.10], kitten: [-0.47, 0.30], wolf: [-0.66, 0.04],
      apple: [-0.18, -0.62], banana: [-0.02, -0.70], bread: [-0.34, -0.70],
      computer: [0.50, -0.46], robot: [0.64, -0.34], network: [0.40, -0.60],
      run: [0.02, 0.78], walk: [-0.14, 0.66], swim: [0.16, 0.64]
    };
    const X = x => W / 2 + x * (W / 2.35), Y = y => H / 2 - y * (H / 2.35);
    let anim = null;

    function base() {
      ctx.clearRect(0, 0, W, H);
      ctx.font = '13px Karla, sans-serif';
      for (const [w, [x, y]] of Object.entries(words)) {
        ctx.fillStyle = SLATE; ctx.beginPath(); ctx.arc(X(x), Y(y), 4, 0, 7); ctx.fill();
        ctx.fillStyle = INK; ctx.fillText(w, X(x) + 8, Y(y) + 4);
      }
      ctx.font = '16px Caveat, cursive'; ctx.fillStyle = FAINT;
      ctx.fillText('animals', X(-0.62), Y(0.62));
      ctx.fillText('royalty', X(0.68), Y(0.92));
      ctx.fillText('food', X(-0.30), Y(-0.86));
      ctx.fillText('tech', X(0.44), Y(-0.76));
    }
    function runAnalogy(a, b, c, target) {
      if (anim) cancelAnimationFrame(anim);
      const A = words[a], B = words[b], C = words[c], T = words[target];
      let t0 = null;
      function frame(ts) {
        if (!t0) t0 = ts;
        const t = Math.min((ts - t0) / (reduced ? 1 : 1900), 1);
        base();
        const p1 = Math.min(t * 2, 1), p2 = Math.max(0, Math.min(t * 2 - 0.85, 1));
        // arrow b→a  (the "direction of royalty/youth")
        arrow(ctx, X(B[0]), Y(B[1]), X(B[0] + (A[0] - B[0]) * p1), Y(B[1] + (A[1] - B[1]) * p1), CORAL, 3);
        // same arrow, translated to start at c
        if (p2 > 0) {
          arrow(ctx, X(C[0]), Y(C[1]), X(C[0] + (A[0] - B[0]) * p2), Y(C[1] + (A[1] - B[1]) * p2), SAGE, 3);
        }
        if (t >= 1) {
          ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(X(T[0]) + 14, Y(T[1]) - 1, 26, 0.3, 6.6); ctx.stroke();
          ctx.font = '19px Caveat, cursive'; ctx.fillStyle = CORAL_D;
          ctx.fillText('same arrow!', X(C[0] + (A[0] - B[0]) / 2) - 30, Y(C[1] + (A[1] - B[1]) / 2) - 14);
          return;
        }
        anim = requestAnimationFrame(frame);
      }
      anim = requestAnimationFrame(frame);
    }
    $('#btn-emb-analogy').addEventListener('click', () => runAnalogy('king', 'man', 'woman', 'queen'));
    $('#btn-emb-analogy2').addEventListener('click', () => runAnalogy('puppy', 'dog', 'cat', 'kitten'));
    $('#btn-emb-clear').addEventListener('click', () => { if (anim) cancelAnimationFrame(anim); base(); });
    base();
  })();

  /* ══════════════ 05 · ATTENTION ══════════════ */
  (function () {
    const cv = $('#cv-attn'); if (!cv) return;
    const [ctx, W, H] = fit(cv);
    const S = ['The', 'robot', 'picked', 'up', 'the', 'ball', 'because', 'it', 'was', 'heavy'];
    // hand-set pre-softmax scores [from][to]; diagonal = mild self-attention
    const R = (pairs, self) => {
      const row = new Array(10).fill(-2);
      pairs.forEach(([j, v]) => row[j] = v);
      return { row, self: self === undefined ? 0.6 : self };
    };
    const rows = [
      R([[1, 1.6]]),                                  // The → robot
      R([[0, 1.0], [2, 1.2]]),                        // robot
      R([[1, 2.4], [5, 2.0], [3, 1.5]]),              // picked → robot, ball
      R([[2, 2.2]]),                                  // up → picked
      R([[5, 2.2]]),                                  // the → ball
      R([[2, 1.8], [4, 1.2], [1, 0.9]]),              // ball → picked
      R([[9, 1.4], [7, 1.0]]),                        // because
      R([[5, 3.1], [1, 1.5], [9, 1.6]]),              // it → ball!, robot, heavy
      R([[7, 1.6], [9, 1.8]]),                        // was
      R([[5, 2.4], [7, 2.0]])                         // heavy → ball, it
    ];
    let sel = 7, causal = false;
    const sentEl = $('#attn-sent');
    S.forEach((w, i) => {
      const el = document.createElement('span');
      el.className = 'w'; el.textContent = w; el.dataset.i = i;
      el.addEventListener('click', () => { if (causal && i > sel && el.classList.contains('masked')) return; sel = i; render(); });
      sentEl.appendChild(el);
    });
    function weights(i) {
      const r = rows[i].row.slice(); r[i] = rows[i].self;
      const idx = [];
      for (let j = 0; j < 10; j++) if (!causal || j <= i) idx.push(j);
      const m = Math.max(...idx.map(j => r[j]));
      let sum = 0; const e = {};
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
        if (v < 0.02) return;
        const x1 = xs[sel], x2 = xs[j];
        ctx.strokeStyle = j === sel ? SAGE : CORAL;
        ctx.globalAlpha = 0.25 + v * 0.75;
        ctx.lineWidth = 1.5 + v * 11;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const mid = (x1 + x2) / 2, drop = 30 + Math.abs(x2 - x1) * 0.22;
        ctx.moveTo(x1, 8); ctx.quadraticCurveTo(mid, 8 + drop, x2, 8);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      // top-3 labels, each tucked under its own arc's apex
      ctx.font = '15px Caveat, cursive'; ctx.fillStyle = INK;
      entries.slice(0, 3).forEach(([j, v]) => {
        if (j === sel) return;
        const drop = 30 + Math.abs(xs[j] - xs[sel]) * 0.22;
        ctx.fillText(Math.round(v * 100) + '%', xs[j] - 12, Math.min(8 + drop / 2 + 26, H - 8));
      });
      ctx.font = '16px Caveat, cursive'; ctx.fillStyle = FAINT;
      ctx.fillText('softmax( q·k / √d ) — live', W - 200, 24);
    }
    $('#btn-attn-causal').addEventListener('click', function () {
      causal = !causal; this.textContent = 'causal mask: ' + (causal ? 'on' : 'off'); this.setAttribute('aria-pressed', causal);
      render();
    });
    addEventListener('resize', render);
    setTimeout(render, 60);
  })();

  /* ══════════════ 06 · N-GRAM GENERATION ══════════════ */
  (function () {
    const cv = $('#cv-gen'); if (!cv) return;
    const [ctx, W, H] = fit(cv);
    // corpus = this page's own prose
    const text = $$('.chapter p, .chapter h2, .hero-sub').map(el => el.textContent).join(' ');
    const toks = text.toLowerCase().replace(/[—–]/g, ' ').replace(/[.!?]/g, ' . ')
      .replace(/[^a-z0-9'\s.]/g, ' ').split(/\s+/).filter(Boolean);
    const uni = {}, bi = {}, tri = {}, starts = [];
    for (let i = 0; i < toks.length; i++) {
      const a = toks[i]; uni[a] = (uni[a] || 0) + 1;
      if (i + 1 < toks.length) {
        const b = toks[i + 1];
        (bi[a] = bi[a] || {})[b] = (bi[a][b] || 0) + 1;
        if (a === '.' && b !== '.') { if (i + 2 < toks.length && toks[i + 2] !== '.') starts.push([b, toks[i + 2]]); }
        if (i + 2 < toks.length) {
          const key = a + ' ' + b, c = toks[i + 2];
          (tri[key] = tri[key] || {})[c] = (tri[key][c] || 0) + 1;
        }
      }
    }
    const uniTotal = toks.length;
    const topUni = Object.entries(uni).filter(([w]) => w !== '.').sort((a, b) => b[1] - a[1]).slice(0, 40).map(e => e[0]);
    const sum = o => Object.values(o).reduce((s, v) => s + v, 0);

    function rawDist(w1, w2) {
      const cand = new Set(topUni);
      const t = tri[w1 + ' ' + w2] || {}, b = bi[w2] || {};
      Object.keys(t).forEach(k => cand.add(k));
      Object.keys(b).forEach(k => cand.add(k));
      const tS = sum(t) || 1, bS = sum(b) || 1;
      const out = [];
      cand.forEach(w => {
        const p = 0.70 * ((t[w] || 0) / tS) + 0.24 * ((b[w] || 0) / bS) + 0.06 * ((uni[w] || 0) / uniTotal);
        if (p > 0) out.push([w, p]);
      });
      const z = out.reduce((s, e) => s + e[1], 0);
      out.forEach(e => e[1] /= z);
      return out.sort((a, b2) => b2[1] - a[1]);
    }
    function shape(dist) {
      const T = +$('#in-temp').value, k = +$('#in-topk').value, p = +$('#in-topp').value;
      let d = dist.map(([w, pr]) => [w, Math.pow(pr, 1 / T)]);
      let z = d.reduce((s, e) => s + e[1], 0); d.forEach(e => e[1] /= z);
      d.sort((a, b) => b[1] - a[1]);
      if (k > 0) d = d.slice(0, k);
      if (p < 1) {
        let cum = 0; const keep = [];
        for (const e of d) { keep.push(e); cum += e[1]; if (cum >= p) break; }
        d = keep;
      }
      z = d.reduce((s, e) => s + e[1], 0); d.forEach(e => e[1] /= z);
      return d;
    }
    let ctxWords = [], genCount = 0, autoTimer = null, lastSample = null;
    const rng2 = mulberry32(Date.now() & 0xffff);

    function drawBars(raw, shaped, sampled) {
      ctx.clearRect(0, 0, W, H);
      const shapeMap = Object.fromEntries(shaped);
      const show = raw.slice(0, 12);
      const rowH = Math.min(24, (H - 38) / show.length), maxP = Math.max(show[0] ? show[0][1] : 0.01, shaped[0] ? shaped[0][1] : 0.01);
      ctx.font = '13.5px Karla, sans-serif';
      show.forEach(([w, pr], i) => {
        const y = 10 + i * rowH, label = w === '.' ? '(end)' : w;
        ctx.fillStyle = INK; ctx.fillText(label.slice(0, 13), 8, y + rowH * 0.62);
        const x0 = 118, maxW = W - 190;
        // ghost: raw
        ctx.strokeStyle = FAINT; ctx.lineWidth = 1.5;
        ctx.strokeRect(x0, y + 2, Math.max(2, pr / maxP * maxW), rowH - 7);
        // filled: shaped
        const sp = shapeMap[w] || 0;
        ctx.fillStyle = w === sampled ? GOLD : CORAL;
        if (sp > 0) ctx.fillRect(x0, y + 2, Math.max(2, sp / maxP * maxW), rowH - 7);
        ctx.fillStyle = FAINT;
        ctx.fillText((sp * 100).toFixed(1) + '%', x0 + maxW + 8, y + rowH * 0.62);
      });
      ctx.font = '15px Caveat, cursive'; ctx.fillStyle = FAINT;
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
      const cur = document.createElement('span'); cur.className = 'cursor';
      el.appendChild(cur);
      const kv = $('#kv-row');
      $$('.kv-cell', kv).forEach(c => c.remove());
      const n = Math.min(ctxWords.length, 34);
      for (let i = 0; i < n; i++) { const c = document.createElement('span'); c.className = 'kv-cell'; kv.appendChild(c); }
      if (ctxWords.length > 34) { const more = document.createElement('span'); more.className = 'kv-label kv-cell-more'; more.textContent = '+' + (ctxWords.length - 34); kv.appendChild(more); }
    }
    function reseed() {
      stopAuto();
      const s = starts[(rng2() * starts.length) | 0] || ['the', 'model'];
      ctxWords = [s[0], s[1]]; genCount = 0; lastSample = null;
      renderOut(); refreshBars();
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
      for (const [w, p] of shaped) { r -= p; if (r <= 0) { pick = w; break; } }
      ctxWords.push(pick); genCount++; lastSample = pick;
      drawBars(raw, shaped, pick);
      renderOut();
    }
    function stopAuto() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; $('#btn-gen-go').textContent = 'generate'; } }
    $('#btn-gen-go').addEventListener('click', function () {
      if (autoTimer) { stopAuto(); return; }
      this.textContent = 'stop';
      let n = 0;
      autoTimer = setInterval(() => { step(); if (++n >= 26) stopAuto(); }, reduced ? 320 : 150);
    });
    $('#btn-gen-step').addEventListener('click', () => { stopAuto(); step(); });
    $('#btn-gen-reseed').addEventListener('click', reseed);
    ['in-temp', 'in-topk', 'in-topp'].forEach(id => $('#' + id).addEventListener('input', () => {
      $('#o-temp').textContent = fmt(+$('#in-temp').value, 2);
      const k = +$('#in-topk').value;
      $('#o-topk').textContent = k === 0 ? 'off' : k;
      $('#o-topp').textContent = fmt(+$('#in-topp').value, 2);
      refreshBars();
    }));
    visible(cv, v => { if (!v) stopAuto(); });
    reseed();
  })();

  /* ══════════════ 07 · LoRA / DPO / MoE ══════════════ */
  (function () {
    const viz = $('#lora-viz'); if (!viz) return;
    const D = 4096;
    function fmtP(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : '' + n; }
    function render(r) {
      const px = Math.max(4, Math.round(3 + r * 0.34));
      viz.innerHTML =
        `<svg width="330" height="150" viewBox="0 0 330 150" style="max-width:100%">
          <rect x="8" y="14" width="120" height="120" fill="#ece6d8" stroke="#2d2a24" stroke-width="2.5" rx="6"/>
          <text x="68" y="80" text-anchor="middle" font-family="Karla" font-weight="700" font-size="14" fill="#57503f">W</text>
          <text x="68" y="98" text-anchor="middle" font-family="Caveat" font-size="16" fill="#8a8171">frozen ✻</text>
          <text x="150" y="82" text-anchor="middle" font-family="Fraunces" font-size="26" fill="#2d2a24">+</text>
          <rect x="172" y="14" width="${px}" height="120" fill="#d97757" stroke="#2d2a24" stroke-width="2.5" rx="3"/>
          <text x="${172 + px / 2}" y="146" text-anchor="middle" font-family="Karla" font-weight="700" font-size="12" fill="#b85c3e">B</text>
          <text x="${196 + px}" y="82" text-anchor="middle" font-family="Fraunces" font-size="20" fill="#2d2a24">×</text>
          <rect x="${212 + px}" y="72" width="112" height="${px}" fill="#7d9070" stroke="#2d2a24" stroke-width="2.5" rx="3"/>
          <text x="${268 + px}" y="${68}" text-anchor="middle" font-family="Karla" font-weight="700" font-size="12" fill="#5e8d5a">A</text>
          <text x="${268 + px}" y="${96 + px}" text-anchor="middle" font-family="Caveat" font-size="15" fill="#8a8171">trainable — rank ${r}</text>
        </svg>`;
      $('#lora-full').textContent = fmtP(D * D);
      $('#lora-lite').textContent = fmtP(2 * D * r);
      $('#lora-pct').textContent = (2 * D * r / (D * D) * 100).toFixed(2) + '%';
    }
    $('#in-rank').addEventListener('input', function () { $('#o-rank').textContent = this.value; render(+this.value); });
    render(8);

    // DPO
    $$('.dpo-card').forEach(card => card.addEventListener('click', () => {
      $$('.dpo-card').forEach(c => { c.classList.remove('chosen', 'rejected'); });
      card.classList.add('chosen');
      $$('.dpo-card').forEach(c => { if (c !== card) c.classList.add('rejected'); });
      const pick = card.dataset.pick.toUpperCase(), other = pick === 'A' ? 'B' : 'A';
      $('#dpo-read').innerHTML = `<span class="stat">logged: <b>${pick} ≻ ${other}</b></span><span class="stat">loss = −log σ(β·Δ) → policy nudged toward ${pick}</span>`;
    }));

    // MoE router
    const expWrap = $('#moe-experts');
    for (let i = 0; i < 8; i++) { const d = document.createElement('div'); d.className = 'moe-exp'; d.textContent = 'E' + (i + 1); expWrap.appendChild(d); }
    const moeTokens = ['gradient', 'the', 'robot', 'attention', 'learning', 'ball', 'descent', 'because'];
    let mi = 0, moeOn = true;
    function moeTick() {
      if (!moeOn) return;
      const tok = moeTokens[mi % moeTokens.length];
      $('#moe-token').textContent = '"' + tok + '"';
      let h = 0; for (const ch of tok) h = (h * 31 + ch.charCodeAt(0)) | 0;
      const a = Math.abs(h) % 8; let b = Math.abs(h >> 3) % 8; if (b === a) b = (b + 3) % 8;
      $$('.moe-exp', expWrap).forEach((el, i) => el.classList.toggle('on', i === a || i === b));
      mi++;
    }
    setInterval(moeTick, reduced ? 3200 : 1700);
    visible($('#w-moe'), v => moeOn = v);
    moeTick();
  })();
})();
