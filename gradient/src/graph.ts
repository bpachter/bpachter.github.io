/* Gradient · graph.ts — ch 21-26: storage shapes, the join tax, graph
   modeling, entity resolution, provenance, the hall of shame.
   Requires core.ts (same bundle). */

/* ══════════════ 21 · FIVE COSTUMES ══════════════ */
(function () {
  const cv = $<HTMLCanvasElement>('#cv-shapes'); if (!cv) return;
  const [ctx, W, H] = fit(cv);
  const CAPS = [
    'relational — great at totals, forms, audits · blind to chains of connection',
    'document — great at read-one-thing-fast · blind to "who else references this?" (copies drift)',
    'key-value — great at instant fetch by key · blind to every question that isn\'t a key',
    'columnar — great at SUM over a billion rows · blind to following one row\'s story',
    'graph — things are nodes, relationships are typed edges. "what\'s connected?" is free'
  ];
  let mode = 0;

  function table(x: number, y: number, title: string, header: string[], rows: string[][], goldRow: number): void {
    const cw = 92, rh = 24;
    ctx.font = '13px Karla, sans-serif'; ctx.fillStyle = FAINT;
    ctx.fillText(title, x, y - 8);
    header.forEach((h, c) => {
      ctx.fillStyle = '#ece6d8'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      ctx.fillRect(x + c * cw, y, cw, rh); ctx.strokeRect(x + c * cw, y, cw, rh);
      ctx.fillStyle = INK; ctx.font = '12px Karla, sans-serif';
      ctx.fillText(h, x + c * cw + 7, y + 16);
    });
    rows.forEach((r, ri) => {
      r.forEach((v, c) => {
        ctx.fillStyle = ri === goldRow ? 'rgba(201,162,39,0.3)' : '#fff';
        ctx.strokeStyle = 'rgba(45,42,36,0.5)'; ctx.lineWidth = 1.2;
        ctx.fillRect(x + c * cw, y + (ri + 1) * rh, cw, rh);
        ctx.strokeRect(x + c * cw, y + (ri + 1) * rh, cw, rh);
        ctx.fillStyle = INK; ctx.font = '12px Karla, sans-serif';
        ctx.fillText(v, x + c * cw + 7, y + (ri + 1) * rh + 16);
      });
    });
  }
  function mono(x: number, y: number, lines: Array<[string, boolean]>): void {
    ctx.font = '13px Karla, monospace';
    lines.forEach((l, i) => {
      if (l[1]) { ctx.fillStyle = 'rgba(201,162,39,0.3)'; ctx.fillRect(x - 5, y + i * 20 - 13, ctx.measureText(l[0]).width + 12, 19); }
      ctx.fillStyle = INK; ctx.fillText(l[0], x, y + i * 20);
    });
  }
  function node(x: number, y: number, label: string, sub: string): void {
    ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.roundRect(x - 62, y - 22, 124, 44, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = '13.5px Fraunces, serif'; ctx.textAlign = 'center';
    ctx.fillText(label, x, y - 2);
    ctx.font = '11px Karla, sans-serif'; ctx.fillStyle = FAINT;
    ctx.fillText(sub, x, y + 14); ctx.textAlign = 'left';
  }
  function edge(x1: number, y1: number, x2: number, y2: number, label: string, gold: boolean): void {
    arrow(ctx, x1, y1, x2, y2, gold ? GOLD : SAGE, gold ? 3 : 2.2);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    ctx.font = '12px Karla, monospace'; ctx.fillStyle = gold ? '#8a6d10' : LEAF_D;
    ctx.textAlign = 'center'; ctx.fillText(label, mx, my - 8); ctx.textAlign = 'left';
  }
  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    if (mode === 0) {
      table(70, 46, 'ORGS', ['id', 'name', 'type'], [['1', 'Acme Rockets', 'customer'], ['2', 'Beta Alloys', 'supplier'], ['3', 'Gamma Chips', 'supplier']], -1);
      table(480, 46, 'SUPPLIES (the relationship, exiled)', ['src', 'dst', 'item'], [['2', '1', 'alloy frames'], ['3', '1', 'guidance chips'], ['3', '2', 'sensor dies']], 0);
      ctx.font = '15px Caveat, cursive'; ctx.fillStyle = FAINT;
      ctx.fillText('"Beta supplies Acme" = a row of foreign keys. the meaning lives in your JOIN.', 90, 240);
    } else if (mode === 1) {
      mono(80, 56, [
        ['{ "org": "Acme Rockets",', false],
        ['  "suppliers": [', false],
        ['    { "name": "Beta Alloys",  "item": "alloy frames" },', true],
        ['    { "name": "Gamma Chips", "item": "guidance chips" } ] }', false]
      ]);
      mono(80, 176, [
        ['{ "org": "Beta Alloys",', false],
        ['  "suppliers": [', false],
        ['    { "name": "Gamma Chips", "item": "sensor dies" } ] }', false]
      ]);
      ctx.font = '15px Caveat, cursive'; ctx.fillStyle = BAD;
      ctx.fillText('Gamma Chips now lives in TWO documents. when its name changes, one copy forgets.', 90, 280);
    } else if (mode === 2) {
      mono(110, 62, [
        ['org:1        →  { name: "Acme Rockets",  type: "customer" }', false],
        ['org:2        →  { name: "Beta Alloys",   type: "supplier" }', false],
        ['org:3        →  { name: "Gamma Chips",  type: "supplier" }', false],
        ['supplies:2:1 →  { item: "alloy frames" }', true],
        ['supplies:3:1 →  { item: "guidance chips" }', false]
      ]);
      ctx.font = '15px Caveat, cursive'; ctx.fillStyle = FAINT;
      ctx.fillText('blazing fast — IF you already know the key. "who supplies Acme?" = scan everything.', 110, 220);
    } else if (mode === 3) {
      const cols = [
        ['orgs.name', 'Acme Rockets', 'Beta Alloys', 'Gamma Chips'],
        ['supplies.src', '2', '3', '3'],
        ['supplies.dst', '1', '1', '2'],
        ['supplies.item', 'alloy frames', 'guidance chips', 'sensor dies']
      ];
      cols.forEach((col, ci) => {
        const x = 90 + ci * 185;
        ctx.font = '12px Karla, sans-serif'; ctx.fillStyle = FAINT;
        ctx.fillText(col[0], x, 52);
        col.slice(1).forEach((v, ri) => {
          const gold = ri === 0 && ci > 0;
          ctx.fillStyle = gold ? 'rgba(201,162,39,0.3)' : '#fff';
          ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
          ctx.fillRect(x, 62 + ri * 30, 160, 26); ctx.strokeRect(x, 62 + ri * 30, 160, 26);
          ctx.fillStyle = INK; ctx.font = '12.5px Karla, sans-serif';
          ctx.fillText(v, x + 8, 80 + ri * 30);
        });
      });
      ctx.font = '15px Caveat, cursive'; ctx.fillStyle = FAINT;
      ctx.fillText('stored column-major: summing a column is a straight line through memory. one fact = a horizontal scavenger hunt.', 90, 230);
    } else {
      node(250, 90, 'Beta Alloys', 'Organization · supplier');
      node(640, 90, 'Acme Rockets', 'Organization · customer');
      node(250, 240, 'Gamma Chips', 'Organization · supplier');
      edge(315, 90, 575, 90, 'supplies (alloy frames)', true);
      edge(315, 228, 585, 112, 'supplies (guidance chips)', false);
      edge(250, 217, 250, 115, 'supplies (sensor dies)', false);
      ctx.font = '15px Caveat, cursive'; ctx.fillStyle = LEAF_D;
      ctx.fillText('the gold fact is simply… drawn. typed, directed, queryable in one hop.', 330, 300);
    }
    $('#shapes-cap').textContent = CAPS[mode];
  }
  $$('#seg-shapes button').forEach(b => b.addEventListener('click', () => {
    $$('#seg-shapes button').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    mode = +((b as HTMLElement).dataset.m!); draw();
  }));
  draw();
  const touch = userTouch($('#w-shapes'));
  if (!reduced) {
    const timer = window.setInterval(() => {
      if (touch.touched) { clearInterval(timer); return; }
      mode = (mode + 1) % 5;
      $$('#seg-shapes button').forEach((x, i) => x.setAttribute('aria-pressed', String(i === mode)));
      draw();
    }, 3400);
  }
})();

