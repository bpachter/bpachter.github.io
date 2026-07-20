/* Gradient · foundations.ts — ch 01-04: perceptron, 1-D descent,
   3-D landscape, live XOR backprop. Requires core.ts (same bundle). */

/* ══════════════ 01 · PERCEPTRON ══════════════ */
(function () {
  const cv = $<HTMLCanvasElement>('#cv-perc'); if (!cv) return;
  const [ctx, W, H] = fit(cv);
  const rng = mulberry32(42);
  interface P { x: number; y: number; l: number; }
  const pts: P[] = [];
  for (let i = 0; i < 46; i++) pts.push({ x: -0.45 + gauss(rng) * 0.21, y: -0.30 + gauss(rng) * 0.21, l: -1 });
  for (let i = 0; i < 46; i++) pts.push({ x: 0.50 + gauss(rng) * 0.21, y: 0.34 + gauss(rng) * 0.21, l: 1 });
  let w1 = 1, w2 = -1, b = 0, learning = false, epoch = 0;
  const X = (x: number) => W / 2 + x * (W / 2.6), Y = (y: number) => H / 2 - y * (H / 2.6);

  const sliders = { w1: $<HTMLInputElement>('#in-w1'), w2: $<HTMLInputElement>('#in-w2'), b: $<HTMLInputElement>('#in-b') };
  const outs = { w1: $('#o-w1'), w2: $('#o-w2'), b: $('#o-b') };
  function syncUI(): void {
    sliders.w1.value = String(w1); sliders.w2.value = String(w2); sliders.b.value = String(b);
    outs.w1.textContent = fmt(w1, 1); outs.w2.textContent = fmt(w2, 1); outs.b.textContent = fmt(b, 1);
  }
  (Object.keys(sliders) as Array<keyof typeof sliders>).forEach(k => sliders[k].addEventListener('input', () => {
    learning = false; w1 = +sliders.w1.value; w2 = +sliders.w2.value; b = +sliders.b.value; syncUI(); draw();
  }));

  function acc(): number {
    let c = 0;
    pts.forEach(p => { if (Math.sign(w1 * p.x + w2 * p.y + b) === p.l) c++; });
    return c / pts.length;
  }
  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    const mag = Math.hypot(w1, w2) || 1e-6;
    for (const side of [1, -1]) {
      ctx.fillStyle = side === 1 ? 'rgba(138,174,104,0.13)' : 'rgba(107,127,163,0.10)';
      ctx.beginPath();
      const n = { x: w1 / mag, y: w2 / mag };
      const c = { x: -b * w1 / (mag * mag), y: -b * w2 / (mag * mag) };
      const d = { x: -n.y, y: n.x };
      const p1 = { x: c.x + d.x * 10, y: c.y + d.y * 10 }, p2 = { x: c.x - d.x * 10, y: c.y - d.y * 10 };
      const off = { x: n.x * 10 * side, y: n.y * 10 * side };
      ctx.moveTo(X(p1.x), Y(p1.y)); ctx.lineTo(X(p2.x), Y(p2.y));
      ctx.lineTo(X(p2.x + off.x), Y(p2.y + off.y)); ctx.lineTo(X(p1.x + off.x), Y(p1.y + off.y));
      ctx.closePath(); ctx.fill();
    }
    {
      const n = { x: w1 / mag, y: w2 / mag };
      const c = { x: -b * w1 / (mag * mag), y: -b * w2 / (mag * mag) };
      const d = { x: -n.y, y: n.x };
      rough(ctx, [[X(c.x + d.x * 3), Y(c.y + d.y * 3)], [X(c.x - d.x * 3), Y(c.y - d.y * 3)]], INK, 3, 11);
    }
    pts.forEach(p => {
      const pred = Math.sign(w1 * p.x + w2 * p.y + b);
      ctx.beginPath();
      if (p.l === 1) { ctx.fillStyle = LEAF; ctx.arc(X(p.x), Y(p.y), 6, 0, 7); ctx.fill(); }
      else { ctx.fillStyle = SLATE; ctx.fillRect(X(p.x) - 5, Y(p.y) - 5, 10, 10); }
      if (pred !== p.l) { ctx.strokeStyle = BAD; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 10, 0, 7); ctx.stroke(); }
    });
    $('#perc-acc').textContent = Math.round(acc() * 100) + '%';
  }
  function learnStep(): void {
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
  const startLearning = () => { if (!learning) { learning = true; epoch = 0; learnStep(); } };
  $('#btn-perc-learn').addEventListener('click', startLearning);
  $('#btn-perc-reset').addEventListener('click', () => { learning = false; w1 = 1; w2 = -1; b = 0; syncUI(); draw(); });
  syncUI(); draw();

  const touch = userTouch($('#w-perceptron'));
  autoOnView($('#w-perceptron'), () => { if (!touch.touched) startLearning(); }, 1100);
})();

