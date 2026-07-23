/* DRAWDOWN — F5 ATLAS: interactive map of the US gas system (MapLibre GL, vendored,
   Carto dark-matter basemap — the Avalon stack). Two sub-tabs:
     ATLAS  — layered geography: basins, pipeline corridors, LNG terminals, BTM campuses, demand hubs
     SITING — click-to-score a gas-powered data-center site (Thessa 23f pattern),
              grounded in the same engine (campus burn math + model price path). */
const Atlas = (() => {
  const $ = s => document.querySelector(s);
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };
  const fmt = (v, d = 0) => v.toLocaleString('en-US', { maximumFractionDigits: d });

  const STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
  const C = { green: '#3dff9e', amber: '#ffb454', red: '#ff5c5c', cyan: '#53d8ff', ink: '#c8d6df', dim: '#5b7284' };

  let map = null, geo = null, mlPromise = null, geoPromise = null, pinMarker = null;
  const state = {
    mode: 'atlas',
    view: { center: [-93.5, 37.6], zoom: 4.0 },
    layers: { basins: true, pipelines: true, lng: true, btm: true, demand: true },
    pin: null, gw: 1.0,
  };

  function loadML() {
    if (mlPromise) return mlPromise;
    mlPromise = new Promise((res, rej) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = 'vendor/maplibre-gl.css';
      document.head.appendChild(l);
      const s = document.createElement('script');
      s.src = 'vendor/maplibre-gl.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    return mlPromise;
  }
  function loadGeo() {
    if (geoPromise) return geoPromise;
    geoPromise = fetch('data/geo.json').then(r => r.ok ? r.json() : null).catch(() => null);
    return geoPromise;
  }

  // ── geometry helpers (equirect approximations — fine at map scale)
  const R = 6371;
  function havKm(a, b) { // [lon,lat]
    const dLat = (b[1] - a[1]) * Math.PI / 180, dLon = (b[0] - a[0]) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function segKm(p, a, b) {
    const kx = Math.cos(p[1] * Math.PI / 180) * 111.32, ky = 110.57;
    const P = [p[0] * kx, p[1] * ky], A = [a[0] * kx, a[1] * ky], B = [b[0] * kx, b[1] * ky];
    const ab = [B[0] - A[0], B[1] - A[1]], ap = [P[0] - A[0], P[1] - A[1]];
    const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1]) / (ab[0] ** 2 + ab[1] ** 2 || 1)));
    const q = [A[0] + t * ab[0], A[1] + t * ab[1]];
    return Math.hypot(P[0] - q[0], P[1] - q[1]);
  }
  const centroid = ring => ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]);

  // ── DOM
  function render(mount, sub) {
    state.mode = sub === 'siting' ? 'siting' : 'atlas';
    mount.innerHTML = `
      <div class="subtabs">
        <button class="subtab ${state.mode === 'atlas' ? 'on' : ''}" data-sub="atlas">ATLAS</button>
        <button class="subtab ${state.mode === 'siting' ? 'on' : ''}" data-sub="siting">SITING</button>
      </div>
      <div class="atlas-grid">
        <div class="atlas-left" id="atlas-left"></div>
        <div class="atlas-map-wrap"><div id="atlas-map"></div><div id="map-card-host"></div></div>
      </div>`;
    mount.querySelectorAll('.subtab').forEach(b => b.onclick = () => location.hash = '#/atlas/' + b.dataset.sub);
    renderLeft();
    initMap();
  }

  function renderLeft() {
    const left = $('#atlas-left');
    if (!left) return;
    if (state.mode === 'atlas') {
      const rows = [
        ['basins', 'PRODUCING BASINS', 'fill'],
        ['pipelines', 'FLOW CORRIDORS', 'line'],
        ['lng', 'LNG TERMINALS', 'circle'],
        ['btm', 'BTM DC CAMPUSES', 'circle'],
        ['demand', 'DEMAND HUBS', 'circle'],
      ];
      left.innerHTML = `
        <div class="panel-hd"><span class="tick">ATLAS.LAYERS</span> THE SYSTEM ON A MAP</div>
        ${rows.map(([id, label]) => `
          <div class="layer-row ${state.layers[id] ? 'on' : ''}" data-layer="${id}">
            <span class="sw"><i></i></span><span class="lk">${label}</span>
            <span class="ln" data-count="${id}"></span>
          </div>`).join('')}
        <div class="legend">
          <div class="li"><span class="dot" style="background:${C.green}"></span> operating LNG</div>
          <div class="li"><span class="dot" style="background:${C.amber}"></span> under construction</div>
          <div class="li"><span class="dot" style="background:${C.cyan}"></span> FID'd (2025-26 wave)</div>
          <div class="li"><span class="dot" style="background:${C.red}"></span> gas-powered DC campus (size = GW)</div>
          <div class="li"><span class="dot" style="background:${C.green};opacity:.25"></span> basin shade = producing region</div>
        </div>
        <div class="legend" style="border-bottom:none">
          Every marker is clickable. This is the whole thesis on one screen: the gas is in the
          shaded regions, the commitments are on the coast, and the red circles are new demand
          landing on top — connected by a fixed set of corridors.
        </div>`;
      left.querySelectorAll('.layer-row').forEach(r => r.onclick = () => {
        const id = r.dataset.layer;
        state.layers[id] = !state.layers[id];
        r.classList.toggle('on', state.layers[id]);
        applyVisibility();
      });
    } else {
      left.innerHTML = `
        <div class="panel-hd"><span class="tick warn">SITING.TOOL</span> DROP A CAMPUS</div>
        <div class="legend" style="font-size:12px;color:var(--ink)">
          Click anywhere on the map to site a gas-powered data-center campus. The tool scores the
          location against the same geography the ATLAS shows — gas access, corridor access, LNG
          feedgas competition — and prices the campus's burn with the model.
        </div>
        <div class="lever">
          <label><span>CAMPUS SIZE</span><span class="val" id="gw-val">${state.gw.toFixed(1)} GW</span></label>
          <input type="range" min="0.2" max="10" step="0.2" value="${state.gw}" id="gw-range">
          <div class="footnote">1 GW · 24/7 at new-CCGT heat rate ≈ 150 MMcf/d — Homer City's own disclosure.</div>
        </div>
        <div class="legend" style="border-bottom:none" id="site-hint">
          Scores are illustrative — distance-based against real geography, not a parcel screen.
          The point is the shape of the tradeoff: close to gas is far from fiber markets;
          close to the coast is bidding against Asia for molecules.
        </div>`;
      $('#gw-range').oninput = e => {
        state.gw = +e.target.value;
        $('#gw-val').textContent = state.gw.toFixed(1) + ' GW';
        if (state.pin) scoreSite(state.pin);
      };
    }
  }

  // ── map init + layers
  async function initMap() {
    const [, g] = await Promise.all([loadML(), loadGeo()]);
    geo = g;
    const host = $('#atlas-map');
    if (!host) return;                      // user navigated away while loading
    map = new maplibregl.Map({
      container: host, style: STYLE_DARK,
      center: state.view.center, zoom: state.view.zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    map.on('moveend', () => { state.view = { center: map.getCenter().toArray(), zoom: map.getZoom() }; });
    map.on('load', () => { addLayers(); applyVisibility(); wireClicks(); if (state.mode === 'siting' && state.pin) dropPin(state.pin); });
  }

  function fc(features) { return { type: 'FeatureCollection', features }; }

  function addLayers() {
    if (!geo) { Motion.toast('geo.json offline — map layers unavailable', { kind: 'warn', tag: 'ATLAS' }); return; }

    // basins
    map.addSource('basins', { type: 'geojson', data: fc((geo.basins || []).map(b => ({
      type: 'Feature', properties: { name: b.name, bcfd: b.production_bcfd },
      geometry: { type: 'Polygon', coordinates: [[...b.ring, b.ring[0]]] },
    }))) });
    map.addLayer({ id: 'basins-fill', type: 'fill', source: 'basins', paint: { 'fill-color': C.green, 'fill-opacity': 0.07 } });
    map.addLayer({ id: 'basins-line', type: 'line', source: 'basins', paint: { 'line-color': C.green, 'line-opacity': 0.35, 'line-width': 1 } });
    map.addLayer({ id: 'basins-label', type: 'symbol', source: 'basins',
      layout: { 'text-field': ['format', ['get', 'name'], {}, '\n', {}, ['concat', ['to-string', ['get', 'bcfd']], ' BCF/D'], { 'font-scale': 0.85 }], 'text-size': 11 },
      paint: { 'text-color': C.green, 'text-opacity': 0.75, 'text-halo-color': '#04070a', 'text-halo-width': 1.4 } });

    // pipelines
    map.addSource('pipes', { type: 'geojson', data: fc((geo.pipelines || []).map(p => ({
      type: 'Feature', properties: { name: p.name, bcfd: p.capacity_bcfd },
      geometry: { type: 'LineString', coordinates: p.path },
    }))) });
    map.addLayer({ id: 'pipes-line', type: 'line', source: 'pipes',
      paint: { 'line-color': C.cyan, 'line-opacity': 0.45, 'line-width': 1.6, 'line-dasharray': [2, 2] } });

    // LNG terminals
    const stColor = { operating: C.green, 'under-construction': C.amber, fid: C.cyan, 'pre-fid': C.dim };
    map.addSource('lng', { type: 'geojson', data: fc((geo.lng_terminals || []).map(t => ({
      type: 'Feature', properties: { ...t, color: stColor[t.status] || C.dim },
      geometry: { type: 'Point', coordinates: [t.lon, t.lat] },
    }))) });
    map.addLayer({ id: 'lng-pts', type: 'circle', source: 'lng', paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['+', 4, ['*', 2.2, ['sqrt', ['coalesce', ['get', 'capacity_bcfd'], 1]]]],
      'circle-opacity': 0.85, 'circle-stroke-color': '#04070a', 'circle-stroke-width': 1.5,
    } });

    // BTM DC campuses
    map.addSource('btm', { type: 'geojson', data: fc((geo.btm_projects || []).map(b => ({
      type: 'Feature', properties: { ...b },
      geometry: { type: 'Point', coordinates: [b.lon, b.lat] },
    }))) });
    map.addLayer({ id: 'btm-pts', type: 'circle', source: 'btm', paint: {
      'circle-color': C.red,
      'circle-radius': ['+', 4, ['*', 2.0, ['sqrt', ['coalesce', ['get', 'gw'], 1]]]],
      'circle-opacity': 0.8, 'circle-stroke-color': '#04070a', 'circle-stroke-width': 1.5,
    } });

    // demand hubs
    map.addSource('demand', { type: 'geojson', data: fc((geo.demand_centers || []).map(d => ({
      type: 'Feature', properties: { ...d },
      geometry: { type: 'Point', coordinates: [d.lon, d.lat] },
    }))) });
    map.addLayer({ id: 'demand-pts', type: 'circle', source: 'demand', paint: {
      'circle-color': C.ink, 'circle-radius': 3, 'circle-opacity': 0.7,
      'circle-stroke-color': '#04070a', 'circle-stroke-width': 1,
    } });

    // layer counts in the left rail
    const counts = { basins: geo.basins?.length, pipelines: geo.pipelines?.length, lng: geo.lng_terminals?.length, btm: geo.btm_projects?.length, demand: geo.demand_centers?.length };
    for (const [k, v] of Object.entries(counts)) {
      const n = document.querySelector(`[data-count="${k}"]`);
      if (n && v) n.textContent = v;
    }
  }

  const LAYER_IDS = { basins: ['basins-fill', 'basins-line', 'basins-label'], pipelines: ['pipes-line'], lng: ['lng-pts'], btm: ['btm-pts'], demand: ['demand-pts'] };
  function applyVisibility() {
    if (!map || !map.getLayer('lng-pts')) return;
    for (const [k, ids] of Object.entries(LAYER_IDS)) {
      ids.forEach(id => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', state.layers[k] ? 'visible' : 'none'));
    }
  }

  function wireClicks() {
    const card = (html) => {
      const host = $('#map-card-host');
      host.innerHTML = `<div class="map-card">${html}</div>`;
      host.querySelector('.map-close')?.addEventListener('click', () => host.innerHTML = '');
    };
    const hd = (tick, title, cls = '') =>
      `<div class="panel-hd"><span class="tick ${cls}">${tick}</span> ${title} <span class="spacer"></span><button class="map-close" style="background:none;border:none;color:var(--ink-dim);cursor:pointer">✕</button></div>`;

    map.on('click', 'lng-pts', e => {
      const p = e.features[0].properties;
      card(hd('LNG.' + (p.state || ''), p.name, p.status === 'operating' ? '' : 'warn') + `
        <div class="scorebars">
          <div class="scorebar"><div class="sk"><span>STATUS</span><b>${(p.status || '').toUpperCase()}</b></div></div>
          <div class="scorebar"><div class="sk"><span>NAMEPLATE</span><b>${p.capacity_bcfd ?? '—'} BCF/D</b></div></div>
          <div class="scorebar"><div class="sk"><span>FEEDGAS ≈</span><b>${p.capacity_bcfd ? (p.capacity_bcfd * 1.1).toFixed(1) : '—'} BCF/D</b></div></div>
        </div>
        <div class="verdict">Every Bcf/d here is contracted for 20 years. This dot doesn't negotiate — it lifts.</div>`);
    });
    map.on('click', 'btm-pts', e => {
      const p = e.features[0].properties;
      const burn = (p.gas_gw || p.gw || 0) * 0.15;
      card(hd('BTM.' + (p.state || ''), p.name, 'crit') + `
        <div class="scorebars">
          <div class="scorebar"><div class="sk"><span>CAMPUS</span><b>${p.gw ?? '—'} GW</b></div></div>
          <div class="scorebar"><div class="sk"><span>GAS-FIRED</span><b>${p.gas_gw ?? p.gw ?? '—'} GW</b></div></div>
          <div class="scorebar"><div class="sk"><span>IMPLIED BURN</span><b>~${burn.toFixed(2)} BCF/D</b></div></div>
        </div>
        <div class="verdict">${p.note ? p.note : 'Bring-your-own-generation: none of this load waits in an interconnection queue — and all of it burns gas.'}</div>`);
    });
    map.on('click', 'demand-pts', e => {
      const p = e.features[0].properties;
      card(hd('HUB', p.name) + `<div class="verdict">${p.kind === 'dc-cluster' ? 'Data-center cluster — load growth lands here first.' : 'Pricing point — where the balance becomes a number.'}</div>`);
    });
    map.on('click', 'pipes-line', e => {
      const p = e.features[0].properties;
      card(hd('CORRIDOR', p.name) + `
        <div class="scorebars"><div class="scorebar"><div class="sk"><span>CAPACITY ≈</span><b>${p.bcfd ?? '—'} BCF/D</b></div></div></div>
        <div class="verdict">Illustrative corridor, not a survey route. One greenfield interstate pipe has been built in a decade — these lines are the whole ballgame.</div>`);
    });
    ['lng-pts', 'btm-pts', 'demand-pts', 'pipes-line'].forEach(id => {
      map.on('mouseenter', id, () => map.getCanvas().style.cursor = 'pointer');
      map.on('mouseleave', id, () => map.getCanvas().style.cursor = '');
    });

    map.on('click', e => {
      if (state.mode !== 'siting') return;
      const feats = map.queryRenderedFeatures(e.point, { layers: ['lng-pts', 'btm-pts', 'demand-pts'].filter(id => map.getLayer(id)) });
      if (feats.length) return;             // clicked a marker — let its card win
      state.pin = [e.lngLat.lng, e.lngLat.lat];
      dropPin(state.pin);
      scoreSite(state.pin);
    });
  }

  function dropPin(lonlat) {
    if (pinMarker) pinMarker.remove();
    const d = document.createElement('div');
    d.style.cssText = 'width:14px;height:14px;border:2px solid #3dff9e;background:rgba(61,255,158,.25);box-shadow:0 0 14px rgba(61,255,158,.8);transform:rotate(45deg)';
    pinMarker = new maplibregl.Marker({ element: d }).setLngLat(lonlat).addTo(map);
  }

  // ── the siting scorecard (Thessa 23f pattern, model-grounded)
  function scoreSite(p) {
    if (!geo) return;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    const dBasin = Math.min(...(geo.basins || []).map(b => havKm(p, centroid(b.ring))));
    let dPipe = Infinity;
    for (const pl of geo.pipelines || [])
      for (let i = 0; i < pl.path.length - 1; i++) dPipe = Math.min(dPipe, segKm(p, pl.path[i], pl.path[i + 1]));
    const dLNG = Math.min(...(geo.lng_terminals || []).filter(t => t.status !== 'pre-fid').map(t => havKm(p, [t.lon, t.lat])));
    const dHub = Math.min(...(geo.demand_centers || []).filter(d => d.kind === 'dc-cluster').map(d => havKm(p, [d.lon, d.lat])));

    const sGas = clamp(100 - dBasin / 9, 0, 100);          // near a basin = molecules nearby
    const sPipe = clamp(100 - dPipe / 4, 0, 100);          // near a corridor = deliverable
    const sComp = clamp(dLNG / 11, 0, 100);                // near the coast = bidding against Asia
    const sMkt = clamp(100 - dHub / 14, 0, 100);           // near a DC cluster = fiber/latency market

    const composite = Math.round(0.32 * sGas + 0.27 * sPipe + 0.22 * sComp + 0.19 * sMkt);
    const burn = state.gw * 0.15;
    const base = ENGINE.run(ENGINE.PRESETS.CHRONOMETER.levers).summary;
    const px30 = base.price2030;
    const fuelCostMd = burn * 1000 * px30 / 1000;          // MMcf/d × $/MMBtu ≈ $k/day → $M/day
    const p50Share = burn / 5.0 * 100;

    const grade = composite >= 75 ? ['VIABLE', ''] : composite >= 50 ? ['CONTESTED', 'warn'] : ['STRANDED', 'crit'];
    const bar = (label, v, note) => `
      <div class="scorebar"><div class="sk"><span>${label}</span><b>${Math.round(v)}</b></div>
      <div class="bar"><i style="width:${v}%;background:${v >= 70 ? C.green : v >= 40 ? C.amber : C.red}"></i></div>
      <div class="footnote">${note}</div></div>`;

    const host = $('#map-card-host');
    host.innerHTML = `<div class="map-card">
      <div class="panel-hd"><span class="tick ${grade[1]}">SITE.${grade[0]}</span> ${p[1].toFixed(2)}, ${p[0].toFixed(2)}
        <span class="spacer"></span><b style="font-family:var(--mono);color:var(--${grade[1] === 'crit' ? 'red' : grade[1] === 'warn' ? 'amber' : 'green'})">${composite}</b></div>
      <div class="scorebars">
        ${bar('GAS ACCESS', sGas, fmt(dBasin) + ' km to nearest basin')}
        ${bar('CORRIDOR ACCESS', sPipe, fmt(dPipe) + ' km to a flow corridor')}
        ${bar('LNG INSULATION', sComp, fmt(dLNG) + ' km from feedgas competition')}
        ${bar('MARKET ACCESS', sMkt, fmt(dHub) + ' km to a DC cluster')}
      </div>
      <div class="verdict">
        ${state.gw.toFixed(1)} GW campus burns <span class="num">~${(burn * 1000).toFixed(0)} MMcf/d</span>
        — <span class="num warn">${p50Share.toFixed(0)}%</span> of the entire P50 data-center gas pull for 2030.
        At the model's 2030 base price ($${px30.toFixed(2)}), fuel alone runs
        <span class="num warn">$${fuelCostMd.toFixed(2)}M/day</span>
        (~$${(fuelCostMd * 365 / 1000).toFixed(1)}B/yr). Scores are illustrative, not a parcel screen.</div>
    </div>`;
  }

  function cleanup() {
    if (map) { try { map.remove(); } catch {} map = null; }
    pinMarker = null;
  }

  return { render, cleanup };
})();
