/* DRAWDOWN motion — beUI-inspired primitives, hand-rolled for a zero-framework app.
   Ports of the patterns in beui.dev (Number Animation, Notification Stack, Command
   Palette, animated tab indicator, staggered entrances) without React/Framer Motion.
   All effects respect prefers-reduced-motion. */
const Motion = (() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── number ticker: counts an element from 0 (or its previous value) to target.
     Usage: Motion.tick(el, 1242, {dec:0, prefix:'$', suffix:''}) */
  const prev = new WeakMap();
  const prevByKey = new Map();   // survives DOM rebuilds — pass opts.key for stable identity
  function tick(el, target, opts = {}) {
    const { dec = 0, prefix = '', suffix = '', ms = 650, key } = opts;
    const from = (key ? prevByKey.get(key) : prev.get(el)) ?? 0;
    if (key) prevByKey.set(key, target); else prev.set(el, target);
    if (reduced || from === target) {
      el.textContent = prefix + target.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix;
      return;
    }
    const t0 = performance.now();
    const ease = x => 1 - Math.pow(1 - x, 3);
    (function frame(now) {
      const p = Math.min(1, (now - t0) / ms);
      const v = from + (target - from) * ease(p);
      el.textContent = prefix + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix;
      if (p < 1) requestAnimationFrame(frame);
      else { el.classList.remove('vflash'); void el.offsetWidth; el.classList.add('vflash'); }
    })(t0);
  }

  /* ── staggered entrance: tag a container's direct children with --i and .m-in */
  function stagger(container, selector = ':scope > *') {
    if (!container) return;
    container.querySelectorAll(selector).forEach((n, i) => {
      n.style.setProperty('--i', Math.min(i, 10));
      n.classList.add('m-in');
    });
  }

  /* ── toast stack */
  function toast(msg, { kind = '', tag = 'SYS', ms = 4200 } = {}) {
    const host = document.getElementById('toasts');
    if (!host) return;
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.innerHTML = `<div class="tt">${tag}</div><div>${msg}</div>`;
    host.appendChild(t);
    while (host.children.length > 4) host.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms);
  }

  /* ── animated tab indicator: glides under the active .tab */
  function tabIndicator() {
    const ind = document.getElementById('tab-ind');
    const on = document.querySelector('.tab.on');
    if (!ind) return;
    if (!on) { ind.style.width = '0'; return; }
    const nav = on.parentElement.getBoundingClientRect();
    const r = on.getBoundingClientRect();
    ind.style.left = (r.left - nav.left + on.parentElement.scrollLeft) + 'px';
    ind.style.width = r.width + 'px';
  }
  window.addEventListener('resize', tabIndicator);

  /* ── command palette (⌘K / Ctrl-K): fuzzy list of registered actions.
     register([{k:'MODEL', label:'Open the desk', hint:'F3', run:fn}, …]) */
  let actions = [], sel = 0;
  function register(list) { actions = list; }
  function score(q, s) {
    q = q.toLowerCase(); s = s.toLowerCase();
    if (!q) return 1;
    if (s.includes(q)) return 100 - s.indexOf(q);
    let i = 0; for (const c of s) if (c === q[i]) i++;
    return i === q.length ? 10 : -1;
  }
  function renderList(q) {
    const list = document.getElementById('pal-list');
    const hits = actions.map(a => ({ a, s: Math.max(score(q, a.k + ' ' + a.label), -1) }))
      .filter(x => x.s >= 0).sort((x, y) => y.s - x.s).slice(0, 9);
    sel = Math.min(sel, Math.max(0, hits.length - 1));
    list.innerHTML = hits.map((h, i) =>
      `<div class="pal-item ${i === sel ? 'on' : ''}" data-i="${i}"><span class="pk">${h.a.k}</span><span>${h.a.label}</span><span class="pd">${h.a.hint || ''}</span></div>`).join('');
    list.querySelectorAll('.pal-item').forEach(n => {
      n.onclick = () => { hide(); hits[+n.dataset.i].a.run(); };
      n.onmousemove = () => { sel = +n.dataset.i; renderList(q); };
    });
    return hits;
  }
  function show() {
    sel = 0;
    document.getElementById('palette').classList.add('show');
    const inp = document.getElementById('pal-input');
    inp.value = ''; renderList(''); inp.focus();
  }
  function hide() { document.getElementById('palette').classList.remove('show'); }
  function initPalette() {
    const inp = document.getElementById('pal-input');
    if (!inp) return;
    inp.addEventListener('input', () => { sel = 0; renderList(inp.value); });
    inp.addEventListener('keydown', e => {
      const hits = renderList(inp.value);
      if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, hits.length - 1); renderList(inp.value); e.preventDefault(); }
      if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); renderList(inp.value); e.preventDefault(); }
      if (e.key === 'Enter' && hits[sel]) { hide(); hits[sel].a.run(); }
      if (e.key === 'Escape') hide();
    });
    document.getElementById('palette').addEventListener('click', e => { if (e.target.id === 'palette') hide(); });
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); show(); }
    });
  }

  return { tick, stagger, toast, tabIndicator, register, initPalette, showPalette: show, reduced };
})();