/* ══════════════ 22 · THE JOIN TAX ══════════════ */
(function () {
  const cv = $<HTMLCanvasElement>('#cv-join'); if (!cv) return;
  const [ctx, W, H] = fit(cv);
  const FAN = 6, EDGE_ROWS = 6000;
  const sqlCost = (h: number) => { let c = 0; for (let k = 1; k <= h; k++) c += Math.pow(FAN, k - 1) * EDGE_ROWS; return c; };
  const graphCost = (h: number) => { let c = 0; for (let k = 1; k <= h; k++) c += Math.pow(FAN, k); return c; };
  const fmtN = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n.toLocaleString('en-US');

  /* a little radial universe for the BFS side */
  const rng = mulberry32(4242);
  const rings: Pt[][] = [];
  const CX = 660, CY = 158;
  [7, 13, 19, 26].forEach((count, ring) => {
    const pts: Pt[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ring * 0.35 + rng() * 0.14;
      const r = 42 + ring * 36 + rng() * 8;
      pts.push([CX + Math.cos(a) * r, CY + Math.sin(a) * r * 0.82]);
    }
    rings.push(pts);
  });

  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    const h = +$<HTMLInputElement>('#in-hops').value;
    /* SQL side */
    ctx.font = '14px Karla, sans-serif'; ctx.fillStyle = INK;
    ctx.fillText('SELECT s3.supplier FROM supplies s1', 40, 46);
    for (let k = 2; k <= 4; k++) {
      const on = k <= h;
      ctx.fillStyle = on ? INK : 'rgba(138,129,113,0.45)';
      ctx.fillText('  JOIN supplies s' + k + ' ON s' + k + '.dst = s' + (k - 1) + '.src', 40, 46 + (k - 1) * 24);
      if (on && k === h) {
        ctx.fillStyle = 'rgba(201,162,39,0.28)';
        ctx.fillRect(34, 46 + (k - 1) * 24 - 15, 320, 21);
      }
    }
    ctx.fillStyle = FAINT; ctx.font = '13px Karla, sans-serif';
    ctx.fillText("WHERE s1.dst = 'Acme'", 40, 148);
    /* cost bars (log scale) */
    const bx = 40, by = 200, bw = 330;
    const logmax = Math.log10(sqlCost(4));
    const sqlW = Math.log10(sqlCost(h)) / logmax * bw;
    const gW = Math.max(4, Math.log10(graphCost(h)) / logmax * bw);
    ctx.font = '12.5px Karla, sans-serif'; ctx.fillStyle = INK;
    ctx.fillText('rows examined (SQL)', bx, by - 6);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, 22);
    ctx.fillStyle = GOLD; ctx.fillRect(bx + 1.5, by + 1.5, sqlW - 3, 19);
    ctx.fillStyle = INK;
    ctx.fillText('nodes visited (graph)', bx, by + 46);
    ctx.strokeRect(bx, by + 52, bw, 22);
    ctx.fillStyle = LEAF; ctx.fillRect(bx + 1.5, by + 53.5, gW - 3, 19);
    ctx.font = '13px Caveat, cursive'; ctx.fillStyle = FAINT;
    ctx.fillText('(log scale — it\'s worse than it looks)', bx, by + 96);
    /* graph side: BFS rings light up */
    ctx.font = '13px Karla, sans-serif'; ctx.fillStyle = FAINT;
    ctx.fillText('the graph just… walks', CX - 60, 30);
    rings.forEach((ring, ri) => {
      ring.forEach(p => {
        const on = ri < h;
        if (on) {
          ctx.strokeStyle = 'rgba(85,121,60,0.35)'; ctx.lineWidth = 1;
          const prev = ri === 0 ? [CX, CY] as Pt : rings[ri - 1][(Math.round(p[0] + p[1]) % rings[ri - 1].length + rings[ri - 1].length) % rings[ri - 1].length];
          ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
        }
        ctx.fillStyle = on ? LEAF : 'rgba(107,127,163,0.3)';
        ctx.strokeStyle = on ? INK : 'rgba(45,42,36,0.3)'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(p[0], p[1], on ? 6 : 4.5, 0, 7); ctx.fill(); ctx.stroke();
      });
    });
    ctx.fillStyle = GOLD; ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(CX, CY, 10, 0, 7); ctx.fill(); ctx.stroke();
    ctx.font = '12px Karla, sans-serif'; ctx.fillStyle = INK; ctx.textAlign = 'center';
    ctx.fillText('Acme', CX, CY - 16); ctx.textAlign = 'left';
    $('#o-hops').textContent = String(h);
    $('#join-sql').textContent = fmtN(sqlCost(h));
    $('#join-graph').textContent = fmtN(graphCost(h));
  }
  $('#in-hops').addEventListener('input', draw);
  draw();
  const touch = userTouch($('#w-join'));
  if (!reduced) {
    let dir = 1;
    const timer = window.setInterval(() => {
      if (touch.touched) { clearInterval(timer); return; }
      const s = $<HTMLInputElement>('#in-hops');
      let v = +s.value + dir;
      if (v >= 4) { v = 4; dir = -1; } else if (v <= 1) { v = 1; dir = 1; }
      s.value = String(v); draw();
    }, 1700);
  }
})();

