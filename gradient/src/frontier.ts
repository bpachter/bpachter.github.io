/* Gradient · frontier.ts — ch 09-10: LoRA, DPO, and the engine room
   (MoE, KV cache, RoPE, GQA, FlashAttention, speculative decoding,
   quantization, RAG). Requires core.ts (same bundle). */

/* ══════════════ 09a · LoRA ══════════════ */
(function () {
  const viz = $('#lora-viz'); if (!viz) return;
  const D = 4096;
  const fmtP = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n);
  function render(r: number): void {
    const px = Math.max(4, Math.round(3 + r * 0.34));
    viz.innerHTML =
      `<svg width="330" height="150" viewBox="0 0 330 150" style="max-width:100%">
        <rect x="8" y="14" width="120" height="120" fill="#ece6d8" stroke="#2d2a24" stroke-width="2.5" rx="6"/>
        <text x="68" y="80" text-anchor="middle" font-family="Karla" font-weight="700" font-size="14" fill="#57503f">W</text>
        <text x="68" y="98" text-anchor="middle" font-family="Caveat" font-size="16" fill="#8a8171">frozen ✻</text>
        <text x="150" y="82" text-anchor="middle" font-family="Fraunces" font-size="26" fill="#2d2a24">+</text>
        <rect x="172" y="14" width="${px}" height="120" fill="#8aae68" stroke="#2d2a24" stroke-width="2.5" rx="3"/>
        <text x="${172 + px / 2}" y="146" text-anchor="middle" font-family="Karla" font-weight="700" font-size="12" fill="#55793c">B</text>
        <text x="${196 + px}" y="82" text-anchor="middle" font-family="Fraunces" font-size="20" fill="#2d2a24">×</text>
        <rect x="${212 + px}" y="72" width="112" height="${px}" fill="#7d9070" stroke="#2d2a24" stroke-width="2.5" rx="3"/>
        <text x="${268 + px}" y="68" text-anchor="middle" font-family="Karla" font-weight="700" font-size="12" fill="#5e8d5a">A</text>
        <text x="${268 + px}" y="${96 + px}" text-anchor="middle" font-family="Caveat" font-size="15" fill="#8a8171">trainable — rank ${r}</text>
      </svg>`;
    $('#lora-full').textContent = fmtP(D * D);
    $('#lora-lite').textContent = fmtP(2 * D * r);
    $('#lora-pct').textContent = (2 * D * r / (D * D) * 100).toFixed(2) + '%';
  }
  $('#in-rank').addEventListener('input', function (this: HTMLInputElement) {
    $('#o-rank').textContent = this.value; render(+this.value);
  });
  render(8);
})();

/* ══════════════ 09b · DPO ══════════════ */
(function () {
  const betaEl = $<HTMLInputElement>('#in-beta'); if (!betaEl) return;
  let pick = '';                                     /* '' until the reader votes; Δ = +1 once they do */
  function render(): void {
    const beta = +betaEl.value;
    $('#o-beta').textContent = fmt(beta, 2);
    if (!pick) {
      $('#dpo-read').innerHTML = '<span class="stat hand" style="font-size:17px;color:var(--ink-faint)">↑ cast a vote, then dial β</span>';
      return;
    }
    const other = pick === 'A' ? 'B' : 'A';
    const s = 1 / (1 + Math.exp(-beta * 1));          /* σ(β·Δ), Δ = 1 after a pick */
    const loss = -Math.log(s);
    const push = beta * (1 - s);                       /* gradient magnitude toward the winner */
    const word = beta < 0.35 ? 'a gentle nudge' : beta < 0.7 ? 'a firm shove' : 'a hard yank (risks over-fitting the vote)';
    $('#dpo-read').innerHTML =
      `<span class="stat">logged: <b>${pick} ≻ ${other}</b></span>` +
      `<span class="stat">loss = −log σ(β·Δ) = <b>${loss.toFixed(3)}</b></span>` +
      `<span class="stat">push ∝ <b>${push.toFixed(3)}</b> — ${word}</span>`;
  }
  $$('.dpo-card').forEach(card => card.addEventListener('click', () => {
    $$('.dpo-card').forEach(c => c.classList.remove('chosen', 'rejected'));
    card.classList.add('chosen');
    $$('.dpo-card').forEach(c => { if (c !== card) c.classList.add('rejected'); });
    pick = ((card as HTMLElement).dataset.pick || 'a').toUpperCase();
    render();
  }));
  betaEl.addEventListener('input', render);
  render();
})();

