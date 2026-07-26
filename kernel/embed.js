/*!
 * kernel-embed — drop a live CPython cell into any page.
 *
 * Canonical source: bpachter.github.io/kernel/embed.js
 * Vendored copies live in the entropy/ and headroom/ repos; keep them in sync.
 *
 * Design notes
 * ------------
 * These are *content* sites. Most readers will never touch a code cell, so the
 * interpreter is NEVER downloaded until someone actually presses Run. Until then
 * a cell is just readable, styled, selectable source text — no network cost at all.
 *
 * Markup contract:
 *   <div data-kernel-cell
 *        data-packages="numpy,pandas"   (optional; omit for stdlib-only — much faster)
 *        data-lang="python"             (optional label)
 *        data-autorun="false">          (optional)
 *     <script type="text/x-python">
 *   ...source, flush-left...
 *     </script>
 *   </div>
 *
 * Source lives in a <script type="text/x-python"> because the browser will not
 * execute or reformat it, and — unlike a <textarea> — leading indentation in the
 * HTML file can be stripped safely (see dedent()). Python is whitespace-sensitive,
 * so that matters.
 *
 * Theming: set --kc-* custom properties on any ancestor to match the host site.
 */
(function () {
  "use strict";

  if (window.__kernelEmbedLoaded) return;
  window.__kernelEmbedLoaded = true;

  var PYODIDE_VERSION = "0.26.4";
  // Overridable so the runtime can be self-hosted (or pointed at a local copy
  // for testing) instead of always reaching for the CDN.
  var PYODIDE_INDEX =
    window.KERNEL_PYODIDE_INDEX ||
    "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/";

  var pyodide = null;
  var bootState = "cold"; // cold | booting | ready | failed
  var bootWaiters = [];
  var loadedPackages = {};

  /* ---------------------------------------------------------------- styles */
  var CSS = [
    '[data-kernel-cell]{--_a:var(--kc-accent,#7c93ff);--_o:var(--kc-out,#f2b73f);--_obg:var(--kc-outbg,#08090f);--_oa:var(--kc-onaccent,#0b0e15);--_bg:var(--kc-bg,#11151f);--_bg2:var(--kc-bg2,#161b28);--_ln:var(--kc-line,rgba(255,255,255,.10));--_tx:var(--kc-text,#c7cedb);--_br:var(--kc-bright,#eef2fa);--_fn:var(--kc-faint,#6b7384);--_mono:var(--kc-mono,"JetBrains Mono",ui-monospace,Menlo,monospace);',
    'display:block;margin:26px 0;border:1px solid var(--_ln);border-radius:14px;overflow:hidden;background:var(--_bg);box-shadow:0 14px 40px rgba(0,0,0,.28);text-align:left}',
    '.kc-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 13px;background:var(--_bg2);border-bottom:1px solid var(--_ln);flex-wrap:wrap}',
    '.kc-tag{font-family:var(--_mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--_fn)}',
    '.kc-title{font-family:var(--_mono);font-size:11.5px;color:var(--_tx);flex:1 1 auto;min-width:0}',
    '.kc-acts{display:flex;gap:7px;flex-shrink:0}',
    '.kc-btn{font-family:var(--_mono);font-size:12px;padding:5px 12px;border-radius:7px;border:1px solid var(--_ln);background:transparent;color:var(--_tx);cursor:pointer;line-height:1.4}',
    '.kc-btn:hover:not(:disabled){border-color:var(--_fn)}',
    '.kc-btn.kc-primary{background:var(--_a);border-color:var(--_a);color:var(--_oa);font-weight:600}',
    '.kc-btn.kc-primary:hover:not(:disabled){filter:brightness(1.08)}',
    '.kc-btn:disabled{opacity:.5;cursor:not-allowed}',
    '.kc-src{display:block;width:100%;box-sizing:border-box;min-height:80px;resize:vertical;font-family:var(--_mono);font-size:13px;line-height:1.6;color:var(--_br);background:var(--_bg);border:0;padding:14px 16px;outline:none;tab-size:4;white-space:pre;overflow-x:auto}',
    '.kc-src:focus{background:rgba(0,0,0,.22)}',
    '.kc-foot{padding:7px 13px;font-family:var(--_mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--_fn);background:rgba(0,0,0,.18);border-top:1px solid var(--_ln)}',
    '.kc-out{font-family:var(--_mono);font-size:12.5px;line-height:1.55;color:var(--_o);background:var(--_obg);padding:14px 16px;margin:0;white-space:pre-wrap;word-break:break-word;max-height:400px;overflow:auto;border-top:1px solid var(--_ln)}',
    '.kc-out.kc-err{color:var(--kc-error,#f87171)}',
    '.kc-out.kc-muted{color:var(--_fn);font-style:italic}',
    '@media(max-width:600px){.kc-src{font-size:12.2px;padding:11px 12px}.kc-title{display:none}}',
    // The lede paragraph sits OUTSIDE the cell (so it inherits the host page's
    // prose styling); it only needs its spacing tightened toward the cell.
    '.kc-intro{margin-bottom:-10px}',
    '.kc-refbadge{opacity:.75;font-style:italic}',
    '[data-kernel-cell][data-runnable="false"]{opacity:.94}',
    '[data-kernel-cell][data-runnable="false"] .kc-src{cursor:default}',
    '.kc-refnote{padding:10px 14px;font-family:var(--kc-mono,ui-monospace,Menlo,monospace);font-size:11px;line-height:1.55;color:var(--kc-faint,#6b7384);background:rgba(0,0,0,.14);border-top:1px solid var(--kc-line,rgba(255,255,255,.10))}',
    // Output tables are fixed-width. Let narrow screens scroll them sideways
    // instead of reflowing and destroying the column alignment.
    '@media(max-width:640px){[data-kernel-cell] .kc-out{white-space:pre;overflow-x:auto}}',
  ].join("");

  function injectStyles() {
    if (document.getElementById("kernel-embed-styles")) return;
    var s = document.createElement("style");
    s.id = "kernel-embed-styles";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------- utilities */

  // Strip the common leading indentation so source can sit naturally indented
  // inside the HTML document without breaking Python's block structure.
  function dedent(text) {
    var lines = text.replace(/\t/g, "    ").split("\n");
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    var indent = null;
    for (var i = 0; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      var n = lines[i].match(/^ */)[0].length;
      if (indent === null || n < indent) indent = n;
    }
    if (!indent) return lines.join("\n");
    return lines.map(function (l) { return l.slice(indent); }).join("\n");
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("could not load " + src)); };
      document.head.appendChild(s);
    });
  }

  /* ------------------------------------------------------------------ boot */

  function announce(msg) {
    bootWaiters.forEach(function (w) { if (w.onProgress) w.onProgress(msg); });
  }

  async function ensurePyodide(packages, onProgress) {
    if (bootState === "ready") {
      await ensurePackages(packages, onProgress);
      return pyodide;
    }
    var waiter = { onProgress: onProgress };
    bootWaiters.push(waiter);

    if (bootState === "cold") {
      bootState = "booting";
      try {
        announce("fetching CPython " + PYODIDE_VERSION + " (WebAssembly)…");
        if (typeof loadPyodide === "undefined") await loadScript(PYODIDE_INDEX + "pyodide.js");
        announce("starting the interpreter…");
        pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX });

        // Capture harness: run user code with stdout redirected, and turn any
        // exception into a normal result rather than letting it escape into JS.
        pyodide.runPython(
          "import sys, io, traceback, json\n" +
          "def __kc_run(code):\n" +
          "    buf = io.StringIO()\n" +
          "    old = sys.stdout\n" +
          "    sys.stdout = buf\n" +
          "    ok = True\n" +
          "    try:\n" +
          "        exec(code, {'__name__': '__main__'})\n" +
          "    except BaseException:\n" +
          "        ok = False\n" +
          "        print(traceback.format_exc(), file=buf)\n" +
          "    finally:\n" +
          "        sys.stdout = old\n" +
          "    return json.dumps({'ok': ok, 'output': buf.getvalue()})\n"
        );
        bootState = "ready";
      } catch (e) {
        bootState = "failed";
        bootWaiters.forEach(function (w) { if (w.onFail) w.onFail(e); });
        bootWaiters = [];
        throw e;
      }
      bootWaiters = [];
    } else {
      // another cell is already booting — wait for it
      while (bootState === "booting") await new Promise(function (r) { setTimeout(r, 120); });
      if (bootState !== "ready") throw new Error("interpreter failed to start");
    }

    await ensurePackages(packages, onProgress);
    return pyodide;
  }

  async function ensurePackages(packages, onProgress) {
    var need = (packages || []).filter(function (p) { return p && !loadedPackages[p]; });
    if (!need.length) return;
    if (onProgress) onProgress("loading " + need.join(", ") + "…");
    await pyodide.loadPackage(need);
    need.forEach(function (p) { loadedPackages[p] = true; });

    // loadPackage can resolve without a module actually being importable
    // (e.g. a partial CDN failure), so confirm capability directly.
    var importNames = { "scikit-learn": "sklearn", "attrs": "attr" };
    var mods = need.map(function (p) { return importNames[p] || p; });
    var missing = JSON.parse(
      pyodide.runPython(
        "import json\n" +
        "__m = []\n" +
        "for __n in " + JSON.stringify(mods) + ":\n" +
        "    try:\n" +
        "        __import__(__n)\n" +
        "    except Exception:\n" +
        "        __m.append(__n)\n" +
        "json.dumps(__m)\n"
      )
    );
    if (missing.length) throw new Error("these libraries did not load: " + missing.join(", "));
  }

  /* ------------------------------------------------------------ cell setup */

  function upgradeCell(host) {
    if (host.__kcReady) return;
    host.__kcReady = true;

    var srcNode = host.querySelector('script[type="text/x-python"], textarea');
    var original = dedent(srcNode ? (srcNode.textContent || srcNode.value || "") : "");
    if (srcNode) srcNode.remove();

    var packages = (host.getAttribute("data-packages") || "")
      .split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    var lang = host.getAttribute("data-lang") || "python";
    var title = host.getAttribute("data-title") || "";
    // Reference blocks: real library code that CANNOT run here (PyTorch and
    // TensorFlow have no WebAssembly build). Shown as read-only source with an
    // explicit note, rather than a Run button that would lie about what it does.
    var runnable = host.getAttribute("data-runnable") !== "false";
    var note = host.getAttribute("data-note") || "";

    var bar = document.createElement("div");
    bar.className = "kc-bar";
    var tag = document.createElement("span");
    tag.className = "kc-tag";
    tag.textContent = lang;
    var titleEl = document.createElement("span");
    titleEl.className = "kc-title";
    titleEl.textContent = title;
    var acts = document.createElement("div");
    acts.className = "kc-acts";

    var resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "kc-btn";
    resetBtn.textContent = "reset";

    var runBtn = document.createElement("button");
    runBtn.type = "button";
    runBtn.className = "kc-btn kc-primary";
    runBtn.textContent = "▶ run";

    if (runnable) {
      acts.appendChild(resetBtn);
      acts.appendChild(runBtn);
    } else {
      var badge = document.createElement("span");
      badge.className = "kc-tag kc-refbadge";
      badge.textContent = "reference · not run here";
      acts.appendChild(badge);
    }
    bar.appendChild(tag);
    bar.appendChild(titleEl);
    bar.appendChild(acts);

    var ta = document.createElement("textarea");
    ta.className = "kc-src";
    ta.spellcheck = false;
    ta.setAttribute("aria-label", title || "editable Python source");
    ta.value = original;
    // size to content so short cells aren't a tall empty box
    ta.rows = Math.min(Math.max(original.split("\n").length + 1, 4), 28);

    var foot = document.createElement("div");
    foot.className = "kc-foot";
    foot.textContent = "output";

    var out = document.createElement("pre");
    out.className = "kc-out kc-muted";
    out.setAttribute("aria-live", "polite");
    out.textContent = packages.length
      ? "press run — first run downloads Python + " + packages.join(", ")
      : "press run — first run downloads the Python interpreter";

    host.appendChild(bar);
    host.appendChild(ta);

    if (!runnable) {
      // Read-only: no output pane, no Run. Just the real source and why it
      // cannot execute in a browser.
      ta.readOnly = true;
      ta.setAttribute("aria-label", (title || "reference source") + " (read only)");
      var refNote = document.createElement("div");
      refNote.className = "kc-refnote";
      refNote.textContent = note ||
        "Real library code, shown for comparison. PyTorch and TensorFlow have no " +
        "WebAssembly build, so this cannot run in a browser — it needs a Python " +
        "install (and, for anything real, a GPU).";
      host.appendChild(refNote);
      return;
    }

    host.appendChild(foot);
    host.appendChild(out);

    function setOut(text, kind) {
      out.textContent = text;
      out.classList.toggle("kc-err", kind === "err");
      out.classList.toggle("kc-muted", kind === "muted");
    }

    async function run() {
      runBtn.disabled = true;
      var label = runBtn.textContent;
      runBtn.textContent = "running…";
      try {
        if (bootState !== "ready") setOut("starting…", "muted");
        var py = await ensurePyodide(packages, function (msg) { setOut(msg, "muted"); });
        setOut("running…", "muted");
        var res = JSON.parse(py.globals.get("__kc_run")(ta.value));
        setOut(res.output || (res.ok ? "(finished with no output — add a print())" : "(no output)"),
               res.ok ? null : "err");
      } catch (e) {
        setOut(
          "Could not start the Python runtime.\n" +
          (e && e.message ? e.message : String(e)) +
          "\n\nThis usually means a script blocker or offline network is stopping " +
          "cdn.jsdelivr.net. The code above is unchanged and still readable.",
          "err"
        );
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = label;
      }
    }

    runBtn.addEventListener("click", run);
    resetBtn.addEventListener("click", function () {
      ta.value = original;
      setOut(packages.length
        ? "press run — first run downloads Python + " + packages.join(", ")
        : "press run — first run downloads the Python interpreter", "muted");
    });

    ta.addEventListener("keydown", function (e) {
      if (e.key === "Tab") {
        e.preventDefault();
        var s = ta.selectionStart, en = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + "    " + ta.value.slice(en);
        ta.selectionStart = ta.selectionEnd = s + 4;
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        run();
      }
    });

    if (host.getAttribute("data-autorun") === "true") run();
  }

  function upgradeAll(root) {
    injectStyles();
    (root || document).querySelectorAll("[data-kernel-cell]").forEach(upgradeCell);
  }

  window.KernelEmbed = { upgrade: upgradeAll, upgradeCell: upgradeCell };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { upgradeAll(); });
  } else {
    upgradeAll();
  }
})();