/* ══════════════ 23 · CURE THE MODEL ══════════════ */
(function () {
  const cv = $<HTMLCanvasElement>('#cv-model'); if (!cv) return;
  const [ctx, W, H] = fit(cv);
  const fixed = [false, false, false, false];

  function box(x: number, y: number, label: string, sub: string, style: 'ok' | 'bad' | 'faint' = 'ok'): void {
    ctx.fillStyle = style === 'bad' ? '#f8e9e4' : PAPER;
    ctx.strokeStyle = style === 'faint' ? 'rgba(45,42,36,0.4)' : INK;
    ctx.lineWidth = 2;
    if (style === 'faint') ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.roundRect(x - 58, y - 20, 116, 40, 11); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = INK; ctx.font = '12.5px Fraunces, serif'; ctx.textAlign = 'center';
    ctx.fillText(label, x, y - 1);
    ctx.font = '10.5px Karla, sans-serif'; ctx.fillStyle = FAINT;
    ctx.fillText(sub, x, y + 13); ctx.textAlign = 'left';
  }
  function tedge(x1: number, y1: number, x2: number, y2: number, label: string, bad: boolean): void {
    if (bad) { ctx.setLineDash([6, 5]); }
    arrow(ctx, x1, y1, x2, y2, bad ? BAD : SAGE, 2.2);
    ctx.setLineDash([]);
    ctx.font = '11.5px Karla, monospace'; ctx.fillStyle = bad ? BAD : LEAF_D;
    ctx.textAlign = 'center'; ctx.fillText(label, (x1 + x2) / 2, (y1 + y2) / 2 - 7); ctx.textAlign = 'left';
  }
  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    box(640, 80, 'Acme Rockets', 'Organization');
    box(420, 60, 'Beta Alloys', 'Organization');
    box(420, 170, 'Gamma Chips', 'Organization');
    tedge(480, 66, 578, 78, 'supplies (frames)', false);
    tedge(480, 164, 580, 96, 'supplies (chips)', false);
    /* f0 — the vague edge */
    if (fixed[0]) tedge(420, 145, 420, 86, 'supplies (dies, since 2024)', false);
    else tedge(420, 145, 420, 86, 'related_to ??', true);
    /* f1 — the orphan */
    if (!fixed[1]) box(150, 262, 'Notes-2024', 'node…of notes?', 'faint');
    else { ctx.font = '13px Caveat, cursive'; ctx.fillStyle = GOOD; ctx.fillText('orphan absorbed as an edge property ✓', 84, 262); }
    /* f2 — the god node */
    if (!fixed[2]) {
      box(150, 90, 'MISC', '9 edges, 0 meaning', 'bad');
      const rng = mulberry32(8);
      for (let i = 0; i < 9; i++) {
        const a = rng() * Math.PI * 2;
        ctx.strokeStyle = 'rgba(192,91,77,0.5)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(150, 90);
        ctx.lineTo(150 + Math.cos(a) * (46 + rng() * 30), 90 + Math.sin(a) * (40 + rng() * 24));
        ctx.stroke();
      }
    } else {
      box(120, 70, 'Plant: Reno', 'Facility', 'ok');
      box(150, 150, 'Cert: AS9100', 'Certification', 'ok');
      tedge(178, 74, 362, 62, 'operates', false);
      tedge(208, 152, 362, 168, 'holds', false);
    }
    /* f3 — the address chain */
    if (!fixed[3]) {
      box(560, 250, 'Address', '"1 Launch Way"', 'faint');
      box(760, 250, 'City', '"Reno, NV"', 'faint');
      tedge(618, 108, 578, 228, 'has_address', true);
      tedge(620, 250, 700, 250, 'in_city', true);
    } else {
      ctx.font = '12px Karla, monospace'; ctx.fillStyle = LEAF_D; ctx.textAlign = 'center';
      ctx.fillText('hq: "Reno, NV" ✓  (a property, not a subgraph)', 640, 40);
      ctx.textAlign = 'left';
    }
  }
  function refresh(): void {
    draw();
    let n = 0;
    fixed.forEach((f, i) => {
      $('#lint-' + i).classList.toggle('ok', f);
      $('#fix-' + i).setAttribute('aria-pressed', String(f));
      if (f) n++;
    });
    $('#model-score').textContent = n + ' / 4';
  }
  for (let i = 0; i < 4; i++) {
    $('#fix-' + i).addEventListener('click', () => { fixed[i] = !fixed[i]; refresh(); });
  }
  refresh();
})();

