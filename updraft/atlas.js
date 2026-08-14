/* UPDRAFT — ATLAS: the frontier map (MapLibre GL, vendored; Carto dark-matter basemap —
   the Drawdown Atlas stack). Layers, bottom to top:
     cells  — 1,592 NASA POWER climate cells, band-tinted (off by default)
     pairs  — frontier data center → nearest ethanol plant, ≤100 km (the golden pairs)
     dc     — 1,474 data centers, circles colored by band
     eth    — 179 ethanol plants, triangles colored by band, white-ringed
   All data compiled offline to static JSON; the browser only renders. */
const UD = (() => {
  let dataPromise = null;
  function load() {
    if (dataPromise) return dataPromise;
    dataPromise = Promise.all(
      ['facilities', 'cells', 'pairs', 'summary'].map(n =>
        fetch('data/' + n + '.json').then(r => { if (!r.ok) throw new Error(n + ' ' + r.status); return r.json(); })
      )
    ).then(([facilities, cells, pairs, summary]) => ({ facilities, cells, pairs, summary }));
    return dataPromise;
  }
  return { load };
})();

const Atlas = (() => {
  const BC = { 1: '#3987e5', 2: '#d95926', 3: '#199e70', 4: '#898781' };
  const BAND_LABEL = { 1: 'FRONTIER', 2: 'COLD BUT TOO DARK', 3: 'BRIGHT, LOW HEAT DEMAND', 4: 'NEITHER' };
  const STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

  let map = null, mlPromise = null, popup = null;
  const state = {
    layers: { dc: true, eth: true, pairs: true, cells: false },
    bands: [1, 2, 3, 4],
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

  // ── GeoJSON builders from the compact arrays
  const fmt = (v, d = 0) => v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: d });
  function dcGeo(rows) {
    return { type: 'FeatureCollection', features: rows.map(r => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [r[0], r[1]] },
      properties: { band: r[2], sqft: r[3], state: r[4], label: r[5], kind: 'dc' } })) };
  }
  function ethGeo(rows) {
    return { type: 'FeatureCollection', features: rows.map(r => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [r[0], r[1]] },
      properties: { band: r[2], mmgal: r[3], co2kt: r[4], state: r[5], label: r[6], kind: 'eth' } })) };
  }
  function cellGeo(c) {
    const dy = c.dlat / 2, dx = c.dlon / 2;
    return { type: 'FeatureCollection', features: c.rows.map(r => {
      const [lat, lon, dli, hdd, band] = r;
      return { type: 'Feature', properties: { band, dli, hdd },
        geometry: { type: 'Polygon', coordinates: [[
          [lon - dx, lat - dy], [lon + dx, lat - dy], [lon + dx, lat + dy], [lon - dx, lat + dy], [lon - dx, lat - dy]]] } };
    }) };
  }
  function pairGeo(p) {
    return { type: 'FeatureCollection', features: p.rows.map(r => ({
      type: 'Feature', properties: { km: r[4] },
      geometry: { type: 'LineString', coordinates: [[r[0], r[1]], [r[2], r[3]]] } })) };
  }

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

  const bandMatch = prop => ['match', ['get', prop], 1, BC[1], 2, BC[2], 3, BC[3], BC[4]];

  function addLayers(d) {
    map.addSource('cells', { type: 'geojson', data: cellGeo(d.cells) });
    map.addLayer({ id: 'cells', type: 'fill', source: 'cells',
      layout: { visibility: state.layers.cells ? 'visible' : 'none' },
      paint: { 'fill-color': bandMatch('band'), 'fill-opacity': 0.13 } });

    map.addSource('pairs', { type: 'geojson', data: pairGeo(d.pairs) });
    map.addLayer({ id: 'pairs', type: 'line', source: 'pairs',
      layout: { visibility: state.layers.pairs ? 'visible' : 'none' },
      paint: { 'line-color': '#ffb454', 'line-width': 1, 'line-opacity': 0.5 } });

    map.addSource('dc', { type: 'geojson', data: dcGeo(d.facilities.dc) });
    map.addLayer({ id: 'dc', type: 'circle', source: 'dc',
      layout: { visibility: state.layers.dc ? 'visible' : 'none' },
      paint: {
        'circle-color': bandMatch('band'),
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 2.1, 6, 4.2, 9, 7],
        'circle-opacity': 0.8 } });

    [1, 2, 3, 4].forEach(b => map.addImage('tri' + b, triImage(BC[b])));
    map.addSource('eth', { type: 'geojson', data: ethGeo(d.facilities.ethanol) });
    map.addLayer({ id: 'eth', type: 'symbol', source: 'eth',
      layout: {
        visibility: state.layers.eth ? 'visible' : 'none',
        'icon-image': ['concat', 'tri', ['to-string', ['get', 'band']]],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.42, 6, 0.62, 9, 0.85],
        'icon-allow-overlap': true } });

    applyBandFilter();
    ['dc', 'eth'].forEach(id => {
      map.on('mouseenter', id, () => map.getCanvas().style.cursor = 'pointer');
      map.on('mouseleave', id, () => map.getCanvas().style.cursor = '');
      map.on('click', id, e => showPopup(e.features[0], e.lngLat));
    });
  }

  function applyBandFilter() {
    const f = ['in', ['get', 'band'], ['literal', state.bands]];
    ['dc', 'eth', 'cells'].forEach(id => map && map.getLayer(id) && map.setFilter(id, f));
    // pairs are frontier-only by construction; hide if band 1 is filtered out
    if (map && map.getLayer('pairs'))
      map.setLayoutProperty('pairs', 'visibility',
        state.layers.pairs && state.bands.includes(1) ? 'visible' : 'none');
  }

  function showPopup(f, ll) {
    const p = f.properties;
    const bandRow = `<span class="pk">BAND</span> <span class="pb" style="color:${BC[p.band]}">${BAND_LABEL[p.band]}</span>`;
    const body = p.kind === 'dc'
      ? `${bandRow}<br><span class="pk">FLOOR</span> ${p.sqft ? fmt(p.sqft) + ' sqft' : '—'}<br><span class="pk">STATE</span> ${p.state}`
      : `${bandRow}<br><span class="pk">CAPACITY</span> ${p.mmgal ? fmt(p.mmgal) + ' MMgal/yr' : '—'}<br><span class="pk">FERM CO2</span> ${p.co2kt ? fmt(p.co2kt) + ' kt/yr' : '—'}<br><span class="pk">STATE</span> ${p.state}`;
    if (popup) popup.remove();
    popup = new maplibregl.Popup({ closeButton: true })
      .setLngLat(ll)
      .setHTML(`<div class="pop"><div class="pn">${esc(p.label)}</div>${body}</div>`)
      .addTo(map);
  }
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  // ── left rail
  function sectorSVG(sectors) {
    const W = 296, ROW = 19, PAD = 2, LW = 150;
    const max = Math.max(...sectors.map(s => s.frontier_pct));
    const rows = sectors.map((s, i) => {
      const y = i * ROW + PAD, hot = /Ethanol plants|Data centers/.test(s.sector);
      const bw = Math.max(2, (W - LW - 44) * s.frontier_pct / max);
      return `<text x="${LW - 6}" y="${y + 12}" text-anchor="end" font-size="9.5" fill="${hot ? '#ddd3c4' : '#83786a'}" font-weight="${hot ? 700 : 400}">${esc(s.sector)}</text>
        <rect x="${LW}" y="${y + 4}" width="${bw}" height="9" fill="${hot ? '#ffb454' : '#8f6527'}" opacity="${hot ? 1 : .55}"/>
        <text x="${LW + bw + 5}" y="${y + 12}" font-size="9.5" fill="${hot ? '#ffb454' : '#83786a'}" font-family="inherit">${s.frontier_pct}%</text>`;
    }).join('');
    return `<svg class="mini" viewBox="0 0 ${W} ${sectors.length * ROW + PAD * 2}" xmlns="http://www.w3.org/2000/svg" font-family="'JetBrains Mono',monospace">${rows}</svg>`;
  }

  function rail(d) {
    const h = d.summary.headline, bands = d.summary.bands;
    return `
      <div class="rail-hd">The frontier<small>DEC LIGHT ≥ 10 mol/m²/d · HEAT DEMAND ≥ 4,000 HDD</small></div>
      <div class="kpis">
        <div class="kpi"><div class="v b1">${h.dc.frontier_n}<span style="font-size:12px;color:var(--ink-dim)">/${fmt(h.dc.n)}</span></div><div class="k">DATA CENTERS IN FRONTIER — ${h.dc.shares[0]}%</div></div>
        <div class="kpi"><div class="v b1">${h.ethanol.shares[0]}%</div><div class="k">ETHANOL PLANTS IN FRONTIER (n=${h.ethanol.n})</div></div>
        <div class="kpi"><div class="v">${h.pairs.n50}</div><div class="k">GOLDEN PAIRS — DC ≤50 KM FROM ETHANOL</div></div>
        <div class="kpi"><div class="v">${h.ethanol.co2_ferm_mt} Mt</div><div class="k">FERMENTATION CO2 / YR AT NAMEPLATE</div></div>
      </div>
      <div class="rail-sec"><h4>LAYERS</h4>
        ${[['dc', 'Data centers', fmt(h.dc.n)], ['eth', 'Ethanol plants', h.ethanol.n],
           ['pairs', 'Golden pairs ≤100 km', h.pairs.n100], ['cells', 'Climate surface', '1,592 cells']]
          .map(([k, t, c]) => `<button class="tog ${state.layers[k] ? 'on' : ''}" data-layer="${k}"><span class="sw"></span>${t}<span class="cnt">${c}</span></button>`).join('')}
      </div>
      <div class="rail-sec"><h4>BANDS</h4>
        <div class="chips">
          ${bands.keys.map((k, i) => `<button class="chip c${i + 1} ${state.bands.includes(i + 1) ? 'on' : ''}" data-band="${i + 1}">${bands.labels[i].split(' - ')[0].toUpperCase()}</button>`).join('')}
        </div>
      </div>
      <div class="rail-sec"><h4>FRONTIER SHARE BY WASTE-HEAT SOURCE</h4>
        ${sectorSVG(d.summary.sectors)}
        <div class="mini-cap">Share of each fleet inside the frontier band. Ethanol and data centers are the two best-placed waste-heat fleets in the country — everything classically "industrial" is structurally misplaced.</div>
      </div>
      <div class="rail-sec rail-note">
        <b>Read the map:</b> blue = a machine whose exhaust could heat a greenhouse through the winter it sits in. Amber lines pair frontier data centers with the nearest fermentation-CO2 source. Click any mark for its numbers. Then read the <a href="#/brief">brief</a>.
      </div>`;
  }

  function wireRail(mount, d) {
    mount.querySelectorAll('.tog').forEach(b => b.onclick = () => {
      const k = b.dataset.layer;
      state.layers[k] = !state.layers[k];
      b.classList.toggle('on', state.layers[k]);
      if (map && map.getLayer(k))
        map.setLayoutProperty(k, 'visibility', state.layers[k] ? 'visible' : 'none');
      if (k === 'pairs') applyBandFilter();
    });
    mount.querySelectorAll('.chip').forEach(b => b.onclick = () => {
      const n = +b.dataset.band;
      state.bands = state.bands.includes(n) ? state.bands.filter(x => x !== n) : [...state.bands, n];
      b.classList.toggle('on', state.bands.includes(n));
      applyBandFilter();
    });
  }

  function render(mount) {
    mount.innerHTML = `
      <div class="atlas-grid">
        <div class="rail" id="rail"></div>
        <div class="map-wrap">
          <div id="map"></div>
          <div class="leg">
            <div><i style="background:${BC[1]}"></i>FRONTIER · LIGHT + HEAT DEMAND</div>
            <div><i style="background:${BC[2]}"></i>COLD BUT TOO DARK</div>
            <div><i style="background:${BC[3]}"></i>BRIGHT, LOW HEAT DEMAND</div>
            <div><i class="tri"></i>ETHANOL PLANT &nbsp;·&nbsp; <i style="background:#83786a"></i>DATA CENTER</div>
            <div><i class="ln"></i>FRONTIER DC → NEAREST ETHANOL ≤100 KM</div>
          </div>
          <div class="attrib">© <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a> © OpenStreetMap · data compiled 2026-08-09</div>
        </div>
      </div>`;
    Promise.all([UD.load(), loadML()]).then(([d]) => {
      const railEl = mount.querySelector('#rail');
      railEl.innerHTML = rail(d);
      wireRail(railEl, d);
      if (!mount.querySelector('#map')) return; // navigated away mid-load
      map = new maplibregl.Map({
        container: 'map', style: STYLE_DARK,
        center: [-95.5, 38.3], zoom: 3.7, minZoom: 2.6, maxZoom: 11,
        attributionControl: false, dragRotate: false, pitchWithRotate: false });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      window._udmap = map; // debug handle
      map.on('load', () => addLayers(d));
    }).catch(err => {
      mount.querySelector('#rail').innerHTML =
        `<div class="rail-note">Failed to load data: <b>${esc(err.message)}</b>. Serve this app over HTTP (fetch cannot read file://).</div>`;
    });
  }

  function destroy() { if (map) { map.remove(); map = null; } }

  return { render, destroy };
})();
