/* Part II · The Evidence — four widgets.
   04 The locals        — merger clock: scrub the MW–Andromeda collision, 0→10 Gyr.
   05 First light       — pannable CMB sphere with the Cold Spot marked.
   06 The flow          — HERO: galaxies advected along streamlines into basins.
   07 Zone of Avoidance — drag the Milky Way band aside, or switch to IR eyes.
   All schematic: honest shapes and honest ratios, not survey data. */

/* ───────────────────────── 04 · the merger clock ───────────────────────── */
(function () {
  const cv = $<HTMLCanvasElement>('#w-merge');
  if (!cv) return;
  const fig = cv.closest('.fig') as HTMLElement;
  const slider = $<HTMLInputElement>('#mg-t');
  const readout = $('#mg-read');
  const playBtn = $('#mg-play');

  // Per-galaxy star clouds (unit disks) + the merged remnant (round swirl).
  interface MStar { x: number; y: number; r: number; w: number; ex: number; ey: number; }
  function makeDisk(n: number, seed: number): MStar[] {
    const rr = mulberry32(seed), out: MStar[] = [];
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt(rr());
      const a = r * 6.4 + (i % 2) * Math.PI + gauss(rr) * 0.26;
      out.push({
        x: r * Math.cos(a), y: r * Math.sin(a), r,
        w: 0.35 + rr() * 0.65,                     // how early the star departs the disk
        ex: gauss(rr) * 0.55, ey: gauss(rr) * 0.5, // its seat in the remnant
      });
    }
    return out;
  }
  const A = makeDisk(300, 3), B = makeDisk(260, 4);

  // Keyframes: [t(Gyr), ax, ay, bx, by, mix, stretch]
  const KF: number[][] = [
    [0.0, -0.30, 0.12, 0.62, -0.34, 0.00, 0.0],
    [3.5, -0.18, 0.07, 0.38, -0.22, 0.02, 0.1],
    [4.6, -0.03, 0.01, 0.07, -0.05, 0.15, 0.9],
    [5.6, -0.13, -0.07, 0.15, 0.11, 0.35, 1.0],
    [6.8, -0.02, -0.01, 0.02, 0.01, 0.80, 0.5],
    [8.0, 0.00, 0.00, 0.00, 0.00, 1.00, 0.1],
    [10.0, 0.00, 0.00, 0.00, 0.00, 1.00, 0.0],
  ];
  function frame(t: number): number[] {
    let i = 0;
    while (i < KF.length - 2 && KF[i + 1][0] < t) i++;
    const a = KF[i], b = KF[i + 1];
    const u = clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
    const o: number[] = [];
    for (let k = 1; k < a.length; k++) o.push(lerp(a[k], b[k], u));
    return o;
  }
  function phase(t: number): string {
    if (t < 3.8) return 'falling together — Andromeda closes at ~110 km/s';
    if (t < 5.2) return 'first pass — tidal tails fly';
    if (t < 6.6) return 'flung apart, falling back';
    if (t < 8.2) return 'merging — the disks dissolve';
    return 'one elliptical now: Milkdromeda';
  }

  const st = { t: 0, playing: false };
  const touch = userTouch(fig, () => { st.playing = false; syncPlay(); });
  function syncPlay(): void { playBtn.textContent = st.playing ? 'pause' : 'play'; playBtn.classList.toggle('on', st.playing); }
  playBtn.addEventListener('click', () => {
    st.playing = !st.playing;
    if (st.playing && st.t > 9.9) st.t = 0;
    syncPlay();
  });
  slider.addEventListener('input', () => { st.t = Number(slider.value) / 100; });

  function cloud(ctx: Ctx, stars: MStar[], gx: number, gy: number, sc: number, spin: number,
                 mix: number, stretch: number, dirx: number, diry: number, S: number, cx: number, cy: number): void {
    ctx.fillStyle = STAR_C;
    for (const s of stars) {
      const m = clamp((mix - (1 - s.w)) / s.w, 0, 1);
      // disk seat (slow pinwheel) → remnant seat
      const ca = Math.cos(spin), sa = Math.sin(spin);
      let px = (s.x * ca - s.y * sa) * sc, py = (s.x * sa + s.y * ca) * sc * 0.62;
      // tidal stretch along the inter-galaxy axis, outer stars first
      const tug = stretch * s.r * s.r * 0.5;
      px += dirx * tug * sc; py += diry * tug * sc;
      const fx = lerp(gx + px, s.ex * 0.34, m), fy = lerp(gy + py, s.ey * 0.30, m);
      ctx.globalAlpha = 0.55 - 0.2 * m;
      ctx.beginPath(); ctx.arc(cx + fx * S, cy + fy * S, 1.1, 0, TAU); ctx.fill();
    }
  }

  let last = 0;
  function draw(tms: number): void {
    const [ctx, W, H] = fit(cv);
    const dt = last ? Math.min(0.05, (tms - last) / 1000) : 0.016;
    last = tms;
    if (st.playing && !reduced) {
      st.t += dt * 0.9;
      if (st.t >= 10) { st.t = 10; st.playing = false; syncPlay(); }
    }
    const [ax, ay, bx, by, mix, stretch] = frame(st.t);
    ctx.clearRect(0, 0, W, H);
    const S = Math.min(W, H) * 0.92, cx = W / 2, cy = H / 2;
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;

    cloud(ctx, A, ax, ay, 0.30, st.t * 0.55, mix, stretch, dx / L, dy / L, S, cx, cy);
    cloud(ctx, B, bx, by, 0.26, -st.t * 0.62 + 1.2, mix, stretch, -dx / L, -dy / L, S, cx, cy);

    // remnant glow as the merger completes
    if (mix > 0.55) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.24);
      g.addColorStop(0, 'rgba(240,201,108,' + fmt(0.12 * (mix - 0.55) / 0.45, 3) + ')');
      g.addColorStop(1, 'rgba(240,201,108,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // labels
    ctx.globalAlpha = 0.85; ctx.fillStyle = FAINT;
    ctx.font = '10.5px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    if (mix < 0.5) {
      ctx.fillText('Milky Way', cx + ax * S, cy + ay * S + 0.30 * S * 0.7 + 14);
      ctx.fillText('Andromeda', cx + bx * S, cy + by * S + 0.26 * S * 0.7 + 14);
    } else if (mix > 0.9) {
      ctx.fillText('Milkdromeda', cx, cy + S * 0.30);
    }
    readout.textContent = fmt(st.t, 1) + ' billion years — ' + phase(st.t);
    if (document.activeElement !== slider) slider.value = String(Math.round(st.t * 100));
  }

  autoOnView(fig, () => { if (!touch.touched && !reduced) { st.playing = true; syncPlay(); } }, 900);
  loopWhenVisible(cv, draw);
})();

