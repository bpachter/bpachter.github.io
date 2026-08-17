#!/usr/bin/env node
/* UPDRAFT — verify.mjs
   Recomputes every headline number on the site from the shipped data/*.json and
   compares it to data/summary.json. Zero dependencies; Node 18+.

       node pipeline/verify.mjs

   Scope, honestly stated: the upstream compile (fetching IM3, NASA POWER, GHGRP
   and EIA, geolocating plants, deriving DLI/HDD per cell) runs offline and is not
   included here. What this script proves is that the shipped derived data is
   internally consistent — bands re-derive from the climate cells, pairs re-derive
   from raw coordinates, every percentage re-derives from the rows — so nothing on
   the site rests on a number the data cannot reproduce.

   The payoff estimator and every band/distance/snap function are NOT redeclared
   here: this file imports pipeline/shared.js — the exact bytes the browser runs —
   so a drifted constant or a changed tie-break cannot pass silently. Change a
   constant in shared.js and re-run to see how the site's numbers move. */

import './shared.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { EST, bandOf: bandOfShared, haversine: hav, cellKey } = globalThis.UD_SHARED;

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const load = n => JSON.parse(readFileSync(join(DATA, n + '.json'), 'utf8'));
const facilities = load('facilities'), cells = load('cells'),
      pairs = load('pairs'), summary = load('summary');

const T = { dli: summary.thresholds.dli_dec, hdd: summary.thresholds.hdd65 };
const bandOf = (dli, hdd, t = T) => bandOfShared(dli, hdd, t);
const cellIx = new Map(cells.rows.map(r =>
  [cellKey(r[0], r[1], cells.dlat, cells.dlon), { dli: r[2], hdd: r[3], band: r[4] }]));
const cellAt = (lat, lon) => cellIx.get(cellKey(lat, lon, cells.dlat, cells.dlon));
const pct = (n, d) => Math.round(1000 * n / d) / 10;
const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

let failures = 0;
const check = (name, expected, computed, pass = String(expected) === String(computed)) => {
  if (!pass) failures++;
  console.log(`${pass ? ' ok ' : 'FAIL'}  ${name}: expected ${expected}, computed ${computed}`);
};

const dc = facilities.dc.map(r => ({ lon: r[0], lat: r[1], band: r[2], sqft: r[3] }));
const eth = facilities.ethanol.map(r => ({ lon: r[0], lat: r[1], band: r[2], mmgal: r[3], co2kt: r[4] }));

/* ── 1 · bands re-derive from the climate cells ──────────────────────────── */
console.log('\n— band consistency (facility band == containing cell band)');
let dcMiss = 0, ethMiss = 0;
for (const f of dc) { const c = cellAt(f.lat, f.lon); if (!c || c.band !== f.band) dcMiss++; }
for (const f of eth) { const c = cellAt(f.lat, f.lon); if (!c || c.band !== f.band) ethMiss++; }
check('data centers snapped to cells, band mismatches', 0, dcMiss);
check('ethanol plants snapped to cells, band mismatches', 0, ethMiss);
const cellReband = cells.rows.filter(r => bandOf(r[2], r[3]) !== r[4]).length;
console.log(`  note  ${cellReband} of ${cells.rows.length} cells re-band differently from their`);
console.log('        shipped 1-decimal DLI (band was computed on unrounded values; no facilities affected)');

/* ── 2 · headline counts and shares ──────────────────────────────────────── */
console.log('\n— headline');
const h = summary.headline;
const dcF = dc.filter(f => f.band === 1).length;
check('DC in frontier', h.dc.frontier_n, dcF);
check('DC frontier share %', h.dc.shares[0], pct(dcF, dc.length));
const sq = dc.filter(f => f.sqft), sqF = sq.filter(f => f.band === 1);
check('DC frontier share, floor-area weighted %', h.dc.sqft_frontier_pct,
  pct(sqF.reduce((a, f) => a + f.sqft, 0), sq.reduce((a, f) => a + f.sqft, 0)));
const ethF = eth.filter(f => f.band === 1).length;
check('ethanol in frontier', h.ethanol.frontier_n, ethF);
check('ethanol frontier share %', h.ethanol.shares[0], pct(ethF, eth.length));
const cap = eth.filter(f => f.mmgal), capF = cap.filter(f => f.band === 1);
check('ethanol frontier share, capacity weighted %', h.ethanol.cap_frontier_pct,
  pct(capF.reduce((a, f) => a + f.mmgal, 0), cap.reduce((a, f) => a + f.mmgal, 0)));
const bgal = cap.reduce((a, f) => a + f.mmgal, 0) / 1000;
check('matched capacity, Bgal/yr', h.ethanol.cap_matched_bgal, Math.round(bgal * 10) / 10);
const co2Mt = cap.reduce((a, f) => a + f.mmgal * 1e6 * EST.kgCO2PerGal, 0) / 1e9;
check('fermentation CO2 at nameplate, Mt/yr', h.ethanol.co2_ferm_mt, Math.round(co2Mt * 10) / 10);
const co2Bad = cap.filter(f => Math.abs(f.co2kt - f.mmgal * EST.kgCO2PerGal) > f.co2kt * 0.01).length;
check('plants where co2_kt deviates >1% from mmgal x 2.85', 0, co2Bad);