/* ══════════════ 10a · MoE ROUTER ══════════════ */
(function () {
  const expWrap = $('#moe-experts'); if (!expWrap) return;
  const counts = new Array(8).fill(0) as number[];
  for (let i = 0; i < 8; i++) {
    const d = document.createElement('div'); d.className = 'moe-exp';
    d.innerHTML = 'E' + (i + 1) + '<small>·</small>';
    expWrap.appendChild(d);
  }
  const moeTokens = ['gradient', 'the', 'robot', 'attention', 'learning', 'ball', 'descent', 'because', 'photon', 'tensor'];
  let mi = 0, moeOn = true, routed = 0;
  const topk = () => +($<HTMLInputElement>('#in-moe-k')?.value ?? 2);
  function activeParams(k: number): string {
    /* 47B total = ~2B shared attention/router + 8 × 5.6B experts; only k experts fire */
    return '~' + Math.round(2 + k * 5.6) + 'B';
  }
  function moeTick(): void {
    if (!moeOn) return;
    const k = topk();
    const tok = moeTokens[mi % moeTokens.length];
    $('#moe-token').textContent = '"' + tok + '"';
    /* deterministic top-k from the token's hash: k distinct experts */
    let h = 0; for (const ch of tok) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const chosen: number[] = [];
    let g = Math.abs(h);
    while (chosen.length < k) { const e = g % 8; if (!chosen.includes(e)) chosen.push(e); g = (g * 31 + 7) | 0; g = Math.abs(g); }
    chosen.forEach(e => counts[e]++); routed++;
    $$('.moe-exp', expWrap).forEach((el, i) => {
      el.classList.toggle('on', chosen.includes(i));
      (el.querySelector('small') as HTMLElement).textContent = '×' + counts[i];
    });
    $('#moe-count').textContent = String(routed);
    $('#moe-active').textContent = activeParams(k);
    mi++;
  }
  $('#in-moe-k').addEventListener('input', function (this: HTMLInputElement) {
    $('#o-moe-k').textContent = this.value; $('#moe-topk-lbl').textContent = this.value;
    $('#moe-active').textContent = activeParams(+this.value);
  });
  window.setInterval(moeTick, reduced ? 3200 : 1500);
  visible($('#w-moe'), v => moeOn = v);
  moeTick();
})();

/* ══════════════ 10b · KV CACHE ══════════════ */
(function () {
  const cv = $<HTMLCanvasElement>('#cv-kv'); if (!cv) return;
  const [ctx, W, H] = fit(cv);
  const NMAX = 13, CELL = 15, GX = 96, GY = 42;
  let n = 1, cached = true, run = true;

  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    ctx.font = '13px Karla, sans-serif'; ctx.fillStyle = FAINT;
    ctx.fillText('each row = one generated word attending to everything before it', GX, 24);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        const x = GX + j * CELL, y = GY + i * CELL;
        const isNew = i === n - 1;
        if (cached) {
          ctx.fillStyle = isNew ? LEAF : 'rgba(125,144,112,0.35)';
        } else {
          ctx.fillStyle = i === j ? GOLD : 'rgba(201,162,39,0.55)';
        }
        ctx.fillRect(x, y, CELL - 2, CELL - 2);
        ctx.strokeStyle = 'rgba(45,42,36,0.35)'; ctx.lineWidth = 1;
        ctx.strokeRect(x, y, CELL - 2, CELL - 2);
      }
    }
    ctx.font = '15px Caveat, cursive'; ctx.fillStyle = INK;
    const label = cached ? 'only the new row is computed — the rest is remembered' : 'no cache: the WHOLE triangle recomputed, every word';
    ctx.fillText(label, GX, GY + NMAX * CELL + 24);
    /* memory bar */
    const bx = W - 250, by = GY + 8;
    ctx.font = '13px Karla, sans-serif'; ctx.fillStyle = FAINT;
    ctx.fillText('GPU memory held by the cache', bx, by - 10);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, 190, 26);
    ctx.fillStyle = SAGE;
    ctx.fillRect(bx + 2, by + 2, (cached ? n / NMAX : 0) * 186, 22);
    if (!cached) { ctx.font = '14px Caveat, cursive'; ctx.fillStyle = FAINT; ctx.fillText('(empty — and you pay for it in time)', bx, by + 44); }
    const work = cached ? n : (n * (n + 1)) / 2;
    $('#kv-work').textContent = work + ' cell' + (work === 1 ? '' : 's');
    $('#kv-mem').textContent = cached ? n + ' tokens · ' + 2 * n + ' vectors' : 'nothing';
  }
  window.setInterval(() => { if (!run) return; n = n >= NMAX ? 1 : n + 1; draw(); }, reduced ? 1600 : 640);
  $('#btn-kv-toggle').addEventListener('click', function (this: HTMLElement) {
    cached = !cached; this.textContent = 'cache: ' + (cached ? 'on' : 'off'); this.setAttribute('aria-pressed', String(cached));
    draw();
  });
  visible(cv, v => run = v);
  draw();
})();