/* ───────────────────────── 05 · the CMB sphere ───────────────────────── */
(function () {
  const cv = $<HTMLCanvasElement>('#w-cmb');
  if (!cv) return;
  const rng = mulberry32(77);

  // Fibonacci sphere with a smooth random temperature field.
  const N = 1500;
  const pts: P3[] = [];
  const temp: number[] = [];
  const modes: Array<[number, number, number, number, number]> = [];
  for (let i = 0; i < 7; i++) {
    const th = rng() * TAU, ph = Math.acos(2 * rng() - 1);
    modes.push([Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph), 2.5 + rng() * 6.5, rng() * TAU]);
  }
  // The Cold Spot direction (fixed seat on the sphere).
  const CS: P3 = [0.42, -0.62, 0.66];
  {
    const L = Math.hypot(CS[0], CS[1], CS[2]);
    CS[0] /= L; CS[1] /= L; CS[2] /= L;
  }
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = i * 2.39996;
    const p: P3 = [Math.cos(th) * r, y, Math.sin(th) * r];
    pts.push(p);
    let v = 0;
    for (const m of modes) v += Math.sin((p[0] * m[0] + p[1] * m[1] + p[2] * m[2]) * m[3] + m[4]);
    v /= 3.2;
    const d = Math.acos(clamp(p[0] * CS[0] + p[1] * CS[1] + p[2] * CS[2], -1, 1));
    v -= 1.7 * Math.exp(-(d * d) / 0.035);
    temp.push(clamp(v, -1.3, 1));
  }
  function ramp(v: number): string {
    // cold → violet, mid → dim slate, warm → gold
    const t = clamp((v + 1) / 2, 0, 1);
    if (t < 0.5) {
      const u = t / 0.5;
      return 'rgba(' + Math.round(lerp(139, 90, u)) + ',' + Math.round(lerp(124, 110, u)) + ',' + Math.round(lerp(248, 150, u)) + ',1)';
    }
    const u = (t - 0.5) / 0.5;
    return 'rgba(' + Math.round(lerp(90, 240, u)) + ',' + Math.round(lerp(110, 201, u)) + ',' + Math.round(lerp(150, 108, u)) + ',1)';
  }
  const colors = temp.map(ramp);

  const cam: Cam = { yaw: -0.4, pitch: 0.1, cx: 0, cy: 0, scale: 100, dist: 4.2 };
  const orb = orbit(cv, cam);
  const spotBtn = $('#cmb-spot');
  const spotPop = $('#cmb-pop');
  spotBtn.addEventListener('click', () => {
    const on = spotPop.style.display !== 'none';
    spotPop.style.display = on ? 'none' : 'block';
    spotBtn.classList.toggle('on', !on);
  });

  let last = 0;
  function draw(t: number): void {
    const [ctx, W, H] = fit(cv);
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
    last = t;
    if (!orb.everDragged && !reduced) cam.yaw += dt * 0.07;
    cam.cx = W / 2; cam.cy = H / 2; cam.scale = Math.min(W, H) * 0.44;
    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < N; i++) {
      const p = project(cam, pts[i]);
      const dn = clamp((p[2] - 0.78) * 2.4, 0, 1);   // front hemisphere pops
      if (dn <= 0.02) continue;
      ctx.globalAlpha = 0.16 + 0.75 * dn;
      ctx.fillStyle = colors[i];
      ctx.beginPath(); ctx.arc(p[0], p[1], 1.1 + 2.1 * dn, 0, TAU); ctx.fill();
    }
    // Cold Spot marker
    const cs = project(cam, CS);
    if (cs[2] > 1) {
      ctx.globalAlpha = 0.9; ctx.strokeStyle = VIOLET; ctx.lineWidth = 1.3; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(cs[0], cs[1], 15, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = VIOLET; ctx.font = '10.5px "JetBrains Mono", monospace'; ctx.textAlign = 'left';
      ctx.fillText('the Cold Spot', cs[0] + 20, cs[1] + 3);
    }
    ctx.globalAlpha = 0.8; ctx.fillStyle = FAINT;
    ctx.font = '10.5px "JetBrains Mono", monospace'; ctx.textAlign = 'left';
    ctx.fillText('2.725 K ± 0.0002 — the whole sky, aged 13.8 Gyr', 14, H - 12);
    ctx.globalAlpha = 1;
  }
  loopWhenVisible(cv, draw);
})();

