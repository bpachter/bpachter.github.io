#!/usr/bin/env node
/* UPDRAFT — build_layers.mjs
   Assembles data/layers.json — the four analysis layers — from the raw source
   pulls in pipeline/raw/ (each carries its own _provenance):

     dli_monthly.json          NASA POWER monthly climatology → DLI per cell
     eia_industrial_price.json EIA annual state industrial electricity prices
     cell_states.json          cell center → US state (Census boundaries)
     water_stress.json         WRI Aqueduct 4.0 state baseline water stress
     co2_claims.json           CCS-contracted / operating-capture ethanol plants
     design_temps.json         ASHRAE 99% heating design temps for the 16 hubs

   Formulas (constants declared once in shared.js EST):
     supplemental light  gap_m = max(0, target − outdoor_m × canopyTransmission)
                         kWh/m²·yr = Σ_m gap_m · days_m / ledMolPerKwh
                         $/m²·yr  = kWh · state industrial price
     design day          peak W/m² = designUWm2K · (tInC − t99) · coverFloorRatio
                         servable@40C = min(1, lowTempEmitterWm2 / peak)

   Run: node pipeline/build_layers.mjs   (then node pipeline/verify.mjs) */

import './shared.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { EST } = globalThis.UD_SHARED;
const HERE = dirname(fileURLToPath(import.meta.url));
const raw = n => JSON.parse(readFileSync(join(HERE, 'raw', n + '.json'), 'utf8'));
const data = n => JSON.parse(readFileSync(join(HERE, '..', 'data', n + '.json'), 'utf8'));

const cells = data('cells');
const dliM = raw('dli_monthly');
const eia = raw('eia_industrial_price');
const cellSt = raw('cell_states');
const water = raw('water_stress');
const co2 = raw('co2_claims');
const dtemps = raw('design_temps');
const summary = data('summary');

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const key = (lat, lon) => lat.toFixed(2) + '|' + lon.toFixed(3);

// index raw pulls by cell
const monthlyIx = new Map(dliM.cells.map(r => [key(r[0], r[1]), r[2]]));
const stateIx = new Map(cellSt.cells.map(r => [key(r[0], r[1]), r[2]]));
const CATS = ['Low', 'Low - Medium', 'Medium - High', 'High', 'Extremely High'];
const norm = s => String(s).toLowerCase().replace(/[^a-z]/g, '');
// -1 = no data (HI NoData, PR absent from Aqueduct) — must never collapse to 'Low'
const catNo = c => CATS.findIndex(x => norm(x) === norm(c));

function lightCost(monthly, priceCents, target) {
  if (!monthly || priceCents == null) return null;
  let kwh = 0;
  for (let m = 0; m < 12; m++) {
    const gap = Math.max(0, target - monthly[m] * EST.canopyTransmission);
    kwh += gap * DAYS[m] / EST.ledMolPerKwh;
  }
  return { kwh: Math.round(kwh), usd: Math.round(kwh * priceCents) / 100 };
}

let missMonthly = 0, missState = 0;
const outCells = cells.rows.map(r => {
  const [lat, lon] = r;
  const monthly = monthlyIx.get(key(lat, lon));
  const st = stateIx.get(key(lat, lon)) || null;
  if (!monthly) missMonthly++;
  if (!st) missState++;
  const price = st ? eia.cents_per_kwh[st] : null;
  const w = st && water.states[st] ? water.states[st] : null;
  const leafy = lightCost(monthly, price, EST.dliTargetLeafy);
  const fruit = lightCost(monthly, price, EST.dliTargetFruit);
  return [lat, lon, st, w ? catNo(w.cat) : -1,
    leafy ? leafy.usd : null, fruit ? fruit.usd : null, fruit ? fruit.kwh : null];
});

const hubs = summary.hubs.map(h => {
  const d = dtemps.hubs.find(x => x.hub === h.hub);
  if (!d) throw new Error('no design temp for hub ' + h.hub);
  const peak = Math.round(EST.designUWm2K * (EST.tInC - d.t99_c) * EST.coverFloorRatio);
  const servable = Math.min(1, EST.lowTempEmitterWm2 / peak);
  return { hub: h.hub, station: d.station, t99_c: d.t99_c, peak_wm2: peak,
    servable40_pct: Math.round(servable * 100), boost: servable < 1 };
});

const out = {
  _meta: {
    built: '2026-08-17',
    note: 'analysis layers — planning heuristics, constants in pipeline/shared.js; raw pulls with per-source provenance in pipeline/raw/',
    sources: [dliM, eia, cellSt, water, co2, dtemps].map(x => x._provenance),
  },
  bws_cats: CATS,
  states: Object.fromEntries(Object.entries(eia.cents_per_kwh).map(([st, p]) => [st,
    { price: p, bws: water.states[st] ? catNo(water.states[st].cat) : -1,
      bws_score: water.states[st] ? water.states[st].score : null }])),
  cells: outCells, // [lat, lon, state, bws_cat, usd_leafy, usd_fruit, kwh_fruit]
  co2: {
    matched: co2.matched,
    counts: {
      operating: co2.matched.filter(m => m.status === 'operating').length,
      contracted: co2.matched.filter(m => m.status.startsWith('contracted')).length,
    },
  },
  hubs,
};

writeFileSync(join(HERE, '..', 'data', 'layers.json'), JSON.stringify(out));
console.log(`layers.json written: ${outCells.length} cells (${missMonthly} missing monthly, ${missState} no state), ` +
  `${Object.keys(out.states).length} states, ${co2.matched.length} CO2-claimed plants, ${hubs.length} hubs`);
if (missMonthly > 0) { console.error('FATAL: monthly DLI missing for some cells'); process.exit(1); }