/* ══════════════ 10c · RoPE ══════════════ */
(function () {
  const cv = $<HTMLCanvasElement>('#cv-rope'); if (!cv) return;
  const [ctx, W, H] = fit(cv);
  const STEP = 20 * Math.PI / 180;  /* 20° per position */
  const GAP = 3;                    /* "robot" and "ball" sit 3 tokens apart */

  function dial(cx: number, cy: number, r: number, ang: number, color: string, word: string, pos: number): void {
    ctx.strokeStyle = 'rgba(45,42,36,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 5), cy + Math.sin(a) * (r - 5));
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }
    arrow(ctx, cx, cy, cx + Math.cos(-ang) * (r - 14), cy + Math.sin(-ang) * (r - 14), color, 3);
    ctx.font = '16px Fraunces, serif'; ctx.fillStyle = INK; ctx.textAlign = 'center';
    ctx.fillText('"' + word + '"', cx, cy + r + 24);
    ctx.font = '14px Karla, sans-serif'; ctx.fillStyle = FAINT;
    ctx.fillText('position ' + pos, cx, cy + r + 42);
    ctx.textAlign = 'left';
  }
  function draw(p: number): void {
    ctx.clearRect(0, 0, W, H);
    const a1 = p * STEP, a2 = (p + GAP) * STEP;
    dial(240, 108, 66, a1, LEAF_D, 'robot', p);
    dial(590, 108, 66, a2, SLATE, 'ball', p + GAP);
    /* the invariant, celebrated in the middle */
    ctx.font = '17px Caveat, cursive'; ctx.fillStyle = INK; ctx.textAlign = 'center';
    ctx.fillText('angle between them:', 415, 76);
    ctx.font = '26px Caveat, cursive'; ctx.fillStyle = LEAF_D;
    ctx.fillText(Math.round(GAP * 20) + '° — always', 415, 104);
    ctx.font = '15px Caveat, cursive'; ctx.fillStyle = FAINT;
    ctx.fillText('(their dot product never moves)', 415, 128);
    ctx.textAlign = 'left';
    $('#rope-delta').textContent = Math.round(GAP * 20) + '°';
    $('#rope-dot').textContent = fmt(Math.cos(GAP * STEP), 2) + ' — constant';
  }
  const slider = $<HTMLInputElement>('#in-rope');
  slider.addEventListener('input', () => { $('#o-rope').textContent = slider.value; draw(+slider.value); });
  draw(0);

  /* hands-free sweep until touched */
  const touch = userTouch($('#w-rope'));
  if (!reduced) {
    let dir = 1;
    const timer = window.setInterval(() => {
      if (touch.touched) { clearInterval(timer); return; }
      let v = +slider.value + dir;
      if (v >= 16) { v = 16; dir = -1; } else if (v <= 0) { v = 0; dir = 1; }
      slider.value = String(v); $('#o-rope').textContent = slider.value; draw(v);
    }, 420);
  }
})();