/* ══════════════ 24 · THE MERGE DESK ══════════════ */
(function () {
  const nameA = $('#er-a-name'); if (!nameA) return;
  interface Ent { name: string; ev: Array<[string, string]>; }
  interface Case { a: Ent; b: Ent; correct: 'merge' | 'sep' | 'link'; why: string; }
  const CASES: Case[] = [
    {
      a: { name: 'Northrop Grumman Corp', ev: [['ticker', 'NOC'], ['LEI', '…M2N5'], ['industry', 'aerospace & defense'], ['hq', 'Falls Church, VA']] },
      b: { name: 'NORTHROP GRUMMAN SYSTEMS CORPORATION', ev: [['ticker', '—'], ['LEI', '…M2N5 (parent)'], ['industry', 'aerospace & defense'], ['hq', 'Falls Church, VA']] },
      correct: 'merge', why: 'same family, same parent LEI, same HQ — an operating name of the same company. fold it into the canonical node, keep the alias.'
    },
    {
      a: { name: 'Apple Inc', ev: [['ticker', 'AAPL'], ['LEI', '…GP58'], ['industry', 'consumer electronics'], ['hq', 'Cupertino, CA']] },
      b: { name: 'Apple Federal Credit Union', ev: [['ticker', '—'], ['LEI', '…Q912'], ['industry', 'banking'], ['hq', 'Fairfax, VA']] },
      correct: 'sep', why: 'shared word, nothing else — different LEI, industry, and state. name similarity alone is how graphs get poisoned.'
    },
    {
      a: { name: 'BOEING CO/THE', ev: [['ticker', 'BA'], ['LEI', '…BC77'], ['industry', 'aerospace'], ['hq', 'Arlington, VA']] },
      b: { name: 'Boeing', ev: [['ticker', 'BA'], ['LEI', '…BC77'], ['industry', 'aerospace'], ['hq', 'Arlington, VA']] },
      correct: 'merge', why: 'identical ticker and LEI — "CO/THE" is a filing-format artifact, not a different company. normalize and merge.'
    },
    {
      a: { name: 'Delta Air Lines', ev: [['ticker', 'DAL'], ['LEI', '…DA31'], ['industry', 'airlines'], ['hq', 'Atlanta, GA']] },
      b: { name: 'Delta Electronics', ev: [['ticker', '2308.TW'], ['LEI', '…DE09'], ['industry', 'power electronics'], ['hq', 'Taipei']] },
      correct: 'sep', why: 'the single-token trap: "Delta" is a word, not a family. conflicting tickers and LEIs — an auto-merger here would weld two industries together.'
    },
    {
      a: { name: 'Alphabet Inc', ev: [['ticker', 'GOOGL'], ['LEI', '…AL01'], ['industry', 'holding company'], ['hq', 'Mountain View, CA']] },
      b: { name: 'Google LLC', ev: [['ticker', '—'], ['LEI', '…GG42'], ['industry', 'internet services'], ['hq', 'Mountain View, CA']] },
      correct: 'link', why: 'neither! merging erases real structure; separating loses the truth. the right move is an edge: Google LLC —subsidiary_of→ Alphabet Inc.'
    }
  ];
  let ci = 0, score = 0, locked = false;
  function show(): void {
    const c = CASES[ci];
    nameA.textContent = c.a.name;
    $('#er-b-name').textContent = c.b.name;
    (['a', 'b'] as const).forEach(side => {
      const el = $('#er-' + side + '-ev'); el.innerHTML = '';
      c[side].ev.forEach(([k, v]) => {
        const d = document.createElement('div'); d.className = 'ev';
        d.innerHTML = k + ': <b>' + v + '</b>';
        el.appendChild(d);
      });
    });
    $('#er-verdict').innerHTML = '';
    $('#er-case').textContent = (ci + 1) + ' / 5';
    locked = false;
  }
  function answer(pick: 'merge' | 'sep' | 'link'): void {
    if (locked) return;
    locked = true;
    const c = CASES[ci];
    const right = pick === c.correct;
    if (right) score++;
    $('#er-score').textContent = String(score);
    const label = { merge: 'merge', sep: 'keep separate', link: 'link with an edge' }[c.correct];
    $('#er-verdict').innerHTML =
      (right ? '<span class="yes">✓ right.</span> ' : '<span class="no">✗ the desk overrules you — ' + label + '.</span> ') + c.why;
    window.setTimeout(() => {
      ci++;
      if (ci < CASES.length) show();
      else {
        $('#er-verdict').innerHTML = '<span class="' + (score >= 4 ? 'yes' : 'no') + '">done — ' + score + '/5.</span> a production graph runs exactly these rules over thousands of pairs nightly, with the <a href="../agents/#ch14">ch 14 blast-radius gate</a> deciding which merges apply on their own.';
        $('#er-case').textContent = '5 / 5';
        locked = true;
      }
    }, reduced ? 2200 : 4200);
  }
  $('#btn-er-merge').addEventListener('click', () => answer('merge'));
  $('#btn-er-sep').addEventListener('click', () => answer('sep'));
  $('#btn-er-link').addEventListener('click', () => answer('link'));
  show();
})();

