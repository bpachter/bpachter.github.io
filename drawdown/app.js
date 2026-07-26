/* DRAWDOWN v2 — terminal application shell: boot, router, modules, command bar.
   Modules: TERMINAL (dash) · BRIEF (documents) · MODEL (desk+method) · DATA (provenance).
   The OPERATOR game lives on its own page (operator.html). No dependencies. */
(() => {
  const $ = s => document.querySelector(s);
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };
  const fmt = (v, d = 0) => v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
  const fmtQ = yf => yf == null ? '—' : Math.floor(yf) + ' Q' + (Math.floor((yf - Math.floor(yf)) * 4) + 1);
  const yearFloat = iso => { const d = new Date(iso + 'T00:00:00Z'); return d.getUTCFullYear() + (d.getUTCMonth() + (d.getUTCDate() - 1) / 31) / 12; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const DATA = {};
  const G = { green: '#3dff9e', amber: '#ffb454', red: '#ff5c5c', cyan: '#53d8ff', dim: '#5b7284', faint: '#31424f' };
  let RUNS = null;                       // preset runs, computed once
  const deskState = {};                  // persists across module switches
  let deskInited = false, activePreset = 'CHRONOMETER';

  // ═══════════════════════════════ BOOT ═══════════════════════════════
  const BOOT_LINES = [
    ['init drawdown/2.0 — us natural gas balance terminal', ''],
    ['mount data/eia_history.json ………………', 'eia'],
    ['mount data/lng_projects.json ……………', 'lng'],
    ['mount data/datacenters.json ………………', 'dc'],
    ['mount data/price_episodes.json ……', 'px'],
    ['calibrate engine — spot $2.86/$2.80 · oct-26 3,970/3,966 · amp 1,943/1,944', 'CAL'],
    ['read forward curve ……………………………… <span class="warn">FLAT THROUGH 2030 — NOBODY IS PRICING THIS</span>', ''],
  ];

  async function loadJSON(path) {
    try { const r = await fetch(path); if (!r.ok) throw 0; return await r.json(); }
    catch { return null; }
  }

  async function boot() {
    const fast = sessionStorage.getItem('dd-booted');
    const lines = $('#bootlines');
    const step = fast ? 30 : 210;
    BOOT_LINES.forEach(([txt, key], i) => {
      const d = el('div', null, '&gt; ' + txt + (key && key !== 'CAL' ? ` <span class="ok" data-b="${key}">…</span>` : key === 'CAL' ? ' <span class="ok">OK</span>' : ''));
      d.style.animationDelay = (i * step / 1000) + 's';
      lines.appendChild(d);
    });

    const t0 = performance.now();
    const [eia, lng, dc, px] = await Promise.all([
      loadJSON('data/eia_history.json'), loadJSON('data/lng_projects.json'),
      loadJSON('data/datacenters.json'), loadJSON('data/price_episodes.json'),
    ]);
    Object.assign(DATA, { eia, lng, dc, px });
    for (const [k, v] of [['eia', eia], ['lng', lng], ['dc', dc], ['px', px]]) {
      const s = document.querySelector(`[data-b="${k}"]`);
      if (s) { s.textContent = v ? 'OK' : 'OFFLINE'; s.className = v ? 'ok' : 'warn'; }
    }

    RUNS = {
      CONSENSUS: ENGINE.run(ENGINE.PRESETS.CONSENSUS.levers),
      CHRONOMETER: ENGINE.run(ENGINE.PRESETS.CHRONOMETER.levers),
      P0: ENGINE.run(ENGINE.PRESETS.UNMITIGATED.levers),
    };

    $('#bootbar').style.width = '100%';
    const wait = Math.max(0, (fast ? 250 : BOOT_LINES.length * step + 500) - (performance.now() - t0));
    setTimeout(() => { $('#boot').classList.add('done'); sessionStorage.setItem('dd-booted', '1'); }, wait);

    buildTape(); startClock(); initCmd(); initKeys(); initPalette();
    window.addEventListener('hashchange', route);
    $('#brand').onclick = () => location.hash = '#/terminal';
    route();
    // re-seat the tab indicator once the webfonts have applied their metrics
    document.fonts?.ready?.then(() => Motion.tabIndicator());
  }

  function initPalette() {
    const go = h => () => { location.hash = h; };
    Motion.register([
      { k: 'TERMINAL', label: 'Market state dashboard', hint: 'F1', run: go('#/terminal') },
      { k: 'BRIEF', label: 'The argument in six documents', hint: 'F2', run: go('#/brief') },
      { k: 'MODEL', label: 'The desk — 13 levers, hood open', hint: 'F3', run: go('#/model') },
      { k: 'METHOD', label: 'Calibration vs reality', hint: '', run: go('#/model/method') },
      { k: 'DATA', label: 'Provenance ledgers', hint: 'F4', run: go('#/data') },
      { k: 'ATLAS', label: 'The system on a map', hint: 'F5', run: go('#/atlas') },
      { k: 'SITING', label: 'Score a gas-powered DC site', hint: '', run: go('#/atlas/siting') },
      { k: 'OPERATOR', label: 'Take the controls — the game', hint: 'F6 ↗', run: () => window.open('operator.html', '_blank') },
      ...BRIEFS.map((b, i) => ({ k: b.code, label: b.title, hint: 'brief ' + (i + 1), run: go('#/brief/' + (i + 1)) })),
      { k: 'PRESET', label: 'Load CRISIS/P0 scenario', hint: '', run: () => { applyPreset('UNMITIGATED'); deskInited = true; location.hash = '#/model'; route(); Motion.toast('CRISIS/P0 loaded', { tag: 'MODEL', kind: 'crit' }); } },
      { k: 'PRESET', label: 'Load base (Chronometer) scenario', hint: '', run: () => { applyPreset('CHRONOMETER'); deskInited = true; location.hash = '#/model'; route(); Motion.toast('Base scenario loaded', { tag: 'MODEL' }); } },
      { k: 'FERN', label: 'The $30.72 print', hint: '', run: () => Motion.toast('2026-01-23 — Winter Storm Fern: $30.72, the highest daily print ever, with storage in SURPLUS. Weather passes. Structure doesn\'t.', { tag: 'PX', kind: 'crit', ms: 8000 }) },
    ]);
    Motion.initPalette();
    $('#cmdPalBtn').onclick = () => Motion.showPalette();
  }

  // ═══════════════════════════════ CHROME ═══════════════════════════════
  function buildTape() {
    const cur = DATA.eia?.storage?.current, hh = DATA.eia?.henry_hub?.latest_spot;
    const q = [];
    if (hh) q.push(`<b>HH.SPOT</b> $${hh.value.toFixed(2)} <span class="dn">▼ asleep</span>`);
    if (cur) q.push(`<b>STOR.L48</b> ${fmt(cur.level_bcf)} BCF <span class="up">+${cur.surplus_to_five_year_avg_pct}% vs 5YR</span>`);
    q.push(`<b>LNG.FEEDGAS</b> ~18 BCF/D <span class="wn">→ 36 BY 2031 (FID'D)</span>`);
    q.push(`<b>DC.LOAD</b> ~31 GW <span class="wn">2030 RANGE 65–148 GW</span>`);
    q.push(`<b>HH.CAL28</b> ~$3.60 <span class="wn">FLAT STRIP — BRIEF 06</span>`);
    q.push(`<b>PROD.L48</b> 111 BCF/D <span class="up">+4/YR IN FLIGHT</span>`);
    q.push(`<b>MODEL.P50</b> BAND BREAK ${fmtQ(RUNS.CHRONOMETER.summary.breaksBandAt)} <span class="dn">■ ALARM</span>`);
    q.push(`<b>OPERATOR</b> NOBODY HAS BEATEN 2030 YET <span class="dn">F6</span>`);
    $('#tapeInner').innerHTML = q.map(s => `<span class="q">${s}</span>`).join('').repeat(2);
  }

  function startClock() {
    const tick = () => {
      const d = new Date();
      $('#clock').textContent = d.toISOString().slice(11, 19) + 'Z';
      $('#clockdate').textContent = d.toISOString().slice(0, 10) + ' UTC';
    };
    tick(); setInterval(tick, 1000);
  }

  // ═══════════════════════════════ ROUTER ═══════════════════════════════
  const MODULES = { terminal: renderTerminal, brief: renderBrief, model: renderModel, data: renderData, atlas: renderAtlas };

  function route() {
    const parts = (location.hash.replace(/^#\/?/, '') || 'terminal').split('/');
    const name = MODULES[parts[0]] ? parts[0] : 'terminal';
    document.querySelectorAll('.tab[data-route]').forEach(t => t.classList.toggle('on', t.dataset.route === name));
    Charts.reset();
    if (typeof Atlas !== 'undefined') Atlas.cleanup();
    const vp = $('#viewport');
    vp.innerHTML = ''; vp.scrollTop = 0;
    MODULES[name](parts[1]);
    Motion.tabIndicator();
    Motion.stagger(vp.querySelector('.module'));
    // route() rebuilds #viewport from scratch, so any live-Python cells in the
    // freshly rendered module are new nodes that embed.js has never seen. Its
    // own DOMContentLoaded pass fired long before boot() finished, so re-scan
    // here. upgradeCell() short-circuits on already-upgraded nodes.
    if (window.KernelEmbed) window.KernelEmbed.upgrade(vp);
  }

  function renderAtlas(sub) {
    const vp = $('#viewport');
    const m = el('div', 'module module-wide');
    m.innerHTML = `
      <div class="mod-hd"><h2><b>ATLAS</b> // THE SYSTEM ON A MAP</h2>
        <span class="mnote">basins → corridors → coast: the whole argument as geography · SITING scores your own campus</span></div>
      <div id="atlas-mount"></div>`;
    vp.appendChild(m);
    Atlas.render($('#atlas-mount'), sub);
  }

  function initKeys() {
    document.addEventListener('keydown', e => {
      if (e.key === '/' && document.activeElement !== $('#cmd') && document.activeElement !== $('#pal-input')) { e.preventDefault(); $('#cmd').focus(); }
      const fmap = { F1: 'terminal', F2: 'brief', F3: 'model', F4: 'data', F5: 'atlas' };
      if (fmap[e.key]) { e.preventDefault(); location.hash = '#/' + fmap[e.key]; }
      if (e.key === 'F6') { e.preventDefault(); window.open('operator.html', '_blank'); }
      if (e.key === 'Escape') { $('#cmdout').classList.remove('show'); $('#cmd').blur(); }
    });
  }

  // ═══════════════════════════════ TERMINAL (dash) ═══════════════════════════════
  const WIRE = [
    ['2026-07-20', 'MKT', 'ok', 'Henry Hub spot <b>$2.80</b> · storage 3,024 Bcf, <b>+6.4%</b> vs 5-yr avg. The market is comfortable.'],
    ['2026-07-14', 'FCT', 'warn', 'BNEF nearly doubles its 2035 US data-center forecast to <b>194 GW</b> — 12% of US electricity by 2030.'],
    ['2026-07-07', 'EIA', 'ok', 'STEO: 2026 production 111.25 Bcf/d, 2027 <b>115.3</b> (+4/yr already in flight) · Oct-26 storage peak projected 3,966.'],
    ['2026-06-03', 'LNG', 'warn', '<b>Delfin FLNG 1</b> takes FID — first US floating LNG. The 2025-26 FID wave keeps growing.'],
    ['2026-05-15', 'LNG', 'warn', '<b>Commonwealth LNG</b> FID (~1.2 Bcf/d). FID-only 2031 nameplate now ~33 Bcf/d.'],
    ['2026-03-30', 'LNG', 'ok', '<b>Golden Pass</b> ships first cargo. Ninth US export terminal online.'],
    ['2026-01-23', 'PX', 'crit', 'Winter Storm Fern: Henry Hub prints <b>$30.72</b> — highest daily price ever recorded — with storage in SURPLUS. January monthly avg $7.72.'],
    ['2025-10-01', 'LNG', 'warn', 'FID wave: <b>Rio Grande T4+T5</b>, <b>Port Arthur Ph2</b>, <b>CP2 Ph2</b> all sanctioned within 7 months.'],
    ['2025-Q3', 'PRD', 'dim', 'EQT reported shutting in gas, betting it is worth more later. Rig count flat. Nobody is drilling for 2028.'],
    ['MODEL', 'P50', 'crit', 'Base case: storage leaves the 5-yr band <b>~2028 Q1</b>, HH ~$12-14 by 2030 vs a $3.80 strip. See BRIEF 05/06.'],
  ];

  function renderTerminal() {
    const r = RUNS.CHRONOMETER, s = r.summary;
    const vp = $('#viewport');
    const m = el('div', 'module');
    m.innerHTML = `
      <div class="mod-hd"><h2><b>TERMINAL</b> // MARKET STATE</h2>
        <span class="mnote">the announced world, netted out — history is data, the future is the model (F3)</span></div>

      <div class="kpis">
        <div class="kpi"><span class="sevbar"></span><div class="k">HH SPOT</div><div class="v">$2.80</div><div class="d">2026-07-20 · asleep</div></div>
        <div class="kpi"><span class="sevbar"></span><div class="k">STOR L48</div><div class="v" id="kpi-stor">3,024</div><div class="d">Bcf · +6.4% vs 5-yr</div></div>
        <div class="kpi"><span class="sevbar warn"></span><div class="k">LNG FEEDGAS</div><div class="v warn">18→36</div><div class="d">Bcf/d by 2031, FID'd</div></div>
        <div class="kpi"><span class="sevbar warn"></span><div class="k">DC LOAD 2030</div><div class="v warn">65–148</div><div class="d">GW, published range</div></div>
        <div class="kpi"><span class="sevbar warn"></span><div class="k">CAL-28 STRIP</div><div class="v warn">$3.60</div><div class="d">flat — the misprice</div></div>
        <div class="kpi"><span class="sevbar crit"></span><div class="k">P50 BAND BREAK</div><div class="v crit">${fmtQ(s.breaksBandAt)}</div><div class="d">model, weather-normal</div></div>
      </div>

      <div class="grid2" style="margin-top:14px">
        <div class="panel span2">
          <div class="panel-hd"><span class="tick crit">STOR.L48</span> WORKING GAS vs 5-YR BAND — HISTORY + MODEL <span class="spacer"></span><span class="lamp crit"></span></div>
          <div class="panel-bd chartbox"><canvas id="t-stor"></canvas>
          <div class="chart-cap">EIA weekly actuals (green) and the real 2021–25 band, then the model: CONSENSUS (cyan) · BASE P50 (amber) · UNMITIGATED P0 (red). Full controls in MODEL (F3).</div></div>
        </div>

        <div class="panel">
          <div class="panel-hd"><span class="tick">BAL.LEDGER</span> SOURCES &amp; USES — TODAY vs 2030 ANNOUNCED <span class="spacer"></span><span class="lamp warn"></span></div>
          <table class="ledger">
            <thead><tr><th>FLOW</th><th class="r">2026</th><th class="r">2030E</th><th class="r">Δ BCF/D</th></tr></thead>
            <tbody>
              <tr class="rowbar"><td>DRY PRODUCTION <div class="sub">ceiling 128–132 (rock+steel)</div></td><td class="r">+111.5</td><td class="r">+128</td><td class="r num">+16.5</td></tr>
              <tr class="rowbar dim"><td>CANADA NET</td><td class="r">+5.8</td><td class="r">+5.8</td><td class="r">0</td></tr>
              <tr class="rowbar warn"><td>LNG FEEDGAS <div class="sub">FID-only, 20-yr SPAs</div></td><td class="r">−18.0</td><td class="r">−33.9</td><td class="r num warn">−15.9</td></tr>
              <tr class="rowbar crit"><td>DATA CENTERS, NEW GAS <div class="sub">P50 / P0 unmitigated</div></td><td class="r">−0.7</td><td class="r">−5.0 / −13</td><td class="r num crit">−4.3 / −13</td></tr>
              <tr class="rowbar warn"><td>MEXICO PIPELINE</td><td class="r">−6.6</td><td class="r">−7.3</td><td class="r">−0.7</td></tr>
              <tr class="rowbar dim"><td>SECTORS (RES/COM/IND/POWER/LEASE)</td><td class="r">−92.3</td><td class="r">−93.1</td><td class="r">−0.8</td></tr>
              <tr class="rowbar crit"><td><b>NET → STORAGE</b> <div class="sub">the ledger where it all lands</div></td><td class="r">≈ 0</td><td class="r num crit">−4.4 / −13</td><td class="r"><span class="chip crit">DRAW</span></td></tr>
            </tbody>
          </table>
          <div class="panel-bd footnote">Announced changes only — no speculative projects, supply given full credit. The imbalance is not a forecast; it is subtraction. DATA (F4) has every row's provenance.</div>
        </div>

        <div class="panel">
          <div class="panel-hd"><span class="tick">SYS.WIRE</span> THE WIRE — WHAT THE MARKET ALREADY KNOWS <span class="spacer"></span><span class="lamp"></span></div>
          <div id="wire"></div>
        </div>
      </div>

      <div class="navcards" style="margin-top:14px">
        <a class="navcard" href="#/brief"><div class="nk">F2 · BRIEF</div><div class="nt">Six documents, one argument</div><div class="nd">Abundance → commitments → ceiling → the pull → the draw → the misprice.</div></a>
        <a class="navcard" href="#/model"><div class="nk">F3 · MODEL</div><div class="nt">The desk — hood open</div><div class="nd">13 levers, 4 presets. Disagree with an assumption? Move it.</div></a>
        <a class="navcard" href="#/data"><div class="nk">F4 · DATA</div><div class="nt">Provenance ledgers</div><div class="nd">Every series, project list, forecast and episode — with sources.</div></a>
        <a class="navcard" href="#/atlas"><div class="nk">F5 · ATLAS</div><div class="nt">The system on a map</div><div class="nd">Basins, corridors, terminals, campuses — plus a click-to-score siting tool.</div></a>
        <a class="navcard op" href="operator.html" target="_blank" rel="noopener"><div class="nk">F6 · OPERATOR ↗</div><div class="nt">Take the controls</div><div class="nd">Run US energy policy 2026–2036. Quarterly turns, real lags. Nobody has beaten 2030 yet.</div></a>
      </div>`;
    vp.appendChild(m);

    const wire = $('#wire');
    for (const [dt, tag, sev, txt] of WIRE) {
      wire.appendChild(el('div', 'wire-item' + (sev === 'crit' ? ' hot' : ''),
        `<span class="wt">${dt}</span><span class="wtag"><span class="chip ${sev === 'dim' ? '' : sev}">${tag}</span></span><span class="wtxt">${txt}</span>`));
    }
    Charts.mount($('#t-stor'), () => Object.assign(specStorage(RUNS), { height: 280 }));
    Motion.tick($('#kpi-stor'), 3024);
  }

  // ═══════════════════════════════ CHART SPECS (shared) ═══════════════════════════════
  function specStorage(runs) {
    const storHist = (DATA.eia?.storage?.series || []).map(r => [yearFloat(r.date), r.value]);
    const band = DATA.eia?.storage?.five_year_band_2026 || [];
    const bandLo = [], bandHi = [];
    for (let y = 2018; y <= 2036; y++) band.forEach(w => {
      const t = y + (yearFloat(w.week) - 2026); if (t >= 2018 && t <= 2036.6) { bandLo.push([t, w.min]); bandHi.push([t, w.max]); }
    });
    bandLo.sort((a, b) => a[0] - b[0]); bandHi.sort((a, b) => a[0] - b[0]);
    const line = (run, color, dash) => ({ type: 'line', pts: run.t.map((t, i) => [t, run.S[i]]), color, dash, width: 1.6 });
    return {
      xDomain: [2022, 2036.6], yDomain: [0, 4400], yLabel: 'BCF',
      xTicks: [2022, 2024, 2026, 2028, 2030, 2032, 2034, 2036].map(v => ({ v, label: "'" + String(v).slice(2) })),
      yTicks: [0, 1000, 2000, 3000, 4000].map(v => ({ v, label: fmt(v) })),
      series: [
        { type: 'band', lo: bandLo, hi: bandHi, color: G.dim, alpha: 0.16 },
        { type: 'line', pts: storHist, color: G.green, width: 1.6, glow: true },
        line(runs.CONSENSUS, G.cyan, [6, 3]), line(runs.CHRONOMETER, G.amber, []), line(runs.P0, G.red, []),
      ],
      guides: [
        { y: 824, color: G.red, label: 'POST-2010 RECORD LOW — 824 (MAR 2014)', dash: [2, 3] },
        { x: 2026.55, color: G.faint, label: 'MODEL →', dash: [2, 4] },
      ],
      legend: [
        { label: 'EIA WEEKLY ACTUAL', color: G.green }, { label: 'CONSENSUS', color: G.cyan },
        { label: 'BASE (P50)', color: G.amber }, { label: 'UNMITIGATED (P0)', color: G.red },
      ],
    };
  }

  function specPrice(runs) {
    const fwd = DATA.eia?.henry_hub?.forward_curve || {};
    const fwdPts = Object.entries(fwd).filter(([k]) => !isNaN(+k)).map(([k, v]) => [+k + 0.5, v.value ?? v]);
    const line = (run, color, dash) => ({ type: 'line', pts: run.t.map((t, i) => [t, run.price[i]]), color, dash, width: 1.6 });
    return {
      xDomain: [2026, 2036.6], yDomain: [0, 40], yLabel: '$/MMBTU',
      xTicks: [2026, 2028, 2030, 2032, 2034, 2036].map(v => ({ v, label: "'" + String(v).slice(2) })),
      yTicks: [0, 10, 20, 30, 40].map(v => ({ v, label: '$' + v })),
      series: [line(runs.CONSENSUS, G.cyan, [6, 3]), line(runs.CHRONOMETER, G.amber, []), line(runs.P0, G.red, []),
        { type: 'line', pts: fwdPts, color: G.dim, dash: [2, 3], width: 2 }],
      guides: [
        { y: 9.0, color: G.faint, label: 'AUG-2022 SQUEEZE ~$9', dash: [2, 4] },
        { y: 3.6, color: G.dim, label: 'THE STRIP (what the market believes)', dash: [] },
      ],
      legend: [
        { label: 'CONSENSUS', color: G.cyan }, { label: 'BASE (P50)', color: G.amber },
        { label: 'UNMITIGATED (P0)', color: G.red }, { label: 'FORWARD STRIP', color: G.dim },
      ],
    };
  }

  function specProd() {
    const prodSeries = (DATA.eia?.dry_production?.series || []).map(r => [r.year + 0.5, r.value]);
    const r = RUNS.CHRONOMETER;
    return {
      xDomain: [2010, 2036], yDomain: [40, 140], yLabel: 'BCF/D',
      xTicks: [2010, 2015, 2020, 2025, 2030, 2035].map(v => ({ v, label: String(v) })),
      yTicks: [50, 75, 100, 125].map(v => ({ v, label: String(v) })),
      series: [
        { type: 'line', pts: prodSeries, color: G.green, glow: true, width: 2 },
        { type: 'line', pts: r.t.map((t, i) => [t, r.prod[i]]), color: G.green, dash: [3, 4], width: 1.4 },
      ],
      guides: [
        { y: 130, color: G.amber, label: 'MAX DELIVERABILITY ~128–132 (rock + steel)' },
        { x: 2026.55, color: G.faint, label: 'MODEL →', dash: [2, 4] },
      ],
    };
  }

  function specLNG() {
    const ramp = DATA.lng?.aggregate_ramp?.by_year_end || ENGINE.CALIB.lng.rampByYear;
    const rampPts = Object.entries(ramp).filter(([k]) => +k <= 2031).map(([k, v]) => [+k + 1, v]);
    const hist = [[2016, 0.5], [2018, 3], [2020, 8.9], [2022, 11.4], [2024, 13.5], ...rampPts];
    return {
      xDomain: [2016, 2032], yDomain: [0, 40], yLabel: 'BCF/D NAMEPLATE',
      xTicks: [2016, 2020, 2024, 2028, 2031].map(v => ({ v, label: String(v) })),
      yTicks: [0, 10, 20, 30, 40].map(v => ({ v, label: String(v) })),
      series: [
        { type: 'area', pts: hist, color: G.cyan, alpha: 0.2 },
        { type: 'line', pts: hist, color: G.cyan, glow: true, width: 2 },
      ],
      guides: [
        { y: 15.2, color: G.dim, label: 'END-2025 OPERATING', dash: [2, 4] },
        { x: 2026.55, color: G.faint, label: "FID'D, NOT BUILT →", dash: [2, 4] },
      ],
    };
  }

  function specDCFan() {
    const fc = { 2024: [192, 192, 192], 2026: [290, 320, 350], 2028: [420, 470, 560], 2030: [380, 649, 850] };
    const yrs = Object.keys(fc).map(Number);
    return {
      xDomain: [2024, 2031], yDomain: [0, 900], yLabel: 'TWH / YR',
      xTicks: yrs.map(v => ({ v, label: String(v) })),
      yTicks: [0, 300, 600, 900].map(v => ({ v, label: String(v) })),
      series: [
        { type: 'band', lo: yrs.map(y => [y, fc[y][0]]), hi: yrs.map(y => [y, fc[y][2]]), color: G.amber, alpha: 0.18 },
        { type: 'line', pts: yrs.map(y => [y, fc[y][1]]), color: G.amber, glow: true, width: 2 },
      ],
      guides: [{ y: 192, color: G.dim, label: '2024 ACTUAL — 4.7% OF US ELECTRICITY', dash: [2, 4] }],
      legend: [{ label: 'FORECAST RANGE (IEA·EPRI·LBNL·McK·GS·BNEF)', color: G.amber }],
    };
  }

  // ═══════════════════════════════ BRIEF ═══════════════════════════════
  const BRIEFS = [
    {
      code: 'DD-BRIEF-01', title: 'Abundance', kicker: 'CH.01 — HOW THE MARKET LEARNED THE WRONG LESSON',
      src: 'EIA NATURAL GAS MONTHLY', chart: specProd,
      cap: 'US dry production, annual (EIA) — dashed: model path, base scenario. The ceiling is the thesis-range maximum deliverability; move it in MODEL.',
      body: `
        <p>In 2010 the United States produced <span class="num">58.4 Bcf/d</span> of dry natural gas.
        By 2025: <span class="num">107.65</span>. Shale didn't just grow supply — it nearly doubled it,
        and it held Henry Hub in a $2–4 band for most of fifteen years. Cheap, abundant, boring.</p>
        <p>Every institution in this market — every utility resource plan, every LNG contract, every
        data-center pro forma — was underwritten during that regime. Abundance stopped being an
        observation and became an assumption.</p>
        <p class="dim">Spot today: $2.80. Storage is <span class="num">+6.4%</span> above its five-year
        average. The market feels fine. That is precisely the setup.</p>`,
    },
    {
      code: 'DD-BRIEF-02', title: 'The Commitments', kicker: 'CH.02 — THE DIE WAS CAST BEFORE AI SHOWED UP',
      src: '28 PROJECTS · 24 SOURCES · FID-ONLY', chart: specLNG,
      cap: 'US LNG nameplate at year-end, operating + under-construction + FID only — no speculative projects. Feedgas runs ~10% above nameplate.',
      body: `
        <p>LNG exports were <span class="num">0.51 Bcf/d</span> in 2016. In 2025 they averaged
        <span class="num">15.09</span>. And the buildout is not a forecast — it is signed: counting only
        projects operating, under construction, or past final investment decision, US nameplate reaches
        <span class="num">~33 Bcf/d by 2031</span> — roughly <span class="num">36 Bcf/d</span> of feedgas
        once liquefaction fuel is counted.</p>
        <p>These are 20-year sale-and-purchase agreements with project finance attached, sold to allies
        who tore out Russian supply on the promise of ours. Golden Pass, Plaquemines, Corpus Christi
        Stage 3, Port Arthur, Rio Grande, CP2 — the 2025–26 FID wave alone added more capacity than the
        entire system had in 2019.</p>
        <p class="big">You cannot un-sign a 20-year SPA. About one in every three molecules of
        incremental US supply this decade is already spoken for by someone overseas.</p>`,
    },
    {
      code: 'DD-BRIEF-03', title: 'The Ceiling', kicker: 'CH.03 — SUPPLY IS ROCK, STEEL, AND PERMITS',
      src: 'EIA STEO · FERC · FIELD EXPERIENCE', chart: null,
      body: `
        <p>The rock is not the immediate constraint — the steel is. Gas has to be gathered, processed to
        pipeline spec, and moved. Processing plants take two to three years. Gathering has to be financed
        now for wells that flow in 2028. And the country has built essentially <span class="num">one</span>
        greenfield interstate gas pipeline in a decade (Mountain Valley), because permitting made the
        category nearly unbuildable.</p>
        <p>Producers are already growing as fast as their sanctioned infrastructure allows: about
        <span class="num">+4 Bcf/d per year</span> is in flight through 2027 (EIA STEO: 111 → 115 Bcf/d).
        The model gives supply every benefit of that momentum — and then a ceiling: known basins, known
        midstream, roughly <span class="num">128–132 Bcf/d</span> of maximum deliverability by the early
        2030s. Beyond that, growth needs price signals <em>years</em> before the molecules arrive. This
        is the same physics I work on in transmission interconnection: the queue is not a formality —
        it <em>is</em> the timeline.</p>
        <p class="big warn">Supply can grow ~20 Bcf/d this decade. The commitments in BRIEF-02 grow ~21 —
        before a single new AI data center is plugged in.</p>`,
    },
    {
      code: 'DD-BRIEF-04', title: 'The Pull', kicker: 'CH.04 — NOW ADD THE DATA CENTERS',
      src: 'LBNL · EPRI · IEA · GS · BNEF · 10 SOURCES', chart: specDCFan,
      cap: 'US data-center electricity consumption: 2024 actual and the span of published 2030 forecasts. Center line: LBNL Reference Case.',
      body: `
        <p>US data centers consumed <span class="num">192 TWh</span> in 2024 — 4.7% of all US electricity
        (LBNL/DOE). Published 2030 forecasts span <span class="num">380–850 TWh</span> and
        <span class="num">65–148 GW</span> — the disagreement itself is the story. The grid can't
        interconnect that fast, so developers bring their own generation, and almost all of it burns gas:
        turbines, recip gensets, fuel cells.</p>
        <p>The conversion is mechanical: a gigawatt of 24/7 load at new-CCGT heat rates burns about
        <span class="num">150 MMcf/d</span> (Homer City's own disclosure: 665,000 MMBtu/day for a 4.4 GW
        campus — same number). Published estimates of incremental data-center gas demand cluster at
        <span class="num">3–6 Bcf/d by 2030</span>. Count every announced behind-the-meter project and
        probability-weight nothing, and the pull runs to <span class="num crit">12–15 Bcf/d</span> by the
        early 2030s.</p>
        <p class="dim">The model's P50 path lands at 5 Bcf/d by 2030 — the center of the published range,
        and, not coincidentally, the number in the thesis that provoked this terminal.</p>

    <p class="kc-intro">The conversion from gigawatts of compute to Bcf/d of gas is the hinge of this whole chapter, and it is short enough to check by hand. This does it with the model's own constants, measures the answer against Homer City's disclosed <b>665,000 MMBtu/day</b>, and then divides the two published 2030 ranges into each other. What falls out is a load factor — the 380–850 TWh span and the 65–148 GW span turn out to be one range in two units, which unifies the <em>units</em> of the disagreement without settling the disagreement itself.</p>
    <div data-kernel-cell data-title="one gigawatt, converted to gas">
    <script type="text/x-python">
# A gigawatt of data center, converted to gas. This is the hinge of the whole
# argument, and it is one line of arithmetic -- so here it is, checked against
# a real filing rather than asserted.
HEAT_RATE = 6.5      # MMBtu/MWh, new H-class CCGT / large recip fleet (engine.js)
BTU_PER_CF = 1037    # Btu per cubic foot, EIA pipeline-quality gas

def gw_to_mmcfd(gw, heat_rate=HEAT_RATE, btu_per_cf=BTU_PER_CF):
    mmbtu_day = gw * 1000 * 24 * heat_rate       # MW -> MWh/day -> MMBtu/day
    return mmbtu_day * 1e6 / btu_per_cf / 1e6    # -> cf/day -> MMcf/d

print(f"1 GW running 24/7 at {HEAT_RATE} MMBtu/MWh  =  {gw_to_mmcfd(1):.1f} MMcf/d")
print()

# Reality check: Homer City Redevelopment's own air-permit disclosure.
HOMER_MMBTU_DAY, HOMER_GW = 665_000, 4.4
implied_hr = HOMER_MMBTU_DAY / (HOMER_GW * 24 * 1000)
implied_mmcfd = HOMER_MMBTU_DAY / HOMER_GW * 1e6 / BTU_PER_CF / 1e6
print("HOMER CITY, 4.4 GW campus, 665,000 MMBtu/day disclosed")
print(f"  implied heat rate     {implied_hr:.2f} MMBtu/MWh   (model uses {HEAT_RATE})")
print(f"  implied gas per GW    {implied_mmcfd:.1f} MMcf/d      (model says {gw_to_mmcfd(1):.1f})")
print(f"  the model runs {gw_to_mmcfd(1) / implied_mmcfd - 1:+.1%} hot. Call it the same number.")
print()

# The 380-850 TWh range and the 65-148 GW range are quoted as if they were two
# separate disagreements. Divide one into the other: 1 GW of AVERAGE load is
# 8.766 TWh/yr, so what falls out is the load factor behind each endpoint.
TWH_PER_GW_YEAR = 8.766
print("PUBLISHED 2030 DATA-CENTER FORECASTS -- two ranges, or one?")
for twh, gw in ((380, 65), (850, 148)):
    avg_gw = twh / TWH_PER_GW_YEAR
    print(f"  {twh:3d} TWh/yr = {avg_gw:5.1f} GW average   vs {gw:3d} GW installed"
          f"   -> load factor {avg_gw / gw:.0%}")
print("  ~66% utilization at both ends: the TWh span and the GW span are one")
print("  range stated in two units, not two competing claims. What they do")
print(f"  not settle is the spread inside it -- {850 / 380:.1f}x from 380 to 850 TWh,")
print("  and that spread is the disagreement the chapter is pointing at.")
print("  (pairing 380 with 65 and 850 with 148 is an assumption: both spans")
print("  are drawn across ~10 houses, not quoted as a pair by any one of them.)")
print()

# And the model's own path, so the 5 Bcf/d headline is not taken on trust.
# gasGWByYear is cumulative NEW gas-served GW of AVERAGE load, not nameplate
# -- engine.js:59 sets baseGW = 31 as "avg US DC load 2025" -- so the 24/7
# conversion above is the right treatment and the 66% load factor is already
# inside the number rather than a correction still owed. At nameplate the P50
# would be 3.3 Bcf/d instead of 5.0, which spans the whole published range.
GAS_GW_2030 = 33          # cumulative NEW gas-served GW, P50 (engine.js)
print("MODEL PATH -- average-load GW, so the 24/7 conversion is the right one")
for label, scale in (("P50", 1.0), ("P30", 1.8), ("P0", 2.7)):
    bcfd = gw_to_mmcfd(GAS_GW_2030 * scale) / 1000
    print(f"  {label:<3} {GAS_GW_2030 * scale:5.1f} gas-served GW by 2030  ->  {bcfd:5.2f} Bcf/d")
print("  published range for incremental DC gas demand in 2030: 3-6 Bcf/d")
print("  count every announced behind-the-meter project instead: 12-15 Bcf/d")
    </script>
    </div>`,
    },
    {
      code: 'DD-BRIEF-05', title: 'The Draw', kicker: 'CH.05 — STORAGE LEAVES THE HISTORICAL RECORD',
      src: 'EIA WNGSR + MODEL', chart: () => specStorage(RUNS),
      cap: 'Lower-48 working gas: EIA weekly actuals + 5-yr band (real), then model trajectories. Weather-normal — a 2021-style winter sits on top of whatever this shows.',
      body: `
        <p>Working gas in storage is the ledger where all of the above nets out — about
        <span class="num">4,280 Bcf</span> of demonstrated capacity, cycled every year: inject
        April–October, draw November–March. Today it holds 3,024 Bcf, comfortably above average.
        Everything in BRIEF-01 through 04 is history. Here is where the model takes over.</p>
        <p class="big crit">Run the announced world forward — FID'd LNG, the P50 data-center path, supply
        given full credit — and storage leaves the bottom of its five-year band around
        <span class="num crit">2028 Q1</span>. The modern record low is 824 Bcf (March 2014). The
        unmitigated path goes looking for it.</p>
        <p class="dim">The chart is the model's live output under three scenarios. The shaded band is real
        EIA weekly history, 2021–2025. Everything right of the seam is arithmetic, not prophecy — and the
        arithmetic is yours to change in MODEL (F3).</p>

    <p class="kc-intro">The imbalance is not a forecast; it is subtraction, so here is the subtraction. The cell takes the sources-and-uses rows straight off the TERMINAL ledger, nets them — and reconciles its own total against the one the panel prints — then carries the gap forward against a seasonal swing measured off the real five-year band. What it shows at the end is why the model does not actually fall through the floor: the balance does not close on molecules, and the price at which it does close is arrived at from the supply side alone.</p>
    <div data-kernel-cell data-title="the ledger, as subtraction">
    <script type="text/x-python">
# The sources-and-uses ledger, run as arithmetic instead of read as a table.
# Every row is an announced flow: EIA STEO production, the FID'd-only LNG
# schedule, published data-center estimates. Supply is given full credit.
#                        2026    2030 P50   2030 P0
LEDGER = [
    ("dry production",    111.5,    128.0,    128.0),
    ("canada net",          5.8,      5.8,      5.8),
    ("lng feedgas",       -18.0,    -33.9,    -33.9),
    ("data centers, new",  -0.7,     -5.0,    -13.0),
    ("mexico pipeline",    -6.6,     -7.3,     -7.3),
    ("res/com/ind/pwr",   -92.3,    -93.1,    -93.1),
]

w = max(len(r[0]) for r in LEDGER)
print(f"{'FLOW':<{w}}  {'2026':>9} {'2030 P50':>9} {'2030 P0':>9}   {'DELTA':>8}")
for name, a, b, c in LEDGER:
    print(f"{name:<{w}}  {a:>+9.1f} {b:>+9.1f} {c:>+9.1f}   {b - a:>+8.1f}")
net26 = sum(r[1] for r in LEDGER)
net50 = sum(r[2] for r in LEDGER)
net0 = sum(r[3] for r in LEDGER)
print("-" * (w + 42))
print(f"{'NET TO STORAGE':<{w}}  {net26:>+9.1f} {net50:>+9.1f} {net0:>+9.1f}   Bcf/d")
print()
print("the TERMINAL panel prints -4.4 on its own P50 NET row. The six rows")
print(f"above it sum to {net50:.1f}, and this cell uses the sum -- so read every")
print(f"number below as {net50 / -4.4 - 1:.0%} heavier than that panel implies.")
print()
print(f"today the ledger nets to {net26:+.1f} Bcf/d -- balanced, which is why it feels fine.")
print(f"2030 P50 nets to {net50:+.1f} Bcf/d. Over a year that is {net50 * 365:,.0f} Bcf,")
print("against a system with 4,280 Bcf of demonstrated working-gas capacity.")
print()

# Reduced form: carry the annual storage peak forward; the winter trough sits
# one seasonal swing below it. The swing is measured off the real 2021-25
# five-year band (engine.js avgByMonth), not assumed.
OCT_MEAN, NOV_MEAN, MAR_MEAN = 3599, 3776, 1832
FULL_SWING = NOV_MEAN - MAR_MEAN     # the band's own peak-to-trough amplitude
OCT_SWING = OCT_MEAN - MAR_MEAN      # like-for-like off an October level
BAND_MIN_MAR = 1431      # lowest March in the 2021-25 band
RECORD_LOW = 824         # 2014-03-28, the post-2010 record
peak = 3970.0            # model Oct-2026 peak; EIA STEO says 3,966

print(f"band swing Nov {NOV_MEAN:,} -> Mar {MAR_MEAN:,} = {FULL_SWING:,} Bcf, which is the")
print("seasonal amplitude the calibration table quotes (model 1,943 vs 1,944).")
print("but that band peaks in November, not October, and the peak below is")
print("seeded at an October level -- so the like-for-like swing is Oct")
print(f"{OCT_MEAN:,} -> Mar {MAR_MEAN:,} = {OCT_SWING:,} Bcf. That is the one used here.")
print()
print("NO PRICE RESPONSE, NO DEMAND DESTRUCTION, NO CURTAILMENT -- just")
print("subtraction, with the gap ramped linearly from today (mid-2026) to its")
print("2030 P50 value and read at the midpoint of each Oct-to-Oct year.")
print(f"  {'SEASON':<9} {'NET Bcf/d':>10} {'OCT PEAK':>10} {'MAR TROUGH':>12}")
net = net26
for yr in range(2027, 2033):
    net = net26 + (net50 - net26) * min((yr + 0.25 - 2026.5) / 4.0, 1.0)
    peak += net * 365
    trough = peak - OCT_SWING
    tag = ""
    if trough < RECORD_LOW:
        tag = "  past the 824 record"
    elif trough < BAND_MIN_MAR:
        tag = "  outside the 5-yr band"
    print(f"  {yr}-{str(yr + 1)[2:]:<4} {net:>10.2f} {peak:>10,.0f} {trough:>12,.0f}{tag}")
    if trough < RECORD_LOW:
        print(f"  the arithmetic stops here: {RECORD_LOW} Bcf is the post-2010")
        print("  record low, and below it the system stops being able to")
        print("  deliver on peak days.")
        break
print("  and that is the kind version: each trough is an October peak minus")
print(f"  the band swing, without the {abs(net) * 151:,.0f} Bcf of structural deficit that")
print("  accrues across the five months in between.")
print()

# So why does the full engine not fall through the floor on this schedule?
# Because it lets price close the balance. Three feedbacks, all in engine.js:
#   demand destruction:  3% of (industrial + power)/2 per dollar of HH over 6
#   spot LNG curtailment: 15% of feedgas stops lifting, phased in 8 to 12
#   producer response:   above the 3.75 incentive price supply climbs toward
#                        the 130 Bcf/d deliverability ceiling -- but the
#                        ledger already books 2030 production at 128.0, so
#                        the headroom left to buy is 2.0 Bcf/d and no more.
PROD_CEILING, PROD_2030, INCENTIVE = 130.0, 128.0, 3.75
HEADROOM = PROD_CEILING - PROD_2030

def closes(hh, with_supply=True):
    shave = 0.03 * max(hh - 6, 0) * (23.6 + 35.8) / 2
    curtail = 0.15 * 33.9 * min(max((hh - 8) / 4, 0), 1)
    supply = HEADROOM * min(max((hh - INCENTIVE) / 2, 0), 1) if with_supply else 0
    return shave + curtail + supply

def clearing_price(gap, with_supply=True):
    lo, hi = 3.0, 60.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if closes(mid, with_supply) < gap:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2

print("THE BALANCE DOES NOT CLOSE ON MOLECULES. IT CLOSES ON PRICE.")
for label, gap in (("P50", -net50), ("P0", -net0)):
    hh = clearing_price(gap)
    bare = clearing_price(gap, False)
    print(f"  {label + ':':<4} a {gap:4.1f} Bcf/d gap clears near {hh:5.2f} USD/MMBtu")
    print(f"       demand response alone would need {bare:5.2f}; the last "
          f"{HEADROOM:.1f} Bcf/d")
    print(f"       of drilling headroom takes {bare - hh:.2f} off that.")
print("  the Cal-28 forward strip:  3.60 USD/MMBtu, flat")
print()
print("that is the price that stops the bleeding at the margin, not the price")
print("the model prints in 2030 -- the engine's price answers to the storage")
print("level it has already lost by then, so it runs higher still.")
    </script>
    </div>`,
    },
    {
      code: 'DD-BRIEF-06', title: 'The Misprice', kicker: 'CH.06 — THE CURVE IS FLAT. THE BALANCE IS NOT.',
      src: 'NYMEX · STEO · EPISODE FITS', chart: () => specPrice(RUNS),
      cap: 'Modeled Henry Hub (monthly, weather-normal) vs the public forward strip (Jul 2026; 2028+ indicative). Convexity fitted to 2014 / 2021 / 2022 episodes.',
      body: `
        <p>Against all of that, the market's own forecast — the futures strip — is
        <span class="num">$3.41</span> for calendar 2027 and roughly <span class="num">$3.60–3.80</span>
        as far out as anyone will quote. Flat. The market is pricing the announced world as if the
        announced world doesn't add up — because '28 is illiquid, because fifteen years of abundance
        trained everyone to fade tightness, and because nobody is paid to hedge a problem two bonus
        cycles away.</p>
        <p>The model's price response is fitted to what actually happens when storage runs short — 2014's
        polar vortex, Uri, the 2022 export squeeze. The relationship is convex: the first 10% of deficit
        is an inconvenience; the last 10% is an auction. Ask anyone who was short DRAM in 2024: slowly at
        first, then all at once.</p>
        <p class="dim">A preview of the auction: this January — Winter Storm Fern — Henry Hub printed
        <span class="num crit">$30.72</span>, the highest daily price ever recorded, with storage in
        <em>surplus</em>. That was weather, and it passed in two weeks. Every scenario in this terminal
        is structural. It does not pass.</p>
        <p>And this is where it lands on compute. At today's strip, energy is roughly
        <span class="num">10%</span> of a hyperscaler's cost of compute. The base scenario's marginal
        power price puts it above <span class="num warn">20%</span> by 2030; the unmitigated path pushes
        toward <span class="num crit">35–50%</span>. When your second-largest cost line triples, you stop
        buying chips on performance and start buying them on <em>performance per watt</em>. Efficiency
        stops being an engineering virtue and becomes the business model.</p>
        <p class="big warn">The forward curve says none of this happens. The storage ledger says it starts
        in about eighteen months. One of them is wrong, and only one of them is arithmetic.</p>`,
    },
    {
      code: 'DD-ANNEX-A', title: 'Method & Provenance', kicker: 'ANNEX — HOW THIS TERMINAL WAS BUILT',
      src: 'ENGINE.JS · DATA/', chart: null,
      body: `
        <p>DRAWDOWN is an independent monthly balance model, Jul 2026 → 2036, built and calibrated
        against public data. It is not the Chronometer Partners model: their thesis (Invest Like the
        Best, 2026) provoked this terminal and appears as one labeled preset, but every load-bearing
        number here traces to EIA, FERC filings, or cited publications.</p>
        <p>Calibration anchors: model spot <span class="num">$2.86</span> vs actual $2.80 · model Oct-26
        storage peak <span class="num">3,970</span> vs EIA's 3,966 · seasonal amplitude
        <span class="num">1,943</span> vs the real band's 1,944 Bcf · price convexity fitted to the
        episode record (empirical P ≈ 4.15·e<sup>−1.95·dev</sup>, deficit side ~50% steeper).</p>
        <p>Known simplifications: weather-normal (real winters draw harder); national single-node balance
        (no regional basis); production responds to spot with a lag rather than to forwards. Each one is
        conservative in the direction that makes the problem look <em>smaller</em>.</p>
        <p class="dim">Full method: MODEL → METHOD tab. Full provenance: DATA (F4). Engine source:
        <a href="engine.js">engine.js</a>. Not investment advice; sector discussion describes market
        structure, not securities recommendations.</p>`,
    },
  ];

  function renderBrief(sub) {
    const idx = Math.min(Math.max((parseInt(sub) || 1) - 1, 0), BRIEFS.length - 1);
    const b = BRIEFS[idx];
    const vp = $('#viewport');
    const m = el('div', 'module module-wide');
    m.innerHTML = `
      <div class="mod-hd"><h2><b>BRIEF</b> // THE ARGUMENT IN ${BRIEFS.length - 1} DOCUMENTS + ANNEX</h2>
        <span class="mnote">read in order — each file is one link in the chain</span></div>
      <div class="brief-grid">
        <div class="panel brief-index">
          <div class="panel-hd"><span class="tick">DD.INDEX</span> FILES</div>
          <div id="brief-list"></div>
        </div>
        <div class="panel">
          <div class="panel-hd"><span class="tick ${idx >= 4 ? 'crit' : idx >= 2 ? 'warn' : ''}">${b.code}</span> ${b.title.toUpperCase()}
            <span class="spacer"></span><span class="lamp ${idx >= 4 ? 'crit' : idx >= 2 ? 'warn' : ''}"></span></div>
          <div class="panel-bd doc">
            <div class="doc-meta"><span>${b.code}</span><span>REV B</span><span>2026-07-23</span><span>SRC: ${b.src}</span></div>
            <div class="kicker">${b.kicker}</div>
            <h3>${b.title}</h3>
            ${b.body}
            ${b.chart ? `<div class="panel" style="margin-top:14px"><div class="panel-bd chartbox"><canvas id="brief-chart"></canvas><div class="chart-cap">${b.cap || ''}</div></div></div>` : ''}
            <div class="doc-nav">
              <button id="b-prev" ${idx === 0 ? 'disabled style="opacity:.3"' : ''}>◂ ${idx > 0 ? BRIEFS[idx - 1].code : ''}</button>
              <button id="b-next" ${idx === BRIEFS.length - 1 ? 'disabled style="opacity:.3"' : ''}>${idx < BRIEFS.length - 1 ? BRIEFS[idx + 1].code : ''} ▸</button>
            </div>
          </div>
        </div>
      </div>`;
    vp.appendChild(m);

    const list = $('#brief-list');
    BRIEFS.forEach((bb, i) => {
      const row = el('button', 'brief-row' + (i === idx ? ' on' : ''),
        `<span class="bno">${String(i + 1).padStart(2, '0')}</span><span>${bb.title}</span>`);
      row.onclick = () => location.hash = '#/brief/' + (i + 1);
      list.appendChild(row);
    });
    if (idx > 0) $('#b-prev').onclick = () => location.hash = '#/brief/' + idx;
    if (idx < BRIEFS.length - 1) $('#b-next').onclick = () => location.hash = '#/brief/' + (idx + 2);
    if (b.chart) Charts.mount($('#brief-chart'), () => Object.assign(b.chart(), { height: 300 }));
  }

  // ═══════════════════════════════ MODEL (desk + method) ═══════════════════════════════
  const LEVERS = [
    { id: 'dcPath', type: 'seg', label: 'DC BUILDOUT PATH', opts: ['P50', 'P30', 'P0'], def: 'P50',
      hint: 'P50 = credible/contracted (~5 Bcf/d gas by 2030). P0 = everything announced (~13).' },
    { id: 'dcGasShare', type: 'range', label: 'DC GAS SHARE', min: 0, max: 1.5, step: 0.05, def: 1.0, fmt: v => Math.round(v * 100) + '%',
      hint: 'How much of the DC path burns gas vs solar+storage / nuclear / grid.' },
    { id: 'perfWattGain', type: 'range', label: 'PERF-PER-WATT GAIN /YR', min: 0, max: 0.25, step: 0.01, def: 0, fmt: v => Math.round(v * 100) + '%',
      hint: 'Chip + system efficiency compounding against load growth.' },
    { id: 'lngScale', type: 'range', label: 'LNG BUILD-OUT (POST-26)', min: 0, max: 1.2, step: 0.05, def: 1.0, fmt: v => Math.round(v * 100) + '%' },
    { id: 'lngDelayMonths', type: 'range', label: 'LNG SLIP', min: 0, max: 24, step: 3, def: 0, fmt: v => v + ' MO' },
    { id: 'allowSpotCurtail', type: 'seg', label: 'SPOT CARGO CURTAIL >$8', opts: [true, false], names: ['ON', 'OFF'], def: true },
    { id: 'allowBreach', type: 'seg', label: 'BREACH CONTRACTS >$16', opts: [false, true], names: ['NEVER', 'FORCED'], def: false,
      hint: 'Political force majeure. Watch price — and imagine the allies.' },
    { id: 'prodMax', type: 'range', label: 'MAX DELIVERABILITY', min: 124, max: 138, step: 1, def: 130, fmt: v => v + ' BCF/D' },
    { id: 'prodBuildRate', type: 'range', label: 'MIDSTREAM BUILD RATE', min: 2, max: 7, step: 0.5, def: 4, fmt: v => '+' + v + '/YR' },
    { id: 'canadaPipeBcfd', type: 'range', label: 'NEW CANADA PIPE (2029+)', min: 0, max: 2, step: 0.25, def: 0, fmt: v => '+' + v.toFixed(2) },
    { id: 'nuclearGW2033', type: 'range', label: 'AP1000s ONLINE 2033+', min: 0, max: 12, step: 1, def: 0, fmt: v => v + ' GW' },
    { id: 'resiSolarShave', type: 'range', label: 'RESI SOLAR SHAVE BY 2030', min: 0, max: 3, step: 0.25, def: 0, fmt: v => '−' + v.toFixed(2) + ' BCF/D' },
    { id: 'weather', type: 'seg', label: 'WEATHER', opts: [0.94, 1.0, 1.06], names: ['MILD', 'NORMAL', 'SEVERE'], def: 1.0 },
  ];

  function applyPreset(key) {
    activePreset = key;
    const preset = ENGINE.PRESETS[key].levers;
    for (const L of LEVERS) deskState[L.id] = (L.id in preset) ? preset[L.id] : L.def;
  }

  function renderModel(sub) {
    if (!deskInited) { applyPreset('CHRONOMETER'); deskInited = true; }
    const tab = sub === 'method' ? 'method' : 'desk';
    const vp = $('#viewport');
    const m = el('div', 'module module-wide');
    m.innerHTML = `
      <div class="mod-hd"><h2><b>MODEL</b> // THE DESK</h2>
        <span class="mnote">the same engine behind every chart in this terminal — hood open</span></div>
      <div class="subtabs">
        <button class="subtab ${tab === 'desk' ? 'on' : ''}" data-sub="desk">DESK</button>
        <button class="subtab ${tab === 'method' ? 'on' : ''}" data-sub="method">METHOD &amp; CALIBRATION</button>
      </div>
      <div id="model-body"></div>`;
    vp.appendChild(m);
    m.querySelectorAll('.subtab').forEach(b => b.onclick = () => location.hash = '#/model/' + b.dataset.sub);
    (tab === 'desk' ? renderDesk : renderMethod)($('#model-body'));
  }

  function renderDesk(mount) {
    mount.innerHTML = `
      <div class="desk-grid">
        <div class="desk-left">
          <div class="presets" id="presets"></div>
          <div id="levers"></div>
        </div>
        <div class="desk-right">
          <div class="alarm" id="alarm"></div>
          <div class="readouts" id="readouts"></div>
          <div class="panel-bd chartbox"><canvas id="chart-desk"></canvas><div class="chart-cap" id="cap-desk"></div></div>
          <div class="panel-bd chartbox" style="padding-top:0"><canvas id="chart-desk2"></canvas><div class="chart-cap" id="cap-desk2"></div></div>
        </div>
      </div>`;

    const p = $('#presets');
    Object.entries(ENGINE.PRESETS).forEach(([key, def]) => {
      const b = el('button', null, def.label);
      b.dataset.preset = key;
      b.onclick = () => { applyPreset(key); syncDeskUI(); renderDeskRun(); };
      p.appendChild(b);
    });

    const wrap = $('#levers');
    for (const L of LEVERS) {
      const box = el('div', 'lever');
      box.appendChild(el('label', null, `<span>${L.label}</span><span class="val" data-val="${L.id}"></span>`));
      if (L.type === 'range') {
        const inp = document.createElement('input');
        inp.type = 'range'; inp.min = L.min; inp.max = L.max; inp.step = L.step; inp.value = deskState[L.id];
        inp.dataset.lever = L.id;
        inp.oninput = () => { deskState[L.id] = +inp.value; markCustom(); renderDeskRun(); };
        box.appendChild(inp);
      } else {
        const seg = el('div', 'seg');
        L.opts.forEach((opt, i) => {
          const b = el('button', null, (L.names || L.opts)[i]);
          b.dataset.opt = String(opt);
          b.onclick = () => { deskState[L.id] = opt; markCustom(); syncDeskUI(); renderDeskRun(); };
          seg.appendChild(b);
        });
        box.appendChild(seg);
      }
      if (L.hint) box.appendChild(el('div', 'footnote', L.hint));
      wrap.appendChild(box);
    }
    syncDeskUI();
    renderDeskRun();
  }

  function markCustom() {
    activePreset = null;
    document.querySelectorAll('#presets button').forEach(b => b.classList.remove('on'));
  }

  function syncDeskUI() {
    document.querySelectorAll('#presets button').forEach(b => b.classList.toggle('on', b.dataset.preset === activePreset));
    document.querySelectorAll('#levers input[type=range]').forEach(inp => { inp.value = deskState[inp.dataset.lever]; });
    document.querySelectorAll('#levers .lever').forEach((box, i) => {
      const L = LEVERS[i];
      if (L?.type === 'seg') box.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.opt === String(deskState[L.id])));
    });
  }

  function renderDeskRun() {
    const r = ENGINE.run(deskState);
    const s = r.summary;

    for (const L of LEVERS) {
      const span = document.querySelector(`[data-val="${L.id}"]`);
      if (!span) continue;
      const v = deskState[L.id];
      span.textContent = L.fmt ? L.fmt(v) : (L.names ? L.names[L.opts.indexOf(v)] : String(v));
    }

    const ro = $('#readouts');
    if (!ro) return;
    const px30 = s.price2030, hs = s.hsShare2030 * 100;
    ro.innerHTML = '';
    // tick: {v: target, ...opts} animates via Motion.tick; plain string renders static
    const cells = [
      ['MIN STORAGE', { v: Math.round(s.minStorage), suffix: ' BCF' }, `bottoms ${fmtQ(s.minStorageYear)}`, s.minStorage < 824 ? 'crit' : s.minStorage < 1400 ? 'warn' : ''],
      ['LEAVES 5-YR BAND', s.breaksBandAt ? fmtQ(s.breaksBandAt) : 'NEVER', s.breaksBandAt ? 'below any recent year' : 'stays inside history', s.breaksBandAt ? 'warn' : ''],
      ['HH 2030', { v: px30, dec: 2, prefix: '$' }, 'strip says $3.80', px30 > 8 ? 'crit' : px30 > 5 ? 'warn' : ''],
      ['PEAK HH', { v: s.maxPrice, dec: 1, prefix: '$' }, s.maxPrice >= 59 ? 'MARKET FAILURE' : 'weather-normal', s.maxPrice > 15 ? 'crit' : s.maxPrice > 8 ? 'warn' : ''],
      ['POWER 2030', { v: Math.round(s.elec2030), prefix: '$', suffix: '/MWH' }, 'marginal, gas-set', s.elec2030 > 100 ? 'crit' : s.elec2030 > 70 ? 'warn' : ''],
      ['HS ENERGY SHARE', { v: hs, dec: 0, suffix: '%' }, 'of compute cost (was ~10%)', hs > 25 ? 'crit' : hs > 15 ? 'warn' : ''],
    ];
    for (const [k, v, d, cls] of cells) {
      const cell = el('div', 'ro', `<div class="k">${k}</div><div class="v ${cls}"></div><div class="d">${d}</div>`);
      ro.appendChild(cell);
      const vEl = cell.querySelector('.v');
      if (typeof v === 'object') Motion.tick(vEl, v.v, { ...v, key: 'ro:' + k, ms: 420 });
      else vEl.textContent = v;
    }

    const alarm = $('#alarm');
    if (s.hitsFloor) { alarm.className = 'alarm on'; alarm.textContent = `■ STORAGE FLOOR BREACH ${s.floorAt} — INVOLUNTARY CURTAILMENT / GRID EMERGENCY`; }
    else if (s.minStorage < 824) { alarm.className = 'alarm on'; alarm.textContent = '■ BELOW POST-2010 RECORD LOW (824 BCF) — UNCHARTED'; }
    else { alarm.className = 'alarm'; alarm.textContent = ''; }

    const deskRuns = { CONSENSUS: RUNS.CONSENSUS, CHRONOMETER: r, P0: RUNS.P0 };
    Charts.mount($('#chart-desk'), () => Object.assign(specStorage(deskRuns), { height: 270 }));
    $('#cap-desk').textContent = 'STOR.L48 — your scenario is the solid amber line (CONSENSUS and P0 shown for reference).';
    Charts.mount($('#chart-desk2'), () => Object.assign(specPrice(deskRuns), { height: 210 }));
    $('#cap-desk2').textContent = 'HH.PX — your scenario vs the flat strip.';
  }

  function renderMethod(mount) {
    const C = ENGINE.CALIB;
    mount.innerHTML = `
      <div class="panel">
        <div class="panel-hd"><span class="tick">MODEL.SRC</span> SHOW YOUR WORK <span class="spacer"></span><span class="lamp"></span></div>
        <div class="panel-bd doc">
          <p>Monthly balance, Jul 2026 → 2036. Storage integrates supply minus demand; price responds to
          storage deviation from a self-consistent seasonal norm; producers respond to price with lag,
          midstream rate limits, and a deliverability ceiling. The system is anchored so that TODAY's
          observed balance is reproduced by construction — the future is driven only by announced
          changes and your levers.</p>
          <p>Price function: HH = ${C.price.base.toFixed(2)}·e<sup>−k·z</sup> with k=${C.price.k} in
          deficit / ${C.price.kLoose} in surplus (empirical episode fit: 4.15·e<sup>−1.95·dev</sup>,
          deficit side ~50% steeper), plus a hyperbolic scarcity term below ${fmt(C.price.scarcityS)} Bcf —
          territory outside the historical sample, where Europe 2022 (TTF ≈ $100/MMBtu-equiv) is the only
          guide. Electricity = marginal heat rate ${C.power.marginalHeatRate} × HH + $${C.power.vomAdder}/MWh.
          Hyperscaler energy share = elec × PUE ÷ (elec × PUE + fixed stack calibrated to 10% at baseline).</p>

    <p class="kc-intro">Convexity is the load-bearing assumption in this model — everything downstream of the storage path depends on it — so here is where it comes from, with nothing withheld. These are the twenty observation pairs in <code>data/price_episodes.json</code>: storage deviation against that month's average Henry Hub, from 2001 through this February. Refit them, put an outlier back, drop the pre-shale rows or keep them. The engine's own <code>priceFrom()</code> is reimplemented in full alongside — exponential, hyperbolic scarcity term, cap — because the paragraph above this cell promises all three.</p>
    <div data-kernel-cell data-title="fitting the convexity to the episode record">
    <script type="text/x-python">
# Where the price model's convexity comes from. Nothing here is assumed:
# these are the real observation pairs in data/price_episodes.json.
#   dev = Lower-48 working gas vs the trailing 5-yr average (fraction, + = surplus)
#   hh  = that month's average Henry Hub spot, USD/MMBtu (EIA series rngwhhdM)
from math import exp, log

USD = "$"

#  period     dev %    HH avg   regime       use in fit?
OBS = [
    ("2012-04",  60.5,   1.95, "shale",     1),
    ("2016-03",  51.9,   1.73, "shale",     1),
    ("2024-02",  20.0,   1.72, "shale",     1),
    ("2020-06",  18.0,   1.63, "shale",     1),
    ("2023-06",  15.0,   2.18, "shale",     1),
    ("2025-12",   6.0,   4.26, "shale",     1),
    ("2025-01",   0.7,   4.13, "shale",     1),
    ("2026-02",  -5.6,   3.62, "shale",     1),
    ("2022-12",  -6.3,   5.53, "shale",     1),   # Elliott
    ("2021-02",  -7.7,   5.35, "shale",     1),   # Uri
    ("2022-09", -11.0,   7.88, "shale",     1),
    ("2022-08", -12.0,   8.81, "shale",     1),   # peak post-invasion squeeze
    ("2018-01", -12.9,   3.87, "shale",     1),   # bomb cyclone
    ("2022-04", -17.0,   6.60, "shale",     1),
    ("2014-02", -22.4,   6.00, "shale",     1),   # polar vortex, mid-winter
    ("2014-03", -54.7,   4.90, "shale",     0),   # end of season: market prices the rebuild
    ("2026-01",  -1.1,   7.72, "shale",     0),   # Fern: a flow shock, not a storage state
    ("2005-10",   2.4,  13.42, "pre_shale", 0),
    ("2008-07",  -2.7,  11.09, "pre_shale", 0),
    ("2001-01", -17.0,   8.17, "pre_shale", 0),
]

def logfit(rows):
    """OLS of ln(P) on dev, i.e. P = a * exp(-b * dev). Returns a, b, R2, n."""
    xs = [r[1] / 100.0 for r in rows]
    ys = [log(r[2]) for r in rows]
    n = len(rows)
    mx, my = sum(xs) / n, sum(ys) / n
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sxx = sum((x - mx) ** 2 for x in xs)
    slope = sxy / sxx
    inter = my - slope * mx
    sst = sum((y - my) ** 2 for y in ys)
    ssr = sum((y - inter - slope * x) ** 2 for x, y in zip(xs, ys))
    return exp(inter), -slope, 1 - ssr / sst, n

fit_rows = [r for r in OBS if r[3] == "shale" and r[4]]
a, b, r2, n = logfit(fit_rows)
print("SHALE-ERA FIT (2 flagged outliers and the pre-shale regime dropped)")
print(f"  this cell      P = {a:.2f} * exp(-{b:.2f} * dev)    R2 = {r2:.2f}   n = {n}")
print( "  published      P = 4.15 * exp(-1.95 * dev)    R2 = 0.66   n = 15")
print()

surp = [r for r in fit_rows if r[1] > 0]
defi = [r for r in fit_rows if r[1] < 0]
_, b_s, _, n_s = logfit(surp)
_, b_d, _, n_d = logfit(defi)
print("THE CURVE IS NOT ONE EXPONENTIAL -- fit each side separately")
print(f"  surplus side   b = {b_s:.2f}  (n = {n_s})   published 1.13")
print(f"  deficit side   b = {b_d:.2f}  (n = {n_d})   published 1.72")
print(f"  deficit side is {b_d / b_s - 1:.0%} steeper. That asymmetry is the whole thesis:")
print( "  a surplus is boring, a deficit is an auction.")
print()

# engine.js priceFrom(), in full. It is NOT a bare exponential: below 1,600
# Bcf of working gas it multiplies by a hyperbolic scarcity term, and the
# whole thing is clamped to a 60 dollar cap.
BASE, K_TIGHT, K_LOOSE = 3.40, 4.0, 1.4
SCARCITY_S, FLOOR, AMP, POW, CAP = 1600.0, 800.0, 9.0, 2.2, 60.0

def exp_term(dev):
    return BASE * exp(-(K_TIGHT if dev < 0 else K_LOOSE) * dev)

def scarcity(S):
    if S >= SCARCITY_S:
        return 1.0
    d = min(max((SCARCITY_S - S) / (SCARCITY_S - FLOOR), 0.0), 1.15)
    return 1 + AMP * d ** POW

def engine_price(S, norm):
    return min(max(exp_term((S - norm) / norm) * scarcity(S), 1.2), CAP)

# The observation record stores deviations, not absolute Bcf, so the column
# below is the exponential factor alone -- the engine's full answer only
# where working gas is known.
money = lambda v: USD + f"{v:.2f}"
print(f"{'DEV':>7}  {'PERIOD':<7}  {'OBSERVED':>8}  {'SINGLE-EXP':>10}  {'EXP TERM':>8}")
for per, dv, hh, reg, use in OBS:
    if reg != "shale":
        continue
    d = dv / 100.0
    flag = "" if use else "   dropped"
    print(f"{dv:>6.1f}%  {per:<7}  {money(hh):>8}  "
          f"{money(a * exp(-b * d)):>10}  {money(exp_term(d)):>8}{flag}")
print()
print("2014-03 is the case the fit guidance says to drop: an end-of-season")
print("deficit, with the market already pricing the injection-season rebuild.")
print("it is also the one row where the engine's other half fires. Working")
S_MAR14, MAR_NORM = 822, 1832   # wk 2014-03-28 (episodes), 2021-25 Mar mean
NORM_MAR14 = S_MAR14 / (1 - 0.547)      # the norm that -54.7% implies
print(f"gas that week was {S_MAR14} Bcf -- and {S_MAR14} at -54.7% implies a 5-yr")
print(f"March norm of {NORM_MAR14:,.0f} Bcf, within {abs(NORM_MAR14 / MAR_NORM - 1):.0%} of the {MAR_NORM:,} the engine")
print("carries, so the two records agree. Below 1,600 Bcf the scarcity term")
print(f"multiplies by {scarcity(S_MAR14):.1f}x and then the cap binds:")
print(f"  exponential term only          {money(exp_term(-0.547)):>8}")
print(f"  times scarcity                 {money(exp_term(-0.547) * scarcity(S_MAR14)):>8}")
print(f"  after the {CAP:.0f} dollar cap        {money(engine_price(S_MAR14, NORM_MAR14)):>8}")
print(f"  reality printed                {money(4.90):>8}")
print("so the engine's answer to the deepest deficit in the record is its own")
print(f"ceiling -- {engine_price(S_MAR14, NORM_MAR14) / 4.90:.0f}x what the month actually printed. Apply the curve")
print("mid-winter, and do not apply it at all below the sample.")
print()

print("WHAT THAT MEANS FOR THE STRIP -- mid-winter, priced off the band's")
print(f"March mean of {MAR_NORM:,} Bcf, which is what priceFrom falls back to when")
print("no frozen-cycle reference is passed:")
print(f"  {'DEV':>5} {'BCF':>7} {'SINGLE-EXP':>11} {'EXP TERM':>9} {'ENGINE':>8}")
for d in (-0.05, -0.10, -0.20, -0.30):
    S = MAR_NORM * (1 + d)
    print(f"  {d:>+5.0%} {S:>7,.0f} {money(a * exp(-b * d)):>11} "
          f"{money(exp_term(d)):>9} {money(engine_price(S, MAR_NORM)):>8}")
print(f"  the CAL-28 forward strip prices, flat: {USD}3.60")
print()
print(f"below {SCARCITY_S:,.0f} Bcf the scarcity term takes over and the engine stops")
print("being an exponential at all. No shale-era observation lives down there")
print("except the one the fit throws out -- which is the honest statement of")
print("what this calibration can and cannot support.")
    </script>
    </div>
        </div>
      </div>
      <div class="panel" style="margin-top:14px">
        <div class="panel-hd"><span class="tick">CAL.ANCHORS</span> CALIBRATION vs REALITY</div>
        <table class="ledger">
          <thead><tr><th>ANCHOR</th><th class="r">MODEL</th><th class="r">ACTUAL</th><th>SOURCE</th></tr></thead>
          <tbody>
            <tr class="rowbar"><td>Henry Hub spot, Jul 2026</td><td class="r num">$2.86</td><td class="r">$2.80</td><td class="sub">EIA daily, 2026-07-20</td></tr>
            <tr class="rowbar"><td>Storage peak, Oct 2026</td><td class="r num">3,970</td><td class="r">3,966</td><td class="sub">EIA STEO projection</td></tr>
            <tr class="rowbar"><td>Seasonal cycle amplitude</td><td class="r num">1,943</td><td class="r">1,944</td><td class="sub">5-yr band, EIA WNGSR</td></tr>
            <tr class="rowbar"><td>Production growth in flight</td><td class="r num">+4.0/yr</td><td class="r">+4.05/yr</td><td class="sub">STEO 2026→27: 111.25→115.3</td></tr>
            <tr class="rowbar"><td>DC gas pull 2030, P50</td><td class="r num">5.0</td><td class="r">3–6</td><td class="sub">KM · East Daley · S&amp;P range</td></tr>
            <tr class="rowbar"><td>LNG feedgas basis</td><td class="r num">nameplate ×1.10</td><td class="r">15.2×1.1=16.7 ✓ '25</td><td class="sub">EIA actual 16.6 avg</td></tr>
          </tbody>
        </table>
        <div class="panel-bd footnote">Every constant lives in <a href="engine.js">engine.js</a> in one CALIB object with inline citations.
        Known simplifications are listed in BRIEF ANNEX-A — each is conservative in the direction that makes the problem look smaller.
        Disagree with an assumption? Good. That's what the DESK is for.</div>
      </div>`;
  }

  // ═══════════════════════════════ DATA (provenance) ═══════════════════════════════
  function renderData() {
    const vp = $('#viewport');
    const m = el('div', 'module module-wide');

    const lngRows = (DATA.lng?.projects || []).map(p => {
      const st = p.status || '';
      const cls = st.includes('operat') ? 'ok' : st.includes('construction') ? 'warn' : st.includes('FID') || st === 'fid' ? 'cy' : '';
      return `<tr class="rowbar ${cls === 'ok' ? '' : cls === 'warn' ? 'warn' : 'dim'}">
        <td>${esc(p.name)}<div class="sub">${esc(p.operator || '')} · ${esc(p.state || '')}</div></td>
        <td><span class="chip ${cls}">${esc(st).toUpperCase().slice(0, 18)}</span></td>
        <td class="r num">${p.capacity_bcfd_nameplate ?? '—'}</td>
        <td class="r">${p.first_lng_year ?? '—'}</td></tr>`;
    }).join('');

    const dcRows = (DATA.dc?.forecasts || []).map(f => {
      const vals = Object.entries(f.values || {}).slice(0, 4)
        .map(([k, v]) => `<span class="sub">${esc(k.replace(/_/g, ' '))}:</span> <b>${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</b>`).join(' · ');
      return `<tr class="rowbar dim"><td>${esc((f.source || '').split(' - ')[0])}<div class="sub">${esc(f.published || '')}</div></td><td style="font-size:11.5px">${vals}</td></tr>`;
    }).join('');

    const pxRows = (DATA.px?.episodes || []).map(e => {
      const peak = e.henry_hub_peak_spot?.value;
      const dev = e.storage?.mid_episode?.dev_vs_5yr_pct;
      const sev = peak >= 15 ? 'crit' : peak >= 8 ? 'warn' : '';
      return `<tr class="rowbar ${sev}"><td>${esc(e.name)}<div class="sub">${esc(e.dates || '')}</div></td>
        <td class="r num ${sev}">${peak ? '$' + peak : '—'}</td>
        <td class="r">${dev != null ? dev + '%' : '—'}</td>
        <td class="sub" style="max-width:380px">${esc(e.cause || '')}</td></tr>`;
    }).join('');

    const eiaS = DATA.eia?.storage, eiaH = DATA.eia?.henry_hub;
    m.innerHTML = `
      <div class="mod-hd"><h2><b>DATA</b> // PROVENANCE</h2>
        <span class="mnote">know where your gas is coming from — every input series, with sources, as gathered 2026-07-23</span></div>

      <div class="grid2">
        <div class="panel">
          <div class="panel-hd"><span class="tick">EIA.HIST</span> SYSTEM HISTORY — HEADLINES <span class="spacer"></span><a class="footnote" href="data/eia_history.json">RAW JSON</a></div>
          <table class="ledger">
            <thead><tr><th>SERIES</th><th class="r">VALUE</th><th>NOTE</th></tr></thead>
            <tbody>
              <tr class="rowbar"><td>Dry production 2010 → 2025</td><td class="r num">58.4 → 107.65</td><td class="sub">Bcf/d · Apr-26: 110.9</td></tr>
              <tr class="rowbar"><td>Storage, current</td><td class="r num">${fmt(eiaS?.current?.level_bcf ?? 3024)}</td><td class="sub">+${eiaS?.current?.surplus_to_five_year_avg_pct ?? 6.4}% vs 5-yr · wk ${esc(eiaS?.current?.week_ending ?? '')}</td></tr>
              <tr class="rowbar"><td>Storage capacity</td><td class="r num">4,280</td><td class="sub">demonstrated peak (design 4,683)</td></tr>
              <tr class="rowbar warn"><td>Record lows</td><td class="r num warn">824 / 636</td><td class="sub">post-2010 (Mar-14) / all-time (Mar-03)</td></tr>
              <tr class="rowbar"><td>LNG exports 2016 → 2025</td><td class="r num">0.51 → 15.09</td><td class="sub">Bcf/d · STEO 2026: 17.4</td></tr>
              <tr class="rowbar"><td>Consumption 2025</td><td class="r num">91.84</td><td class="sub">power 35.8 · ind 23.6 · res/com 23.2 · other 9.1</td></tr>
              <tr class="rowbar warn"><td>HH forward strip</td><td class="r num warn">$3.41–3.80</td><td class="sub">Cal-27 → Cal-30 (28+ indicative) · spot $${eiaH?.latest_spot?.value ?? 2.80}</td></tr>
            </tbody>
          </table>
        </div>

        <div class="panel">
          <div class="panel-hd"><span class="tick">PX.EPISODES</span> WHAT SHORTAGE ACTUALLY COSTS <span class="spacer"></span><a class="footnote" href="data/price_episodes.json">RAW JSON</a></div>
          <table class="ledger">
            <thead><tr><th>EPISODE</th><th class="r">PEAK $</th><th class="r">STOR DEV</th><th>CAUSE</th></tr></thead>
            <tbody>${pxRows || '<tr><td class="sub">offline</td></tr>'}</tbody>
          </table>
          <div class="panel-bd footnote">Shale-era fit: P ≈ 4.15·e<sup>−1.95·dev</sup> (R² 0.66), deficit side ~50% steeper.
          Two systematic outliers the model handles separately: end-of-season deficits under-price; short weather shocks (Uri, Fern) blow out regardless of storage.</div>
        </div>

        <div class="panel span2">
          <div class="panel-hd"><span class="tick warn">LNG.BOOK</span> THE EXPORT COMMITMENT BOOK — ${(DATA.lng?.projects || []).length} PROJECTS, FID-ONLY RAMP 15.2 → 32.9 BY 2031 <span class="spacer"></span><a class="footnote" href="data/lng_projects.json">RAW JSON</a></div>
          <div style="max-height:420px;overflow-y:auto">
          <table class="ledger">
            <thead><tr><th>PROJECT</th><th>STATUS</th><th class="r">BCF/D</th><th class="r">FIRST LNG</th></tr></thead>
            <tbody>${lngRows || '<tr><td class="sub">offline</td></tr>'}</tbody>
          </table></div>
        </div>

        <div class="panel span2">
          <div class="panel-hd"><span class="tick warn">DC.FCST</span> DATA-CENTER LOAD — ${(DATA.dc?.forecasts || []).length} PUBLISHED FORECASTS <span class="spacer"></span><a class="footnote" href="data/datacenters.json">RAW JSON</a></div>
          <table class="ledger">
            <thead><tr><th>SOURCE</th><th>KEY FIGURES</th></tr></thead>
            <tbody>${dcRows || '<tr><td class="sub">offline</td></tr>'}</tbody>
          </table>
          <div class="panel-bd footnote">Conversion anchor: 1 GW of 24/7 load ≈ <b>150 MMcf/d</b> at new-CCGT/SOFC heat rates
          (6.3 MMBtu/MWh × 24,000 ÷ 1,037 ≈ 146; Homer City discloses the same). Peaker-heavy fleets run 0.17–0.23 Bcf/d per GW.</div>
        </div>
      </div>`;
    vp.appendChild(m);
  }

  // ═══════════════════════════════ COMMAND BAR ═══════════════════════════════
  function initCmd() {
    const inp = $('#cmd'), out = $('#cmdout');
    const say = html => { out.innerHTML = html; out.classList.add('show'); };
    const CMDS = {
      help: () => say(`<b>commands</b> — go terminal|brief|model|data|atlas · brief 1..7 · siting · preset consensus|base|p0|soft ·
        set &lt;lever&gt; &lt;value&gt; (e.g. <b>set prodMax 134</b> — levers: ${LEVERS.map(l => l.id).join(', ')}) ·
        operator [N] (opens the standalone policy game, optionally with seed N) · sources · fern · clear · <b>⌘K</b> opens the palette`),
      clear: () => out.classList.remove('show'),
      go: a => { const t = { terminal: 1, brief: 1, model: 1, data: 1, atlas: 1 }[(a?.[0] || '').toLowerCase()]; if (t) { location.hash = '#/' + a[0].toLowerCase(); out.classList.remove('show'); } else say('unknown module. try: terminal, brief, model, data, atlas — or operator (opens on its own page)'); },
      siting: () => { location.hash = '#/atlas/siting'; out.classList.remove('show'); },
      brief: a => { location.hash = '#/brief/' + (parseInt(a?.[0]) || 1); out.classList.remove('show'); },
      sources: () => { location.hash = '#/data'; out.classList.remove('show'); },
      operator: a => { window.open('operator.html' + (a?.[0] ? '?seed=' + parseInt(a[0]) : ''), '_blank'); },
      preset: a => {
        const map = { consensus: 'CONSENSUS', base: 'CHRONOMETER', chronometer: 'CHRONOMETER', p0: 'UNMITIGATED', crisis: 'UNMITIGATED', soft: 'SOFTLANDING' };
        const key = map[(a?.[0] || '').toLowerCase()];
        if (!key) return say('presets: consensus · base · p0 · soft');
        applyPreset(key); deskInited = true;
        location.hash = '#/model'; route();
        Motion.toast(`Preset <b>${key}</b> loaded`, { tag: 'MODEL', kind: key === 'UNMITIGATED' ? 'crit' : '' });
        out.classList.remove('show');
      },
      set: a => {
        const L = LEVERS.find(l => l.id.toLowerCase() === (a?.[0] || '').toLowerCase());
        if (!L) return say('unknown lever. levers: ' + LEVERS.map(l => l.id).join(', '));
        let v = a[1];
        if (L.type === 'range') { v = parseFloat(v); if (isNaN(v)) return say('need a number'); v = Math.min(L.max, Math.max(L.min, v)); }
        else { const i = (L.names || L.opts).findIndex(n => String(n).toLowerCase() === String(v).toLowerCase()); if (i < 0) return say('options: ' + (L.names || L.opts).join(', ')); v = L.opts[i]; }
        deskState[L.id] = v; deskInited = true; activePreset = null;
        if (!location.hash.startsWith('#/model')) { location.hash = '#/model'; } else { route(); }
        Motion.toast(`<b>${L.id}</b> = ${L.fmt ? L.fmt(v) : v} — engine re-run`, { tag: 'MODEL' });
        out.classList.remove('show');
      },
      fern: () => say(`2026-01-23 · winter storm fern · henry hub <b>$30.72</b> — the highest daily price ever recorded, with storage in <b>surplus</b>. that was weather. the scenarios in this terminal are structural.`),
    };
    inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const [cmd, ...args] = inp.value.trim().split(/\s+/);
      inp.value = '';
      if (!cmd) return;
      (CMDS[cmd.toLowerCase()] || (() => say(`unknown command <b>${esc(cmd)}</b> — try <b>help</b>`)))(args);
    });
  }

  boot();
})();
