/* UPDRAFT — ATLAS: the frontier map (MapLibre GL, vendored; Carto dark-matter basemap —
   the Drawdown Atlas stack). Layers, bottom to top:
     cells     — 1,592 NASA POWER climate cells, band-tinted (on by default — the WHY)
     hovercell — outline of the cell under the cursor
     pairs     — frontier data center → nearest ethanol plant, ≤100 km (the golden pairs)
     pairs-hit — invisible wide twin of pairs so thin lines are clickable
     dc        — 1,474 data centers, circles colored by band
     eth       — 179 ethanol plants, triangles colored by band, white-ringed
   Bands are recomputed in the browser from each facility's climate cell (math shared
   with the verifier via pipeline/shared.js), so the threshold sliders re-draw the
   frontier live as pure style updates — no per-tick geometry rebuilds. At the default
   thresholds this reproduces the compiled facility bands exactly; 4 of 1,592 cells
   shift one band from 1-decimal display rounding (disclosed in pipeline/README.md).
   Verify: node pipeline/verify.mjs */
const UD = (() => {
  let dataPromise = null;
  function load() {
    if (dataPromise) return dataPromise;
    dataPromise = Promise.all(
      ['facilities', 'cells', 'summary'].map(n =>
        fetch('data/' + n + '.json').then(r => { if (!r.ok) throw new Error(n + ' ' + r.status); return r.json(); })
      )
    ).then(([facilities, cells, summary]) => ({ facilities, cells, summary }));
    dataPromise.catch(() => { dataPromise = null; }); // transient failure: next call retries
    return dataPromise;
  }
  return { load };
})();

