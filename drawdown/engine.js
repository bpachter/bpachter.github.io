/* DRAWDOWN engine — monthly US natural-gas balance model, 2026-07 → 2036-06.
   Pure functions, no DOM. All units Bcf/d unless noted; storage in Bcf.
   Calibration constants live in ENGINE.CALIB; calibrate() can merge a
   normalized model_inputs.json bundle over them, but nothing currently
   fetches one — CALIB below is what actually runs. */
const ENGINE = (() => {

  // ───────────────────────── calibration (fallbacks; replaced by data bundle)
  const CALIB = {
    startYear: 2026, startMonth: 7, years: 10,
    storage: {
      start: 3024,            // Bcf, week ending 2026-07-10 (EIA WNGSR)
      capacity: 4280,         // demonstrated peak working gas (design 4,683), Bcf
      floor: 800,             // operational base-gas proxy; post-2010 record low 824 (2014-03-28), all-time 636 (2003-03-14)
      // monthly aggregation of the real 2021-25 5-yr weekly band (data/eia_history.json)
      avgByMonth: [2872, 2123, 1832, 1900, 2247, 2643, 2867, 3003, 3220, 3599, 3776, 3481],
      minByMonth: [2657, 1818, 1431, 1443, 1757, 2151, 2402, 2573, 2858, 3342, 3559, 3287],
      maxByMonth: [3032, 2454, 2309, 2365, 2703, 3047, 3224, 3306, 3464, 3784, 3961, 3625],
      recordLow2010: 824, recordLowAllTime: 636,
    },
    production: {
      start: 111.5,           // dry gas Bcf/d, mid-2026 (Apr-26 110.9; STEO 2026 avg 111.25)
      maxDeliverability: 130, // rock + midstream ceiling (128-132 range)
      buildRatePerYear: 4.0,  // max Bcf/d addable per year (midstream-limited)
      incentivePrice: 3.75,   // $/MMBtu above which growth accelerates
      shutinPrice: 2.25,      // below which production drifts down
      plannedGrowth: 4.0,     // Bcf/d/yr already in flight (STEO: 111.25 → 115.3 in 2027)
      plannedThrough: 2028.0, // planned momentum carries to here, then price must do the work
    },
    lng: {
      // OUTPUT nameplate by year-end, Bcf/d — FID'd-only schedule (data/lng_projects.json)
      rampByYear: { 2025: 15.2, 2026: 17.6, 2027: 20.6, 2028: 24.0, 2029: 26.3, 2030: 30.8, 2031: 32.9, 2032: 33.3, 2033: 33.3, 2034: 33.3, 2035: 33.3 },
      utilization: 1.10,      // nameplate → FEEDGAS (liquefaction fuel + realized>nameplate); matches 2025-26 actuals
      spotShare: 0.15,        // share curtailable without contract breach
      spotOffPrice: 8,        // HH $ at which spot cargoes stop lifting
      breachPrice: 16,        // HH $ at which political force majeure begins
    },
    balance: {
      bias: 0.75,              // Bcf/d of today's observed oversupply — calibrated: model Oct-26 peak 3,970 vs EIA STEO 3,966; model spot $2.86 vs actual $2.80
      biasEnd: 2028.0,         // decays linearly to zero as the announced ramp consumes the surplus
    },
    demand: {
      resComm: 23.16,          // res 13.27 + comm 9.89, 2025 actual Bcf/d
      resCommSeason: [2.05, 1.85, 1.45, 1.0, 0.62, 0.45, 0.42, 0.42, 0.48, 0.78, 1.25, 1.85], // shape; amplitude via seasonAmp
      industrial: 23.63,       // 2025 actual
      industrialGrowth: 0.005, // per year
      powerBase: 35.77,        // 2025 actual gas power burn (new-DC gas added on top)
      powerSeason: [1.05, 0.95, 0.85, 0.82, 0.92, 1.1, 1.28, 1.3, 1.12, 0.9, 0.87, 1.0],
      seasonAmp: 1.2,          // seasonal contrast, calibrated: frozen-cycle amplitude 1943 vs real 5-yr band 1944 Bcf
      otherUse: 9.13,          // lease & plant 5.58 + pipeline & distribution 3.55, 2025
      mexico: 6.64,            // 2025 actual
      mexicoGrowth: 0.15,      // Bcf/d per year
      elasticity: 0.03,        // industrial+power demand shaved per $ above $6
    },
    canada: {
      netByMonth: [7.8, 7.4, 6.2, 5.2, 4.5, 4.2, 4.4, 4.5, 4.7, 5.4, 6.4, 7.5], // net imports; 2025 avg 5.8
    },
    datacenters: {
      baseGW: 31,             // avg US DC load 2025, GW (Goldman May-2026; LBNL-consistent)
      /* cumulative NEW gas-served DC gigawatts by year-end, P50 path.
         Calibrated so P50 ≈ 5 Bcf/d by 2030 at 0.15 Bcf/d/GW — the center of the
         published 3–6 Bcf/d range (Kinder Morgan, East Daley, S&P). P0 ×2.7 ≈ 13 Bcf/d,
         matching the unmitigated 12–15 range. See data/datacenters.json. */
      gasGWByYear: { 2026: 3, 2027: 8, 2028: 15, 2029: 24, 2030: 33, 2031: 40, 2032: 46, 2033: 51, 2034: 55, 2035: 58 },
      pathScale: { P50: 1.0, P30: 1.8, P0: 2.7 },
      heatRate: 6.5,          // MMBtu/MWh — new H-class CCGT / SOFC ≈ 150 MMcf/d per GW; peaker-heavy mixes run higher
      btuPerCf: 1037,
      pue: 1.2,
    },
    price: {
      /* Calibrated to data/price_episodes.json: shale-era monthly fit P≈4.15·e^(−1.95·dev)
         (R² .66), deficit side ~50% steeper than surplus side; -17% deviations printed
         $6.6-8.8 monthly. k below reproduces the deficit-side points; the scarcity term
         covers territory outside the historical sample (structural deficits, sub-1600 Bcf),
         where the European 2022 analog (TTF ≈ $100/MMBtu-equiv) is the only guide. */
      base: 3.40,             // $/MMBtu at normal storage
      k: 4.0,                 // convexity vs fractional deficit (empirical mid-range 1.95→4.4 point-implied)
      kLoose: 1.4,            // surplus side (empirical ~1.1)
      scarcityS: 1600,        // Bcf below which scarcity multiplier engages
      scarcityPow: 2.2,
      scarcityAmp: 9,
      cap: 60,                // display cap; beyond this = market failure (US record daily print: $30.72, Jan 2026)
      forward: { 2026: 3.67, 2027: 3.41, 2028: 3.6, 2029: 3.7, 2030: 3.8 }, // STEO + NYMEX strip 2026-07-23 (28-30 indicative)
    },
    power: {
      marginalHeatRate: 7.5,  // MMBtu/MWh price-setting unit
      vomAdder: 12,           // $/MWh non-fuel
      baselineElec: 45,       // $/MWh reference
      hyperscalerFixed: 486,  // $/MWh-equiv non-energy compute cost stack (calibrated: 10% share at baseline)
    },
    nuclear: { gwLagYears: 7, mwhPerGWYear: 8322000 },
  };

  const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
  const normalized = a => { const m = avg(a); return a.map(v => v / m); };
  // normalize to mean 1, then scale seasonal contrast (amp>1 = sharper winters/summers)
  const seasonShape = (a, amp) => normalized(a).map(v => 1 + (v - 1) * amp);

  // year-fraction interpolation over a {year: value} table
  function tableAt(tbl, yearFloat) {
    const years = Object.keys(tbl).map(Number).sort((a, b) => a - b);
    if (yearFloat <= years[0]) return tbl[years[0]];
    if (yearFloat >= years[years.length - 1]) return tbl[years[years.length - 1]];
    for (let i = 0; i < years.length - 1; i++) {
      if (yearFloat >= years[i] && yearFloat <= years[i + 1]) {
        return lerp(tbl[years[i]], tbl[years[i + 1]], (yearFloat - years[i]) / (years[i + 1] - years[i]));
      }
    }
    return tbl[years[years.length - 1]];
  }

  // DC gas demand in Bcf/d for a given gas-served GW running 24/7
  function gwToBcfd(gw, heatRate, btuPerCf) {
    // gw * 1000 MWh/h * 24 h * heatRate MMBtu/MWh = MMBtu/day → Bcf/d
    return gw * 1000 * 24 * heatRate * 1e6 / btuPerCf / 1e9;
  }

  /* Anchor: compute the constant "unmodeled net" (Bcf/d) that makes TODAY's system
     annually storage-neutral at t0 levels. The model's future deficit then comes only
     from announced/levered CHANGES: LNG ramp beyond today, new DC gas, demand growth,
     minus production response. This is the sources-and-uses framing, made explicit. */
  function computeResidual(C) {
    const t0 = C.startYear + (C.startMonth - 1) / 12;
    const lng0 = tableAt(C.lng.rampByYear, t0) * C.lng.utilization;
    const dc0 = gwToBcfd(tableAt(C.datacenters.gasGWByYear, t0), C.datacenters.heatRate, C.datacenters.btuPerCf);
    const demand0 = C.demand.resComm + C.demand.industrial + C.demand.powerBase +
      dc0 + lng0 + C.demand.mexico + C.demand.otherUse;
    const supply0 = C.production.start + avg(C.canada.netByMonth);
    return demand0 - supply0; // added to supply every month
  }

  /* Self-consistent seasonal norm: freeze the system at t0 (no growth, normal weather,
     no price feedback), anchor at the real 5-yr-average level for the start month, and
     integrate one year. The result is the storage cycle a balanced version of TODAY's
     system would trace — the model prices deviations from that, so its own seasonal
     amplitude never reads as phantom tightness. Real EIA bands are display/record only. */
  function frozenCycle(C, residual, seasonRC, seasonPW) {
    const t0 = C.startYear + (C.startMonth - 1) / 12;
    const lng0 = tableAt(C.lng.rampByYear, t0) * C.lng.utilization;
    const dc0 = gwToBcfd(tableAt(C.datacenters.gasGWByYear, t0), C.datacenters.heatRate, C.datacenters.btuPerCf);
    let S = C.storage.avgByMonth[C.startMonth - 1];
    const ref = new Array(12).fill(0);
    for (let i = 0; i < 12; i++) {
      const m = (C.startMonth - 1 + i) % 12;
      const demand = C.demand.resComm * seasonRC[m] + C.demand.industrial +
        C.demand.powerBase * seasonPW[m] + dc0 + lng0 + C.demand.mexico + C.demand.otherUse;
      const supply = C.production.start + C.canada.netByMonth[m] + residual;
      S += (supply - demand) * DAYS[m];
      ref[m] = S;
    }
    return ref;
  }

  // Henry Hub from storage state — the convex heart of the model
  function priceFrom(S, month, C, ref) {
    const norm = (ref || C.storage.avgByMonth)[month];
    const z = (S - norm) / norm;                       // fractional deviation
    const k = z < 0 ? C.price.k : C.price.kLoose;
    let p = C.price.base * Math.exp(-k * z);
    if (S < C.price.scarcityS) {                       // approaching the floor: hyperbolic blowout
      const d = (C.price.scarcityS - S) / (C.price.scarcityS - C.storage.floor);
      p *= 1 + C.price.scarcityAmp * Math.pow(clamp(d, 0, 1.15), C.price.scarcityPow);
    }
    return clamp(p, 1.2, C.price.cap);
  }

  /* Levers — the public scenario surface. All optional; defaults = "announced world".
     {
       lngDelayMonths: 0,        // slip all post-2026 LNG additions
       lngScale: 1.0,            // 0..1 multiplier on post-2026 additions
       allowSpotCurtail: true,
       allowBreach: false,
       dcPath: 'P50'|'P30'|'P0',
       dcGasShare: 1.0,          // multiplier on gas-served DC path (solar/nuclear substitution)
       perfWattGain: 0.0,        // annual fractional efficiency gain shaving DC load growth
       prodMax: 130, prodBuildRate: 4.0,
       canadaPipeBcfd: 0, canadaPipeYear: 2029,
       nuclearGW2033: 0,         // AP1000s online 2033+, displaces gas power burn
       resiSolarShave: 0,        // Bcf/d shaved off power burn by 2030, ramps linearly
       weather: 1.0,             // 0.93 mild … 1.07 severe (both seasons)
     } */
  function run(levers = {}, calibOverride) {
    const C = calibOverride || CALIB;
    const L = Object.assign({
      lngDelayMonths: 0, lngScale: 1.0, allowSpotCurtail: true, allowBreach: false,
      dcPath: 'P50', dcGasShare: 1.0, perfWattGain: 0.0,
      prodMax: C.production.maxDeliverability, prodBuildRate: C.production.buildRatePerYear,
      canadaPipeBcfd: 0, canadaPipeYear: 2029,
      nuclearGW2033: 0, resiSolarShave: 0, weather: 1.0,
    }, levers);

    const months = C.years * 12;
    let S = C.storage.start;
    let prod = C.production.start;
    let price = C.price.base;
    const lngStartLevel = tableAt(C.lng.rampByYear, C.startYear + (C.startMonth - 1) / 12);
    const residual = computeResidual(C);
    const seasonRC = seasonShape(C.demand.resCommSeason, C.demand.seasonAmp);
    const seasonPW = seasonShape(C.demand.powerSeason, C.demand.seasonAmp);
    const Sref = frozenCycle(C, residual, seasonRC, seasonPW);

    const out = { t: [], m: [], S: [], price: [], prod: [], lng: [], dcGas: [], elec: [], hsShare: [], supply: [], demand: [], events: [] };

    for (let i = 0; i < months; i++) {
      const mAbs = (C.startMonth - 1) + i;
      const month = mAbs % 12;
      const year = C.startYear + Math.floor(mAbs / 12);
      const yf = year + month / 12;

      // ── LNG feedgas
      const yfLNG = year + (month - L.lngDelayMonths) / 12;
      let lngName = tableAt(C.lng.rampByYear, yfLNG);
      lngName = lngStartLevel + (lngName - lngStartLevel) * L.lngScale;
      let lng = Math.max(0, lngName) * C.lng.utilization;
      if (L.allowSpotCurtail && price > C.lng.spotOffPrice) {
        const sev = clamp((price - C.lng.spotOffPrice) / 4, 0, 1);
        lng *= 1 - C.lng.spotShare * sev;
      }
      if (L.allowBreach && price > C.lng.breachPrice) {
        lng *= 0.55; // political force majeure: contracted cargoes held back
        out.events.push({ i, type: 'BREACH', year, month });
      }

      // ── data-center gas pull
      const scale = C.datacenters.pathScale[L.dcPath] ?? 1.0;
      const eff = Math.pow(1 - L.perfWattGain, Math.max(0, yf - C.startYear));
      const gasGW = tableAt(C.datacenters.gasGWByYear, yf) * scale * L.dcGasShare * eff;
      const dcGas = gwToBcfd(gasGW, C.datacenters.heatRate, C.datacenters.btuPerCf);

      // ── other demand
      const yrs = yf - C.startYear;
      const wx = (L.weatherByYear && L.weatherByYear[year]) ?? L.weather; // per-year draw (game) or constant lever
      const resComm = C.demand.resComm * seasonRC[month] * (month <= 2 || month >= 10 ? wx : 1);
      const industrial = C.demand.industrial * (1 + C.demand.industrialGrowth * yrs);
      let power = C.demand.powerBase * seasonPW[month] * (month >= 5 && month <= 8 ? wx : 1);
      // nuclear displacement (7-yr build: only if turned on, arrives 2033+)
      if (L.nuclearGW2033 > 0 && year >= 2033) {
        const nukeGW = L.nuclearGW2033 * clamp((yf - 2033) / 2, 0.3, 1);
        power -= gwToBcfd(nukeGW * 0.92, C.power.marginalHeatRate, C.datacenters.btuPerCf);
      }
      // resi solar shave, ramps to full by 2030
      power -= L.resiSolarShave * clamp((yf - C.startYear) / (2030 - C.startYear), 0, 1);
      power = Math.max(15, power);
      // price-driven demand destruction (industrial + power)
      const shave = price > 6 ? C.demand.elasticity * (price - 6) * (industrial + power) / 2 : 0;
      const mexico = C.demand.mexico + C.demand.mexicoGrowth * yrs;

      const demand = resComm + industrial + power + dcGas + lng + mexico + C.demand.otherUse - shave;

      // ── supply
      let canada = C.canada.netByMonth[month];
      if (L.canadaPipeBcfd > 0 && yf >= L.canadaPipeYear) canada += L.canadaPipeBcfd * clamp((yf - L.canadaPipeYear) / 1, 0, 1);
      const t0y = C.startYear + (C.startMonth - 1) / 12;
      const bias = C.balance.bias * clamp((C.balance.biasEnd - yf) / (C.balance.biasEnd - t0y), 0, 1);
      const supply = prod + canada + residual + bias;

      // ── storage integration
      const days = DAYS[month] + (month === 1 && year % 4 === 0 ? 1 : 0);
      S += (supply - demand) * days;
      let failed = false;
      if (S < C.storage.floor) { failed = true; out.events.push({ i, type: 'FLOOR', year, month }); S = C.storage.floor; }
      if (S > C.storage.capacity) S = C.storage.capacity; // forced injections stop / prod curtails

      // ── price responds to storage state
      price = priceFrom(S, month, C, Sref);
      if (failed) price = C.price.cap;

      // ── producers respond to price (with midstream rate limit + ceiling)
      const planned = yf < C.production.plannedThrough ? C.production.plannedGrowth / 12 : 0;
      const signal = clamp((price - C.production.incentivePrice) / 2, -0.5, 2.5);
      const drift = price < C.production.shutinPrice ? -0.15 : 0;
      const responsive = clamp(signal * (L.prodBuildRate / 12) * 0.9, -0.35, L.prodBuildRate / 12);
      prod += Math.max(planned, responsive) + drift; // planned and price-driven overlap, not stack
      prod = clamp(prod, 95, L.prodMax);

      // ── electricity + hyperscaler economics
      const elec = C.power.marginalHeatRate * price + C.power.vomAdder;                    // $/MWh
      const hsEnergy = elec * C.datacenters.pue;
      const hsShare = hsEnergy / (hsEnergy + C.power.hyperscalerFixed);

      out.t.push(yf + 1 / 24); out.m.push(month); out.S.push(S); out.price.push(price); out.prod.push(prod);
      out.lng.push(lng); out.dcGas.push(dcGas); out.elec.push(elec); out.hsShare.push(hsShare);
      out.supply.push(supply); out.demand.push(demand);
    }
    out.Sref = Sref;

    // ── headline diagnostics
    const idxOf = yr => out.t.findIndex(t => t >= yr);
    const minS = Math.min(...out.S);
    const minSAt = out.t[out.S.indexOf(minS)];
    const breakBand = out.S.findIndex((s, i) => s < CALIB.storage.minByMonth[out.m[i]]);
    out.summary = {
      minStorage: minS, minStorageYear: minSAt,
      breaksBandAt: breakBand >= 0 ? out.t[breakBand] : null,
      hitsFloor: out.events.some(e => e.type === 'FLOOR'),
      floorAt: (out.events.find(e => e.type === 'FLOOR') || {}).year ?? null,
      maxPrice: Math.max(...out.price),
      price2030: out.price[idxOf(2030)] ?? null,
      hsShare2030: out.hsShare[idxOf(2030)] ?? null,
      elec2030: out.elec[idxOf(2030)] ?? null,
    };
    return out;
  }

  // merge a normalized model_inputs.json over the fallbacks
  function calibrate(inputs) {
    function deepMerge(dst, src) {
      for (const k of Object.keys(src || {})) {
        if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k]) deepMerge(dst[k], src[k]);
        else dst[k] = src[k];
      }
    }
    deepMerge(CALIB, inputs);
  }

  const PRESETS = {
    CONSENSUS:  { label: 'CONSENSUS',  levers: { dcPath: 'P50', dcGasShare: 0.7, perfWattGain: 0.10, prodMax: 134, prodBuildRate: 5.5, lngScale: 0.9 } },
    CHRONOMETER:{ label: 'CHRONOMETER', levers: { dcPath: 'P50', dcGasShare: 1.0, perfWattGain: 0.0, prodMax: 130, prodBuildRate: 4.0 } },
    UNMITIGATED:{ label: 'CRISIS/P0',  levers: { dcPath: 'P0',  dcGasShare: 1.0, perfWattGain: 0.0, prodMax: 130, prodBuildRate: 4.0 } },
    SOFTLANDING:{ label: 'SOFT LANDING', levers: { dcPath: 'P50', dcGasShare: 0.5, perfWattGain: 0.15, prodMax: 134, prodBuildRate: 6.0, canadaPipeBcfd: 1.5, nuclearGW2033: 8, resiSolarShave: 1.5, allowSpotCurtail: true } },
  };

  return { CALIB, run, calibrate, PRESETS, gwToBcfd, priceFrom, tableAt };
})();
if (typeof module !== 'undefined') module.exports = ENGINE;
