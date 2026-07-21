/* Gradient · epilogue.ts — ch 32: one question, the whole machine.
   Every station on the loop is a chapter of the library.
   Requires core.ts (same bundle). */

(function () {
  const cv = $<HTMLCanvasElement>('#cv-all'); if (!cv) return;
  const [ctx, W, H] = fit(cv);
  const CX = W / 2, CY = 228, RX = 338, RY = 158;

  interface Chip { t: string; href: string; }
  interface StageDef { label: string; chips: Chip[]; }
  /* the eight stations are fixed machinery; only the story flowing through them changes */
  const STAGES: StageDef[] = [
    { label: 'tokens', chips: [{ t: '05 · words become numbers', href: '../language/#ch5' }] },
    { label: 'the tower', chips: [{ t: '06 · attention', href: '../language/#ch6' }, { t: '07 · the tower in 3-D', href: '../language/#ch7' }, { t: '10 · the engine room', href: '../frontier/#ch10' }] },
    { label: 'thinking', chips: [{ t: '17 · thinking out loud', href: '../thinking/#ch17' }, { t: '19 · the thinking budget', href: '../thinking/#ch19' }] },
    { label: 'the agent', chips: [{ t: '11 · the loop', href: '../agents/#ch11' }, { t: '12 · tools & MCP', href: '../agents/#ch12' }] },
    { label: 'the graph', chips: [{ t: '22 · the walk', href: '../graph/#ch22' }, { t: '25 · receipts', href: '../graph/#ch25' }, { t: '28 · GraphRAG', href: '../business/#ch28' }] },
    { label: 'the gate', chips: [{ t: '14 · guardrails', href: '../agents/#ch14' }, { t: '30 · humans in the org chart', href: '../business/#ch30' }] },
    { label: 'the fleet', chips: [{ t: '10g · quantization', href: '../frontier/#quant' }, { t: '29 · the model fleet', href: '../business/#ch29' }] },
    { label: 'the answer', chips: [{ t: '08 · the autocomplete machine', href: '../language/#ch8' }, { t: '25 · receipts', href: '../graph/#ch25' }] },
    { label: 'the flywheel', chips: [{ t: '27 · the flywheel', href: '../business/#ch27' }, { t: '13 · the context engineer', href: '../agents/#ch13' }] }
  ];
  interface Step { now: string; expl: string; }
  interface Scenario { q: string; when: string; answer: string; steps: Step[]; }
  const SCEN: Scenario[] = [
    { q: '"Fab-9 flooded — who\'s exposed?"', when: 'monday, 8:04 am',
      answer: 'exposed: Acme Rockets + OrbitalWorks, via Chipco [1][2] — owners notified.',
      steps: [
        { now: '8:04 am — the question becomes tokens', expl: 'the words are chopped into chunks and mapped to coordinates. meaning as geometry.' },
        { now: 'up the tower', expl: 'every token watches every other; dozens of layers refine what each word means here.' },
        { now: 'it pauses to think', expl: 'scratchpad first: reason, check, then speak — thinking tokens spent on purpose.' },
        { now: 'the agent reaches for a tool', expl: 'this needs live data, not vibes. it writes an order slip for the graph.' },
        { now: 'GraphRAG walks the graph', expl: 'Fab-9 → Chipco → two customers: the blast radius, receipts on every edge.' },
        { now: 'the gate checks the act', expl: 'notify two account owners? small blast radius, within bounds — applied and logged.' },
        { now: 'the fleet kept it cheap', expl: 'local models did the reading, a verifier doubted it, the frontier wrote the brief.' },
        { now: 'the answer streams out', expl: 'token by token, citations attached — one skill, wearing the whole machine.' },
        { now: 'and that night, the flywheel turns', expl: 'extract → verify → gate, unattended: the graph is richer by morning, so tomorrow\'s answer is better.' }
      ] },
    { q: '"Which customers ride on a single supplier?"', when: 'tuesday, 9:12 am',
      answer: 'fragile: Acme Rockets is sole-sourced on Chipco [1] — second-source suggested.',
      steps: [
        { now: '9:12 am — the risk question becomes tokens', expl: 'same machine, different words — chopped and placed in the very same meaning-space.' },
        { now: 'up the tower', expl: 'attention ties "single" to "supplier" to "customers" — the real shape of the ask.' },
        { now: 'it plans the search', expl: 'a counting question over structure — it decides to walk the graph, not guess.' },
        { now: 'the agent writes a graph query', expl: 'find customers whose distinct-supplier count is 1. an order slip, not a hunch.' },
        { now: 'it walks every supply path', expl: 'per customer, count distinct suppliers; Acme resolves to only Chipco — a single point of failure.' },
        { now: 'the gate reviews the finding', expl: 'read-only, zero blast radius — surfaced straight to the analyst and logged.' },
        { now: 'cheap tiers did the counting', expl: 'local models traversed the edges; the frontier only phrased the warning.' },
        { now: 'the answer streams out', expl: 'one fragile customer, the supplier named, a fix proposed — with receipts.' },
        { now: 'and overnight it re-checks', expl: 'new contracts change the counts; tomorrow\'s fragile-list is current without anyone asking.' }
      ] },
    { q: '"A tariff hits Taiwan chips — what\'s our exposure?"', when: 'thursday, 7:48 am',
      answer: 'exposure ≈ $2.4M across 3 products, via Chipco [1][2] — sourcing review opened.',
      steps: [
        { now: '7:48 am — the news becomes tokens', expl: 'a headline, chopped and mapped like any other prompt.' },
        { now: 'up the tower', expl: 'it links "tariff", "Taiwan", "chips" — and knows which of your nodes those touch.' },
        { now: 'it reasons about propagation', expl: 'a cost shock flows downstream; it plans a multi-hop walk before answering.' },
        { now: 'the agent reaches for the graph', expl: 'trace Taiwan-fab → chips → your products → revenue at risk. live data, not vibes.' },
        { now: 'it propagates the shock', expl: 'fab in Taiwan → Chipco → three of your products; multiply by volume for the dollar figure.' },
        { now: 'the gate weighs the act', expl: 'opening a sourcing review touches budgets — a bigger blast radius, so it asks a human first.' },
        { now: 'the fleet split the work', expl: 'local models did the arithmetic across edges; the frontier wrote the exec summary.' },
        { now: 'the answer streams out', expl: 'a dollar figure, the products, the path — every number traceable to a source.' },
        { now: 'and it keeps watching', expl: 'if the tariff sticks, tonight\'s run updates the exposure as new orders land.' }
      ] }
  ];
  let cur = 0;
  const scn = (): Scenario => SCEN[cur];
  const N = STAGES.length;
  const ang = (i: number) => -Math.PI / 2 + (i / N) * Math.PI * 2;
  const pos = (i: number): Pt => [CX + Math.cos(ang(i)) * RX, CY + Math.sin(ang(i)) * RY];

  let stage = 0, playing = true, pulse = 1, sinceAdvance = 0, answerLen = 0, onScreen = false;

  /* ── tiny icons, one per station ── */
  function icon(i: number, x: number, y: number, on: boolean, past: boolean): void {
    const a = on ? 1 : past ? 0.55 : 0.22;
    ctx.globalAlpha = a;
    ctx.lineWidth = 1.6; ctx.strokeStyle = INK;
    if (i === 0) {                                     /* token chips */
      ['#e2edd6', '#dbe2ee', '#f3e6c3'].forEach((c, k) => {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.roundRect(x - 27 + k * 19, y - 8, 16, 15, 4); ctx.fill(); ctx.stroke();
      });
    } else if (i === 1) {                              /* tower slabs */
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = on && k === 1 ? 'rgba(138,174,104,0.5)' : PAPER;
        ctx.beginPath(); ctx.roundRect(x - 20 + k * 2.5, y + 8 - k * 11, 36, 9, 3); ctx.fill(); ctx.stroke();
      }
    } else if (i === 2) {                              /* thought bubble */
      ctx.fillStyle = 'rgba(230,239,218,0.95)';
      ctx.beginPath(); ctx.roundRect(x - 22, y - 12, 44, 22, 11); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = '13px Caveat, cursive'; ctx.textAlign = 'center';
      ctx.fillText('hmm…', x, y + 4); ctx.textAlign = 'left';
    } else if (i === 3) {                              /* order slip */
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.roundRect(x - 16, y - 13, 32, 26, 4); ctx.fill(); ctx.stroke();
      ctx.font = '13px Karla, monospace'; ctx.fillStyle = INK; ctx.textAlign = 'center';
      ctx.fillText('{ }', x, y + 4); ctx.textAlign = 'left';
    } else if (i === 4) {                              /* mini graph */
      const P: Pt[] = [[x - 22, y + 8], [x - 2, y - 8], [x + 18, y - 2], [x + 14, y + 12]];
      const lit = on || past;
      [[0, 1], [1, 2], [1, 3]].forEach(([q, r], ei) => {
        ctx.strokeStyle = lit && ei < 2 ? GOLD : 'rgba(125,144,112,0.8)';
        ctx.lineWidth = lit && ei < 2 ? 2.4 : 1.4;
        ctx.beginPath(); ctx.moveTo(P[q][0], P[q][1]); ctx.lineTo(P[r][0], P[r][1]); ctx.stroke();
      });
      P.forEach(p => {
        ctx.fillStyle = LEAF; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, 7); ctx.fill(); ctx.stroke();
      });
    } else if (i === 5) {                              /* gate posts */
      ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(x - 14, y - 14); ctx.lineTo(x - 14, y + 14);
      ctx.moveTo(x + 14, y - 14); ctx.lineTo(x + 14, y + 14); ctx.stroke();
      ctx.font = '15px Karla, sans-serif'; ctx.fillStyle = GOOD; ctx.textAlign = 'center';
      ctx.fillText(on || past ? '✓' : '·', x, y + 5); ctx.textAlign = 'left';
    } else if (i === 6) {                              /* fleet tiers */
      [4, 6, 8].forEach((r, k) => {
        ctx.fillStyle = [LEAF, SAGE, GOLD][k]; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(x - 18 + k * 18, y, r, 0, 7); ctx.fill(); ctx.stroke();
      });
    } else if (i === 7) {                              /* answer lines */
      ctx.strokeStyle = 'rgba(45,42,36,0.7)'; ctx.lineWidth = 2;
      [0, 1, 2].forEach(k => {
        ctx.beginPath(); ctx.moveTo(x - 20, y - 8 + k * 8); ctx.lineTo(x - 20 + (k === 2 ? 22 : 40), y - 8 + k * 8); ctx.stroke();
      });
      if (on || past) { ctx.font = '13px Karla, sans-serif'; ctx.fillStyle = GOOD; ctx.fillText('✓', x + 24, y + 9); }
    } else {                                           /* flywheel */
      ctx.strokeStyle = on ? LEAF_D : SLATE; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(x, y, 13, 0.6, 5.6); ctx.stroke();
      const tx = x + Math.cos(5.6) * 13, ty = y + Math.sin(5.6) * 13;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - 6, ty - 3); ctx.moveTo(tx, ty); ctx.lineTo(tx + 1, ty - 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    /* the track */
    ctx.strokeStyle = 'rgba(138,129,113,0.4)'; ctx.lineWidth = 1.6; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.ellipse(CX, CY, RX, RY, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    /* stations */
    for (let i = 0; i < N; i++) {
      const [x, y] = pos(i);
      const on = i === stage, past = i < stage || (stage === N - 1 && pulse >= 1);
      if (on) {
        ctx.fillStyle = 'rgba(138,174,104,0.16)';
        ctx.beginPath(); ctx.arc(x, y, 40, 0, 7); ctx.fill();
      }
      icon(i, x, y, on, past);
      const lx = CX + Math.cos(ang(i)) * (RX + 42), ly = CY + Math.sin(ang(i)) * (RY + 32);
      ctx.font = (on ? '700 ' : '') + '12.5px Karla, sans-serif';
      ctx.fillStyle = on ? LEAF_D : FAINT; ctx.textAlign = 'center';
      ctx.fillText(STAGES[i].label, lx, Math.max(14, Math.min(H - 6, ly + 4)));
      ctx.textAlign = 'left';
    }
    /* the pulse, travelling the arc into the current station */
    const a0 = ang((stage + N - 1) % N), a1 = ang(stage) + (stage === 0 ? 0 : 0);
    let aa = a0 + (a1 - a0 + (a1 < a0 ? Math.PI * 2 : 0)) * Math.min(1, pulse);
    ctx.fillStyle = GOLD; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(CX + Math.cos(aa) * RX, CY + Math.sin(aa) * RY, 7, 0, 7); ctx.fill(); ctx.stroke();
    /* center: the question and, later, the answer */
    ctx.font = '16px Fraunces, serif'; ctx.fillStyle = INK; ctx.textAlign = 'center';
    ctx.fillText(scn().q, CX, CY - 26);
    ctx.font = '12px Karla, sans-serif'; ctx.fillStyle = FAINT;
    ctx.fillText(scn().when, CX, CY - 8);
    if (stage >= 7) {
      const txt = scn().answer.slice(0, answerLen | 0);
      ctx.font = '13.5px Karla, sans-serif'; ctx.fillStyle = LEAF_D;
      const mid = Math.ceil(txt.length / 2);
      ctx.fillText(txt.slice(0, mid), CX, CY + 22);
      ctx.fillText(txt.slice(mid), CX, CY + 40);
    }
    if (stage === N - 1) {
      ctx.font = '15px Caveat, cursive'; ctx.fillStyle = FAINT;
      ctx.fillText('…and by tuesday the graph knows more than it did today.', CX, CY + 70);
    }
    ctx.textAlign = 'left';
  }
  function caption(): void {
    $('#all-now').textContent = scn().steps[stage].now;
    $('#all-expl').textContent = scn().steps[stage].expl;
    const chips = $('#all-chips'); chips.innerHTML = '';
    STAGES[stage].chips.forEach(c => {
      const a = document.createElement('a'); a.href = c.href; a.textContent = c.t;
      chips.appendChild(a);
    });
  }
  function setStage(i: number): void {
    stage = ((i % N) + N) % N;
    pulse = 0; sinceAdvance = 0;
    if (stage < 7) answerLen = 0;
    caption(); draw();
  }
  let last = 0;
  function loop(ts: number): void {
    const dt = last ? Math.min(ts - last, 60) : 16; last = ts;
    pulse = Math.min(1, pulse + dt / 700);
    if (stage >= 7 && answerLen < scn().answer.length) answerLen += dt / 26;
    if (playing) {
      sinceAdvance += dt;
      if (sinceAdvance > (stage === N - 1 ? 4200 : 2900)) setStage(stage + 1);
    }
    draw();
    if (onScreen && !reduced) requestAnimationFrame(loop);
  }
  $('#btn-all-play').addEventListener('click', function (this: HTMLElement) {
    playing = !playing; this.textContent = playing ? 'pause' : 'play';
    sinceAdvance = 0;
  });
  $('#btn-all-prev').addEventListener('click', () => setStage(stage - 1));
  $('#btn-all-next').addEventListener('click', () => setStage(stage + 1));
  $('#btn-all-restart').addEventListener('click', () => setStage(0));
  function setScenario(i: number): void {
    cur = ((i % SCEN.length) + SCEN.length) % SCEN.length;
    $$('#all-scenarios button').forEach((b, k) => {
      b.setAttribute('aria-pressed', String(k === cur));
      b.classList.toggle('primary', k === cur);
    });
    if (reduced) { stage = N - 1; pulse = 1; answerLen = scn().answer.length; caption(); draw(); }
    else { playing = true; $('#btn-all-play').textContent = 'pause'; setStage(0); }
  }
  $$('#all-scenarios button').forEach((b, i) => b.addEventListener('click', () => setScenario(i)));
  visible(cv, v => { const was = onScreen; onScreen = v; if (v && !was && !reduced) { last = 0; requestAnimationFrame(loop); } });
  if (reduced) { stage = N - 1; pulse = 1; answerLen = scn().answer.length; playing = false; $('#btn-all-play').textContent = 'play'; }
  caption(); draw();
})();
