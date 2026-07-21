/* Gradient · chat.ts — a warm little guide to Ben's work, wired to a
   Cloudflare Worker that talks to Claude Haiku. No secrets live here; the
   widget only knows the Worker's public URL. Compiled standalone to js/chat.js
   and dropped on every page. Stays dormant until WORKER_URL is set. */

(function () {
  /* ↓↓↓ paste the deployed Worker URL here to switch the chat on ↓↓↓ */
  const WORKER_URL = '';
  if (!WORKER_URL) return;                              /* invisible until configured */

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let busy = false, opened = false;
  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  /* ── build the DOM (all injected, no markup needed on the page) ── */
  const fab = document.createElement('button');
  fab.className = 'gc-fab'; fab.type = 'button';
  fab.setAttribute('aria-label', 'Ask about Ben\'s work');
  fab.innerHTML = '<span class="gc-fab-ico" aria-hidden="true">✦</span><span class="gc-fab-txt">ask about Ben</span>';

  const panel = document.createElement('div');
  panel.className = 'gc-panel'; panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Chat about Ben\'s work'); panel.hidden = true;
  panel.innerHTML =
    '<div class="gc-head"><span class="gc-title">ask about Ben<span>.</span></span>' +
    '<button class="gc-x" type="button" aria-label="Close chat">×</button></div>' +
    '<div class="gc-log" aria-live="polite"></div>' +
    '<form class="gc-form"><input class="gc-in" type="text" autocomplete="off" ' +
    'placeholder="his work? his stack? just ask…" aria-label="Your question" maxlength="1500" />' +
    '<button class="gc-send" type="submit" aria-label="Send">→</button></form>' +
    '<div class="gc-foot">an AI guide · Claude Haiku · answers can be imperfect</div>';

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  const log = panel.querySelector('.gc-log') as HTMLElement;
  const form = panel.querySelector('.gc-form') as HTMLFormElement;
  const input = panel.querySelector('.gc-in') as HTMLInputElement;

  /* ── helpers ── */
  function bubble(role: 'user' | 'bot', text: string): HTMLElement {
    const el = document.createElement('div');
    el.className = 'gc-msg gc-' + role;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  function typing(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'gc-msg gc-bot gc-typing';
    el.innerHTML = '<i></i><i></i><i></i>';
    log.appendChild(el); log.scrollTop = log.scrollHeight;
    return el;
  }
  async function reveal(el: HTMLElement, text: string): Promise<void> {
    if (reduced) { el.textContent = text; log.scrollTop = log.scrollHeight; return; }
    el.textContent = '';
    for (let i = 0; i < text.length; i += 2) {
      el.textContent = text.slice(0, i + 2);
      log.scrollTop = log.scrollHeight;
      if (i % 8 === 0) await sleep(12);
    }
    el.textContent = text;
  }

  async function send(text: string): Promise<void> {
    if (busy || !text.trim()) return;
    busy = true; input.value = ''; (panel.querySelector('.gc-send') as HTMLButtonElement).disabled = true;
    bubble('user', text);
    history.push({ role: 'user', content: text });
    const dots = typing();
    let reply = '', limited = false;
    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-10) }),
      });
      const data = await res.json().catch(() => ({} as { reply?: string; limited?: boolean }));
      reply = data.reply || 'Sorry — I couldn\'t answer that one just now.';
      limited = !!data.limited;
    } catch {
      reply = 'I couldn\'t reach my brain just now — try again in a moment, or email ben.pachter@bellsouth.net.';
      limited = true;
    }
    dots.remove();
    await reveal(bubble('bot', ''), reply);
    if (!limited) history.push({ role: 'assistant', content: reply });
    busy = false; (panel.querySelector('.gc-send') as HTMLButtonElement).disabled = false;
    input.focus();
  }

  /* ── open / close ── */
  function openPanel(): void {
    panel.hidden = false; fab.classList.add('gc-hidden');
    requestAnimationFrame(() => panel.classList.add('gc-show'));
    if (!opened) {
      opened = true;
      reveal(bubble('bot', ''),
        'Hi! 👋 I\'m the guide to Ben Pachter\'s work — knowledge graphs, LLM pipelines, and the odd hand-built physics engine. Ask me anything: what he does at Duke Energy, how Thessa works, what he\'s built for fun. What are you curious about?');
    }
    setTimeout(() => input.focus(), 220);
  }
  function closePanel(): void {
    panel.classList.remove('gc-show'); fab.classList.remove('gc-hidden');
    setTimeout(() => { panel.hidden = true; }, 220);
  }
  fab.addEventListener('click', openPanel);
  (panel.querySelector('.gc-x') as HTMLElement).addEventListener('click', closePanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) closePanel(); });
  form.addEventListener('submit', e => { e.preventDefault(); void send(input.value); });
})();