/* ───────────────────────── 06 · the flow ───────────────────────── */
(function () {
  const cv = $<HTMLCanvasElement>('#w-flow');
  if (!cv) return;
  const rng = mulberry32(31);

  // Basins (pull) and one repeller (push), in canvas-fraction coordinates.
  const GA = { x: 0.70, y: 0.36, g: 1.0 };       // the Great Attractor region
  const SH = { x: 1.10, y: 0.28, g: 1.9 };       // Shapley, beyond the edge
  const RP = { x: -0.10, y: 0.66, g: 0.85 };     // the Dipole Repeller (push)
  const SOFT = 0.012;

  function vel(x: number, y: number): [number, number] {
    let vx = 0, vy = 0;
    for (const w of [GA, SH]) {
      const dx = w.x - x, dy = w.y - y;
      const d2 = dx * dx + dy * dy + SOFT;
      const f = w.g / d2 * 0.014;
      vx += dx * f; vy += dy * f;
    }
    const dx = x - RP.x, dy = y - RP.y;
    const d2 = dx * dx + dy * dy + SOFT;
    const f = RP.g / d2 * 0.014;
    vx += dx * f; vy += dy * f;
    const sp = Math.hypot(vx, vy);
    const cap = 0.075;
    if (sp > cap) { vx = vx / sp * cap; vy = vy / sp * cap; }
    return [vx, vy];
  }

  interface Gal { x: number; y: number; px: number; py: number; }
  const gals: Gal[] = [];
  function spawn(g?: Gal): Gal {
    const n: Gal = g || { x: 0, y: 0, px: 0, py: 0 };
    n.x = rng() * 1.15 - 0.08; n.y = rng() * 1.1 - 0.05;
    n.px = n.x; n.py = n.y;
    return n;
  }
  for (let i = 0; i < 240; i++) gals.push(spawn());

  let showField = false;
  const fbtn = $('#flow-grid');
  fbtn.addEventListener('click', () => { showField = !showField; fbtn.classList.toggle('on', showField); });

  let last = 0;
  function draw(t: number): void {
    const [ctx, W, H] = fit(cv);
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
    last = t;
    // fade instead of clear → streamline trails
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(11, 18, 32, 0.26)';
    ctx.fillRect(0, 0, W, H);

    if (showField) {
      ctx.lineWidth = 1;
      for (let gx = 0.05; gx < 1; gx += 0.07) {
        for (let gy = 0.07; gy < 1; gy += 0.11) {
          const [vx, vy] = vel(gx, gy);
          const sp = Math.hypot(vx, vy);
          ctx.globalAlpha = clamp(sp * 16, 0.04, 0.22);
          arrow(ctx, gx * W, gy * H, (gx + vx * 1.5) * W, (gy + vy * 1.5) * H, FAINT, 1);
        }
      }
    }

    for (const g of gals) {
      const [vx, vy] = vel(g.x, g.y);
      g.px = g.x; g.py = g.y;
      if (!reduced) { g.x += vx * dt * 6.5; g.y += vy * dt * 6.5; }
      const dGA = Math.hypot(g.x - GA.x, g.y - GA.y);
      const dSH = Math.hypot(g.x - SH.x, g.y - SH.y);
      if (dGA < 0.035 || dSH < 0.05 || g.x > 1.25 || g.x < -0.2 || g.y < -0.15 || g.y > 1.2) { spawn(g); continue; }
      const sp = Math.hypot(vx, vy);
      ctx.globalAlpha = clamp(0.25 + sp * 9, 0.25, 0.85);
      ctx.strokeStyle = SKY; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(g.px * W, g.py * H); ctx.lineTo(g.x * W, g.y * H); ctx.stroke();
    }

    // the Attractor basin
    ctx.globalAlpha = 0.95; ctx.fillStyle = GOLD;
    ctx.shadowColor = GOLD; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(GA.x * W, GA.y * H, 5, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = '10.5px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText('the Great Attractor region', GA.x * W, GA.y * H - 14);
    // teasers at the edges (kept clear of the basin and "you" labels)
    ctx.globalAlpha = 0.7; ctx.fillStyle = GOLD;
    ctx.textAlign = 'right'; ctx.fillText('Shapley, beyond → (Part III)', W - 10, 0.12 * H);
    ctx.globalAlpha = 0.7; ctx.fillStyle = VIOLET;
    ctx.textAlign = 'left'; ctx.fillText('← the Dipole Repeller (Part III)', 10, RP.y * H + 34);
    // you
    const yx = 0.30 * W, yy = 0.58 * H;
    const [uvx, uvy] = vel(0.30, 0.58);
    const uL = Math.hypot(uvx, uvy) || 1;
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = TEAL; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(yx, yy, 5, 0, TAU); ctx.stroke();
    arrow(ctx, yx, yy, yx + (uvx / uL) * 34, yy + (uvy / uL) * 34, TEAL_B, 2);
    ctx.fillStyle = TEAL_B; ctx.textAlign = 'left';
    ctx.fillText('you · ~600 km/s', yx + 12, yy + 18);
    ctx.globalAlpha = 1;
  }
  loopWhenVisible(cv, draw);
})();

/* ───────────────────────── 07 · the Zone of Avoidance ───────────────────────── */
(function () {
  const cv = $<HTMLCanvasElement>('#w-zoa');
  if (!cv) return;
  const fig = cv.closest('.fig') as HTMLElement;
  const rng = mulberry32(63);

  // Behind the veil: a general galaxy field + the Norma knot dead center.
  const back: Array<[number, number, number]> = [];
  for (let i = 0; i < 240; i++) back.push([rng(), rng(), 0.3 + rng() * 0.7]);
  const norma: Array<[number, number, number]> = [];
  for (let i = 0; i < 90; i++) norma.push([0.5 + gauss(rng) * 0.055, 0.52 + gauss(rng) * 0.045, 0.5 + rng() * 0.5]);

  // The veil: the Milky Way's disk — a dense star lane + dark dust blobs.
  const lane: Array<[number, number, number]> = [];
  for (let i = 0; i < 1600; i++) lane.push([rng(), 0.5 + gauss(rng) * 0.085, rng()]);
  const dust: Array<[number, number, number, number]> = [];
  for (let i = 0; i < 42; i++) dust.push([rng(), 0.5 + gauss(rng) * 0.05, 0.03 + rng() * 0.09, 0.015 + rng() * 0.035]);

  const st = { off: 0, ir: false, target: 0 };
  const touch = userTouch(fig);
  const irBtn = $('#zoa-ir');
  irBtn.addEventListener('click', () => { st.ir = !st.ir; irBtn.classList.toggle('on', st.ir); });

  // Drag the band up/down.
  let dragging = false, py = 0;
  cv.addEventListener('pointerdown', e => { dragging = true; py = e.clientY; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if (!dragging) return;
    const H = cv.getBoundingClientRect().height || 1;
    st.off = clamp(st.off + (e.clientY - py) / H, -0.5, 0.5);
    st.target = st.off;
    py = e.clientY;
  });
  const up = (): void => { dragging = false; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

  let last = 0, demoT = -1;
  function draw(t: number): void {
    const [ctx, W, H] = fit(cv);
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
    last = t;
    // auto-demo: lift the veil once, gently, until the user takes over
    if (demoT >= 0 && !touch.touched && !reduced) {
      demoT += dt;
      // "lift the veil": raise the band, hold, settle back
      st.target = demoT < 2.4 ? Math.max(-0.3, -demoT * 0.16) : (demoT < 4.6 ? Math.min(0, -0.3 + (demoT - 2.4) * 0.16) : 0);
      if (demoT > 5) demoT = -1;
    }
    if (!dragging) st.off += (st.target - st.off) * Math.min(1, dt * 3);

    ctx.clearRect(0, 0, W, H);
    // background sky
    ctx.fillStyle = STAR_C;
    for (const p of back) {
      ctx.globalAlpha = 0.3 * p[2];
      ctx.beginPath(); ctx.arc(p[0] * W, p[1] * H, 1, 0, TAU); ctx.fill();
    }
    // the Norma knot + the Attractor glow
    const g = ctx.createRadialGradient(0.5 * W, 0.52 * H, 0, 0.5 * W, 0.52 * H, W * 0.13);
    g.addColorStop(0, 'rgba(240,201,108,0.20)'); g.addColorStop(1, 'rgba(240,201,108,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = GOLD;
    for (const p of norma) {
      ctx.globalAlpha = 0.5 * p[2];
      ctx.beginPath(); ctx.arc(p[0] * W, p[1] * H, 1.3, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 0.9; ctx.fillStyle = GOLD;
    ctx.font = '10.5px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText('the Norma cluster — the Attractor’s core neighborhood', 0.5 * W, 0.52 * H + W * 0.13 + 4);

    // the veil (shifted by st.off)
    const oy = st.off * H;
    const dustA = st.ir ? 0.16 : 0.88;
    const starA = st.ir ? 0.35 : 0.75;
    ctx.fillStyle = STAR_C;
    for (const p of lane) {
      ctx.globalAlpha = starA * (0.25 + 0.5 * p[2]);
      ctx.beginPath(); ctx.arc(p[0] * W, p[1] * H + oy, 0.9, 0, TAU); ctx.fill();
    }
    for (const d of dust) {
      ctx.globalAlpha = dustA;
      ctx.fillStyle = '#05080f';
      ctx.beginPath(); ctx.ellipse(d[0] * W, d[1] * H + oy, d[2] * W, d[3] * W, 0, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 0.85; ctx.fillStyle = FAINT;
    ctx.textAlign = 'left';
    // ride the band's upper edge so it never sits on the Norma caption
    ctx.fillText('the Milky Way’s disk — your ceiling', 12, clamp(0.5 * H + oy - H * 0.14, 16, H - 10));
    ctx.globalAlpha = 1;
  }
  autoOnView(fig, () => { if (!touch.touched) demoT = 0; }, 800);
  loopWhenVisible(cv, draw);
})();
