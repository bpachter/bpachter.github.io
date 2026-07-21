/* Gradient · business.ts — ch 27-31: the flywheel, GraphRAG, the model
   fleet, humans in the org chart, the modern data department.
   Requires core.ts (same bundle). */

const sleepB = (ms: number) => new Promise<void>(res => window.setTimeout(res, reduced ? Math.min(ms / 4, 120) : ms));

/* ══════════════ 27 · THE FLYWHEEL ══════════════ */
(function () {
  const cv = $<HTMLCanvasElement>('#cv-fly'); if (!cv) return;
  const [ctx, W, H] = fit(cv);
  const rng = mulberry32(2727);
  const strictEl = $<HTMLInputElement>('#in-strict');
  const strictness = () => strictEl ? +strictEl.value : 0.3;    /* the verifier's bar; accept when rng() clears it */
  /* the org ring the flywheel grows */
  const NODES: Array<{ x: number; y: number; name?: string }> = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    NODES.push({ x: 655 + Math.cos(a) * 150, y: 185 + Math.sin(a) * 128 });
  }
  NODES[0].name = 'Acme'; NODES[4].name = 'Chipco'; NODES[8].name = 'Beta';
  interface E { a: number; b: number; status: 'prop' | 'ok' | 'rej' | 'held'; age: number; }
  const edges: E[] = [];
  let docs = 0, nights = 0, okN = 0, rejN = 0, held: E[] = [], onScreen = false, ticking = false;

  function newPair(): [number, number] {
    const a = (rng() * 12) | 0; let b = (rng() * 12) | 0;
    if (b === a) b = (b + 1 + ((rng() * 10) | 0)) % 12;
    return [a, b];
  }
  function draw(msg?: string): void {
    ctx.clearRect(0, 0, W, H);
    /* pipeline stations */
    ctx.font = '13px Karla, sans-serif'; ctx.fillStyle = FAINT;
    ctx.fillText('tonight\'s documents', 40, 40);
    for (let i = 0; i < Math.max(0, 5 - (docs % 5)); i++) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      ctx.fillRect(44 + i * 10, 52 + i * 4, 54, 66); ctx.strokeRect(44 + i * 10, 52 + i * 4, 54, 66);
    }
    const st = (x: number, y: number, label: string, on: boolean) => {
      ctx.fillStyle = on ? 'rgba(138,174,104,0.3)' : PAPER;
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x, y, 128, 44, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = '12.5px Karla, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(label, x + 64, y + 26); ctx.textAlign = 'left';
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
      if (e.status === 'rej') ctx.globalAlpha = Math.max(0, 1 - e.age / 18);
      ctx.strokeStyle = e.status === 'ok' ? 'rgba(85,121,60,0.75)' : e.status === 'held' ? GOLD : e.status === 'rej' ? BAD : 'rgba(107,127,163,0.6)';
      ctx.lineWidth = e.status === 'ok' ? 2.2 : 1.6;
      if (e.status !== 'ok') ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    });
    NODES.forEach(n => {
      ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(n.x, n.y, 7, 0, 7); ctx.fill(); ctx.stroke();
      if (n.name) { ctx.font = '11.5px Karla, sans-serif'; ctx.fillStyle = FAINT; ctx.fillText(n.name, n.x + 10, n.y + 4); }
    });
    if (msg) {
      ctx.font = '17px Caveat, cursive'; ctx.fillStyle = '#8a6d10';
      ctx.fillText(msg, 190, 340);
    }
    $('#fly-nights').textContent = String(nights);
    $('#fly-ok').textContent = String(okN);
    $('#fly-rej').textContent = String(rejN);
  }
  async function tick(): Promise<void> {
    if (ticking) return;
    ticking = true;
    while (onScreen) {
      if (held.length) { draw('batch held at the gate — waiting on your GO'); await sleepB(500); continue; }
      docs++;
      if (docs % 17 === 0) {
        /* the extractor has a weird night: floods the queue */
        for (let i = 0; i < 12; i++) { const [a, b] = newPair(); held.push({ a, b, status: 'held', age: 0 }); }
        held.forEach(e => edges.push(e));
        ($('#btn-fly-go') as HTMLButtonElement).disabled = false;
        draw('12 proposals in one pass?! gate trips — escalated.');
        await sleepB(600); continue;
      }
      const [a, b] = newPair();
      const e: E = { a, b, status: 'prop', age: 0 };
      edges.push(e);
      draw(); await sleepB(520);
      if (rng() > strictness()) { e.status = 'ok'; okN++; } else { e.status = 'rej'; rejN++; }
      if (docs % 5 === 0) nights++;
      /* prune old rejected */
      edges.forEach(x => { if (x.status === 'rej') x.age++; });
      for (let i = edges.length - 1; i >= 0; i--) if (edges[i].status === 'rej' && edges[i].age > 16) edges.splice(i, 1);
      if (edges.filter(x => x.status === 'ok').length > 34) {
        const first = edges.findIndex(x => x.status === 'ok'); edges.splice(first, 1);
      }
      draw(); await sleepB(420);
    }
    ticking = false;
  }
  $('#btn-fly-go').addEventListener('click', async function (this: HTMLButtonElement) {
    this.disabled = true;
    for (const e of held) {
      e.status = 'prop'; draw(); await sleepB(150);
      if (rng() > strictness()) { e.status = 'ok'; okN++; } else { e.status = 'rej'; rejN++; }
    }
    held = [];
    draw('batch reviewed under your GO — applied with receipts.');
  });
  if (strictEl) strictEl.addEventListener('input', () => {
    $('#o-strict').textContent = (+strictEl.value).toFixed(2);
    $('#fly-accept').textContent = '~' + Math.round((1 - +strictEl.value) * 100) + '%';
  });
  visible(cv, v => { const was = onScreen; onScreen = v; if (v && !was && !reduced) void tick(); });
  draw();
  if (reduced) { /* static tableau */
    for (let i = 0; i < 9; i++) { const [a, b] = newPair(); edges.push({ a, b, status: i % 4 === 3 ? 'prop' : 'ok', age: 0 }); okN = 7; }
    nights = 2; draw();
  }
})();