/* ══════════════ 10d · GQA ══════════════ */
(function () {
  const cv = $<HTMLCanvasElement>('#cv-gqa'); if (!cv) return;
  const [ctx, W, H] = fit(cv);
  const QY = 66, KY = 210, QN = 8;
  const qx = (i: number) => W / 2 + (i - (QN - 1) / 2) * 92;
  let kvNow = 2, kvPrev = 2, animT = 1;

  const kvX = (k: number, of: number) => W / 2 + (k - (of - 1) / 2) * (of === 8 ? 92 : of === 2 ? 260 : 0);
  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    const e = 1 - Math.pow(1 - Math.min(animT, 1), 3);   /* ease-out cubic */
    for (let i = 0; i < QN; i++) {
      const gPrev = Math.floor(i / (QN / kvPrev)), gNow = Math.floor(i / (QN / kvNow));
      const x2 = kvX(gPrev, kvPrev) + (kvX(gNow, kvNow) - kvX(gPrev, kvPrev)) * e;
      ctx.strokeStyle = 'rgba(85,121,60,0.65)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(qx(i), QY + 20); ctx.quadraticCurveTo(qx(i), (QY + KY) / 2, x2, KY - 16); ctx.stroke();
    }
    for (let i = 0; i < QN; i++) {
      ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(qx(i), QY, 19, 0, 7); ctx.fill(); ctx.stroke();
      ctx.font = '12.5px Karla, sans-serif'; ctx.fillStyle = INK; ctx.textAlign = 'center';
      ctx.fillText('Q' + (i + 1), qx(i), QY + 4);
      ctx.textAlign = 'left';
    }
    for (let k = 0; k < kvNow; k++) {
      const x = kvX(k, kvNow);
      ctx.fillStyle = LEAF; ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.roundRect(x - 34, KY - 16, 68, 40, 9); ctx.fill(); ctx.stroke();
      ctx.font = '12.5px Karla, sans-serif'; ctx.fillStyle = INK; ctx.textAlign = 'center';
      ctx.fillText('KV ' + (k + 1), x, KY + 8);
      ctx.textAlign = 'left';
    }
    ctx.font = '15px Caveat, cursive'; ctx.fillStyle = FAINT;
    ctx.fillText('8 question-askers', qx(0) - 20, QY - 34);
    ctx.fillText(kvNow + (kvNow > 1 ? ' shared filing cabinets' : ' filing cabinet for everyone'), kvX(0, kvNow) - 34, KY + 44);
    /* memory bar */
    const bx = W - 260, by = H - 34;
    ctx.font = '13px Karla, sans-serif'; ctx.fillText('KV-cache size:', bx - 100, by + 16);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(bx, by, 200, 22);
    ctx.fillStyle = SAGE; ctx.fillRect(bx + 2, by + 2, 196 * (kvNow / 8), 18);
    if (animT < 1) { animT += 0.05; requestAnimationFrame(draw); }
    $('#gqa-mem').textContent = kvNow === 8 ? '8× (every head hoards)' : kvNow === 2 ? '2× — a quarter of MHA' : '1× — an eighth of MHA';
  }
  function setMode(kv: number): void {
    if (kv === kvNow) return;
    kvPrev = kvNow; kvNow = kv; animT = 0; requestAnimationFrame(draw);
  }
  $$('#seg-gqa button').forEach(btn => btn.addEventListener('click', () => {
    $$('#seg-gqa button').forEach(b => b.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');
    setMode(+((btn as HTMLElement).dataset.kv!));
  }));
  draw();

  const touch = userTouch($('#w-gqa'));
  if (!reduced) {
    const cycle = [8, 2, 1, 2];
    let ci = 1;
    const timer = window.setInterval(() => {
      if (touch.touched) { clearInterval(timer); return; }
      ci = (ci + 1) % cycle.length;
      $$('#seg-gqa button').forEach(b => b.setAttribute('aria-pressed', String(+((b as HTMLElement).dataset.kv!) === cycle[ci])));
      setMode(cycle[ci]);
    }, 3400);
  }
})();

