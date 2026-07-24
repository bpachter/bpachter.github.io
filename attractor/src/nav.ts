/* The Great Attractor — sidebar drawer toggle.
   Sections expand/collapse via native <details>; this only drives the mobile
   off-canvas drawer (hamburger open, backdrop/link/Escape close). Self-contained,
   no dependencies, loaded on every page. */
(function () {
  var body = document.body;
  function setOpen(on: boolean) {
    body.classList.toggle('nav-open', on);
    var burger = document.querySelector('.nav-burger');
    if (burger) burger.setAttribute('aria-expanded', on ? 'true' : 'false');
  }
  document.addEventListener('click', function (e) {
    var t = e.target as HTMLElement | null;
    if (!t) return;
    if (t.closest('.nav-burger')) {
      e.preventDefault();
      setOpen(!body.classList.contains('nav-open'));
      return;
    }
    if (t.closest('.nav-backdrop')) { setOpen(false); return; }
    if (t.closest('.sidebar a')) { setOpen(false); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setOpen(false);
  });
})();