const Atlas = (() => {
  const { EST, bandOf, haversine, cellKey, esc, fmt } = globalThis.UD_SHARED;

  const BC = { 1: '#3987e5', 2: '#d95926', 3: '#2ec4a0', 4: '#898781' };
  const BAND_LABEL = { 1: 'FRONTIER', 2: 'COLD BUT TOO DARK', 3: 'BRIGHT, LOW HEAT DEMAND', 4: 'NEITHER' };
  const STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
  const FALLBACK_STYLE = { version: 8, name: 'ud-fallback', sources: {}, layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#070503' } }] };
  const DEFAULTS = { dli: 10, hdd: 4000 };

  let map = null, mlPromise = null, stylePromise = null, popup = null, model = null;
  let styleFellBack = false, rebandQueued = false, hoverKey = null, renderSeq = 0;
  const state = {
    layers: { dc: true, eth: true, pairs: true, cells: true },
    bands: [1, 2, 3, 4],
    t: { ...DEFAULTS },
    view: null, // {center:[lon,lat], zoom} from URL or captured on destroy
  };

  function loadML() {
    if (mlPromise) return mlPromise;
    mlPromise = new Promise((res, rej) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = 'vendor/maplibre-gl.css';
      document.head.appendChild(l);
      const s = document.createElement('script');
      s.src = 'vendor/maplibre-gl.js';
      s.onload = res;
      s.onerror = () => { mlPromise = null; rej(new Error('maplibre-gl failed to load')); };
      document.head.appendChild(s);
    });
    return mlPromise;
  }
  function loadStyle() {
    // Fetch the basemap style ourselves so a blocked CDN degrades to a dark field
    // with the (self-hosted) data still shown, instead of a silent black void.
    if (stylePromise) return stylePromise;
    let signal;
    try { signal = AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined; }
    catch { signal = undefined; }
    stylePromise = fetch(STYLE_DARK, { signal })
      .then(r => { if (!r.ok) throw new Error('style ' + r.status); return r.json(); })
      .catch(() => { styleFellBack = true; return FALLBACK_STYLE; });
    return stylePromise;
  }

  // ── model: compact arrays → objects, snapped to climate cells, payoff precomputed
  const fmtMW = v => v >= 10 ? fmt(v) : fmt(v, 1);
  const fmtUSD = v => v >= 995000 ? '$' + (v / 1e6).toFixed(1) + 'M/yr' : '$' + fmt(v / 1e3) + 'k/yr';

  function buildModel(d) {
    const grid = { dlat: d.cells.dlat, dlon: d.cells.dlon };
    const cellIx = new Map();
    const cells = d.cells.rows.map(r => {
      const c = { lat: r[0], lon: r[1], dli: r[2], hdd: r[3], band: r[4] };
      cellIx.set(cellKey(c.lat, c.lon, grid.dlat, grid.dlon), c);
      return c;
    });
    const cellAt = (lat, lon) => cellIx.get(cellKey(lat, lon, grid.dlat, grid.dlon)) || null;

    const eths = d.facilities.ethanol.map((r, i) => ({
      i, lon: r[0], lat: r[1], band: r[2], mmgal: r[3], co2kt: r[4], state: r[5], label: r[6],
      cell: cellAt(r[1], r[0]),
      haEnrich: r[4] ? r[4] * 1000 / EST.co2TPerHaYr : null,
    }));
    const dcs = d.facilities.dc.map((r, i) => {
      const f = { i, lon: r[0], lat: r[1], band: r[2], sqft: r[3], state: r[4], label: r[5],
        cell: cellAt(r[1], r[0]), pay: null, near: null };
      if (f.sqft) {
        const it = f.sqft * EST.wPerSqft / 1e6, heat = it * EST.capture;
        f.pay = { it, heat, haLo: heat * EST.haPerMWpeak, haHi: heat * EST.haPerMWenergy,
          usd: heat * 8760 * EST.absorb * EST.thermsPerMWh / EST.boilerEff * EST.usdPerTherm };
      }
      let best = -1, bkm = Infinity;
      for (let j = 0; j < eths.length; j++) {
        const km = haversine(f.lon, f.lat, eths[j].lon, eths[j].lat);
        if (km < bkm) { bkm = km; best = j; }
      }
      f.near = { e: best, km: bkm };
      return f;
    });
    return { grid, cells, cellIx, dcs, eths, summary: d.summary, kpi: {}, pairs: [] };
  }

  function rebandModel() {
    const t = state.t, m = model;
    for (const c of m.cells) c.band = bandOf(c.dli, c.hdd, t);
    // a facility with no containing cell (none in today's data) gets band 4,
    // matching the map expression's -1/-1 fallback properties
    for (const f of m.dcs) f.band = f.cell ? bandOf(f.cell.dli, f.cell.hdd, t) : 4;
    for (const f of m.eths) f.band = f.cell ? bandOf(f.cell.dli, f.cell.hdd, t) : 4;
    const fr = m.dcs.filter(f => f.band === 1);
    m.pairs = fr.filter(f => f.near.km <= 100)
      .map(f => ({ dc: f, eth: m.eths[f.near.e], km: f.near.km }))
      .sort((a, b) => a.km - b.km);
    m.kpi = {
      dcF: fr.length, dcN: m.dcs.length, dcPct: (100 * fr.length / m.dcs.length).toFixed(1),
      ethF: m.eths.filter(f => f.band === 1).length, ethN: m.eths.length,
      n50: m.pairs.filter(p => p.km <= 50).length, n100: m.pairs.length,
    };
    m.kpi.ethPct = (100 * m.kpi.ethF / m.kpi.ethN).toFixed(1);
  }

  // nearest frontier DC for one ethanol plant — computed on demand at popup time,
  // so slider ticks never pay for it and the answer is always current
  function nearestFrontierDC(e) {
    let best = null, bkm = Infinity;
    for (const f of model.dcs) {
      if (f.band !== 1) continue;
      const km = haversine(e.lon, e.lat, f.lon, f.lat);
      if (km < bkm) { bkm = km; best = f; }
    }
    return best ? { f: best, km: bkm } : null;
  }

  // ── GeoJSON: geometry + climate properties are built ONCE; thresholds never
  //    touch these sources again (banding lives in paint/filter expressions)
  const ptProps = f => ({ i: f.i, dli: f.cell ? f.cell.dli : -1, hdd: f.cell ? f.cell.hdd : -1 });
  const dcGeo = () => ({ type: 'FeatureCollection', features: model.dcs.map(f => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [f.lon, f.lat] }, properties: ptProps(f) })) });
  const ethGeo = () => ({ type: 'FeatureCollection', features: model.eths.map(f => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [f.lon, f.lat] }, properties: ptProps(f) })) });
  const cellGeo = () => ({ type: 'FeatureCollection', features: model.cells.map(c => cellPoly(c)) });
  function cellPoly(c) {
    const dy = model.grid.dlat / 2, dx = model.grid.dlon / 2;
    return { type: 'Feature', properties: { dli: c.dli, hdd: c.hdd },
      geometry: { type: 'Polygon', coordinates: [[
        [c.lon - dx, c.lat - dy], [c.lon + dx, c.lat - dy], [c.lon + dx, c.lat + dy],
        [c.lon - dx, c.lat + dy], [c.lon - dx, c.lat - dy]]] } };
  }
  const pairGeo = () => ({ type: 'FeatureCollection', features: model.pairs.map((p, i) => ({
    type: 'Feature', properties: { i },
    geometry: { type: 'LineString', coordinates: [[p.dc.lon, p.dc.lat], [p.eth.lon, p.eth.lat]] } })) });

  // ── threshold expressions: the sliders re-color and re-filter via these,
  //    which is a style-only update MapLibre applies without re-tiling
  const bandExpr = t => ['case',
    ['all', ['>=', ['get', 'dli'], t.dli], ['>=', ['get', 'hdd'], t.hdd]], 1,
    ['>=', ['get', 'hdd'], t.hdd], 2,
    ['>=', ['get', 'dli'], t.dli], 3,
    4];
  const colorExpr = t => ['match', bandExpr(t), 1, BC[1], 2, BC[2], 3, BC[3], BC[4]];
  const iconExpr = t => ['concat', 'tri', ['to-string', bandExpr(t)]];
  const bandFilter = t => ['in', bandExpr(t), ['literal', state.bands]];

  // triangle icons per band (canvas → addImage)
  function triImage(color) {
    const w = 30, h = 28, c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.beginPath(); x.moveTo(w / 2, 3); x.lineTo(w - 3, h - 4); x.lineTo(3, h - 4); x.closePath();
    x.fillStyle = color; x.fill();
    x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,.92)'; x.stroke();
    return c.getContext('2d').getImageData(0, 0, w, h);
  }

  // ── URL state: #/atlas?c=lon,lat&z=4.2&l=dc.eth.pairs.cells&b=1.2.3.4&dli=10&hdd=4000
  function readURL() {
    const q = location.hash.split('?')[1];
    if (!q) return;
    const p = new URLSearchParams(q);
    if (p.get('c')) {
      let [lon, lat] = p.get('c').split(',').map(Number);
      const z = parseFloat(p.get('z') ?? '');
      if (isFinite(lon) && isFinite(lat)) {
        lat = Math.max(-85, Math.min(85, lat));   // MapLibre throws beyond ±90;
        lon = Math.max(-180, Math.min(180, lon)); // clamp instead of bricking on a mangled link
        state.view = { center: [lon, lat], zoom: isFinite(z) ? z : 5 };
      }
    }
    if (p.get('l') != null) {
      const on = new Set(p.get('l').split('.'));
      for (const k of Object.keys(state.layers)) state.layers[k] = on.has(k);
    }
    if (p.get('b') != null)
      state.bands = p.get('b').split('.').map(Number).filter(n => n >= 1 && n <= 4);
    const dli = parseFloat(p.get('dli') ?? ''), hdd = parseInt(p.get('hdd') ?? '', 10);
    if (isFinite(dli)) state.t.dli = Math.min(16, Math.max(6, dli));
    if (isFinite(hdd)) state.t.hdd = Math.min(7000, Math.max(2000, hdd));
  }
  function syncURL() {
    if (!map) return; // map is destroyed the moment the route leaves the atlas
    const c = map.getCenter(), p = new URLSearchParams();
    p.set('c', c.lng.toFixed(2) + ',' + c.lat.toFixed(2));
    p.set('z', map.getZoom().toFixed(1));
    p.set('l', Object.keys(state.layers).filter(k => state.layers[k]).join('.'));
    p.set('b', state.bands.join('.'));
    if (state.t.dli !== DEFAULTS.dli) p.set('dli', state.t.dli);
    if (state.t.hdd !== DEFAULTS.hdd) p.set('hdd', state.t.hdd);
    history.replaceState(null, '', location.pathname + '#/atlas?' + p.toString());
  }

  // ── layers
  function addLayers() {
    const t = state.t;
    map.addSource('cells', { type: 'geojson', data: cellGeo() });
    map.addLayer({ id: 'cells', type: 'fill', source: 'cells',
      layout: { visibility: state.layers.cells ? 'visible' : 'none' },
      paint: { 'fill-color': colorExpr(t), 'fill-opacity': 0.22 } });

    map.addSource('hovercell', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'hovercell', type: 'line', source: 'hovercell',
      paint: { 'line-color': '#ffb454', 'line-width': 1.2, 'line-opacity': 0.7 } });

    map.addSource('pairs', { type: 'geojson', data: pairGeo() });
    map.addLayer({ id: 'pairs', type: 'line', source: 'pairs',
      layout: { visibility: state.layers.pairs ? 'visible' : 'none' },
      paint: { 'line-color': '#ffb454', 'line-width': 1, 'line-opacity': 0.5 } });
    map.addLayer({ id: 'pairs-hit', type: 'line', source: 'pairs',
      layout: { visibility: state.layers.pairs ? 'visible' : 'none' },
      paint: { 'line-color': '#ffb454', 'line-width': 9, 'line-opacity': 0.01 } });

    map.addSource('dc', { type: 'geojson', data: dcGeo() });
    map.addLayer({ id: 'dc', type: 'circle', source: 'dc',
      layout: { visibility: state.layers.dc ? 'visible' : 'none' },
      paint: {
        'circle-color': colorExpr(t),
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 2.1, 6, 4.2, 9, 7],
        'circle-opacity': 0.8 } });

    [1, 2, 3, 4].forEach(b => map.addImage('tri' + b, triImage(BC[b])));
    map.addSource('eth', { type: 'geojson', data: ethGeo() });
    map.addLayer({ id: 'eth', type: 'symbol', source: 'eth',
      layout: {
        visibility: state.layers.eth ? 'visible' : 'none',
        'icon-image': iconExpr(t),
        'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.42, 6, 0.62, 9, 0.85],
        'icon-allow-overlap': true } });

    applyBandFilter();
  }

  // registered at map creation, not on 'load' — the load event needs a render
  // frame, which background/hidden tabs never produce; these handlers are all
  // safe pre-load (delegated events no-op, the dispatch re-checks getLayer)
  function wireMapEvents() {
    ['dc', 'eth', 'pairs-hit'].forEach(id => {
      map.on('mouseenter', id, () => map.getCanvas().style.cursor = 'pointer');
      map.on('mouseleave', id, () => map.getCanvas().style.cursor = '');
    });
    // one dispatch, explicit priority — dots beat triangles beat lines
    map.on('click', e => {
      const layers = ['dc', 'eth', 'pairs-hit'].filter(id => map.getLayer(id));
      if (!layers.length) return;
      const feats = map.queryRenderedFeatures(e.point, { layers });
      if (!feats.length) return;
      const pri = { dc: 0, eth: 1, 'pairs-hit': 2 };
      feats.sort((a, b) => pri[a.layer.id] - pri[b.layer.id]);
      const hit = feats[0], p = hit.properties;
      if (hit.layer.id === 'dc') popDC(model.dcs[p.i]);
      else if (hit.layer.id === 'eth') popEth(model.eths[p.i]);
      else { const pair = model.pairs[p.i]; if (pair) popPair(pair, e.lngLat); }
    });
    map.on('mousemove', e => {
      setHoverCell(model.cellIx.get(cellKey(e.lngLat.lat, e.lngLat.lng, model.grid.dlat, model.grid.dlon)) || null);
    });
    map.on('mouseout', () => setHoverCell(null));
  }

  function applyThresholds() {
    if (!map || !map.getLayer('cells')) return;
    const t = state.t;
    map.setPaintProperty('cells', 'fill-color', colorExpr(t));
    map.setPaintProperty('dc', 'circle-color', colorExpr(t));
    map.setLayoutProperty('eth', 'icon-image', iconExpr(t));
    applyBandFilter(); // the filter embeds the thresholds too
    const s = map.getSource('pairs'); // membership genuinely changes — the one real setData
    if (s) s.setData(pairGeo());
  }

  function applyBandFilter() {
    if (!map) return;
    const f = bandFilter(state.t);
    ['dc', 'eth', 'cells'].forEach(id => map.getLayer(id) && map.setFilter(id, f));
    // pairs are frontier-only by construction; they need band 1 visible
    const pairsOn = state.layers.pairs && state.bands.includes(1);
    ['pairs', 'pairs-hit'].forEach(id => map.getLayer(id) &&
      map.setLayoutProperty(id, 'visibility', pairsOn ? 'visible' : 'none'));
  }

  // rail affordances that depend on cross-control state, derived in one place
  function syncRailDeps() {
    const tog = document.querySelector('.tog[data-layer="pairs"]');
    if (tog) {
      tog.classList.toggle('dep-off', !state.bands.includes(1));
      tog.title = state.bands.includes(1) ? '' : 'golden pairs are frontier-only — re-enable the FRONTIER band to show them';
    }
    const hint = document.getElementById('map-hint');
    if (hint) hint.hidden = state.bands.length !== 0;
  }

  // ── popups
  function openPop(ll, html) {
    if (popup) popup.remove();
    popup = new maplibregl.Popup({ closeButton: true, maxWidth: '300px' })
      .setLngLat(ll).setHTML(`<div class="pop">${html}</div>`).addTo(map);
  }
  const bandRow = b =>
    `<span class="pk">BAND</span> <span class="pb" style="color:${BC[b]}">${BAND_LABEL[b]}</span>`;
  const cellRow = c => c
    ? `<span class="pk">CELL</span> DLI ${fmt(c.dli, 1)} · ${fmt(c.hdd)} HDD` : '';

  function popDC(f) {
    const near = model.eths[f.near.e];
    const pay = f.pay ? `
      <div class="pay">
        <div>≈ <b>${fmtMW(f.pay.it)} MW</b> IT → <b>${fmtMW(f.pay.heat)} MWth</b> recoverable</div>
        <div>≈ <b>${fmt(f.pay.haLo, f.pay.haLo < 10 ? 1 : 0)}–${fmt(f.pay.haHi, f.pay.haHi < 10 ? 1 : 0)} ha</b> greenhouse heated</div>
        <div>≈ <b>${fmtUSD(f.pay.usd)}</b> boiler gas displaced</div>
      </div>`
      : `<div class="pay dimmed">payoff needs floor area — not in the source atlas for this site</div>`;
    openPop([f.lon, f.lat], `
      <div class="pn">${esc(f.label)}</div>
      ${bandRow(f.band)}<br>${cellRow(f.cell)}<br>
      <span class="pk">FLOOR</span> ${f.sqft ? fmt(f.sqft) + ' sqft' : '—'} · <span class="pk">STATE</span> ${esc(f.state)}
      ${pay}
      <span class="pk">CO₂</span> ${esc(near.label)} · ${fmt(f.near.km)} km${f.near.km > 100 ? ' <span class="dimtx">(beyond pair range)</span>' : ''}
      <div class="pfoot">planning estimates — assumptions in <a href="#/data">DATA</a></div>`);
  }
  function popEth(f) {
    const nd = nearestFrontierDC(f);
    openPop([f.lon, f.lat], `
      <div class="pn">${esc(f.label)}</div>
      ${bandRow(f.band)}<br>${cellRow(f.cell)}<br>
      <span class="pk">CAPACITY</span> ${f.mmgal ? fmt(f.mmgal) + ' MMgal/yr' : '—'}<br>
      <span class="pk">FERM CO₂</span> ${f.co2kt ? fmt(f.co2kt) + ' kt/yr → enriches ≈ ' + fmt(f.haEnrich) + ' ha' : '—'}<br>
      <span class="pk">STATE</span> ${esc(f.state)}<br>
      <span class="pk">NEAREST FRONTIER DC</span> ${nd ? esc(nd.f.label) + ' · ' + fmt(nd.km) + ' km' : '—'}
      <div class="pfoot">planning estimates — assumptions in <a href="#/data">DATA</a></div>`);
  }
  function popPair(p, ll) {
    openPop(ll || [(p.dc.lon + p.eth.lon) / 2, (p.dc.lat + p.eth.lat) / 2], `
      <div class="pn">GOLDEN PAIR · ${fmt(p.km)} KM</div>
      <span class="pk">HEAT</span> ${esc(p.dc.label)}${p.dc.pay ? ' · ≈' + fmtMW(p.dc.pay.heat) + ' MWth' : ''}<br>
      <span class="pk">CO₂</span> ${esc(p.eth.label)}${p.eth.co2kt ? ' · ' + fmt(p.eth.co2kt) + ' kt/yr' : ''}<br>
      <span class="dimtx">greenhouse at the DC fence line, CO₂ trucked or piped ${fmt(p.km)} km</span>`);
  }

  // ── hover inspector
  function setHoverCell(c) {
    const key = c ? c.lat + '|' + c.lon : null;
    if (key === hoverKey) return;
    hoverKey = key;
    const src = map && map.getSource('hovercell');
    if (src) src.setData({ type: 'FeatureCollection', features: c ? [cellPoly(c)] : [] });
    const el = document.getElementById('cellread');
    if (!el) return;
    if (!c) { el.hidden = true; return; }
    el.hidden = false;
    const t = state.t;
    let need = '';
    if (c.band === 2) need = ` · +${(t.dli - c.dli).toFixed(1)} DLI to frontier`;
    else if (c.band === 3) need = ` · +${fmt(t.hdd - c.hdd)} HDD to frontier`;
    else if (c.band === 4) need = ` · +${(t.dli - c.dli).toFixed(1)} DLI, +${fmt(t.hdd - c.hdd)} HDD`;
    el.innerHTML = `<b style="color:${BC[c.band]}">${BAND_LABEL[c.band]}</b> · DLI ${fmt(c.dli, 1)} · ${fmt(c.hdd)} HDD${esc(need)}`;
  }

  // ── rail
  function sectorSVG(sectors) {
    const W = 296, ROW = 19, PAD = 2, LW = 150;
    const rows = sectors.map((s, i) => {
      const y = i * ROW + PAD, hot = /Ethanol plants|Data centers/.test(s.sector);
      // fixed 0–100 axis: a percentage deserves a percentage scale
      const bw = Math.max(2, (W - LW - 44) * s.frontier_pct / 100);
      return `<text x="${LW - 6}" y="${y + 12}" text-anchor="end" font-size="10.5" fill="${hot ? '#ddd3c4' : '#998c7a'}" font-weight="${hot ? 700 : 400}">${esc(s.sector)}</text>
        <rect x="${LW}" y="${y + 4}" width="${bw}" height="9" fill="${hot ? '#ffb454' : '#8f6527'}" opacity="${hot ? 1 : .55}"/>
        <text x="${LW + bw + 5}" y="${y + 12}" font-size="10.5" fill="${hot ? '#ffb454' : '#998c7a'}" font-family="inherit">${s.frontier_pct}%</text>`;
    }).join('');
    return `<svg class="mini" viewBox="0 0 ${W} ${sectors.length * ROW + PAD * 2}" xmlns="http://www.w3.org/2000/svg" font-family="'JetBrains Mono',monospace" role="img" aria-label="Frontier share by waste-heat source fleet">${rows}</svg>`;
  }

  function rail(d) {
    return `
      <div class="rail-hd">The frontier<small>DEC LIGHT ≥ <span id="th-dli">${state.t.dli}</span> mol/m²/d · HEAT DEMAND ≥ <span id="th-hdd">${fmt(state.t.hdd)}</span> HDD</small></div>
      <div class="kpis">
        <div class="kpi"><div class="v b1" id="k-dc">—</div><div class="k" id="k-dc-l">DATA CENTERS IN FRONTIER</div></div>
        <div class="kpi"><div class="v b1" id="k-eth">—</div><div class="k">ETHANOL PLANTS IN FRONTIER (n=${model.eths.length})</div></div>
        <div class="kpi"><div class="v" id="k-p50">—</div><div class="k">GOLDEN PAIRS — DC ≤50 KM FROM ETHANOL</div></div>
        <div class="kpi"><div class="v">${d.summary.headline.ethanol.co2_ferm_mt} Mt</div><div class="k">FERM CO2 / YR — 4–16× FULL-BUILDOUT DEMAND</div></div>
      </div>
      <div class="rail-sec"><h4 id="lbl-search">FIND A SITE</h4>
        <div class="searchbox">
          <input id="ud-search" type="search" placeholder="name or state — try Ashburn, WY…"
                 autocomplete="off" spellcheck="false" aria-labelledby="lbl-search">
          <div id="ud-results" role="listbox" aria-label="matching facilities" hidden></div>
        </div>
      </div>
      <div class="rail-sec"><h4>THRESHOLDS — REDRAW THE FRONTIER</h4>
        <label class="sld"><span>DEC LIGHT ≥ <b id="sv-dli">${state.t.dli}</b> mol/m²/d</span>
          <input type="range" id="sl-dli" min="6" max="16" step="0.5" value="${state.t.dli}" aria-label="December light threshold, mol per square meter per day"></label>
        <label class="sld"><span>HEAT DEMAND ≥ <b id="sv-hdd">${fmt(state.t.hdd)}</b> HDD</span>
          <input type="range" id="sl-hdd" min="2000" max="7000" step="250" value="${state.t.hdd}" aria-label="Annual heating degree days threshold"></label>
        <div class="sld-note">The lines are a choice — drag them and watch the count. <button id="t-reset" class="lnkbtn" ${state.t.dli === DEFAULTS.dli && state.t.hdd === DEFAULTS.hdd ? 'hidden' : ''}>reset to 10 / 4,000</button></div>
      </div>
      <div class="rail-sec"><h4>LAYERS</h4>
        ${[['dc', 'Data centers', fmt(model.dcs.length)], ['eth', 'Ethanol plants', model.eths.length],
           ['pairs', 'Golden pairs ≤100 km', ''], ['cells', 'Climate surface', '1,592 cells']]
          .map(([k, t, c]) => `<button class="tog ${state.layers[k] ? 'on' : ''}" data-layer="${k}" role="switch" aria-checked="${state.layers[k]}"><span class="sw"></span>${t}<span class="cnt" ${k === 'pairs' ? 'id="k-p100"' : ''}>${c}</span></button>`).join('')}
      </div>
      <div class="rail-sec"><h4>BANDS</h4>
        <div class="chips">
          ${[1, 2, 3, 4].map(b => `<button class="chip c${b} ${state.bands.includes(b) ? 'on' : ''}" data-band="${b}" aria-pressed="${state.bands.includes(b)}">${BAND_LABEL[b]}</button>`).join('')}
        </div>
      </div>
      <div class="rail-sec"><h4>TOP GOLDEN PAIRS</h4>
        <div id="toppairs" class="toppairs"></div>
      </div>
      <div class="rail-sec"><h4>FRONTIER SHARE BY WASTE-HEAT SOURCE</h4>
        ${sectorSVG(d.summary.sectors)}
        <div class="mini-cap">Share of each fleet inside the frontier band at the default thresholds.
          Ethanol and data centers lead the table; the textbook "industrial waste heat" fleets —
          refineries, pulp &amp; paper — sit at the bottom, where winters are mild.</div>
      </div>
      <div class="rail-sec rail-note">
        <b>Read the map:</b> blue = a machine whose exhaust could heat a greenhouse through the winter
        it sits in. Amber lines pair frontier data centers with the nearest fermentation-CO2 source.
        Click any mark or pair line for its numbers; hover the map for the climate underneath.
        Then read the <a href="#/brief">brief</a>, or <a href="#/data">view the numbers as tables</a>.
      </div>`;
  }

  function updateKPIs() {
    const k = model.kpi, $id = i => document.getElementById(i);
    if (!$id('k-dc')) return;
    $id('k-dc').innerHTML = `${k.dcF}<span style="font-size:12px;color:var(--ink-dim)">/${fmt(k.dcN)}</span>`;
    $id('k-dc-l').textContent = `DATA CENTERS IN FRONTIER — ${k.dcPct}%`;
    $id('k-eth').textContent = k.ethPct + '%';
    $id('k-p50').textContent = k.n50;
    const p100 = $id('k-p100'); if (p100) p100.textContent = k.n100;
    $id('th-dli').textContent = state.t.dli;
    $id('th-hdd').textContent = fmt(state.t.hdd);
    const tp = $id('toppairs');
    if (tp) {
      // campuses ship as many same-labeled facilities — show each name-pair once, shortest first
      const seen = new Set(), rows = [];
      for (let i = 0; i < model.pairs.length && rows.length < 8; i++) {
        const p = model.pairs[i], key = p.dc.label + '|' + p.eth.label;
        if (seen.has(key)) continue;
        seen.add(key); rows.push({ p, i });
      }
      tp.innerHTML = rows.map(({ p, i }) =>
        `<button class="tprow" data-pair="${i}">
           <span class="tpkm">${fmt(p.km)} km</span>
           <span class="tpnm">${esc(p.dc.label)} ↔ ${esc(p.eth.label)}</span>
         </button>`).join('') ||
        '<div class="dimtx" style="font-size:11px">no pairs at these thresholds</div>';
    }
  }

  function reband() {
    // timer debounce, not requestAnimationFrame — rAF freezes in hidden tabs,
    // which would silently drop slider changes made while the tab is backgrounded
    if (rebandQueued) return;
    rebandQueued = true;
    setTimeout(() => {
      rebandQueued = false;
      rebandModel();
      applyThresholds();
      updateKPIs();
      syncURL();
    }, 40);
  }

  // ── wiring
  function wireRail(mount) {
    mount.querySelectorAll('.tog').forEach(b => b.onclick = () => {
      const k = b.dataset.layer;
      state.layers[k] = !state.layers[k];
      b.classList.toggle('on', state.layers[k]);
      b.setAttribute('aria-checked', state.layers[k]);
      if (map && map.getLayer(k))
        map.setLayoutProperty(k, 'visibility', state.layers[k] ? 'visible' : 'none');
      if (k === 'pairs') applyBandFilter();
      syncURL();
    });
    mount.querySelectorAll('.chip').forEach(b => b.onclick = () => {
      const n = +b.dataset.band;
      state.bands = state.bands.includes(n) ? state.bands.filter(x => x !== n) : [...state.bands, n];
      b.classList.toggle('on', state.bands.includes(n));
      b.setAttribute('aria-pressed', state.bands.includes(n));
      applyBandFilter();
      syncRailDeps();
      syncURL();
    });

    const sdli = mount.querySelector('#sl-dli'), shdd = mount.querySelector('#sl-hdd');
    const reset = mount.querySelector('#t-reset');
    const onSlide = () => {
      state.t.dli = parseFloat(sdli.value);
      state.t.hdd = parseInt(shdd.value, 10);
      mount.querySelector('#sv-dli').textContent = state.t.dli;
      mount.querySelector('#sv-hdd').textContent = fmt(state.t.hdd);
      reset.hidden = state.t.dli === DEFAULTS.dli && state.t.hdd === DEFAULTS.hdd;
      reband();
    };
    sdli.oninput = onSlide; shdd.oninput = onSlide;
    reset.onclick = () => { sdli.value = DEFAULTS.dli; shdd.value = DEFAULTS.hdd; onSlide(); };

    mount.querySelector('#toppairs').onclick = e => {
      const row = e.target.closest('.tprow');
      if (!row) return;
      const p = model.pairs[+row.dataset.pair];
      if (!p || !map) return;
      map.fitBounds([[p.dc.lon, p.dc.lat], [p.eth.lon, p.eth.lat]], { padding: 60, maxZoom: 9.5 });
      popPair(p);
    };

    // search
    const inp = mount.querySelector('#ud-search'), res = mount.querySelector('#ud-results');
    const all = [
      ...model.dcs.map(f => ({ f, kind: 'dc' })),
      ...model.eths.map(f => ({ f, kind: 'eth' })),
    ];
    const goTo = it => {
      res.hidden = true; inp.blur();
      if (!map) return;
      map.flyTo({ center: [it.f.lon, it.f.lat], zoom: Math.max(map.getZoom(), 7.5) });
      it.kind === 'dc' ? popDC(it.f) : popEth(it.f);
    };
    let hits = [];
    inp.oninput = () => {
      const q = inp.value.trim().toLowerCase();
      if (q.length < 2) { hits = []; res.hidden = true; return; }
      const starts = [], contains = [];
      for (const it of all) {
        const l = it.f.label.toLowerCase();
        if (l.startsWith(q) || it.f.state.toLowerCase() === q) starts.push(it);
        else if (l.includes(q) || it.f.state.toLowerCase().startsWith(q)) contains.push(it);
        if (starts.length > 30) break;
      }
      hits = starts.concat(contains).slice(0, 8);
      res.innerHTML = hits.map((it, i) =>
        `<button role="option" data-hit="${i}"><span class="hitkind ${it.kind}">${it.kind === 'dc' ? '●' : '▲'}</span>${esc(it.f.label)} <span class="dimtx">· ${esc(it.f.state)}</span></button>`).join('') ||
        `<div class="dimtx" style="padding:5px 8px;font-size:11px">no match in 1,653 facilities</div>`;
      res.hidden = false;
    };
    inp.onkeydown = e => { if (e.key === 'Enter' && hits.length) goTo(hits[0]); if (e.key === 'Escape') res.hidden = true; };
    res.onmousedown = e => {
      const b = e.target.closest('[data-hit]');
      if (b) { e.preventDefault(); goTo(hits[+b.dataset.hit]); }
    };
    inp.onblur = () => setTimeout(() => { res.hidden = true; }, 150);
  }

  function render(mount) {
    const seq = ++renderSeq; // guards the async continuation against re-entry
    mount.innerHTML = `
      <div class="atlas-grid">
        <div class="rail" id="rail"></div>
        <div class="map-wrap">
          <div id="map"></div>
          <div id="cellread" class="cellread" hidden></div>
          <div id="map-hint" class="map-hint" hidden>no bands selected — pick a band chip on the left</div>
          <div class="leg" role="img" aria-label="Map legend">
            <div class="leg-h">SHAPE</div>
            <div><i class="dot"></i>DATA CENTER &nbsp;·&nbsp; <i class="tri"></i>ETHANOL PLANT</div>
            <div class="leg-h">COLOR — CLIMATE BAND</div>
            <div><i style="background:${BC[1]}"></i>FRONTIER · LIGHT + HEAT DEMAND</div>
            <div><i style="background:${BC[2]}"></i>COLD BUT TOO DARK</div>
            <div><i style="background:${BC[3]}"></i>BRIGHT, LOW HEAT DEMAND</div>
            <div><i style="background:${BC[4]}"></i>NEITHER</div>
            <div><i class="ln"></i>FRONTIER DC → NEAREST ETHANOL ≤100 KM</div>
          </div>
          <div class="attrib" id="attrib">© <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a> © OpenStreetMap · data compiled 2026-08-09</div>
        </div>
      </div>`;
    Promise.all([UD.load(), loadML(), loadStyle()]).then(([d, , style]) => {
      if (seq !== renderSeq) return; // a newer render (or route change) superseded this one
      const railEl = mount.querySelector('#rail');
      if (!railEl || !mount.querySelector('#map')) return; // navigated away mid-load
      if (map) { map.remove(); map = null; } // belt and braces: never stack two maps
      if (!model) model = buildModel(d);
      readURL();
      rebandModel();
      railEl.innerHTML = rail(d);
      wireRail(railEl);
      updateKPIs();
      syncRailDeps();
      map = new maplibregl.Map({
        container: 'map', style,
        center: state.view ? state.view.center : [-95.5, 38.3],
        zoom: state.view ? state.view.zoom : 3.7,
        minZoom: 2.6, maxZoom: 11,
        attributionControl: false, dragRotate: false, pitchWithRotate: false });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      if (styleFellBack) {
        const at = mount.querySelector('#attrib');
        if (at) at.innerHTML = 'basemap unreachable — facilities still shown · data compiled 2026-08-09';
      }
      map.on('load', () => addLayers());
      wireMapEvents();
      map.on('moveend', syncURL);
    }).catch(err => {
      if (seq !== renderSeq) return;
      const railEl = mount.querySelector('#rail');
      if (railEl) railEl.innerHTML =
        `<div class="rail-note">Failed to load data: <b>${esc(err.message)}</b>. Serve this app over HTTP (fetch cannot read file://).</div>`;
    });
  }

  function destroy() {
    renderSeq++; // invalidate any in-flight render continuation
    if (popup) { popup.remove(); popup = null; }
    if (map) {
      const c = map.getCenter();
      state.view = { center: [c.lng, c.lat], zoom: map.getZoom() }; // restore on return
      map.remove(); map = null;
    }
    hoverKey = null;
  }

  return {
    render, destroy,
    preload: () => { loadML().catch(() => {}); loadStyle(); },
  };
})();