/* ══════════════ 10e · FLASHATTENTION ══════════════ */
(function () {
  const cv = $<HTMLCanvasElement>('#cv-flash'); if (!cv) return;
  const [ctx, W, H] = fit(cv);
  const N = 12, CELL = 16, MX = 60, MY = 70;
  let TILE = 3;                                       /* 2/3/4/6 all divide N=12 */
  /* HBM + SRAM boxes */
  const HB = { x: 560, y: 46, w: 280, h: 130 }, SR = { x: 560, y: 214, w: 170, h: 92 };
  let mode: 'naive' | 'flash' = 'naive', prog = 0, run = true;

  function boxes(): void {
    ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
    ctx.strokeRect(HB.x, HB.y, HB.w, HB.h);
    ctx.strokeRect(SR.x, SR.y, SR.w, SR.h);
    ctx.font = '13.5px Karla, sans-serif'; ctx.fillStyle = INK;
    ctx.fillText('HBM — big, slow warehouse', HB.x + 10, HB.y - 8);
    ctx.fillText('SRAM — tiny, blazing scratchpad', SR.x + 10, SR.y - 8);
  }
  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    ctx.font = '15px Caveat, cursive'; ctx.fillStyle = INK;
    ctx.fillText(mode === 'naive' ? 'naive attention — build the whole N×N square' : 'FlashAttention — chew tiles, keep a running answer', MX, 30);
    /* the score matrix (the work to be done) */
    const total = N * N;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const idx = i * N + j, x = MX + j * CELL, y = MY + i * CELL;
      let on = false, hot = false;
      if (mode === 'naive') { on = idx < prog; hot = idx === prog - 1; }
      else {
        const ti = Math.floor(i / TILE), tj = Math.floor(j / TILE);
        const tIdx = ti * (N / TILE) + tj;
        on = tIdx < Math.floor(prog / (TILE * TILE));
        hot = tIdx === Math.floor(prog / (TILE * TILE));
      }
      ctx.fillStyle = hot ? GOLD : on ? (mode === 'naive' ? 'rgba(201,162,39,0.5)' : 'rgba(138,174,104,0.28)') : 'rgba(45,42,36,0.05)';
      ctx.fillRect(x, y, CELL - 2, CELL - 2);
      ctx.strokeStyle = 'rgba(45,42,36,0.22)'; ctx.lineWidth = 1;
      ctx.strokeRect(x, y, CELL - 2, CELL - 2);
    }
    boxes();
    if (mode === 'naive') {
      /* the whole matrix materializes in HBM */
      const mini = 8;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        if (i * N + j >= prog) continue;
        ctx.fillStyle = 'rgba(201,162,39,0.75)';
        ctx.fillRect(HB.x + 24 + j * mini, HB.y + 18 + i * mini, mini - 1.5, mini - 1.5);
      }
      ctx.font = '14px Caveat, cursive'; ctx.fillStyle = FAINT;
      ctx.fillText('144 numbers parked in slow memory…', HB.x + 130, HB.y + 66);
      $('#flash-mem').textContent = Math.min(prog, total) + ' / 144 cells to HBM';
      $('#flash-passes').textContent = 'n/a — one giant matrix';
    } else {
      /* only the current tile lives in SRAM; scale cells so a big tile still fits the box */
      const t = Math.floor(prog / (TILE * TILE));
      const cell = Math.min(15, Math.floor(56 / TILE));
      ctx.fillStyle = 'rgba(138,174,104,0.5)';
      for (let a = 0; a < TILE; a++) for (let b = 0; b < TILE; b++)
        ctx.fillRect(SR.x + 24 + b * cell, SR.y + 20 + a * cell, cell - 2, cell - 2);
      ctx.font = '13px Caveat, cursive'; ctx.fillStyle = FAINT;
      ctx.fillText(TILE + '×' + TILE + ' tile in SRAM', SR.x + 30 + TILE * cell, SR.y + 30);
      const rowsDone = Math.min(N, Math.floor(t / (N / TILE)) * TILE + TILE);
      for (let i = 0; i < rowsDone; i++) {
        ctx.fillStyle = GOOD;
        ctx.fillRect(HB.x + 24, HB.y + 18 + i * 8, 7, 6.5);
      }
      ctx.fillText('only the skinny answer column', HB.x + 44, HB.y + 60);
      $('#flash-mem').textContent = Math.min(rowsDone, N) + ' / 12 cells to HBM  (vs 144)';
      const tiles = (N / TILE) * (N / TILE);
      $('#flash-passes').textContent = (N / TILE) + '×' + (N / TILE) + ' = ' + tiles + ' tiles';
    }
  }
  window.setInterval(() => {
    if (!run) return;
    prog += mode === 'naive' ? 6 : 9;
    if (prog > N * N + 20) { prog = 0; mode = mode === 'naive' ? 'flash' : 'naive'; }
    draw();
  }, reduced ? 900 : 130);
  $$('#seg-flash button').forEach(btn => btn.addEventListener('click', () => {
    $$('#seg-flash button').forEach(b => b.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');
    TILE = +((btn as HTMLElement).dataset.tile!);
    mode = 'flash'; prog = 0;                        /* jump to flash so the new tiling is visible at once */
    draw();
  }));
  visible(cv, v => run = v);
  draw();
})();