/* ══════════════ 25 · RECEIPTS ══════════════ */
(function () {
  const stack = $('#prov-stack'); if (!stack) return;
  interface Src { year: number; label: string; tier: string; cls: string; }
  const sources: Src[] = [{ year: 2023, label: 'trade-press article: "Beta lands Acme frame deal"', tier: 'reported · 0.60', cls: 'rep' }];
  let hasGov = false, hasCon = false;

  function state(atYear: number): { status: string; conf: string; cls: string } {
    const gov = hasGov && atYear >= 2024, con = hasCon && atYear >= 2026;
    if (con) return { status: 'disputed — kept, quarantined', conf: '0.45', cls: 'disputed' };
    if (gov) return { status: 'verified', conf: '0.92', cls: 'verified' };
    return { status: 'reported', conf: '0.60', cls: 'reported' };
  }
  function render(): void {
    const y = +$<HTMLInputElement>('#in-time').value;
    $('#o-time').textContent = String(y);
    stack.innerHTML = '';
    sources.filter(s => s.year <= y).forEach(s => {
      const d = document.createElement('div');
      d.className = 'prov-src ' + s.cls;
      d.innerHTML = '<span>' + s.year + ' · ' + s.label + '</span><span class="tier">' + s.tier + '</span>';
      stack.appendChild(d);
    });
    const st = state(y);
    const rel = $('#prov-rel');
    rel.textContent = 'supplies · ' + st.status.split(' ')[0];
    rel.className = 'prov-rel ' + st.cls;
    $('#prov-status').textContent = st.status;
    $('#prov-conf').textContent = st.conf;
  }
  $('#btn-prov-gov').addEventListener('click', function (this: HTMLButtonElement) {
    if (hasGov) return;
    hasGov = true; this.disabled = true;
    sources.push({ year: 2024, label: 'federal subaward record: Beta → Acme, $2.1M frames', tier: 'government · 0.95', cls: 'gov' });
    render();
  });
  $('#btn-prov-con').addEventListener('click', function (this: HTMLButtonElement) {
    if (hasCon) return;
    hasCon = true; this.disabled = true;
    sources.push({ year: 2026, label: 'SEC filing: Beta divests frames unit to Delta Forge', tier: 'contradicts · gov-tier', cls: 'con' });
    render();
  });
  $('#in-time').addEventListener('input', render);
  render();
})();

/* ══════════════ 26 · THE HALL OF SHAME ══════════════ */
(function () {
  const grid = $('#shame-grid'); if (!grid) return;
  const INNOCENT = 1;
  let found = 0;
  $$('.shame-card', grid).forEach(card => card.addEventListener('click', () => {
    if (card.classList.contains('revealed')) return;
    const k = +((card as HTMLElement).dataset.k!);
    card.classList.add('revealed', k === INNOCENT ? 'fine' : 'rot');
    if (k !== INNOCENT) {
      found++;
      $('#shame-found').textContent = found + ' / 5';
      if (found === 5) $('#shame-done').textContent = 'all found — and the CRM survives. kill the copies, never the source. →';
    }
  }));
})();