/* ══════════════ 02 · GRADIENT DESCENT (1-D) ══════════════ */
(function () {
  const cv = $<HTMLCanvasElement>('#cv-gd'); if (!cv) return;
  const [ctx, W, H] = fit(cv);
  const f = (w: number) => 0.045 * w * w + 1.1 * Math.sin(1.35 * w);
  const fp = (w: number) => 0.09 * w + 1.485 * Math.cos(1.35 * w);
  const WMIN = -9, WMAX = 9, FMIN = -1.35, FMAX = 4.6;
  const X = (w: number) => (w - WMIN) / (WMAX - WMIN) * (W - 40) + 20;
  const Y = (v: number) => H - 34 - (v - FMIN) / (FMAX - FMIN) * (H - 70);
  let w = 7.6, trail: number[] = [], auto: number | null = null, noise = false;
  const rng = mulberry32(9);

  function draw(msg?: string): void {
    ctx.clearRect(0, 0, W, H);
    const pts: Pt[] = [];
    for (let x = WMIN; x <= WMAX; x += 0.08) pts.push([X(x), Y(f(x))]);
    rough(ctx, pts, SLATE, 3, 3);
    ctx.font = '17px Caveat, cursive'; ctx.fillStyle = FAINT;
    ctx.fillText('the loss landscape', X(-8.6), Y(4.1));
    ctx.fillText('deep valley', X(-2.4), Y(-1.25));
    ctx.fillText('sneaky local valley', X(2.2), Y(-0.78));
    trail.forEach((t, i) => {
      ctx.globalAlpha = (i + 1) / trail.length * 0.45;
      ctx.fillStyle = LEAF; ctx.beginPath(); ctx.arc(X(t), Y(f(t)), 4, 0, 7); ctx.fill();
    });
    ctx.globalAlpha = 1;
    const g = fp(w), len = Math.min(Math.abs(g) * 30, 70) * -Math.sign(g);
    arrow(ctx, X(w), Y(f(w)) - 16, X(w) + len, Y(f(w)) - 16 - len * g * 0.12, GOLD, 2.5);
    ctx.fillStyle = LEAF; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(X(w), Y(f(w)) - 9, 9, 0, 7); ctx.fill(); ctx.stroke();
    $('#gd-loss').textContent = fmt(f(w)); $('#gd-slope').textContent = fmt(fp(w));
    $('#gd-msg').textContent = msg || '';
  }
  function step(): void {
    const lr = +$<HTMLInputElement>('#in-lr').value;
    trail.push(w); if (trail.length > 42) trail.shift();
    const prev = f(w);
    w -= lr * fp(w);
    if (noise) w += gauss(rng) * 0.24;
    let msg = '';
    if (w < WMIN + 0.2 || w > WMAX - 0.2) { w = Math.max(WMIN + 0.2, Math.min(WMAX - 0.2, w)); msg = 'diverged! lower the learning rate'; stop(); }
    else if (f(w) > prev + 0.4) msg = 'overshot the valley!';
    draw(msg);
  }
  function stop(): void { if (auto !== null) { clearInterval(auto); auto = null; $('#btn-gd-auto').textContent = 'descend'; } }
  function startAuto(): void {
    if (auto !== null) return;
    $('#btn-gd-auto').textContent = 'pause';
    auto = window.setInterval(step, reduced ? 400 : 130);
  }
  $('#btn-gd-step').addEventListener('click', () => { stop(); step(); });
  $('#btn-gd-auto').addEventListener('click', () => { auto !== null ? stop() : startAuto(); });
  $('#btn-gd-noise').addEventListener('click', function (this: HTMLElement) {
    noise = !noise; this.textContent = 'noise: ' + (noise ? 'on' : 'off'); this.setAttribute('aria-pressed', String(noise));
  });
  $('#btn-gd-reset').addEventListener('click', () => { stop(); w = 7.6; trail = []; draw(); });
  $('#in-lr').addEventListener('input', () => $('#o-lr').textContent = fmt(+$<HTMLInputElement>('#in-lr').value));
  visible(cv, v => { if (!v) stop(); });
  draw();

  const touch = userTouch($('#w-gd'));
  autoOnView($('#w-gd'), () => {
    if (touch.touched) return;
    startAuto();
    window.setTimeout(() => { if (!touch.touched) stop(); }, 2600);
  }, 900);
})();

