/* UPDRAFT — shared constants and pure math, declared ONCE for both runtimes:
   the browser loads this as a classic <script> before atlas.js, and the Node
   verifier side-effect-imports it. No module syntax on purpose — everything
   hangs off globalThis.UD_SHARED so the same bytes execute in both. */
(() => {
  /* Payoff planning heuristics — every atlas popup estimate and every verifier
     check derives from these. Change one here and both the site (on reload)
     and `node pipeline/verify.mjs` see it. */
  const EST = {
    wPerSqft: 75,       // IT load per building sqft (planning range 50–150 W/sqft)
    capture: 0.85,      // recoverable share of facility heat
    haPerMWpeak: 0.3,   // hectares guaranteed at design day, per MWth
    haPerMWenergy: 1.0, // hectares energy-matched with storage, per MWth
    absorb: 0.45,       // share of annual heat a matched greenhouse absorbs
    boilerEff: 0.85,    // displaced gas boiler efficiency
    thermsPerMWh: 34.13,
    usdPerTherm: 0.90,  // commercial gas
    co2TPerHaYr: 175,   // enrichment demand, t CO2 per hectare-year
    kgCO2PerGal: 2.85,  // stoichiometric fermentation CO2 per gallon of ethanol
  };

  // band verdict for one location against thresholds t = {dli, hdd}
  const bandOf = (dli, hdd, t) =>
    dli >= t.dli && hdd >= t.hdd ? 1 : hdd >= t.hdd ? 2 : dli >= t.dli ? 3 : 4;

  // great-circle km
  const haversine = (lo1, la1, lo2, la2) => {
    const R = 6371, r = Math.PI / 180;
    const a = Math.sin((la2 - la1) * r / 2) ** 2 +
      Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  /* snap a coordinate to its climate-cell key; grid steps come from cells.json
     (dlat/dlon), defaulting to the MERRA-2 native 0.5 x 0.625. The fixed 2/3
     decimal places cover any grid at that scale. */
  const cellKey = (lat, lon, dlat = 0.5, dlon = 0.625) =>
    (Math.round(lat / dlat) * dlat).toFixed(2) + '|' +
    (Math.round(lon / dlon) * dlon).toFixed(3);

  // HTML-escape for innerHTML interpolation (5 chars incl. quotes)
  const esc = s => String(s).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  // locale-pinned number format; null-safe
  const fmt = (v, d = 0) => v == null ? '—'
    : Number(v).toLocaleString('en-US', { maximumFractionDigits: d });

  globalThis.UD_SHARED = { EST, bandOf, haversine, cellKey, esc, fmt };
})();