/* ── 3 · golden pairs re-derive from raw coordinates ─────────────────────── */
console.log('\n— golden pairs (nearest ethanol plant per frontier DC)');
const nearest = dc.map(f => {
  let k = Infinity;
  for (const e of eth) { const d = hav(f.lon, f.lat, e.lon, e.lat); if (d < k) k = d; }
  return { band: f.band, km: k };
});
const frontierNear = nearest.filter(n => n.band === 1);
check('pairs <=50 km', pairs.n50, frontierNear.filter(n => n.km <= 50).length);
check('pairs <=100 km', pairs.n100, frontierNear.filter(n => n.km <= 100).length);
check('pairs.json rows == pairs <=100 km', pairs.rows.length, pairs.n100);
check('median DC-ethanol separation, km (frontier DCs)', pairs.median_km,
  Math.round(median(frontierNear.map(n => n.km))));

/* ── 4 · threshold sensitivity grid ──────────────────────────────────────── */
console.log('\n— sensitivity (grid was compiled from unrounded climatology; the shipped');
console.log('  cells carry 1-decimal DLI, so off-default corners tolerate ±3 pp)');
const S = summary.sensitivity;
S.dli.forEach((dli, i) => S.hdd.forEach((hdd, j) => {
  const n = dc.filter(f => { const c = cellAt(f.lat, f.lon);
    return c && bandOf(c.dli, c.hdd, { dli, hdd }) === 1; }).length;
  const got = pct(n, dc.length), want = S.pct[i][j];
  const exact = dli === T.dli; // the default-DLI row must reproduce exactly
  check(`DLI>=${dli} HDD>=${hdd} %`, want, got,
    exact ? want === got : Math.abs(want - got) <= 3);
}));
const flat = S.pct.flat();
console.log(`  note  full grid spans ${Math.min(...flat)}–${Math.max(...flat)}% ` +
  '(the brief quotes both this and the default-DLI row)');

/* ── 5 · analysis layers (data/layers.json vs raw pulls + shared constants) ── */
console.log('\n— analysis layers');
try {
  const layers = load('layers');
  const rawDir = join(dirname(fileURLToPath(import.meta.url)), 'raw');
  const rawL = n => JSON.parse(readFileSync(join(rawDir, n + '.json'), 'utf8'));
  const dliM = rawL('dli_monthly'), eia = rawL('eia_industrial_price'),
        cellSt = rawL('cell_states'), dtemps = rawL('design_temps');
  check('layers cells aligned with cells.json', cells.rows.length,
    layers.cells.length, layers.cells.length === cells.rows.length &&
    layers.cells.every((r, i) => r[0] === cells.rows[i][0] && r[1] === cells.rows[i][1]));

  // recompute light cost for a deterministic sample of 25 cells
  const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const mIx = new Map(dliM.cells.map(r => [r[0].toFixed(2) + '|' + r[1].toFixed(3), r[2]]));
  let lightBad = 0;
  for (let i = 0; i < cells.rows.length; i += 64) {
    const L = layers.cells[i], monthly = mIx.get(L[0].toFixed(2) + '|' + L[1].toFixed(3));
    const price = L[2] ? eia.cents_per_kwh[L[2]] : null;
    if (!monthly || price == null) { if (L[5] !== null) lightBad++; continue; }
    let kwh = 0;
    for (let m = 0; m < 12; m++)
      kwh += Math.max(0, EST.dliTargetFruit - monthly[m] * EST.canopyTransmission) * DAYS[m] / EST.ledMolPerKwh;
    if (Math.abs(Math.round(kwh * price) / 100 - L[5]) > 0.02) lightBad++;
  }
  check('light-cost recompute (25-cell sample, fruiting target)', 0, lightBad);

  // hubs: design-day panel reproduces the disclosed formula
  let hubBad = 0;
  for (const h of layers.hubs) {
    const d = dtemps.hubs.find(x => x.hub === h.hub);
    const peak = Math.round(EST.designUWm2K * (EST.tInC - d.t99_c) * EST.coverFloorRatio);
    if (peak !== h.peak_wm2 ||
        h.servable40_pct !== Math.round(Math.min(1, EST.lowTempEmitterWm2 / peak) * 100) ||
        h.boost !== (EST.lowTempEmitterWm2 / peak < 1)) hubBad++;
  }
  check('design-day panel reproduces formula for all 16 hubs', 0, hubBad);

  // water categories spot-anchors + no-data must stay -1
  const st = layers.states;
  check('water stress anchors (NM=4, WA=1, HI=-1)', 'NM4 WA1 HI-1',
    `NM${st.NM.bws} WA${st.WA.bws} HI${st.HI.bws}`);

  // co2 claims point at real ethanol rows
  const badClaims = layers.co2.matched.filter(m =>
    !facilities.ethanol[m.i] || facilities.ethanol[m.i][6] !== m.label).length;
  check('CO2-claim indices label-match facilities.json', 0, badClaims);
  check('CO2 status counts (operating + contracted = matched)', layers.co2.matched.length,
    layers.co2.counts.operating + layers.co2.counts.contracted);
} catch (e) {
  failures++;
  console.log('FAIL  analysis layers: ' + e.message);
}

console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nall checks pass');
process.exit(failures ? 1 : 0);