/* ══════════════ 03 · THE LANDSCAPE IN 3-D ══════════════ */
(function () {
  const cv = $<HTMLCanvasElement>('#cv-gd3d'); if (!cv) return;
  const [ctx, W, H] = fit(cv);

  /* the terrain — two dials now. gentle bowl + rolling waves = several valleys */
  const f = (x: number, y: number) => 0.10 * (x * x + y * y) + Math.sin(1.3 * x) * Math.cos(1.1 * y) + 1.45;
  const fx = (x: number, y: number) => 0.20 * x + 1.3 * Math.cos(1.3 * x) * Math.cos(1.1 * y);
  const fy = (x: number, y: number) => 0.20 * y - 1.1 * Math.sin(1.3 * x) * Math.sin(1.1 * y);
  const R = 4, N = 27;                       // domain [-R,R], N×N grid
  const SX = 55, SY = 40;                    // world scale: ground px, height px

  const cam: Cam = { yaw: 0.7, pitch: 0.52, cx: W / 2, cy: H / 2 + 30, scale: 1, dist: 1600 };
  const drag = orbit(cv, cam);

  const world = (x: number, y: number): P3 => [x * SX, f(x, y) * SY, y * SX];

  /* find the deepest valley for a label */
  let minP: Pt = [0, 0], minV = 1e9;
  for (let i = 0; i <= 60; i++) for (let j = 0; j <= 60; j++) {
    const x = -R + (2 * R * i) / 60, y = -R + (2 * R * j) / 60;
    if (f(x, y) < minV) { minV = f(x, y); minP = [x, y]; }
  }

  const rng = mulberry32(31);
  let bx = 3.2, by = -2.6, vx = 0, vy = 0, steps = 0, rest = 0;
  let momentum = true;
  const trail: Pt[] = [];
  function dropBall(px?: number, py?: number): void {
    bx = px === undefined ? (rng() * 2 - 1) * (R - 0.7) : px;
    by = py === undefined ? (rng() * 2 - 1) * (R - 0.7) : py;
    vx = 0; vy = 0; steps = 0; rest = 0; trail.length = 0;
  }
  function physics(): void {
    if (rest > 0) { rest--; if (rest === 0) dropBall(); return; }
    const lr = +$<HTMLInputElement>('#in-lr3d').value;
    const beta = momentum ? 0.86 : 0;
    vx = beta * vx - lr * fx(bx, by);
    vy = beta * vy - lr * fy(bx, by);
    bx = Math.max(-R, Math.min(R, bx + vx));
    by = Math.max(-R, Math.min(R, by + vy));
    steps++;
    trail.push([bx, by]); if (trail.length > 90) trail.shift();
    if (Math.hypot(vx, vy) < 0.004 && Math.hypot(fx(bx, by), fy(bx, by)) < 0.09 && steps > 30) rest = 46;
    $('#gd3d-loss').textContent = fmt(f(bx, by) - minV, 2);
    $('#gd3d-steps').textContent = String(steps);
  }

  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    /* wireframe, rows then columns */
    ctx.lineWidth = 1.1;
    for (let gj = 0; gj <= N; gj++) {
      const y = -R + (2 * R * gj) / N;
      ctx.strokeStyle = 'rgba(107,127,163,0.42)';
      ctx.beginPath();
      for (let gi = 0; gi <= N; gi++) {
        const x = -R + (2 * R * gi) / N;
        const [sx, sy] = project(cam, world(x, y));
        gi ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
      }
      ctx.stroke();
    }
    for (let gi = 0; gi <= N; gi++) {
      const x = -R + (2 * R * gi) / N;
      ctx.strokeStyle = 'rgba(107,127,163,0.30)';
      ctx.beginPath();
      for (let gj = 0; gj <= N; gj++) {
        const y = -R + (2 * R * gj) / N;
        const [sx, sy] = project(cam, world(x, y));
        gj ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
      }
      ctx.stroke();
    }
    /* deepest-valley label */
    {
      const [sx, sy] = project(cam, world(minP[0], minP[1]));
      ctx.font = '17px Caveat, cursive'; ctx.fillStyle = FAINT;
      ctx.fillText('deepest valley', sx - 40, sy + 24);
    }
    /* trail on the surface */
    if (trail.length > 1) {
      ctx.strokeStyle = LEAF_D; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.8;
      ctx.beginPath();
      trail.forEach((t, i) => {
        const [sx, sy] = project(cam, world(t[0], t[1]));
        i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
      });
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    /* the ball (slightly above the surface) */
    {
      const [sx, sy, per] = project(cam, [bx * SX, f(bx, by) * SY + 9, by * SX]);
      const r = 9 * per;
      ctx.fillStyle = LEAF; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(4, r), 0, 7); ctx.fill(); ctx.stroke();
      /* downhill arrow */
      const gx = fx(bx, by), gy = fy(bx, by), gm = Math.hypot(gx, gy);
      if (gm > 0.12 && rest === 0) {
        const ex = bx - (gx / gm) * 0.9, ey = by - (gy / gm) * 0.9;
        const [ax, ay] = project(cam, [ex * SX, f(ex, ey) * SY + 9, ey * SX]);
        arrow(ctx, sx, sy, ax, ay, GOLD, 2);
      }
    }
    ctx.font = '16px Caveat, cursive'; ctx.fillStyle = FAINT;
    ctx.fillText('altitude = error. the ball only ever feels the slope under its feet.', 18, H - 14);
  }

  let tick = 0;
  function loop(): void {
    if (!reduced && !drag.dragging && !drag.everDragged) cam.yaw += 0.0028;
    else if (!reduced && !drag.dragging) cam.yaw += 0.0008;   // gentler after the reader takes over
    tick++;
    if (tick % (reduced ? 6 : 2) === 0) physics();
    draw();
    if (onScreen) requestAnimationFrame(loop);
  }
  let onScreen = false;
  visible(cv, v => { const was = onScreen; onScreen = v; if (v && !was) requestAnimationFrame(loop); });

  $('#btn-gd3d-drop').addEventListener('click', () => dropBall());
  $('#btn-gd3d-mom').addEventListener('click', function (this: HTMLElement) {
    momentum = !momentum; this.textContent = 'momentum: ' + (momentum ? 'on' : 'off'); this.setAttribute('aria-pressed', String(momentum));
  });
  $('#in-lr3d').addEventListener('input', () => $('#o-lr3d').textContent = fmt(+$<HTMLInputElement>('#in-lr3d').value, 2));
  draw();
})();

