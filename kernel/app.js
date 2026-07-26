(() => {
  const CHAPTERS = ["ingest", "query", "forecast", "model"];
  const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";

  const statusPill = document.getElementById("status-pill");
  const statusText = document.getElementById("status-text");
  const bootLog = document.getElementById("boot-log");
  const defaults = {};
  let pyodide = null;

  CHAPTERS.forEach((id) => {
    const ta = document.getElementById("code-" + id);
    if (ta) defaults[id] = ta.value;
  });

  function setStatus(state, text) {
    statusPill.className = "status-pill " + state;
    statusText.textContent = text;
  }

  function log(line) {
    bootLog.textContent += (bootLog.textContent ? "\n" : "") + line;
  }

  function setButtonsEnabled(enabled) {
    document.querySelectorAll(".btn-run").forEach((b) => { b.disabled = !enabled; });
  }

  async function boot() {
    setStatus("booting", "booting the interpreter…");
    log("loading CPython 3.12 (WebAssembly)…");
    try {
      pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX_URL });
    } catch (e) {
      setStatus("error", "couldn't load the Python runtime");
      log("failed to load Pyodide — a script/tracking blocker may be stopping cdn.jsdelivr.net. " + (e && e.message ? e.message : e));
      return;
    }
    log("CPython ready.");

    // sqlite3 is NOT part of Pyodide's default stdlib — it loads as its own package
    setStatus("booting", "loading pandas, numpy, scikit-learn, sqlite3…");
    try {
      await pyodide.loadPackage(["pandas", "numpy", "scikit-learn", "sqlite3"], {
        messageCallback: (msg) => log(msg),
      });
    } catch (e) {
      setStatus("error", "couldn't load the data-science packages");
      log("package load failed: " + (e && e.message ? e.message : e));
      return;
    }

    setStatus("booting", "loading the EIA storage data…");
    try {
      const [storageCsv, bandCsv] = await Promise.all([
        fetch("data/storage_weekly.csv").then((r) => r.text()),
        fetch("data/five_year_band_2026.csv").then((r) => r.text()),
      ]);
      pyodide.FS.writeFile("storage_weekly.csv", storageCsv);
      pyodide.FS.writeFile("five_year_band_2026.csv", bandCsv);
    } catch (e) {
      setStatus("error", "couldn't load the dataset");
      log("data fetch failed: " + (e && e.message ? e.message : e));
      return;
    }

    pyodide.runPython(`
import sys, io, traceback, json

def __run_and_capture(code):
    buf = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = buf
    ok = True
    try:
        exec(code, {"__name__": "__main__"})
    except Exception:
        ok = False
        print(traceback.format_exc(), file=buf)
    finally:
        sys.stdout = old_stdout
    return json.dumps({"ok": ok, "output": buf.getvalue()})
`);

    // loadPackage can resolve without actually making a module importable (e.g. a
    // partial CDN failure), so verify capability directly rather than trusting it.
    const missing = pyodide.runPython(`
import json
__missing = []
for __m in ("pandas", "numpy", "sklearn", "sqlite3"):
    try:
        __import__(__m)
    except Exception:
        __missing.append(__m)
json.dumps(__missing)
`);
    const missingList = JSON.parse(missing);
    if (missingList.length) {
      setStatus("error", "some libraries didn't load");
      log("these failed to import: " + missingList.join(", ") + " — cells needing them will error.");
    } else {
      setStatus("ready", "interpreter ready — pick a cell below");
      log("ready.");
    }
    setButtonsEnabled(true);

    // give the first chapter a free, unprompted run so scrolling down already shows real output
    runChapter("ingest");
  }

  function runChapter(id) {
    if (!pyodide) return;
    const ta = document.getElementById("code-" + id);
    const out = document.getElementById("out-" + id);
    const btn = document.querySelector('.btn-run[data-run="' + id + '"]');
    if (!ta || !out) return;

    const prevLabel = btn ? btn.textContent : null;
    if (btn) { btn.disabled = true; btn.textContent = "running…"; }

    try {
      const runner = pyodide.globals.get("__run_and_capture");
      const resultJson = runner(ta.value);
      const result = JSON.parse(resultJson);
      out.textContent = result.output || (result.ok ? "(no output — try a print statement)" : "unknown error");
      out.classList.toggle("err", !result.ok);
    } catch (e) {
      out.textContent = "Interpreter error: " + (e && e.message ? e.message : e);
      out.classList.add("err");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = prevLabel; }
    }
  }

  // wire up buttons
  document.querySelectorAll(".btn-run").forEach((btn) => {
    btn.addEventListener("click", () => runChapter(btn.dataset.run));
  });
  document.querySelectorAll(".btn-reset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.reset;
      const ta = document.getElementById("code-" + id);
      const out = document.getElementById("out-" + id);
      if (ta && defaults[id] !== undefined) ta.value = defaults[id];
      if (out) { out.textContent = ""; out.classList.remove("err"); }
    });
  });

  // editor niceties: Tab inserts spaces instead of moving focus; Cmd/Ctrl+Enter runs the cell
  document.querySelectorAll(".code-editor").forEach((ta) => {
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const start = ta.selectionStart, end = ta.selectionEnd;
        ta.value = ta.value.slice(0, start) + "    " + ta.value.slice(end);
        ta.selectionStart = ta.selectionEnd = start + 4;
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        const chapter = ta.closest(".cell").dataset.chapter;
        runChapter(chapter);
      }
    });
  });

  boot();
})();
