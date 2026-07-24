/* Landing hero — a starfield with a secret.
   Every point drifts, slowly and coherently, toward one point just off the
   right edge of the frame. The whole thesis of the site in one background.
   Respects prefers-reduced-motion (renders a static field instead). */
(function () {
  const cv = $<HTMLCanvasElement>('#hero-cv');
  if (!cv) return;
  const rng = mulberry32(7);

  interface Drifter { x: number; y: number; z: number; }
  const N = 320;
  let stars: Drifter[] = [];
  let W = 0, H = 0;

  function seed(w: number, h: number): void {
    stars = [];
    for (let i = 0; i < N; i++) stars.push({ x: rng() * w, y: rng() * h, z: 0.15 + rng() * 0.85 });
  }
  function ensure(): Ctx {
    const [ctx, w, h] = fit(cv);
    if (w !== W || h !== H) { W = w; H = h; seed(w, h); }
    return ctx;
  }

  let last = 0;
  function draw(t: number): void {
    const ctx = ensure();
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
    last = t;
    ctx.clearRect(0, 0, W, H);

    // The attractor: just past the right edge, where we can't quite see.
    const tx = W * 1.16, ty = H * 0.4;
    const glow = ctx.createRadialGradient(tx, ty, 0, tx, ty, Math.max(W, H) * 0.55);
    glow.addColorStop(0, 'rgba(240,201,108,0.14)');
    glow.addColorStop(1, 'rgba(240,201,108,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      const dx = tx - s.x, dy = ty - s.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (!reduced) {
        // Faster when deeper in the field (parallax) and when closer to the pull.
        const sp = (5 + 34 * s.z) * (0.35 + 230 / (dist + 150));
        s.x += (dx / dist) * sp * dt;
        s.y += (dy / dist) * sp * dt;
        if (dist < 34) { s.x = rng() * W * 0.55 - W * 0.08; s.y = rng() * H; }
      }
      const r = 0.6 + 1.5 * s.z;
      ctx.globalAlpha = (0.22 + 0.6 * s.z) * clamp(dist / 170, 0.12, 1);
      ctx.fillStyle = s.z > 0.84 ? TEAL_B : STAR_C;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();
      if (s.z > 0.76 && !reduced) {
        ctx.globalAlpha *= 0.32;
        ctx.strokeStyle = TEAL;
        ctx.lineWidth = r * 0.75;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - (dx / dist) * 8 * s.z, s.y - (dy / dist) * 8 * s.z);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  if (reduced) {
    const once = (): void => { last = 0; requestAnimationFrame(tt => draw(tt)); };
    once();
    addEventListener('resize', once);
  } else {
    loopWhenVisible(cv, draw);
    addEventListener('resize', () => { W = -1; });
  }
})();