/* ══════════════ 04 · XOR — LIVE TRAINING ══════════════ */
(function () {
  const cv = $<HTMLCanvasElement>('#cv-xor'); if (!cv) return;
  const [ctx, W, H] = fit(cv);
  const rng = mulberry32(77);
  interface D { x: number; y: number; l: number; }
  const data: D[] = [];
  while (data.length < 170) {
    const x = rng() * 2 - 1, y = rng() * 2 - 1;
    if (Math.abs(x) < 0.14 || Math.abs(y) < 0.14) continue;
    data.push({ x, y, l: (x > 0) !== (y > 0) ? 1 : 0 });
  }
  const HN = 8;
  type ActName = 'sigmoid' | 'tanh' | 'relu';
  let act: ActName = 'tanh';
  let W1: number[][] = [], B1: number[] = [], W2: number[] = [], B2 = 0, steps = 0, running = false, lossHist: number[] = [];
  const acts: Record<ActName, { f: (z: number) => number; d: (z: number, h: number) => number; lr: number }> = {
    sigmoid: { f: z => 1 / (1 + Math.exp(-z)), d: (_z, h) => h * (1 - h), lr: 2.2 },
    tanh:    { f: Math.tanh,                    d: (_z, h) => 1 - h * h,   lr: 0.55 },
    relu:    { f: z => Math.max(0, z),          d: z => (z > 0 ? 1 : 0),  lr: 0.22 }
  };
  function init(): void {
    const scale = act === 'relu' ? Math.sqrt(2 / 2) : Math.sqrt(1 / 2);
    W1 = []; B1 = []; W2 = []; B2 = 0;
    for (let j = 0; j < HN; j++) {
      W1.push([gauss(rng) * scale, gauss(rng) * scale]);
      B1.push(0.01 * gauss(rng));
      W2.push(gauss(rng) * Math.sqrt(1 / HN));
    }
    steps = 0; lossHist = [];
  }
  function forward(x: number, y: number): { z1: number[]; h: number[]; p: number } {
    const z1: number[] = [], h: number[] = [];
    for (let j = 0; j < HN; j++) { z1[j] = W1[j][0] * x + W1[j][1] * y + B1[j]; h[j] = acts[act].f(z1[j]); }
    let z2 = B2; for (let j = 0; j < HN; j++) z2 += W2[j] * h[j];
    return { z1, h, p: 1 / (1 + Math.exp(-z2)) };
  }
  function trainBatch(): number {
    const lr = acts[act].lr, n = data.length;
    const gW1 = W1.map(() => [0, 0]), gB1 = new Array(HN).fill(0) as number[], gW2 = new Array(HN).fill(0) as number[];
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
  const PX = (x: number) => W / 2 + x * (W / 2.5), PY = (y: number) => H / 2 - y * (H / 2.5);
  const heat = document.createElement('canvas'); heat.width = 64; heat.height = 40;
  const hctx = heat.getContext('2d')!;
  function draw(loss?: number): void {
    const img = hctx.createImageData(64, 40);
    for (let iy = 0; iy < 40; iy++) for (let ix = 0; ix < 64; ix++) {
      const x = (ix / 63) * 2.24 - 1.12, y = 1.12 - (iy / 39) * 2.24;
      const p = forward(x, y).p, i = (iy * 64 + ix) * 4;
      /* blend slate(0) → paper(0.5) → leaf(1) */
      const t = p * 2 - 1;
      img.data[i]     = t > 0 ? 250 - (250 - 138) * t : 250 - (250 - 107) * -t;
      img.data[i + 1] = t > 0 ? 247 - (247 - 174) * t : 247 - (247 - 127) * -t;
      img.data[i + 2] = t > 0 ? 240 - (240 - 104) * t : 240 - (240 - 163) * -t;
      img.data[i + 3] = 235;
    }
    hctx.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(heat, PX(-1.12), PY(1.12), PX(1.12) - PX(-1.12), PY(-1.12) - PY(1.12));
    data.forEach(d => {
      ctx.beginPath(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      if (d.l === 1) { ctx.fillStyle = LEAF; ctx.arc(PX(d.x), PY(d.y), 5, 0, 7); ctx.fill(); ctx.stroke(); }
      else { ctx.fillStyle = SLATE; ctx.fillRect(PX(d.x) - 4.5, PY(d.y) - 4.5, 9, 9); ctx.strokeRect(PX(d.x) - 4.5, PY(d.y) - 4.5, 9, 9); }
    });
    const bx = W - 214, by = 16, bw = 198, bh = 74;
    ctx.fillStyle = 'rgba(250,247,240,0.92)'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
    ctx.font = '15px Caveat, cursive'; ctx.fillStyle = FAINT; ctx.fillText('loss over time', bx + 10, by + 17);
    if (lossHist.length > 1) {
      const m = Math.max(...lossHist, 0.75);
      const pts: Pt[] = lossHist.map((v, i) => [bx + 8 + (i / (lossHist.length - 1)) * (bw - 16), by + bh - 8 - (v / m) * (bh - 30)]);
      rough(ctx, pts, LEAF_D, 2, 5);
    }
    let correct = 0; data.forEach(d => { if ((forward(d.x, d.y).p > 0.5 ? 1 : 0) === d.l) correct++; });
    $('#xor-loss').textContent = loss !== undefined ? fmt(loss, 3) : '—';
    $('#xor-steps').textContent = String(steps);
    $('#xor-acc').textContent = Math.round(correct / data.length * 100) + '%';
  }
  function loop(): void {
    if (!running) return;
    let loss = 0;
    const per = reduced ? 8 : 26;
    for (let i = 0; i < per; i++) loss = trainBatch();
    if (steps % 52 < per) lossHist.push(loss);
    if (lossHist.length > 90) lossHist.shift();
    draw(loss);
    if (act === 'relu' && steps > 3000 && loss > 0.65) init(); /* dead-ReLU rescue */
    if (loss < 0.015 || steps > 24000) { running = false; $('#btn-xor-train').textContent = 'train'; return; }
    requestAnimationFrame(loop);
  }
  const startTraining = () => { if (!running) { running = true; $('#btn-xor-train').textContent = 'pause'; loop(); } };
  $('#btn-xor-train').addEventListener('click', function (this: HTMLElement) {
    running = !running; this.textContent = running ? 'pause' : 'train';
    if (running) loop();
  });
  $('#btn-xor-reset').addEventListener('click', () => { running = false; $('#btn-xor-train').textContent = 'train'; init(); draw(); });
  $$('#seg-act button').forEach(btn => btn.addEventListener('click', () => {
    $$('#seg-act button').forEach(b => b.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');
    act = (btn as HTMLElement).dataset.act as ActName;
    running = false; $('#btn-xor-train').textContent = 'train'; init(); draw();
  }));
  visible(cv, v => { if (!v && running) { running = false; $('#btn-xor-train').textContent = 'train'; } });
  init(); draw();

  const touch = userTouch($('#w-xor'));
  autoOnView($('#w-xor'), () => { if (!touch.touched) startTraining(); }, 1200);
})();