/* ══════════════ 10f · SPECULATIVE DECODING ══════════════ */
(function () {
  const laneD = $('#lane-draft'); if (!laneD) return;
  const laneV = $('#lane-verd'), laneF = $('#lane-final');
  const gammaEl = $<HTMLInputElement>('#in-gamma');
  const ALPHA = 0.8, COST = 0.12;                    /* per-token accept prob; one draft pass ≈ 12% of a big pass */
  interface Round { draft: string[]; ok: number; fix?: string; }
  const ROUNDS: Round[] = [
    { draft: ['The', 'sky', 'looks', 'blue'], ok: 4 },
    { draft: ['because', 'air', 'absorbs', 'red'], ok: 2, fix: 'scatters' },
    { draft: ['blue', 'light', 'the', 'most'], ok: 2, fix: 'more' },
    { draft: ['than', 'red', 'light', '.'], ok: 4 }
  ];
  const gamma = () => gammaEl ? +gammaEl.value : 4;
  /* the real economics: expected accepted tokens per verify = (1−α^{γ+1})/(1−α),
     paid for by one big pass + γ cheap draft passes. Peaks, then diminishes. */
  function economics(): void {
    const g = gamma();
    if (gammaEl) $('#o-gamma').textContent = String(g);
    const E = (1 - Math.pow(ALPHA, g + 1)) / (1 - ALPHA);
    const toks = 12 * E / (1 + COST * g);
    $('#spec-toks').textContent = E.toFixed(2) + ' tokens';
    $('#spec-speed').textContent = toks.toFixed(0) + ' tok/s — ×' + (toks / 12).toFixed(1) + ' faster';
  }
  let running = false;
  const sleep = (ms: number) => new Promise<void>(res => window.setTimeout(res, reduced ? ms / 4 : ms));
  function chip(txt: string, cls: string): HTMLElement {
    const s = document.createElement('span');
    s.className = 'dchip ' + cls; s.textContent = txt;
    return s;
  }
  async function race(): Promise<void> {
    if (running) return;
    running = true;
    laneD.innerHTML = ''; laneV.innerHTML = ''; laneF.innerHTML = '';
    $('#spec-speed').textContent = '…racing';
    const g = gamma();
    for (const r of ROUNDS) {
      const draft = r.draft.slice(0, g);             /* the drafter only proposes γ tokens this round */
      const ok = Math.min(r.ok, draft.length);
      laneD.innerHTML = ''; laneV.innerHTML = '';
      for (const w of draft) { laneD.appendChild(chip(w, 'draft')); await sleep(140); }
      await sleep(420);
      for (let i = 0; i < draft.length; i++) {
        const good = i < ok;
        laneV.appendChild(chip(good ? '✓ ' + draft[i] : '✗ ' + draft[i], good ? 'ok' : 'no'));
        await sleep(150);
        if (!good) break;
      }
      await sleep(380);
      for (let i = 0; i < ok; i++) laneF.appendChild(chip(draft[i], 'ok'));
      if (ok < draft.length && r.fix) { laneF.appendChild(chip(r.fix, 'fix')); await sleep(260); }
      await sleep(300);
    }
    economics();
    running = false;
  }
  $('#btn-spec-run').addEventListener('click', () => { void race(); });
  if (gammaEl) gammaEl.addEventListener('input', economics);
  economics();
  autoOnView($('#w-spec'), () => { void race(); }, 900);
})();

