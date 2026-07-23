/* DRAWDOWN charts — tiny hand-rolled canvas kit, terminal-styled. No deps.
   Usage: Charts.draw(canvas, spec) where spec = {
     xDomain:[x0,x1], yDomain:[y0,y1], height?:px,
     xTicks:[{v,label}], yTicks:[{v,label}], yLabel?:string,
     series:[
       {type:'line',  pts:[[x,y],...], color, width?, dash?, glow?, label?},
       {type:'band',  lo:[[x,y]...], hi:[[x,y]...], color, alpha?},          // min/max fill
       {type:'area',  pts:[[x,y]...], color, alpha?},                         // fill to y=0
       {type:'stack', layers:[{pts,color,label}...]},                         // stacked areas
     ],
     guides:[{y,color,label,dash?} | {x,color,label,dash?}],
     legend?: [{label,color}],
   }
   Coordinates are data-space; the kit handles mapping, DPR, axes, grid. */
const Charts = (() => {
  const CSS = getComputedStyle(document.documentElement);
  const C = name => CSS.getPropertyValue(name).trim();
  const FONT = '11px ' + (CSS.getPropertyValue('--mono').trim() || 'monospace');

  const PAD = { l: 52, r: 14, t: 14, b: 26 };

  function prep(canvas, spec) {
    const cssW = canvas.parentElement.clientWidth - 0.5 || 600;
    const cssH = spec.height || Math.max(200, Math.min(340, cssW * 0.42));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = cssH + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: cssW, h: cssH };
  }

  function mapper(spec, w, h) {
    const [x0, x1] = spec.xDomain, [y0, y1] = spec.yDomain;
    const iw = w - PAD.l - PAD.r, ih = h - PAD.t - PAD.b;
    return {
      x: v => PAD.l + ((v - x0) / (x1 - x0)) * iw,
      y: v => PAD.t + ih - ((v - y0) / (y1 - y0)) * ih,
      iw, ih
    };
  }

  function axes(ctx, spec, m, w, h) {
    ctx.strokeStyle = C('--grid') || '#14212b';
    ctx.fillStyle = C('--ink-dim') || '#5b7284';
    ctx.font = FONT;
    ctx.lineWidth = 1;
    (spec.yTicks || []).forEach(t => {
      const y = Math.round(m.y(t.v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(w - PAD.r, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(t.label ?? String(t.v), PAD.l - 7, y);
    });
    (spec.xTicks || []).forEach(t => {
      const x = Math.round(m.x(t.v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, h - PAD.b); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(t.label ?? String(t.v), x, h - PAD.b + 7);
    });
    // frame
    ctx.strokeStyle = C('--border') || '#1c2c38';
    ctx.strokeRect(PAD.l + 0.5, PAD.t + 0.5, m.iw - 1, m.ih - 1);
  }

  function poly(ctx, pts, m) {
    pts.forEach((p, i) => {
      const x = m.x(p[0]), y = m.y(p[1]);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
  }

  function clipPlot(ctx, m) {
    ctx.beginPath();
    ctx.rect(PAD.l, PAD.t, m.iw, m.ih);
    ctx.clip();
  }

  function draw(canvas, spec) {
    const { ctx, w, h } = prep(canvas, spec);
    const m = mapper(spec, w, h);
    ctx.clearRect(0, 0, w, h);
    axes(ctx, spec, m, w, h);

    ctx.save();
    clipPlot(ctx, m);

    for (const s of spec.series || []) {
      if (s.type === 'band' && s.lo?.length && s.hi?.length) {
        ctx.beginPath();
        poly(ctx, s.hi, m);
        [...s.lo].reverse().forEach(p => ctx.lineTo(m.x(p[0]), m.y(p[1])));
        ctx.closePath();
        ctx.globalAlpha = s.alpha ?? 0.14;
        ctx.fillStyle = s.color; ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (s.type === 'area' && s.pts?.length) {
        ctx.beginPath();
        poly(ctx, s.pts, m);
        ctx.lineTo(m.x(s.pts[s.pts.length - 1][0]), m.y(spec.yDomain[0]));
        ctx.lineTo(m.x(s.pts[0][0]), m.y(spec.yDomain[0]));
        ctx.closePath();
        ctx.globalAlpha = s.alpha ?? 0.25;
        ctx.fillStyle = s.color; ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (s.type === 'stack' && s.layers?.length) {
        // layers share x grid; accumulate
        const n = s.layers[0].pts.length;
        let base = new Array(n).fill(0);
        for (const layer of s.layers) {
          const top = layer.pts.map((p, i) => [p[0], base[i] + p[1]]);
          ctx.beginPath();
          poly(ctx, top, m);
          for (let i = n - 1; i >= 0; i--) ctx.lineTo(m.x(layer.pts[i][0]), m.y(base[i]));
          ctx.closePath();
          ctx.globalAlpha = layer.alpha ?? 0.55;
          ctx.fillStyle = layer.color; ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = layer.color; ctx.lineWidth = 1;
          ctx.beginPath(); poly(ctx, top, m); ctx.stroke();
          base = top.map(p => p[1]);
        }
      }
      if (s.type === 'line' && s.pts?.length) {
        ctx.beginPath();
        poly(ctx, s.pts, m);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width ?? 1.6;
        ctx.setLineDash(s.dash || []);
        if (s.glow) { ctx.shadowColor = s.color; ctx.shadowBlur = 9; }
        ctx.stroke();
        ctx.setLineDash([]); ctx.shadowBlur = 0;
      }
    }
    ctx.restore();

    // guides (drawn over, labels outside clip)
    ctx.font = FONT;
    for (const g of spec.guides || []) {
      ctx.strokeStyle = g.color; ctx.fillStyle = g.color;
      ctx.setLineDash(g.dash || [4, 4]); ctx.lineWidth = 1;
      if (g.y !== undefined) {
        const y = Math.round(m.y(g.y)) + 0.5;
        if (y > PAD.t - 1 && y < h - PAD.b + 1) {
          ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(w - PAD.r, y); ctx.stroke();
          if (g.label) { ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(g.label, PAD.l + 6, y - 3); }
        }
      } else if (g.x !== undefined) {
        const x = Math.round(m.x(g.x)) + 0.5;
        ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, h - PAD.b); ctx.stroke();
        if (g.label) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(g.label, x + 5, PAD.t + 4); }
      }
      ctx.setLineDash([]);
    }

    // legend
    if (spec.legend?.length) {
      let lx = PAD.l + 10, ly = PAD.t + 10;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      for (const item of spec.legend) {
        ctx.fillStyle = item.color;
        ctx.fillRect(lx, ly - 3.5, 14, 3);
        ctx.fillStyle = C('--ink-dim');
        ctx.fillText(item.label, lx + 20, ly - 2);
        ly += 15;
      }
    }

    // y-axis label
    if (spec.yLabel) {
      ctx.fillStyle = C('--ink-faint') || '#31424f';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(spec.yLabel, 4, 4);
    }
  }

  // registry for responsive redraw
  const registry = new Map();
  function mount(canvas, specFn) {
    registry.set(canvas, specFn);
    draw(canvas, specFn());
  }
  // drop all mounted charts — call on route change before the DOM is replaced
  function reset() { registry.clear(); }
  function refresh(canvas) {
    const fn = registry.get(canvas);
    if (fn) draw(canvas, fn());
  }
  let rT;
  window.addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => registry.forEach((fn, cv) => draw(cv, fn())), 120);
  });

  return { draw, mount, refresh, reset, C };
})();
