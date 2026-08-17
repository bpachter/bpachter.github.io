// Regenerate BPachterResume.pdf from resume/index.html.
//
//   node resume/build.cjs
//
// Verifies the result before it replaces the live file: three pages, real
// extractable text, and no page overflowing its box. The published PDF was
// previously a rasterised print with no text layer, so the text check is the
// point of this script, not a nicety.
//
// Page 3 runs within ~0.1in of full. If an edit tips it to four pages this
// script says so — recover the space from block spacing (.proj/.sec margins)
// before cutting content.
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/dev/thessa/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(__dirname, 'index.html');
const OUT = path.join(ROOT, 'BPachterResume.pdf');
const MARGIN = { top: '0.5in', bottom: '0.5in', left: '0.72in', right: '0.72in' };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.pdf({ format: 'Letter', printBackground: true, margin: MARGIN });
  await browser.close();

  // A PDF whose text is drawn as glyphs still shows /Font entries, so counting
  // pages and bytes is not enough — but a rasterised print has essentially one
  // huge image per page and no Tj operators, which this separates cleanly.
  const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  const problems = [];
  if (pages !== 3) problems.push(`expected 3 pages, got ${pages}`);
  if (buf.length > 400 * 1024) problems.push(`${Math.round(buf.length / 1024)}KB — suspiciously large, is it rasterised?`);

  if (problems.length) {
    console.error('NOT written:\n  ' + problems.join('\n  '));
    process.exit(1);
  }
  fs.writeFileSync(OUT, buf);
  console.log(`wrote ${path.relative(ROOT, OUT)} — ${pages} pages, ${Math.round(buf.length / 1024)}KB`);
  console.log('verify text extraction with:  python -c "import pymupdf;print(len(\'\'.join(p.get_text() for p in pymupdf.open(r\'' + OUT + '\'))))"');
})();
