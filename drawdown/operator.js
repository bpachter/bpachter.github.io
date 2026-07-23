/* DRAWDOWN — Act III: THE OPERATOR.
   You run US energy policy + markets, quarterly, Jul 2026 → Jan 2036.
   Same engine as Act II. Decisions have lags, budgets, and political costs.
   Deliberately hard. Nobody has beaten 2030 yet. */
(() => {
  const $ = s => document.querySelector(s);
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };
  const fmt = (v, d = 0) => v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
  const fmtQ = yf => Math.floor(yf) + ' Q' + (Math.floor((yf - Math.floor(yf)) * 4) + 1);

  // seeded RNG (mulberry32) — deterministic runs, shareable
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  const T0 = 2026.5, T_END = 2036.0, QTRS = Math.round((T_END - T0) * 4); // 38

  /* Actions. cost = political capital. lag in years before effect.
     apply(fx) mutates the game's effect accumulator. */
  const ACTIONS = [
    { id: 'midstream', name: 'FAST-TRACK MIDSTREAM', cost: 2, max: 4, lag: 1.5,
      desc: 'Processing + gathering. +0.5 Bcf/d/yr build rate, +1 max deliverability. Effective in 18 months.',
      apply: fx => { fx.prodBuildRate += 0.5; fx.prodMax += 1; } },
    { id: 'pipe', name: 'PERMIT INTERSTATE PIPELINE', cost: 3, max: 2, lag: 3,
      desc: 'Unbottleneck Appalachia. +2 Bcf/d max deliverability. Three years of court dates first.',
      apply: fx => { fx.prodMax += 2; } },
    { id: 'canada', name: 'CANADA PIPELINE DEAL', cost: 3, max: 2, lag: 3,
      desc: '+1 Bcf/d of year-round Canadian gas. Effective in 3 years.',
      apply: fx => { fx.canadaPipeBcfd += 1; } },
    { id: 'ap1000', name: 'ORDER AP1000 PAIR', cost: 4, max: 6, lag: 7,
      desc: '+2 GW nuclear, online in SEVEN years. The only lever that matters in 2033 is the one you pull now.',
      apply: fx => { fx.nuclearGW += 2; } },
    { id: 'solar', name: 'RESI SOLAR INCENTIVES', cost: 2, max: 4, lag: 2,
      desc: 'Rooftops + batteries shave the 10AM–6PM gas burn. −0.5 Bcf/d power burn, ramps in 2 years.',
      apply: fx => { fx.resiSolarShave += 0.5; } },
    { id: 'throttle', name: 'THROTTLE DC INTERCONNECTS', cost: 2, max: 5, lag: 0.25,
      desc: 'Slow-walk data-center hookups. −15% DC gas path. The AI lobby will remember.',
      aiHit: 9, apply: fx => { fx.dcGasShare -= 0.15; } },
    { id: 'perfwatt', name: 'EFFICIENCY MANDATE', cost: 2, max: 4, lag: 0.5,
      desc: 'Perf-per-watt standards for new compute. +3%/yr efficiency against load growth.',
      aiHit: 3, apply: fx => { fx.perfWattGain += 0.03; } },
    { id: 'defer', name: 'DEFER SPOT CARGOES', cost: 1, max: 8, lag: 0, dur: 1,
      desc: 'Lean on exporters to skip spot liftings for 4 quarters. −8% LNG. Allies notice (−6 trust).',
      allyHit: 6, apply: fx => { fx.lngDeferUntil = Math.max(fx.lngDeferUntil, fx.now + 1); } },
    { id: 'breach', name: 'BREACH LNG CONTRACTS', cost: 0, max: 1, lag: 0,
      desc: 'Force majeure on contracted cargoes above $16. Permanent. Allies: −40. There is no undo.',
      allyHit: 40, apply: fx => { fx.allowBreach = true; } },
    { id: 'dr', name: 'DEMAND RESPONSE PROGRAM', cost: 1, max: 3, lag: 0.5,
      desc: 'Industrial curtailment contracts. Softens price blowouts slightly.',
      apply: fx => { fx.elasticity += 0.01; } },
  ];

  const state = {
    seed: 0, rand: null, q: 0, pc: 8, spentLog: [],
    counts: {}, fxQueue: [], weatherByYear: {}, allowBreach: false,
    ai: 100, allies: 100, over: null, // over = {won, reason, at}
    lngDeferUntil: -1,
  };

  function now() { return T0 + state.q / 4; }

  function drawWeather(year) {
    const r = state.rand();
    // mild .18 | normal .52 | severe .22 | extreme .08  (Fern-class)
    return r < 0.18 ? 0.95 : r < 0.70 ? 1.0 : r < 0.92 ? 1.05 : 1.10;
  }

  // build engine inputs from base + matured actions
  function buildRun() {
    const fx = {
      prodBuildRate: 4.0, prodMax: 130, canadaPipeBcfd: 0, nuclearGW: 0, resiSolarShave: 0,
      dcGasShare: 1.0, perfWattGain: 0, elasticity: 0, lngDeferUntil: state.lngDeferUntil, now: now(),
      allowBreach: state.allowBreach,
    };
    for (const item of state.fxQueue) if (item.at <= now()) item.apply(fx);
    fx.dcGasShare = Math.max(0.25, fx.dcGasShare);

    const C = JSON.parse(JSON.stringify(ENGINE.CALIB));
    C.demand.elasticity += fx.elasticity;

    const levers = {
      dcPath: 'P50', dcGasShare: fx.dcGasShare, perfWattGain: fx.perfWattGain,
      prodMax: fx.prodMax, prodBuildRate: fx.prodBuildRate,
      canadaPipeBcfd: fx.canadaPipeBcfd, canadaPipeYear: 2026,  // lag handled by fxQueue maturity
      nuclearGW2033: fx.nuclearGW, resiSolarShave: fx.resiSolarShave,
      allowSpotCurtail: true, allowBreach: fx.allowBreach,
      lngScale: fx.lngDeferUntil >= now() ? 0.92 : 1.0,
      weatherByYear: state.weatherByYear, weather: 1.0,
    };
    return ENGINE.run(levers, C);
  }

  function evaluate(r) {
    // score months up to "now"
    const iNow = Math.max(0, Math.min(r.t.length - 1, Math.round((now() - T0) * 12) - 1));
    let bandMonths = 0, crisisMonths = 0, billsIdx = 0, n = 0, floorHit = false, worstS = 1e9;
    for (let i = 0; i <= iNow; i++) {
      const min5 = ENGINE.CALIB.storage.minByMonth[r.m[i]];
      if (r.S[i] < min5) bandMonths++;
      if (r.S[i] < 1100) crisisMonths++;
      if (r.S[i] < worstS) worstS = r.S[i];
      billsIdx += r.elec[i] / 40;   // baseline ≈ $37.5/MWh at $3.4 gas, small headroom
      n++;
    }
    floorHit = r.events.some(e => e.type === 'FLOOR' && (e.year + e.month / 12) <= now());
    const bills = billsIdx / Math.max(1, n);          // 1.0 = baseline
    const recentElec = r.elec.slice(Math.max(0, iNow - 11), iNow + 1);
    const recentBills = recentElec.reduce((a, b) => a + b, 0) / Math.max(1, recentElec.length) / 40;
    const grid = Math.max(0, 100 - bandMonths * 2.5 - crisisMonths * 6 - (floorHit ? 100 : 0));
    const billsScore = Math.max(0, Math.round(100 - Math.max(0, recentBills - 1) * 90));
    // market-forced AI slowdown when gas is unaffordable
    const pxNow = r.price[iNow];
    if (pxNow > 20) state.ai = Math.max(0, state.ai - 2);
    return { iNow, grid: Math.round(grid), bills: billsScore, floorHit, worstS, pxNow, sNow: r.S[iNow], recentBills };
  }

  function checkEndings(ev) {
    if (ev.floorHit) return { won: false, reason: 'STORAGE FLOOR BREACH — involuntary curtailment cascaded into a grid emergency. The inquiry will take years.', at: fmtQ(now()) };
    if (ev.bills < 15) return { won: false, reason: 'CONSUMER REVOLT — power bills ran ~2× baseline for a year. You were voted out. Your successor breached the contracts anyway.', at: fmtQ(now()) };
    if (state.allies < 20) return { won: false, reason: 'ALLIANCE COLLAPSE — Europe and Asia re-signed with other suppliers. The next crisis, nobody takes your call.', at: fmtQ(now()) };
    if (state.ai < 30) return { won: false, reason: 'CEDED THE RACE — compute buildout stalled under your throttles. The frontier moved offshore.', at: fmtQ(now()) };
    if (now() >= T_END) {
      const ok = ev.grid >= 40 && ev.bills >= 40 && state.ai >= 40 && state.allies >= 40;
      return ok
        ? { won: true, reason: 'YOU REACHED 2036 WITH THE LIGHTS ON, BILLS PAID, ALLIES INTACT, AND THE RACE STILL RUNNING. Now look at which levers you had to pull — and when you had to pull them. That is the point.', at: '2036' }
        : { won: false, reason: 'You reached 2036, but something gave: grid, bills, allies, or the race. A managed decline is still a decline.', at: '2036' };
    }
    return null;
  }

  // ── UI
  function meter(label, v, invert) {
    const cls = v < 30 ? 'crit' : v < 55 ? 'warn' : '';
    return `<div class="ro"><div class="k">${label}</div><div class="v ${cls}">${Math.round(v)}</div><div class="d">/100</div></div>`;
  }

  function render() {
    const r = buildRun();
    const ev = evaluate(r);
    if (!state.over) state.over = checkEndings(ev);

    const mount = $('#operator-mount');
    const wx = state.weatherByYear[Math.floor(now()) + (now() % 1 > 0.75 ? 1 : 0)];
    mount.innerHTML = `
      <p class="op-note">Seed <b>#${state.seed}</b> — same seed, same winters (share it with your result).
      <b>Nobody has beaten 2030 yet.</b></p>
      <div class="panel" style="margin-top:12px">
        <div class="panel-hd">
          <span class="tick ${ev.sNow < 1400 ? 'crit' : ev.sNow < 2000 ? 'warn' : ''}">OP.${fmtQ(now()).replace(' ', '')}</span>
          STOR ${fmt(Math.round(ev.sNow))} BCF · HH $${ev.pxNow.toFixed(2)} · BILLS ${(ev.recentBills).toFixed(2)}×
          <span class="spacer"></span>
          <span style="color:var(--green)">PC ${state.pc.toFixed(1)}</span>
          <span class="lamp ${ev.sNow < 1400 ? 'crit' : ev.sNow < 2000 ? 'warn' : ''}"></span>
        </div>
        <div class="readouts">
          ${meter('GRID', ev.grid)}${meter('BILLS', ev.bills)}${meter('AI RACE', state.ai)}${meter('ALLIES', state.allies)}
        </div>
        <div class="alarm ${state.over && !state.over.won ? 'on' : ''}" style="display:${state.over ? 'block' : 'none'}">
          ${state.over ? (state.over.won ? '■ ' : '■ GAME OVER ' + state.over.at + ' — ') + state.over.reason : ''}
        </div>
        <div class="panel-bd chartbox"><canvas id="op-chart"></canvas><div class="chart-cap">Your run: storage (green, left) and Henry Hub (amber, right). Dimmed beyond NOW = current-policy projection. The band is real EIA history.</div></div>
        <div class="panel-bd" id="op-actions" style="padding-top:0"></div>
        <div class="panel-bd" style="display:flex;gap:10px;flex-wrap:wrap;padding-top:0">
          ${state.over
            ? `<button class="op-adv" id="op-restart">RESTART (NEW WINTERS)</button>
               <button class="op-adv" id="op-retry">RETRY SEED #${state.seed}</button>
               <button class="op-adv" id="op-share">COPY RESULT</button>`
            : `<button class="op-adv" id="op-next">ADVANCE QUARTER ▸</button>
               <button class="op-adv" id="op-year">ADVANCE YEAR ▸▸</button>`}
          <span class="footnote" id="op-log" style="align-self:center"></span>
        </div>
      </div>`;

    // actions grid
    const grid = $('#op-actions');
    const g = el('div', 'seg');
    g.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px';
    for (const a of ACTIONS) {
      const used = state.counts[a.id] || 0;
      const dead = state.over || used >= a.max || state.pc < a.cost;
      const b = el('button', null,
        `<div style="display:flex;justify-content:space-between"><b>${a.name}</b><span>${a.cost}PC</span></div>
         <div style="color:var(--ink-dim);font-size:11px;text-transform:none;letter-spacing:0;margin-top:3px">${a.desc}</div>
         <div style="color:var(--ink-faint);font-size:10.5px;margin-top:3px">${used}/${a.max}${a.lag ? ' · LAG ' + a.lag + 'Y' : ''}</div>`);
      b.style.cssText = 'text-align:left;padding:8px 10px;' + (dead ? 'opacity:.38;cursor:not-allowed' : '');
      if (!dead) b.onclick = () => act(a);
      g.appendChild(b);
    }
    grid.appendChild(g);

    // chart: storage + price dual, with NOW marker
    const G = { green: '#3dff9e', amber: '#ffb454', red: '#ff5c5c', dim: '#5b7284', faint: '#31424f' };
    const iNow = ev.iNow;
    const S1 = r.t.map((t, i) => [t, r.S[i]]).slice(0, iNow + 1);
    const S2 = r.t.map((t, i) => [t, r.S[i]]).slice(iNow);
    const P1 = r.t.map((t, i) => [t, r.price[i] * 100]).slice(0, iNow + 1); // scale price onto Bcf axis (100 Bcf = $1)
    const P2 = r.t.map((t, i) => [t, r.price[i] * 100]).slice(iNow);
    Charts.draw($('#op-chart'), {
      xDomain: [T0, T_END + 0.4], yDomain: [0, 4400], height: 240, yLabel: 'BCF · $/MMBTU×100',
      xTicks: [2027, 2029, 2031, 2033, 2035].map(v => ({ v, label: "'" + String(v).slice(2) })),
      yTicks: [0, 1000, 2000, 3000, 4000].map(v => ({ v, label: fmt(v) })),
      series: [
        { type: 'line', pts: S1, color: G.green, width: 2, glow: true },
        { type: 'line', pts: S2, color: G.green, width: 1, dash: [2, 4] },
        { type: 'line', pts: P1, color: G.amber, width: 1.6 },
        { type: 'line', pts: P2, color: G.amber, width: 1, dash: [2, 4] },
      ],
      guides: [
        { y: 824, color: G.red, label: 'RECORD LOW 824', dash: [2, 3] },
        { x: now(), color: G.faint, label: 'NOW', dash: [4, 3] },
      ],
    });

    if (state.over) {
      $('#op-restart').onclick = () => start((Math.random() * 1e9) | 0);
      $('#op-retry').onclick = () => start(state.seed);
      $('#op-share').onclick = () => {
        const txt = `DRAWDOWN/OPERATOR seed#${state.seed} — ${state.over.won ? 'SURVIVED TO 2036' : 'FELL ' + state.over.at} · GRID ${ev.grid} BILLS ${ev.bills} AI ${Math.round(state.ai)} ALLIES ${Math.round(state.allies)} — bpachter.github.io/drawdown/`;
        navigator.clipboard?.writeText(txt);
        $('#op-log').textContent = 'copied.';
      };
    } else {
      $('#op-next').onclick = () => advance(1);
      $('#op-year').onclick = () => advance(4);
    }
  }

  function act(a) {
    state.pc -= a.cost;
    state.counts[a.id] = (state.counts[a.id] || 0) + 1;
    if (a.aiHit) state.ai = Math.max(0, state.ai - a.aiHit);
    if (a.allyHit) state.allies = Math.max(0, state.allies - a.allyHit);
    if (a.id === 'breach') state.allowBreach = true;
    if (a.id === 'defer') state.lngDeferUntil = now() + (a.dur || 1);
    else state.fxQueue.push({ at: now() + a.lag, apply: a.apply });
    $('#op-log') && ($('#op-log').textContent = a.name + ' ordered — effective ' + fmtQ(now() + a.lag));
    render();
  }

  function advance(qs) {
    for (let i = 0; i < qs && !state.over; i++) {
      state.q++;
      state.pc = Math.min(12, state.pc + 1);
      state.allies = Math.min(100, state.allies + (state.lngDeferUntil >= now() ? 0 : 0.75));
      state.ai = Math.min(100, state.ai + 0.25);
      // draw next winter each Q4
      const yr = Math.floor(now());
      if (state.weatherByYear[yr + 1] === undefined) state.weatherByYear[yr + 1] = drawWeather(yr + 1);
      const r = buildRun();
      const ev = evaluate(r);
      state.over = checkEndings(ev);
    }
    render();
  }

  function start(seed) {
    state.seed = seed; state.rand = rng(seed);
    state.q = 0; state.pc = 8; state.counts = {}; state.fxQueue = [];
    state.allowBreach = false; state.ai = 100; state.allies = 100; state.over = null;
    state.lngDeferUntil = -1;
    state.weatherByYear = { 2026: 1.0, 2027: drawWeather(2027) };
    render();
  }

  const urlSeed = new URLSearchParams(location.search).get('seed');
  start(urlSeed ? +urlSeed : ((Math.random() * 1e9) | 0));
})();
