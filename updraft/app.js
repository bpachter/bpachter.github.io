/* UPDRAFT — shell: boot, routing, BRIEF, DATA.
   Sibling apps: DRAWDOWN (what the machines take) · HEADROOM (where the grid says yes).
   Every number below is compiled offline into data/*.json; the browser only renders. */
(() => {
  const $ = s => document.querySelector(s);

  // ── boot
  const BOOT = [
    ['loading atlas', 'facilities 1,474 + 179'],
    ['climate normals', 'NASA POWER 2001–2020 · 1,592 cells'],
    ['band engine', 'DLI ≥ 10 · HDD65 ≥ 4,000'],
    ['provenance', 'IM3 · GHGRP · EIA · retrieved 2026-08-09'],
  ];
  function boot() {
    const lines = $('#bootlines'), bar = $('#bootbar');
    let i = 0;
    const step = () => {
      if (i < BOOT.length) {
        lines.innerHTML += `<b>·</b> ${BOOT[i][0]} <span style="color:var(--ink-faint)">— ${BOOT[i][1]}</span>\n`;
        bar.style.width = (100 * (i + 1) / BOOT.length) + '%';
        i++; setTimeout(step, 130);
      } else setTimeout(() => {
        $('#boot').classList.add('done');
        $('#app').classList.add('on');
        route();
      }, 220);
    };
    step();
  }

  // ── clock
  setInterval(() => {
    $('#clock').textContent = new Date().toISOString().slice(11, 19);
  }, 1000);

  // ── routing
  const routes = { atlas: renderAtlas, brief: renderBrief, data: renderData };
  let current = '';
  function route() {
    const r = (location.hash.replace('#/', '') || 'atlas').split('/')[0];
    const name = routes[r] ? r : 'atlas';
    if (name === current) return;
    if (current === 'atlas') Atlas.destroy();
    current = name;
    document.querySelectorAll('.tab[data-route]').forEach(t =>
      t.classList.toggle('on', t.dataset.route === name));
    routes[name]($('#viewport'));
  }
  window.addEventListener('hashchange', route);
  document.querySelectorAll('.tab[data-route]').forEach(t =>
    t.onclick = () => location.hash = '#/' + t.dataset.route);
  $('#brand').onclick = () => location.hash = '#/atlas';
  window.addEventListener('keydown', e => {
    const k = { F1: 'atlas', F2: 'brief', F3: 'data' }[e.key];
    if (k && !e.metaKey && !e.ctrlKey) { e.preventDefault(); location.hash = '#/' + k; }
  });

  function renderAtlas(mount) { Atlas.render(mount); }

  // ── BRIEF
  const DOCS = [
    { no: '01', t: 'THE PULL', meta: 'WHAT THE MACHINES TAKE',
      html: `<p>AI is the largest new electric load in a generation, and in the US the marginal
        winter electron is natural gas. <a href="../drawdown/" target="_blank" rel="noopener">DRAWDOWN</a>
        models that pull end to end: data-center load plus contracted LNG exports against a system near
        full commitment, working storage on track to leave its historical range around 2028, and a forward
        curve that hasn't priced it. That app is the cost ledger of the buildout — this app is the other
        side of the same ledger.</p>`,
      src: 'DRAWDOWN engine + brief — EIA history, FID\'d LNG book, EPRI/LBNL/GS load forecasts. Forward paths are models and labeled as such.' },
    { no: '02', t: 'THE GATE', meta: 'WHERE THE GRID SAYS YES',
      html: `<p>Before a campus draws a watt it has to interconnect, and interconnection — not land, not
        chips — is the binding constraint of the buildout. <a href="../headroom/" target="_blank" rel="noopener">HEADROOM</a>
        demonstrates the screening math that decides it: B-θ power flow, PTDF sensitivities, an N-1 sweep,
        and a verdict that flips from <b>energize</b> to <b>queued</b> with the binding element named.
        The grid's yes-map constrains everything downstream of this brief: a frontier site behind a
        four-year queue is not yet a site.</p>`,
      src: 'HEADROOM — public synthetic cousin of a production hyperscaler screening platform (100+ GW screened).' },
    { no: '03', t: 'THE EXHAUST', meta: 'EVERY WATT LEAVES AS HEAT',
      html: `<p>Physics does not negotiate: essentially every watt a data center draws leaves the building
        as low-grade heat, 30–45 °C in modern liquid-cooled plants. That is too cool for district heating
        without heat pumps — and exactly the grade a greenhouse wants for root-zone and air heating. The
        one industry that is a natural sink for the AI economy's exhaust grows food. Falk, Asgari, Pearce
        &amp; van Wynsberghe put the national potential at <span class="num">30,085–45,448 ha</span> of
        heated greenhouse — but as a single aggregate number. Nobody had drawn the map.</p>`,
      src: 'Falk et al., SSRN 5170348 (2025) — DC waste-heat potential for US greenhouse food production.' },
    { no: '04', t: 'THE MATCH', meta: 'THE FRONTIER COUNT',
      html: `<p>A waste-heat greenhouse needs two things the map rarely gives together: enough December
        light to grow (<span class="num">DLI ≥ 10 mol/m²/day</span>) and enough cold to make free heat
        valuable (<span class="num">≥ 4,000</span> heating degree days). Light and cold trade off along a
        clean diagonal — that is the frontier. The count: <span class="num">742 of 1,474</span> US data
        centers — <span class="num">50.3%</span> — sit inside it (floor-area weighted: 48.1%).</p>
        <p>The industry's capital passes: Ashburn's cell — 285 facilities, the densest waste-heat cluster
        on Earth — lands at DLI 12.8 against 4,813 HDD. The failures split into two clean wings:
        the Pacific Northwest and Great Lakes are <span class="b2">cold but too dark</span>; the Sun Belt
        is <span class="b3">bright with worthless heat</span>. The <span class="b1">deep frontier</span>
        is the Mountain West — Denver, Salt Lake, Reno, Albuquerque, and Cheyenne at DLI 14.6 / 7,003 HDD.
        Across the full threshold grid the share runs 26.8–62.2%, so the finding is not an artifact of
        where the lines are drawn.</p>`,
      src: 'IM3 Open Source Data Center Atlas (PNNL, Feb 2026, ODbL) × NASA POWER 2001–2020 climatology. DLI = 0.45 × 4.57 × MJ/m²/day; HDD from monthly normals (±5–10%).' },
    { no: '05', t: 'THE COMPANY IT KEEPS', meta: 'THE OBJECTIVE RANKING',
      html: `<p>Score every large waste-heat source in the country with the same engine and the classic
        candidates collapse: refineries <span class="num">21.1%</span>, pulp &amp; paper
        <span class="num">17.3%</span> — the textbook "industrial waste heat" lives where winters are mild.
        The two best-placed fleets belong to the AI economy and the biofuel economy:
        data centers at <span class="num">50.3%</span> and ethanol plants at
        <span class="num">76.5%</span> (81.1% capacity-weighted — the corn belt is cold <i>and</i> bright).</p>
        <p>Ethanol brings what data centers lack: fermentation exhaust is near-pure CO₂ — the enrichment
        gas greenhouses literally purchase — at <span class="num">~49 Mt/yr</span> at nameplate. (A data
        point on data honesty: GHGRP's biogenic column reads ~0 for these plants because fermentation CO₂
        is exempt from reporting; the figure here is stoichiometric, 2.85 kg per gallon, from EIA
        capacity.) The fleets are mostly disjoint — median separation 238 km — which makes the overlap
        precious: <span class="num">94</span> frontier data centers sit within 50 km of an ethanol plant,
        <span class="num">274</span> within 100 km. Heat from the server hall, CO₂ from the fermenter,
        winter sun from the sky: those are complete greenhouse sites.</p>`,
      src: 'EPA GHGRP RY2023 direct emitters (6,461 facilities) · EIA Fuel Ethanol Plant Production Capacity, Jan 2025 (179/192 plants geolocated, 93% of capacity).' },
    { no: '06', t: 'THE PRIZE', meta: 'WHAT INTEGRATION BUYS',
      html: `<p>Honesty about magnitude: piping every recoverable data-center watt into greenhouses moves
        the national gas balance by single-digit Bcf per year against a ~37,000 Bcf market. This does not
        rescue DRAWDOWN's storage curve, and this site will never claim it does. What it moves is the food
        system: the US imports the majority of its winter fresh vegetables; every frontier hectare grows
        produce at the fence line with heat that was being vented and CO₂ that was being released, and
        retires a gas boiler that would have heated that greenhouse otherwise.</p>
        <p>That is the flip this app exists to describe: the same machines DRAWDOWN prices as strain are,
        sited with intention, the founding infrastructure of American controlled-environment agriculture.
        The buildout is happening either way. The exhaust is a choice.</p>
        <p class="dim">Roadmap: a unified site screener (grid axis from public queue data + the HEADROOM
        engine), model levers for heat-recovery adoption and gas-price feedback, and an OPERATOR-style
        game where you run the integration policy. The engines exist; they are siblings on this domain.</p>`,
      src: 'Magnitude estimates from this site\'s own compiled data; import shares USDA ERS. Forward statements are direction, not prediction.' },
  ];
  function renderBrief(mount) {
    mount.innerHTML = `<div class="scroll"><div class="brief-wrap">
      <div class="brief-kicker">THE BRIEF · SIX DOCUMENTS</div>
      <p class="brief-lede"><b>DRAWDOWN</b> asks what the machines take. <b>HEADROOM</b> asks where the
        grid can say yes. <b>UPDRAFT</b> closes the loop: every watt in leaves as heat — and mapped
        correctly, the AI buildout's exhaust is agricultural infrastructure.</p>
      <div class="brief-sibs">A data center is a machine that turns electricity into heat. These three
        apps are that sentence, told in order.</div>
      ${DOCS.map(d => `<div class="doc"><h3><span class="no">${d.no}</span>${d.t}</h3>
        <div class="doc-meta">${d.meta}</div>${d.html}<div class="src">${d.src}</div></div>`).join('')}
    </div></div>`;
  }

  // ── DATA
  function renderData(mount) {
    mount.innerHTML = `<div class="scroll"><div class="data-wrap" id="datawrap">loading…</div></div>`;
    UD.load().then(d => {
      const s = d.summary, w = $('#datawrap');
      const pill = b => `<span class="bpill b${{ frontier: 1, fail_light: 2, fail_heat: 3, fail_both: 4 }[b]}">${b.replace('_', '-').toUpperCase()}</span>`;
      w.innerHTML = `
        <h2>Provenance</h2>
        <div class="data-sub">Every number on this site is compiled offline from the sources below into
          static JSON (<a href="data/summary.json">inspect</a>) — the browser only renders. Method:
          ${s.thresholds.method}. Compiled ${s.built}.</div>
        <table class="tbl"><tr><th>SOURCE</th><th>ORG</th><th>ROLE</th><th>VINTAGE</th><th>RETRIEVED</th><th>LICENSE</th></tr>
          ${s.provenance.map(p => `<tr><td><a href="${p.url}" target="_blank" rel="noopener">${p.name}</a></td>
            <td>${p.org}</td><td>${p.role}</td><td>${p.vintage}</td><td>${p.retrieved}</td><td>${p.license}</td></tr>`).join('')}
        </table>
        <h2>Frontier share by waste-heat source</h2>
        <div class="data-sub">Share of each fleet with December DLI ≥ ${s.thresholds.dli_dec} mol/m²/day AND annual HDD65 ≥ ${s.thresholds.hdd65.toLocaleString()}.</div>
        <table class="tbl"><tr><th>SOURCE FLEET</th><th class="r">FACILITIES</th><th class="r">FRONTIER %</th><th class="bar-td"></th></tr>
          ${s.sectors.map(x => `<tr class="${/Ethanol plants|Data centers/.test(x.sector) ? 'hl' : ''}">
            <td>${x.sector}</td><td class="r">${x.n.toLocaleString()}</td><td class="r">${x.frontier_pct}</td>
            <td class="bar-td"><i style="width:${x.frontier_pct}%"></i></td></tr>`).join('')}
        </table>
        <h2>Threshold sensitivity — % of data centers in frontier</h2>
        <table class="tbl"><tr><th></th>${s.sensitivity.hdd.map(h => `<th class="r">HDD ≥ ${h.toLocaleString()}</th>`).join('')}</tr>
          ${s.sensitivity.dli.map((dl, i) => `<tr ${dl === 10 ? 'class="hl"' : ''}><td>DLI ≥ ${dl}</td>
            ${s.sensitivity.hdd.map((h, j) => `<td class="r">${s.sensitivity.pct[i][j]}${dl === 10 && h === 4000 ? ' ◀' : ''}</td>`).join('')}</tr>`).join('')}
        </table>
        <h2>Hub verdicts</h2>
        <div class="data-sub">The nearest scored climate cell to each major data-center market.</div>
        <table class="tbl"><tr><th>HUB</th><th class="r">DEC DLI</th><th class="r">HDD65</th><th class="r">FACILITIES IN CELL</th><th>BAND</th></tr>
          ${s.hubs.map(h => `<tr><td>${h.hub}</td><td class="r">${h.dli}</td><td class="r">${h.hdd.toLocaleString()}</td>
            <td class="r">${h.n}</td><td>${pill(h.band)}</td></tr>`).join('')}
        </table>`;
    }).catch(err => { $('#datawrap').textContent = 'failed to load data: ' + err.message; });
  }

  boot();
})();