/* ══════════════ 10g · QUANTIZATION ══════════════ */
(function () {
  const cv = $<HTMLCanvasElement>('#cv-quant'); if (!cv) return;
  const [ctx, W, H] = fit(cv);
  const BITS = [16, 8, 4, 2], SIZES = ['14 GB', '7 GB', '3.5 GB', '1.75 GB'];
  const LEVELS = ['65,536', '256', '16', '4'];
  const rng = mulberry32(5150);
  const weights: number[] = [];
  for (let i = 0; i < 2400; i++) weights.push(Math.max(-2, Math.min(2, gauss(rng) * 0.7)));

  function draw(idx: number): void {
    ctx.clearRect(0, 0, W, H);
    const bits = BITS[idx], L = Math.min(Math.pow(2, bits), 512);
    const q = (v: number) => {
      if (bits >= 16) return v;
      const s = Math.round((v + 2) / 4 * (L - 1));
      return (s / (L - 1)) * 4 - 2;
    };
    /* histogram, left */
    const HX = 46, HW = 350, HY = H - 56, BINS = 56;
    const hist = new Array(BINS).fill(0) as number[];
    weights.forEach(w => {
      const b = Math.min(BINS - 1, Math.max(0, Math.floor((q(w) + 2) / 4 * BINS)));
      hist[b]++;
    });
    const hm = Math.max(...hist);
    ctx.font = '13px Karla, sans-serif'; ctx.fillStyle = FAINT;
    ctx.fillText('2,400 weights, snapped to the available shelves', HX, 30);
    if (bits < 16) {
      ctx.strokeStyle = 'rgba(201,162,39,0.65)'; ctx.lineWidth = 1.2;
      for (let l = 0; l < L; l++) {
        const x = HX + (l / (L - 1)) * HW;
        ctx.beginPath(); ctx.moveTo(x, 44); ctx.lineTo(x, HY); ctx.stroke();
      }
    }
    for (let bIdx = 0; bIdx < BINS; bIdx++) {
      const x = HX + (bIdx / BINS) * HW, h = (hist[bIdx] / hm) * (HY - 52);
      ctx.fillStyle = LEAF;
      ctx.fillRect(x, HY - h, HW / BINS - 1.5, h);
    }
    rough(ctx, [[HX - 6, HY], [HX + HW + 6, HY]], INK, 2, 4);
    /* wave, right */
    const WX = 470, WW = 370, WCY = (H - 40) / 2 + 14, AMP = 74;
    ctx.font = '13px Karla, sans-serif'; ctx.fillStyle = FAINT;
    ctx.fillText('the same song, at ' + bits + '-bit', WX, 30);
    ctx.strokeStyle = 'rgba(107,127,163,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= WW; x += 3) {
      const y = WCY - Math.sin(x / WW * Math.PI * 3.2) * AMP;
      x ? ctx.lineTo(WX + x, y) : ctx.moveTo(WX + x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = LEAF_D; ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (let x = 0; x <= WW; x += 3) {
      const v = Math.sin(x / WW * Math.PI * 3.2);
      const qv = bits >= 16 ? v : q(v * 2) / 2;
      const y = WCY - qv * AMP;
      x ? ctx.lineTo(WX + x, y) : ctx.moveTo(WX + x, y);
    }
    ctx.stroke();
    $('#quant-levels').textContent = LEVELS[idx];
    $('#quant-mem').textContent = SIZES[idx];
    $('#o-bits').textContent = String(BITS[idx]);
  }
  const slider = $<HTMLInputElement>('#in-bits');
  slider.addEventListener('input', () => draw(+slider.value));
  draw(0);

  const touch = userTouch($('#w-quant'));
  if (!reduced) {
    let idx = 0, dir = 1;
    const timer = window.setInterval(() => {
      if (touch.touched) { clearInterval(timer); return; }
      idx += dir;
      if (idx >= 3) { idx = 3; dir = -1; } else if (idx <= 0) { idx = 0; dir = 1; }
      slider.value = String(idx); draw(idx);
    }, 2200);
  }
})();

/* ══════════════ 10h · RAG ══════════════ */
(function () {
  const cv = $<HTMLCanvasElement>('#cv-rag'); if (!cv) return;
  const [ctx, W, H] = fit(cv);
  interface Chunk { x: number; y: number; label: string; }
  const CH: Chunk[] = [
    { x: 0.14, y: 0.30, label: 'ch 01 — 1958, Rosenblatt builds the perceptron' },
    { x: 0.24, y: 0.62, label: 'ch 02 — too-big learning rates diverge' },
    { x: 0.09, y: 0.80, label: 'ch 03 — momentum coasts through dips' },
    { x: 0.46, y: 0.22, label: 'ch 05 — models see chunks, not letters' },
    { x: 0.56, y: 0.44, label: 'ch 06 — queries, keys, values' },
    { x: 0.42, y: 0.72, label: 'ch 08 — temperature reshapes the odds' },
    { x: 0.80, y: 0.28, label: '10b — the KV cache IS the context window' },
    { x: 0.88, y: 0.52, label: '10d — GQA shrinks the cache' },
    { x: 0.74, y: 0.76, label: '10g — 4-bit weights, 4× smaller' },
    { x: 0.63, y: 0.90, label: '10a — a router picks 2 experts' }
  ];
  interface Q { text: string; x: number; y: number; ans: string; }
  /* positions laid out so the genuine nearest-neighbours (in the same stretched
     pixel-space we render in) are the chunks each answer actually cites */
  const QS: Q[] = [
    { text: 'when was the perceptron born?', x: 0.14, y: 0.44,
      ans: 'In 1958 — Frank Rosenblatt\'s perceptron <sup>[1]</sup>, trained by nudging its weights after every mistake.' },
    { text: 'why do chats eat GPU memory?', x: 0.84, y: 0.36,
      ans: 'Every past token\'s keys and values are held in the KV cache — your context window is literally that memory <sup>[1]</sup>; sharing heads shrinks it <sup>[2]</sup>.' },
    { text: 'how do big models fit on one GPU?', x: 0.80, y: 0.68,
      ans: 'Quantize the weights to 4 bits — four times smaller <sup>[1]</sup> — and keep the KV cache lean with grouped heads <sup>[2]</sup>.' }
  ];
  const PX = (x: number) => 30 + x * (W - 60), PY = (y: number) => 26 + y * (H - 60);
  const kEl = $<HTMLInputElement>('#rag-k');
  const kVal = () => kEl ? +kEl.value : 3;
  let active = -1, anim = 0, hits: number[] = [];

  /* real k-nearest-neighbour retrieval in the fixed 880×280 design space (minus the
     30/26px margins ×2) so the ranking is identical at every viewport — the canvas
     keeps its aspect ratio, so the dashed lines still fly to the chunks that look closest */
  const AX = 820, AY = 220;
  function retrieve(qx: number, qy: number, k: number): number[] {
    return CH
      .map((c, i) => ({ i, d: Math.hypot((c.x - qx) * AX, (c.y - qy) * AY) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, k)
      .map(o => o.i);
  }

  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    ctx.font = '15px Caveat, cursive'; ctx.fillStyle = FAINT;
    ctx.fillText('the library, embedded into meaning-space', 24, 20);
    CH.forEach((c, i) => {
      const rank = hits.indexOf(i);
      const hit = active >= 0 && rank >= 0;
      if (hit && anim > 0.25) {
        ctx.strokeStyle = rank === 0 ? LEAF_D : 'rgba(85,121,60,0.55)';
        ctx.lineWidth = rank === 0 ? 2.6 : 1.6;
        ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(PX(QS[active].x), PY(QS[active].y)); ctx.lineTo(PX(c.x), PY(c.y)); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = hit ? LEAF : 'rgba(107,127,163,0.8)';
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(PX(c.x), PY(c.y), hit ? 7 : 5, 0, 7); ctx.fill(); ctx.stroke();
      ctx.font = '11.5px Karla, sans-serif'; ctx.fillStyle = hit ? INK : FAINT;
      if (c.x > 0.68) { ctx.textAlign = 'right'; ctx.fillText(c.label, PX(c.x) - 11, PY(c.y) + 4); ctx.textAlign = 'left'; }
      else ctx.fillText(c.label, PX(c.x) + 11, PY(c.y) + 4);
    });
    if (active >= 0) {
      const q = QS[active];
      ctx.fillStyle = PLUM; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.save();
      ctx.translate(PX(q.x), PY(q.y)); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-7, -7, 14, 14); ctx.strokeRect(-7, -7, 14, 14);
      ctx.restore();
      ctx.font = '14px Caveat, cursive'; ctx.fillStyle = INK; ctx.textAlign = 'center';
      ctx.fillText('your question lands here', PX(q.x), PY(q.y) + 28);
      ctx.textAlign = 'left';
    }
  }
  /* re-staple the retrieved chunks into the prompt (answer text stays put) */
  function buildPrompt(q: Q): void {
    const pr = $('#rag-prompt');
    pr.innerHTML = '<span class="rag-slot">system: answer from the sources</span>';
    hits.forEach((h, k) => {
      const s = document.createElement('span');
      s.className = 'rag-slot doc'; s.style.animationDelay = (0.35 + k * 0.18) + 's';
      s.textContent = '[' + (k + 1) + '] ' + CH[h].label;
      pr.appendChild(s);
    });
    const qs = document.createElement('span');
    qs.className = 'rag-slot q'; qs.style.animationDelay = (0.35 + hits.length * 0.18 + 0.2) + 's';
    qs.textContent = 'user: ' + q.text;
    pr.appendChild(qs);
  }
  let typeTimer: number | null = null;
  function ask(qi: number): void {
    active = qi; anim = 0;
    const q = QS[qi];
    hits = retrieve(q.x, q.y, kVal());
    const start = performance.now();
    (function grow(now: number) {
      anim = Math.min((now - start) / (reduced ? 1 : 900), 1);
      draw();
      if (anim < 1) requestAnimationFrame(grow);
    })(start);
    buildPrompt(q);
    /* type the answer */
    const ansEl = $('#rag-ans');
    ansEl.innerHTML = '';
    if (typeTimer !== null) clearInterval(typeTimer);
    const full = q.ans;
    let i = 0;
    typeTimer = window.setInterval(() => {
      i += reduced ? full.length : 3;
      ansEl.innerHTML = full.slice(0, i) + (i < full.length ? '▎' : '');
      if (i >= full.length && typeTimer !== null) { clearInterval(typeTimer); typeTimer = null; }
    }, 30);
  }
  $$('.rag-qbtn').forEach(btn => btn.addEventListener('click', () => ask(+((btn as HTMLElement).dataset.q!))));
  if (kEl) kEl.addEventListener('input', () => {
    $('#o-rag-k').textContent = kEl.value;
    if (active < 0) return;                          /* re-retrieve live; keep the same answer text */
    hits = retrieve(QS[active].x, QS[active].y, kVal());
    draw();
    buildPrompt(QS[active]);
  });
  draw();
  autoOnView($('#w-rag'), () => { if (active < 0) ask(0); }, 1100);
})();
