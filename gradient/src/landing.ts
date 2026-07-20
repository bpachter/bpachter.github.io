/* Gradient · landing.ts — the loop that answers you, animated end to end.
   Requires core.ts (same bundle). */

(function () {
  const cv = $<HTMLCanvasElement>('#cv-pipe'); if (!cv) return;
  const [ctx, W, H] = fit(cv);

  /* the answer, one token per cycle, with the odds the "model" weighed */
  interface Step { cands: Array<[string, number]>; }
  const STEPS: Step[] = [
    { cands: [['Because', 0.58], ['Sunlight', 0.22], ['The', 0.11]] },
    { cands: [['sunlight', 0.64], ['blue', 0.15], ['light', 0.10]] },
    { cands: [['scatters', 0.52], ['bounces', 0.24], ['spreads', 0.11]] },
    { cands: [['more', 0.38], ['in', 0.27], ['a', 0.16]] },
    { cands: [['blue', 0.71], ['short', 0.14], ['cool', 0.07]] },
    { cands: [['than', 0.77], ['light', 0.11], ['waves', 0.06]] },
    { cands: [['red', 0.69], ['green', 0.13], ['long', 0.09]] },
    { cands: [['.', 0.82], ['!', 0.09], ['…', 0.05]] }
  ];
  const PROMPT_TOKS = ['why', 'is', 'the', 'sky', 'blue', '?'];

  /* layout */
  const PB = { x: 24, y: 14, w: 340, h: 42 };                    /* prompt bubble */
  const S1 = { x: 24, y: 96, w: 158, h: 116 };                   /* tokens */
  const S2 = { x: 218, y: 96, w: 128, h: 116 };                  /* meanings */
  const S3 = { x: 382, y: 88, w: 172, h: 130 };                  /* tower */
  const S4 = { x: 592, y: 92, w: 264, h: 124 };                  /* odds */
  const ANS = { x: 24, y: 292 };

  const CYCLE = 1550, HOLD = 1900;

  function box(s: { x: number; y: number; w: number; h: number }, active: number, cap: string): void {
    ctx.fillStyle = active > 0.05 ? `rgba(138,174,104,${0.10 + active * 0.12})` : 'rgba(45,42,36,0.025)';
    ctx.strokeStyle = INK; ctx.lineWidth = 2 + active * 1.2;
    ctx.beginPath(); ctx.roundRect(s.x, s.y, s.w, s.h, 12); ctx.fill(); ctx.stroke();
    ctx.font = '15px Caveat, cursive'; ctx.fillStyle = active > 0.05 ? LEAF_D : FAINT;
    ctx.textAlign = 'center';
    ctx.fillText(cap, s.x + s.w / 2, s.y + s.h + 20);
    ctx.textAlign = 'left';
  }
  const phase = (tt: number, a: number, b: number) =>
    Math.max(0, Math.min(1, (tt - a) / 0.09)) * Math.max(0, Math.min(1, (b + 0.09 - tt) / 0.09));

  function draw(stepIdx: number, tt: number, done: boolean): void {
    ctx.clearRect(0, 0, W, H);

    /* prompt bubble */
    ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(PB.x, PB.y, PB.w, PB.h, 12); ctx.fill(); ctx.stroke();
    ctx.font = '15.5px Karla, sans-serif'; ctx.fillStyle = INK;
    ctx.fillText('you:  "why is the sky blue?"', PB.x + 14, PB.y + 26);

    const a1 = done ? 0 : phase(tt, 0.16, 0.34);
    const a2 = done ? 0 : phase(tt, 0.34, 0.52);
    const a3 = done ? 0 : phase(tt, 0.50, 0.72);
    const a4 = done ? 0 : phase(tt, 0.70, 0.94);

    box(S1, a1, '1 · chop into tokens');
    box(S2, a2, '2 · look up meanings');
    box(S3, a3, '3 · the tower thinks');
    box(S4, a4, '4 · odds for the next word');

    /* stage 1: token chips */
    PROMPT_TOKS.forEach((tk, i) => {
      const cx = S1.x + 14 + (i % 3) * 46, cy = S1.y + 16 + Math.floor(i / 3) * 34;
      ctx.fillStyle = ['#e2edd6', '#dbe2ee', '#f3e6c3'][i % 3];
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(cx, cy, 42, 24, 7); ctx.fill(); ctx.stroke();
      ctx.font = '12.5px Karla, sans-serif'; ctx.fillStyle = INK; ctx.textAlign = 'center';
      ctx.fillText(tk, cx + 21, cy + 16);
      ctx.textAlign = 'left';
    });
    ctx.font = '12px Karla, sans-serif'; ctx.fillStyle = FAINT;
    ctx.fillText('+ the answer so far', S1.x + 14, S1.y + 100);

    /* stage 2: embedding dot-columns */
    for (let i = 0; i < 6; i++) {
      for (let d = 0; d < 5; d++) {
        const v = Math.sin(i * 2.7 + d * 1.3) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(107,127,163,${0.25 + v * 0.6})`;
        ctx.beginPath();
        ctx.arc(S2.x + 20 + i * 18, S2.y + 20 + d * 19, 4.5, 0, 7);
        ctx.fill();
      }
    }

    /* stage 3: the tower — slabs light bottom→top */
    for (let l = 0; l < 4; l++) {
      const lit = a3 > 0 ? Math.max(0, Math.min(1, a3 * 5 - (3 - l) * 1.05)) : 0;
      const sx = S3.x + 18 + (3 - l) * 3, sy = S3.y + 12 + (3 - l) * 28;
      ctx.fillStyle = lit > 0.15 ? `rgba(138,174,104,${0.25 + lit * 0.5})` : 'rgba(236,230,216,0.9)';
      ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.roundRect(sx, sy, S3.w - 42, 22, 6); ctx.fill(); ctx.stroke();
    }
    ctx.font = '12px Karla, sans-serif'; ctx.fillStyle = FAINT;
    ctx.fillText('× 24 more', S3.x + 22, S3.y + 126);

    /* stage 4: candidate bars */
    const st = STEPS[Math.min(stepIdx, STEPS.length - 1)];
    st.cands.forEach(([w, p], i) => {
      const by = S4.y + 18 + i * 34, grow = done ? 1 : Math.max(0, Math.min(1, (tt - 0.72) / 0.18));
      const winner = i === 0 && (done || tt > 0.9);
      ctx.font = '13px Karla, sans-serif'; ctx.fillStyle = INK; ctx.textAlign = 'right';
      ctx.fillText(w, S4.x + 88, by + 13);
      ctx.textAlign = 'left';
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      ctx.strokeRect(S4.x + 96, by, 130, 18);
      ctx.fillStyle = winner ? GOLD : LEAF;
      ctx.fillRect(S4.x + 97.5, by + 1.5, 127 * p * grow, 15);
      ctx.fillStyle = FAINT; ctx.font = '12px Karla, sans-serif';
      ctx.fillText(Math.round(p * 100) + '%', S4.x + 232, by + 13);
    });

    /* arrows between stages */
    const flow: Array<[number, number]> = [[S1.x + S1.w, S2.x], [S2.x + S2.w, S3.x], [S3.x + S3.w, S4.x]];
    flow.forEach(([xa, xb], i) => {
      const on = [a1, a2, a3][i + 0] > 0 || [a2, a3, a4][i] > 0;
      arrow(ctx, xa + 6, 154, xb - 8, 154, on ? LEAF_D : 'rgba(138,129,113,0.6)', 2);
    });
    /* prompt → stage 1 */
    arrow(ctx, PB.x + 60, PB.y + PB.h + 2, S1.x + 50, S1.y - 6, 'rgba(138,129,113,0.6)', 2);
    /* winner → answer */
    if (done || tt > 0.93) arrow(ctx, S4.x + 60, S4.y + S4.h + 4, ANS.x + 240, ANS.y - 22, GOLD, 2);
    /* answer feeds back into the prompt side — the loop! */
    ctx.strokeStyle = 'rgba(138,129,113,0.55)'; ctx.lineWidth = 1.6; ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(ANS.x + 60, ANS.y + 8);
    ctx.quadraticCurveTo(2, (ANS.y + S1.y) / 2 + 30, S1.x + 20, S1.y + 96);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '13px Caveat, cursive'; ctx.fillStyle = FAINT;
    ctx.fillText('…and the new word goes back in', 30, ANS.y - 34);

    /* the answer line */
    const nDone = done ? STEPS.length : stepIdx + (tt > 0.97 ? 1 : 0);
    const answer = STEPS.slice(0, nDone).map(s => s.cands[0][0]);
    ctx.font = '18px Fraunces, serif'; ctx.fillStyle = INK;
    let out = 'claude:  ';
    answer.forEach(w => { out += (w === '.' || w === '!' ? w : ' ' + w); });
    ctx.fillText(out + (done ? '' : ' ▎'), ANS.x, ANS.y + 6);
  }

  if (reduced) { draw(STEPS.length - 1, 1, true); return; }

  let t0: number | null = null, onScreen = false;
  function loop(ts: number): void {
    if (t0 === null) t0 = ts;
    const total = STEPS.length * CYCLE + HOLD;
    const t = (ts - t0) % total;
    const idx = Math.floor(t / CYCLE);
    if (idx >= STEPS.length) draw(STEPS.length - 1, 1, true);
    else draw(idx, (t % CYCLE) / CYCLE, false);
    if (onScreen) requestAnimationFrame(loop);
  }
  visible(cv, v => {
    const was = onScreen; onScreen = v;
    if (v && !was) { t0 = null; requestAnimationFrame(loop); }
  });
  draw(0, 0.05, false);
})();