/* ══════════════ 28 · GRAPHRAG ══════════════ */
(function () {
  const cv = $<HTMLCanvasElement>('#cv-grag'); if (!cv) return;
  const [ctx, W, H] = fit(cv);
  interface N { x: number; y: number; name: string; sub: string; }
  const NS: N[] = [
    { x: 130, y: 275, name: 'Fab-9', sub: 'Facility' },
    { x: 330, y: 205, name: 'Chipco', sub: 'Organization' },
    { x: 545, y: 120, name: 'Acme Rockets', sub: 'customer' },
    { x: 560, y: 260, name: 'OrbitalWorks', sub: 'customer' },
    { x: 250, y: 90, name: 'Beta Alloys', sub: 'Organization' }
  ];
  const ES: Array<[number, number, string]> = [
    [0, 1, 'supplies wafers'], [1, 2, 'supplies chips'], [1, 3, 'supplies chips'], [4, 2, 'supplies frames']
  ];
  let mode: 'idle' | 'chunk' | 'graph' = 'idle', anim = 0, raf: number | null = null;

  function node(n: N, lit: boolean): void {
    ctx.fillStyle = lit ? 'rgba(201,162,39,0.28)' : PAPER;
    ctx.strokeStyle = lit ? '#8a6d10' : INK; ctx.lineWidth = lit ? 2.6 : 1.8;
    ctx.beginPath(); ctx.roundRect(n.x - 56, n.y - 20, 112, 40, 11); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = '12.5px Fraunces, serif'; ctx.textAlign = 'center';
    ctx.fillText(n.name, n.x, n.y - 1);
    ctx.font = '10.5px Karla, sans-serif'; ctx.fillStyle = FAINT;
    ctx.fillText(n.sub, n.x, n.y + 13); ctx.textAlign = 'left';
  }
  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    const litN = new Set<number>(), litE = new Set<number>();
    if (mode === 'graph') {
      if (anim > 0.15) litN.add(0);
      if (anim > 0.35) { litE.add(0); litN.add(1); }
      if (anim > 0.6) { litE.add(1); litE.add(2); litN.add(2); litN.add(3); }
    }
    ES.forEach(([a, b, label], i) => {
      const A = NS[a], B = NS[b];
      const lit = litE.has(i);
      ctx.strokeStyle = lit ? GOLD : 'rgba(125,144,112,0.55)'; ctx.lineWidth = lit ? 3 : 1.8;
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      ctx.font = '11px Karla, monospace'; ctx.fillStyle = lit ? '#8a6d10' : FAINT;
      ctx.textAlign = 'center'; ctx.fillText(label, (A.x + B.x) / 2, (A.y + B.y) / 2 - 7); ctx.textAlign = 'left';
    });
    NS.forEach((n, i) => node(n, litN.has(i)));
    /* right panel */
    const px = 680;
    ctx.font = '13px Karla, sans-serif'; ctx.fillStyle = FAINT;
    if (mode === 'chunk') {
      ctx.fillText('top chunks by similarity to "flooded":', px - 28, 34);
      const chunks = [
        ['facilities memo:', '"…Fab-9 flooded Tues,', 'pumps on site…"'],
        ['news clip:', '"…historic flooding', 'across the region…"'],
        ['policy doc:', '"…flood insurance', 'renewal terms…"']
      ];
      chunks.forEach((c, i) => {
        const y = 48 + i * 74;
        ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
        ctx.fillRect(px - 28, y, 200, 62); ctx.strokeRect(px - 28, y, 200, 62);
        ctx.fillStyle = FAINT; ctx.font = '11px Karla, sans-serif';
        c.forEach((l, li) => { ctx.fillStyle = li === 0 ? INK : FAINT; ctx.fillText(l, px - 18, y + 16 + li * 15); });
      });
      ctx.font = '15px Caveat, cursive'; ctx.fillStyle = BAD;
      ctx.fillText('✗ lots about floods. zero about customers —', px - 28, 300);
      ctx.fillText('the chain lives across documents.', px - 28, 320);
    } else if (mode === 'graph' && anim > 0.8) {
      ctx.font = '15px Caveat, cursive'; ctx.fillStyle = GOOD;
      ctx.fillText('✓ exposed: Acme Rockets', px - 28, 60);
      ctx.fillText('+ OrbitalWorks — via Chipco,', px - 28, 82);
      ctx.fillText('2 hops.', px - 28, 104);
      ctx.fillStyle = FAINT;
      ctx.fillText('citation: the gold path itself,', px - 28, 138);
      ctx.fillText('every edge w/ receipts (ch 25).', px - 28, 158);
    } else if (mode === 'idle') {
      ctx.font = '15px Caveat, cursive'; ctx.fillStyle = FAINT;
      ctx.fillText('two retrievers, one question →', px - 28, 60);
    }
  }
  function run(m: 'chunk' | 'graph'): void {
    mode = m; anim = 0;
    if (raf !== null) cancelAnimationFrame(raf);
    const t0 = performance.now();
    const step = (t: number) => {
      anim = Math.min(1, (t - t0) / (reduced ? 1 : 2200));
      draw();
      if (anim < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  $('#btn-grag-chunk').addEventListener('click', () => run('chunk'));
  $('#btn-grag-graph').addEventListener('click', () => run('graph'));
  draw();
  const touch = userTouch($('#w-grag'));
  autoOnView($('#w-grag'), () => {
    if (touch.touched) return;
    run('chunk');
    window.setTimeout(() => { if (!touch.touched) run('graph'); }, 3400);
  }, 900);
})();

/* ══════════════ 29 · THE MODEL FLEET ══════════════ */
(function () {
  const inLane = $('#fleet-in'); if (!inLane) return;
  interface T { t: string; tier: 0 | 1 | 2; cost: number; alt: number; }
  const TASKS: T[] = [
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
  let running = false, mode: 'smart' | 'frontier' = 'smart';
  function chip(txt: string, cls: string): HTMLElement {
    const s = document.createElement('span'); s.className = 'dchip ' + cls; s.textContent = txt; return s;
  }
  async function run(): Promise<void> {
    if (running) return;
    running = true;
    inLane.innerHTML = ''; lanes.forEach(l => l.innerHTML = '');
    $('#fleet-save').textContent = '';
    const front = mode === 'frontier';
    $('#fleet-cost-lbl').textContent = front ? 'all-frontier cost' : 'fleet cost';
    $('#fleet-alt-lbl').textContent = front ? 'smart fleet would be' : 'all-frontier would be';
    let smartCost = 0, frontCost = 0;
    for (const t of TASKS) {
      const c = chip(t.t, 'draft');
      inLane.appendChild(c);
      await sleepB(480);
      c.remove();
      const laneIdx = front ? 2 : t.tier;       /* helicopter mode dumps every errand on the frontier */
      lanes[laneIdx].appendChild(chip(t.t, 't' + laneIdx));
      smartCost += t.cost; frontCost += t.alt;
      $('#fleet-cost').textContent = '$' + (front ? frontCost : smartCost).toFixed(2);
      $('#fleet-alt').textContent = '$' + (front ? smartCost : frontCost).toFixed(2);
      await sleepB(240);
    }
    $('#fleet-save').textContent = front
      ? '→ ' + (frontCost / Math.max(smartCost, 0.01)).toFixed(1) + '× the cost — a helicopter for every errand'
      : '→ ' + Math.round((1 - smartCost / frontCost) * 100) + '% saved, judgment un-compromised';
    running = false;
  }
  $('#btn-fleet-run').addEventListener('click', () => { void run(); });
  $$('#seg-fleet button').forEach(b => b.addEventListener('click', () => {
    if (running) return;
    $$('#seg-fleet button').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    mode = (b as HTMLElement).dataset.mode as 'smart' | 'frontier';
    void run();
  }));
  autoOnView($('#w-fleet'), () => { void run(); }, 900);
})();

/* ══════════════ 30 · THE DELEGATION DIAL ══════════════ */
(function () {
  const cv = $<HTMLCanvasElement>('#cv-org'); if (!cv) return;
  const [ctx, W, H] = fit(cv);
  const rng = mulberry32(3030);
  const LANES = ['extract', 'verify', 'curate', 'brief'];
  const DELS = ['L1 — you approve everything', 'L2 — big & medium ask', 'L3 — gate decides', 'L4 — nothing asks'];
  interface P { lane: number; y: number; blast: number; state: 'rise' | 'wait' | 'done'; waitT: number; }
  let pulses: P[] = [], okN = 0, intN = 0, onScreen = false;
  const ledger = $('#org-ledger');

  function level(): number { return +$<HTMLInputElement>('#in-del').value; }
  function needsHuman(blast: number): boolean {
    const L = level();
    if (L === 1) return true;
    if (L === 2) return blast > 25;
    if (L === 3) return blast > 80;
    return false;
  }
  function log(txt: string, cls = ''): void {
    const d = document.createElement('div'); d.className = 'log-line ' + cls; d.textContent = txt;
    ledger.prepend(d);
    while (ledger.childElementCount > 6) ledger.lastElementChild!.remove();
  }
  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    /* human row */
    ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.roundRect(W / 2 - 90, 24, 180, 42, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = '13.5px Fraunces, serif'; ctx.textAlign = 'center';
    ctx.fillText('you — holding the gates', W / 2, 50);
    /* gate line */
    ctx.strokeStyle = 'rgba(45,42,36,0.5)'; ctx.setLineDash([7, 6]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(60, 130); ctx.lineTo(W - 60, 130); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '13px Caveat, cursive'; ctx.fillStyle = FAINT; ctx.textAlign = 'left';
    ctx.fillText('the gate', 62, 122);
    /* agent lanes */
    LANES.forEach((l, i) => {
      const x = 150 + i * 170;
      ctx.fillStyle = 'rgba(236,230,216,0.9)'; ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.roundRect(x - 55, H - 62, 110, 38, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = '12px Karla, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(l + ' agents', x, H - 38); ctx.textAlign = 'left';
    });
    /* pulses */
    pulses.forEach(p => {
      const x = 150 + p.lane * 170;
      const hum = needsHuman(p.blast);
      ctx.fillStyle = hum ? GOLD : LEAF;
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      const px = p.state === 'wait' ? W / 2 + ((p.lane - 1.5) * 26) : x;
      ctx.beginPath(); ctx.arc(px, p.y, 4 + Math.min(6, p.blast / 40), 0, 7); ctx.fill(); ctx.stroke();
    });
    $('#org-ok').textContent = String(okN);
    $('#org-int').textContent = String(intN);
  }
  function step(): void {
    if (pulses.length < 6 && rng() < 0.3) {
      pulses.push({ lane: (rng() * 4) | 0, y: H - 70, blast: 3 + ((rng() * rng() * 250) | 0), state: 'rise', waitT: 0 });
    }
    pulses.forEach(p => {
      if (p.state === 'rise') {
        p.y -= reduced ? 1.4 : 2.6;
        const stopY = needsHuman(p.blast) ? 70 : 130;
        if (p.y <= stopY) {
          if (needsHuman(p.blast)) {
            p.state = 'wait'; p.waitT = 0; intN++;
            log('⏸ awaiting you: ' + LANES[p.lane] + ' change, blast ' + p.blast, '');
          } else {
            p.state = 'done'; okN++;
            log('✓ auto-applied within bounds: ' + LANES[p.lane] + ', blast ' + p.blast + ' — logged', 'good');
          }
        }
      } else if (p.state === 'wait') {
        p.waitT++;
        if (p.waitT > (level() === 1 ? 90 : 55)) {
          p.state = 'done'; okN++;
          log('✓ your GO: ' + LANES[p.lane] + ', blast ' + p.blast, 'good');
        }
      }
    });
    pulses = pulses.filter(p => p.state !== 'done');
    draw();
  }
  let last = 0;
  function loop(ts: number): void {
    if (ts - last > (reduced ? 120 : 60)) { last = ts; step(); }
    if (onScreen) requestAnimationFrame(loop);
  }
  visible(cv, v => { const was = onScreen; onScreen = v; if (v && !was) requestAnimationFrame(loop); });
  $('#in-del').addEventListener('input', () => {
    $('#o-del').textContent = DELS[level() - 1];
    if (level() === 4) log('⚠ L4: nothing asks. hope the ledger is enough.', 'bad');
  });
  draw();
})();

/* ══════════════ 31 · THE WHOLE MACHINE ══════════════ */
(function () {
  const cv = $<HTMLCanvasElement>('#cv-dept'); if (!cv) return;
  const [ctx, W, H] = fit(cv);
  const CY = 165, GX = 470;
  let t = 0, onScreen = false;
  interface Dot { seg: 0 | 1; p: number; off: number; }
  const dots: Dot[] = [];
  for (let i = 0; i < 7; i++) dots.push({ seg: (i % 2) as 0 | 1, p: (i * 0.16) % 1, off: (i % 3 - 1) * 14 });

  function box(x: number, y: number, w: number, h: number, label: string, sub?: string): void {
    ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = '12.5px Karla, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h / 2 + (sub ? -3 : 4));
    if (sub) { ctx.font = '10.5px Karla, sans-serif'; ctx.fillStyle = FAINT; ctx.fillText(sub, x + w / 2, y + h / 2 + 12); }
    ctx.textAlign = 'left';
  }
  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    /* sources */
    ['filings', 'contracts', 'news'].forEach((s, i) => box(40, 70 + i * 62, 92, 40, s));
    box(210, 130, 110, 66, 'one pipeline', 'lineage + alarms');
    /* the graph */
    ctx.strokeStyle = 'rgba(85,121,60,0.5)'; ctx.lineWidth = 1.4;
    const ring: Pt[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ring.push([GX + Math.cos(a) * 62, CY + Math.sin(a) * 55]);
    }
    for (let i = 0; i < 10; i++) {
      const j = (i + 3) % 10;
      ctx.beginPath(); ctx.moveTo(ring[i][0], ring[i][1]); ctx.lineTo(ring[j][0], ring[j][1]); ctx.stroke();
    }
    ring.forEach(p => {
      ctx.fillStyle = LEAF; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, 7); ctx.fill(); ctx.stroke();
    });
    ctx.font = '13.5px Fraunces, serif'; ctx.fillStyle = INK; ctx.textAlign = 'center';
    ctx.fillText('THE GRAPH', GX, CY + 92);
    ctx.font = '10.5px Karla, sans-serif'; ctx.fillStyle = FAINT;
    ctx.fillText('typed · receipted · bitemporal', GX, CY + 106);
    ctx.textAlign = 'left';
    /* the flywheel orbit */
    const oa = t * 0.014;
    ctx.strokeStyle = SLATE; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(GX, CY, 102, 88, 0, oa, oa + 4.6); ctx.stroke();
    const ex = GX + Math.cos(oa + 4.6) * 102, ey = CY + Math.sin(oa + 4.6) * 88;
    const ta = oa + 4.6 + Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(ex, ey);
    ctx.lineTo(ex - 9 * Math.cos(ta - 0.4), ey - 9 * Math.sin(ta - 0.4));
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - 9 * Math.cos(ta + 0.4), ey - 9 * Math.sin(ta + 0.4));
    ctx.stroke();
    ctx.font = '12px Caveat, cursive'; ctx.fillStyle = SLATE; ctx.textAlign = 'center';
    ctx.fillText('agents: extract · verify · curate — behind the gate', GX, 34);
    ctx.textAlign = 'left';
    /* decisions */
    ['screener', 'weekly brief', 'alerts'].forEach((s, i) => box(742, 70 + i * 62, 100, 40, s));
    ctx.font = '10.5px Karla, sans-serif'; ctx.fillStyle = FAINT;
    ctx.fillText('every number traceable to a source', 700, 268);
    /* flowing dots */
    dots.forEach(d => {
      d.p += reduced ? 0.002 : 0.0042;
      if (d.p > 1) { d.p = 0; d.off = (((t | 0) % 3) - 1) * 14; }
      let x: number, y: number;
      if (d.seg === 0) { x = 135 + d.p * (GX - 62 - 135); y = 150 + d.off * 2 * (1 - d.p) + (CY - 150) * d.p; }
      else { x = GX + 62 + d.p * (740 - GX - 62); y = CY + (90 + d.off * 30 - CY) * d.p * 0.9; }
      ctx.fillStyle = d.seg === 0 ? SAGE : GOLD;
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); ctx.stroke();
    });
    t++;
  }
  function loop(): void { draw(); if (onScreen) requestAnimationFrame(loop); }
  visible(cv, v => { const was = onScreen; onScreen = v; if (v && !was && !reduced) requestAnimationFrame(loop); });
  draw();
})();
