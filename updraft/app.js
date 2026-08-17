/* UPDRAFT — shell: boot, routing, BRIEF, DATA.
   Sibling apps: DRAWDOWN (what the machines take) · HEADROOM (where the grid says yes).
   Every number below is compiled offline into data/*.json; the browser only renders.
   Reproduce the headline numbers yourself: node pipeline/verify.mjs */
(() => {
  const $ = s => document.querySelector(s);
  const { esc, fmt } = globalThis.UD_SHARED;

  // warm the data + map library fetches behind the boot screen instead of after it;
  // allSettled: a failure here surfaces as the atlas/data error note, not an unhandled rejection
  const warm = Promise.allSettled([UD.load()]);
  Atlas.preload();

  // ── boot
  const BOOT = [
    ['loading atlas', 'facilities 1,474 + 179'],
    ['climate normals', 'NASA POWER 2001–2020 · 1,592 cells'],
    ['band engine', 'DLI ≥ 10 · HDD65 ≥ 4,000'],
    ['provenance', 'IM3 · GHGRP · EIA · retrieved 2026-08-09'],
  ];
  function boot() {
    // the mask dismisses when BOTH the animation and the real data fetch are done,
    // so it covers actual loading instead of adding fixed-duration theater on top;
    // repeat visits this session skip the animation but still gate on the data
    const seen = (() => { try { return sessionStorage.getItem('ud-boot'); } catch { return null; } })();
    const anim = seen ? Promise.resolve() : new Promise(res => {
      const lines = $('#bootlines'), bar = $('#bootbar');
      let i = 0;
      const step = () => {
        if (i < BOOT.length) {
          lines.innerHTML += `<b>·</b> ${BOOT[i][0]} <span style="color:var(--ink-faint)">— ${BOOT[i][1]}</span>\n`;
          bar.style.width = (100 * (i + 1) / BOOT.length) + '%';
          i++; setTimeout(step, 130);
        } else setTimeout(res, 220);
      };
      step();
    });
    Promise.all([anim, warm]).then(() => {
      $('#boot').classList.add('done');
      $('#app').classList.add('on');
      try { sessionStorage.setItem('ud-boot', '1'); } catch { /* private mode */ }
      route();
    });
  }

  // ── clock
  setInterval(() => {
    $('#clock').textContent = new Date().toISOString().slice(11, 19);
  }, 1000);

  // ── routing (hash may carry atlas view params after '?' — route on the path only)
  const routes = { atlas: renderAtlas, brief: renderBrief, data: renderData };
  let current = '';
  function route() {
    const r = (location.hash.replace('#/', '') || 'atlas').split(/[/?]/)[0];
    const name = routes[r] ? r : 'atlas';
    if (name === current) {
      // param-only change while the atlas is active (a pasted deep link):
      // re-render so the new view/threshold params actually apply. Plain
      // '#/atlas' (tab click on the active tab) falls through to no-op.
      if (name === 'atlas' && location.hash.includes('?')) {
        Atlas.destroy();
        routes.atlas($('#viewport'));
      }
      return;
    }
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
  // 1/2/3 switch tabs everywhere (F1/F2 kept as a bonus; F3 left alone — it is find-next)
  window.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') || t.isContentEditable) return;
    const k = { 1: 'atlas', 2: 'brief', 3: 'data', F1: 'atlas', F2: 'brief' }[e.key];
    if (k) { e.preventDefault(); location.hash = '#/' + k; }
  });

  function renderAtlas(mount) { Atlas.render(mount); }

  // ── BRIEF
  const A = (q, txt) => `<a href="#/atlas?${q}">${txt}</a>`;
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
        as heat. In new liquid-cooled AI plants it leaves as 30–45 °C water you can pump; in the air-cooled
        majority of today's fleet — perimeter air cooling still runs at ~75% of operators in Uptime's 2025
        survey — it leaves as ~35 °C exhaust air that needs a recovery retrofit before a greenhouse sees a
        watt. Either way the grade is too cool for district heating without heat pumps, and right for a
        greenhouse's ~38 °C root-zone loops and base-load air heating — with the honest footnote that the
        coldest nights want extra emitter surface, thermal storage, or a small-lift booster. The one
        industry that is a natural sink for the AI economy's exhaust grows food. Falk, Asgari, Pearce
        &amp; van Wynsberghe put the national potential at <span class="num">30,085–45,448 ha</span> of
        heated greenhouse — but as a single aggregate number. Nobody had drawn the map.</p>`,
      src: 'Falk et al., SSRN 5170348 (2025) — the 40 GW extrapolation; their mapped 6.6 GW alone supports 5,624–7,499 ha · Uptime Institute Cooling Systems Survey 2025 (n=1,033) · Rutgers/eXtension root-zone guidance (~38 °C water; <25% of coldest-night load in most US climates).' },
    { no: '04', t: 'THE MATCH', meta: 'THE FRONTIER COUNT',
      html: `<p>A waste-heat greenhouse needs two things the map rarely gives together: enough December
        light that the sun does most of the work (<span class="num">DLI ≥ 10 mol/m²/day</span> — a
        floriculture quality floor; unlit tomato production wants 15–30) and enough cold to make free heat
        valuable (<span class="num">≥ 4,000</span> heating degree days). Light and cold trade off along a
        clean diagonal — that is the frontier. The count: <span class="num">742 of 1,474</span> US data
        centers — <span class="num">50.3%</span> — sit inside it (floor-area weighted: 48.1%).</p>
        <p>The industry's capital passes: ${A('c=-77.49,39.04&z=7', 'Ashburn’s cell')} — 285 facilities,
        the densest waste-heat cluster on Earth — lands at DLI 12.8 against 4,813 HDD. The failures split
        into two clean wings: the Pacific Northwest and Great Lakes are <span class="b2">cold but too
        dark</span>; the Sun Belt is <span class="b3">bright with worthless heat</span>. The
        <span class="b1">deep frontier</span> is the Mountain West — ${A('c=-104.9,39.7&z=6.3', 'Denver')},
        ${A('c=-111.9,40.7&z=6.5', 'Salt Lake')}, ${A('c=-119.8,39.5&z=6.5', 'Reno')},
        ${A('c=-106.6,35.1&z=6.5', 'Albuquerque')}, and ${A('c=-104.8,41.1&z=6.5', 'Cheyenne')} at
        DLI 14.6 / 7,003 HDD.</p>
        <p>Holding light at DLI 10, the share runs <span class="num">26.8–62.2%</span> across the HDD
        range; the full published grid spans <span class="num">12.6–68%</span>, collapsing only at the
        strictest corner (DLI ≥ 12 with HDD ≥ 5,000). The lines are a choice — the atlas has
        <a href="#/atlas">threshold sliders</a>: drag them and watch the frontier redraw.</p>
        <p>Two honest caveats keep the frontier a screen, not a verdict. Dark is a cost, not a
        disqualifier: the Netherlands (December DLI ~2–5) and Leamington, Ontario — nearly 2,000
        greenhouse acres on the same Great Lakes shore this map paints orange — grow through winter under
        purchased light, so a cheap-power cell like ${A('c=-119.85,47.23&z=7', 'Quincy, WA')} reads better
        as a lights-on candidate than a failure. And in the deep frontier the binding constraint is water:
        every named hub draws on a stressed or over-appropriated basin (Lake Powell touched 23% — a record
        low — in 2026, and Aurora, CO already bars new evaporative-cooled facilities), so the brightest
        cells on this map are also some of the hardest new water permits in the country. The atlas now
        prices both: flip the cell surface to ${A('paint=light', 'LIGHT COST')} or
        ${A('paint=water', 'WATER STRESS')} and the caveats become layers.</p>`,
      src: 'IM3 Open Source Data Center Atlas (PNNL, Feb 2026, ODbL) × NASA POWER 2001–2020 climatology. DLI = 0.45 × 4.57 × MJ/m²/day; HDD from monthly normals (±5–10%). Full sensitivity grid on the DATA tab. DLI floors: Faust/MSU 10–12 quality guideline; fruiting-crop targets 15–30 (MSU/GPN). Water: CNN 07/2026 (Powell 23%), Aurora Water tiered framework.' },
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
        precious: ${A('l=dc.eth.pairs&c=-93.5,41.5&z=5.2', '94 frontier data centers sit within 50 km of an ethanol plant')},
        <span class="num">274</span> within 100 km. Heat from the server hall, CO₂ from the fermenter,
        winter sun from the sky: those are the raw materials of complete greenhouse sites.</p>
        <p>Scale honesty cuts the ethanol way too: 49 Mt is <span class="num">4–16×</span> what even the
        full Falk buildout could absorb (~3–11 Mt/yr at enrichment rates of 100–250 t/ha·yr) — CO₂ supply
        is the abundant leg, and it is already being bid for. Summit's CCS system had
        <span class="num">~57</span> corn-belt plants (~12 Mt/yr) under contract before its 2026
        downsizing to ~27, chasing the $85/t 45Q credit — a price a greenhouse buying merchant CO₂ at
        several hundred dollars a tonne can comfortably outbid at the fence line.</p>`,
      src: 'EPA GHGRP RY2023 direct emitters (6,461 facilities) · EIA Fuel Ethanol Plant Production Capacity, Jan 2025 (179/192 plants geolocated, 93% of capacity) · Enrichment demand 100–250 t/ha·yr (OCAP network averages ~200) · Summit contracts: AP/Sierra Club Iowa (57 plants, ~12 Mt/yr); North Dakota Monitor, May 2026 (reroute to ~27 Iowa plants).' },
    { no: '06', t: 'ALREADY RUNNING', meta: 'THE DEPLOYMENT RECORD',
      html: `<p>None of this is hypothetical. The exact trade this site maps — a greenhouse at the fence
        line, waste heat and fermentation CO₂ across it — has run in Chatham, Ontario
        <span class="num">since 2013</span>: Truly Green Farms grows tomatoes on CO₂ and low-grade steam
        piped from GreenField Global's ~200-million-litre ethanol distillery across the road, expanded in
        four 22.5-acre phases to <span class="num">~90 acres</span>. It sits in a climate band this very
        map paints <span class="b2">cold but too dark</span> — evidence the thresholds here are
        conservative, not generous. The Netherlands runs the pipeline-scale version: OCAP delivers
        <span class="num">~0.4–0.5 Mt/yr</span> of CO₂ — Shell Pernis hydrogen off-gas plus Alco
        Rotterdam's fermentation exhaust — through a repurposed 97 km trunk line and 250 km of
        distribution to ~580 growers on ~1,900 ha. And a June 2025 feasibility study for GO Virginia
        found the state's data-center heat could carry <span class="num">6,000–8,500 acres</span> of
        greenhouse — 80–120% of Virginia's fresh-tomato demand — an independent check on this map's
        #1 hub, ${A('c=-77.49,39.04&z=7', 'Ashburn')}.</p>
        <p>The record also says where the hard part lives: temperature. Stockholm's data parks sell heat
        only after operators boost it to ~68 °C; Meta's Odense campus lifts ~27 °C server heat to
        70–75 °C with ammonia heat pumps to warm 11,000+ homes; QScale's Lévis campus feeds its
        greenhouse partner through a lift to 60 °C — and still cites a ~66% energy reduction. The direct
        low-grade successes are fish farms: Hima Seafood's trout at Rjukan, 800 m from the data center,
        and White Data Center's eels at Bibai. Blockheating, the one firm that piped 60 °C chip-loop
        water straight to tomatoes, proved the engineering and still went bankrupt in 2023; Microsoft's
        campus inside the Agriport A7 greenhouse cluster has delivered no heat to its neighbors yet.
        Co-location is necessary, not sufficient — which is why this map is a screen, and why the grid,
        water, and market axes matter as much as the climate diagonal.</p>`,
      src: 'Truly Green × GreenField: Greenhouse Canada; GreenField Chatham distillery (~200M L/yr, CO₂ + low-grade steam) · OCAP/Linde factsheet; Hortidaily · RII "Colocating Data Centers &amp; Greenhouses," GO Virginia Region 3, June 2025 · Stockholm Exergi · Ramboll/Alfa Laval (Odense) · ÉTS Montréal (QScale × Énergir) · Hortidaily 09/2023 (Blockheating bankruptcy) · GFActueel 03/2024 (Agriport A7, "loze belofte") · Green Mountain × Hima (Rjukan, live 2025) · DCD/CNN (Bibai).' },
    { no: '07', t: 'THE PRIZE', meta: 'WHAT INTEGRATION BUYS',
      html: `<p>Honesty about magnitude: piping every recoverable data-center watt into greenhouses moves
        the national gas balance by single-digit Bcf per year against a ~37,000 Bcf market. This does not
        rescue DRAWDOWN's storage curve, and this site will never claim it does. What it moves is the food
        system: the US imports the majority of its winter fresh tomatoes, cucumbers and peppers —
        overwhelmingly from Mexico; every frontier hectare grows produce at the fence line with heat that
        was being vented and CO₂ that was being released, and retires a gas boiler that would have heated
        that greenhouse otherwise.</p>
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
      <div class="brief-kicker">THE BRIEF · SEVEN DOCUMENTS</div>
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
      if (!w) return; // navigated away before the data resolved
      const pill = b => `<span class="bpill b${{ frontier: 1, fail_light: 2, fail_heat: 3, fail_both: 4 }[b]}">${b.replace('_', '-').toUpperCase()}</span>`;
      const safeURL = u => /^https?:\/\//.test(u) ? esc(u) : '#';
      w.innerHTML = `
        <h2>Provenance</h2>
        <div class="data-sub">Every number on this site is compiled offline from the sources below into
          static JSON (<a href="data/summary.json">inspect</a>) — the browser only renders. Method:
          ${esc(s.thresholds.method)}. Compiled ${esc(s.built)}.</div>
        <table class="tbl"><tr><th>SOURCE</th><th>ORG</th><th>ROLE</th><th>VINTAGE</th><th>RETRIEVED</th><th>LICENSE</th></tr>
          ${s.provenance.map(p => `<tr><td><a href="${safeURL(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a></td>
            <td>${esc(p.org)}</td><td>${esc(p.role)}</td><td>${esc(p.vintage)}</td><td>${esc(p.retrieved)}</td><td>${esc(p.license)}</td></tr>`).join('')}
          <tr><td><a href="pipeline/verify.mjs">updraft pipeline — verify.mjs</a></td>
            <td>this site</td><td>recomputes every headline number above from the shipped JSON; constants + math shared with the atlas via <a href="pipeline/shared.js">shared.js</a></td>
            <td>2026-08-17</td><td>—</td><td>runs offline: <span class="mono-inline">node pipeline/verify.mjs</span></td></tr>
        </table>
        <h2>Payoff assumptions</h2>
        <div class="data-sub">Atlas popups show <b>planning estimates</b> computed in the browser from the
          shipped data: IT load = floor area × 75 W/sqft (planning range 50–150); recoverable heat = 85%
          of IT load; greenhouse area = 0.3 ha per MWth guaranteed at design day → 1.0 ha per MWth
          energy-matched with seasonal storage (consistent with Falk et al. and QScale's ~130 ha on
          96 MW); displaced boiler gas assumes the greenhouse absorbs 45% of annual heat through an 85%
          boiler at $0.90/therm commercial gas. Screening numbers, not engineering — every constant is
          declared once in <a href="pipeline/shared.js">pipeline/shared.js</a>, the same file the atlas
          runs on; change one there and <span class="mono-inline">node pipeline/verify.mjs</span> re-checks the site.</div>
        <h2>Frontier share by waste-heat source</h2>
        <div class="data-sub">Share of each fleet with December DLI ≥ ${s.thresholds.dli_dec} mol/m²/day AND annual HDD65 ≥ ${fmt(s.thresholds.hdd65)}.</div>
        <table class="tbl"><tr><th>SOURCE FLEET</th><th class="r">FACILITIES</th><th class="r">FRONTIER %</th><th class="bar-td"></th></tr>
          ${s.sectors.map(x => `<tr class="${/Ethanol plants|Data centers/.test(x.sector) ? 'hl' : ''}">
            <td>${esc(x.sector)}</td><td class="r">${fmt(x.n)}</td><td class="r">${x.frontier_pct}</td>
            <td class="bar-td"><i style="width:${x.frontier_pct}%"></i></td></tr>`).join('')}
        </table>
        <h2>Threshold sensitivity — % of data centers in frontier</h2>
        <div class="data-sub">The full grid runs 12.6–68%. Computed offline from unrounded climatology;
          the atlas sliders recompute live from the shipped 1-decimal cell values, so the strictest
          corners can differ by a point or two.</div>
        <table class="tbl"><tr><th></th>${s.sensitivity.hdd.map(h => `<th class="r">HDD ≥ ${fmt(h)}</th>`).join('')}</tr>
          ${s.sensitivity.dli.map((dl, i) => `<tr ${dl === 10 ? 'class="hl"' : ''}><td>DLI ≥ ${dl}</td>
            ${s.sensitivity.hdd.map((h, j) => `<td class="r">${s.sensitivity.pct[i][j]}${dl === 10 && h === 4000 ? ' ◀' : ''}</td>`).join('')}</tr>`).join('')}
        </table>
        <h2>Hub verdicts</h2>
        <div class="data-sub">The nearest scored climate cell to each major data-center market.</div>
        <table class="tbl"><tr><th>HUB</th><th class="r">DEC DLI</th><th class="r">HDD65</th><th class="r">FACILITIES IN CELL</th><th>BAND</th></tr>
          ${s.hubs.map(h => `<tr><td>${esc(h.hub)}</td><td class="r">${h.dli}</td><td class="r">${fmt(h.hdd)}</td>
            <td class="r">${h.n}</td><td>${pill(h.band)}</td></tr>`).join('')}
        </table>
        <h2>Design day — can 40 °C water carry the load?</h2>
        <div class="data-sub">The first calculation a developer runs: peak heating load at each hub's ASHRAE
          99% design temperature (2025 Handbook, station named per hub), against what a low-temperature
          emitter package can deliver from ~40 °C supply. Peak = U<sub>eff</sub> 5.0 W/m²K ×
          (18 °C − T<sub>99</sub>) × 1.3 envelope/floor; deliverable ≈150 W/m² at 40 °C supply.
          BOOST = a small-lift heat pump (or storage + backup) covers the remainder — the honest
          difference between Ashburn and Cheyenne.</div>
        <table class="tbl"><tr><th>HUB</th><th>STATION</th><th class="r">99% DESIGN</th><th class="r">PEAK W/m²</th><th class="r">SERVABLE @40 °C</th><th>BOOST?</th></tr>
          ${d.layers.hubs.map(h => `<tr class="${h.boost ? '' : 'hl'}"><td>${esc(h.hub)}</td><td>${esc(h.station)}</td>
            <td class="r">${h.t99_c} °C</td><td class="r">${h.peak_wm2}</td><td class="r">${h.servable40_pct}%</td>
            <td>${h.boost ? 'small-lift HP or storage' : '<span class="mono-inline">no</span>'}</td></tr>`).join('')}
        </table>
        <h2>Analysis-layer assumptions &amp; sources</h2>
        <div class="data-sub">The LIGHT COST surface holds DLI 17 at canopy (tomato-grade; 65% glazing
          transmission) with LEDs at 2.6 µmol/J, priced at each state's 2024 EIA industrial rate —
          monthly light gaps from NASA POWER 2001–2020 climatology (December re-derived exactly matches
          the compiled atlas). WATER STRESS is WRI Aqueduct 4.0 state baseline stress (1979–2019 baseline).
          CO₂ CLAIMS marks ${d.layers.co2.matched.length} of 179 plants with operating CCS
          (${d.layers.co2.counts.operating}) or Summit contracts (${d.layers.co2.counts.contracted};
          current-27 vs pre-2026 book both marked). Constants in
          <a href="pipeline/shared.js">pipeline/shared.js</a>; rebuild with
          <span class="mono-inline">node pipeline/build_layers.mjs</span>, check with
          <span class="mono-inline">node pipeline/verify.mjs</span>.</div>
        <table class="tbl"><tr><th>LAYER SOURCE</th><th>VINTAGE</th><th>RETRIEVED</th><th>METHOD</th></tr>
          ${d.layers._meta.sources.map(p => `<tr><td>${p.url ? `<a href="${/^https?:\/\//.test(p.url) ? esc(p.url) : '#'}" target="_blank" rel="noopener">${esc(p.source)}</a>` : esc(p.source)}</td>
            <td>${esc(p.vintage || '—')}</td><td>${esc(p.retrieved || '—')}</td><td>${esc(p.method || '—')}</td></tr>`).join('')}
        </table>`;
    }).catch(err => {
      const w = $('#datawrap');
      if (w) w.textContent = 'failed to load data: ' + err.message;
    });
  }

  boot();
})();
