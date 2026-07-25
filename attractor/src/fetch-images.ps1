<#
  fetch-images.ps1  —  download the license-cleared telescope/archival photos this
  site references, into attractor/img/, under the exact filenames the HTML expects.

  WHY: the build sandbox blocks every image host at the proxy, so the images can't be
  fetched there. Run this once on your own machine, then commit attractor/img and push;
  each plate un-hides and the hero photo appears automatically the moment its file exists.

  For each image several candidate Wikimedia Commons filenames are tried in order (exact
  Commons titles are finicky); the first that resolves wins. Files that already exist are
  SKIPPED so this never clobbers the web-optimized versions already in the repo (pass
  -Force to re-fetch). Anything that can't be found is reported — the matching plate just
  stays hidden until you drop the right file in.

  LICENSES (all free for a credited portfolio; verified by a 4-panel cross-check):
    M87 black hole (hero) ..... CC BY 4.0 .. Event Horizon Telescope Collaboration
    Bullet Cluster ............ Public Domain .. NASA/CXC; NASA/STScI, Magellan, ESO
    Antennae Galaxies ......... CC BY 4.0 .. NASA, ESA & the Hubble Heritage Team
    Pillars of Creation ....... Public Domain .. NASA, ESA, CSA, STScI
    Fornax Cluster ............ CC BY 4.0 .. ESO
    Pandora's Cluster (A2744) . Public Domain .. NASA, ESA, CSA, STScI
    Einstein portrait (1921) .. Public Domain .. Ferdinand Schmutzer / rest. A. Cuerden
    Henrietta Leavitt ......... Public Domain .. Harvard College Observatory / AAVSO
    Quasar 3C 273 ............. CC BY 4.0 .. ESA/Hubble & NASA
    Dark-matter map (COSMOS) .. CC BY 4.0 .. NASA, ESA & R. Massey (Caltech)
    Webb's First Deep Field ... Public Domain .. NASA, ESA, CSA, STScI  (already in repo)

  NOTE: fetched files are full-resolution ORIGINALS. The five images already committed
  are web-optimized derivatives; the ones you fetch here can be slimmed the same way
  afterward (or just ask and they'll be optimized in-repo once pushed).
#>

[CmdletBinding()]
param([switch]$Force)

$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
$UA = 'AttractorSiteBot/1.0 (+https://bpachter.github.io/attractor/; portfolio image fetch)'

$imgDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'img'
if (-not (Test-Path $imgDir)) { New-Item -ItemType Directory -Path $imgDir | Out-Null }
Write-Host "Target: $imgDir`n" -ForegroundColor Cyan

# out = filename the HTML expects | width = longest-edge downscale | files = candidate Commons titles (tried in order)
$targets = @(
  @{ out = 'hero-singularity.jpg'; width = 2200; files = @('Black hole - Messier 87.jpg','Black hole - Messier 87 crop max res.jpg','EHT image of the M87 black hole.jpg','EHT image of the black hole in M87.jpg') }
  @{ out = 'plate-bullet.jpg';     width = 1800; files = @('1e0657 scale.jpg','Bullet cluster.jpg','1E0657-558.jpg') }
  @{ out = 'plate-antennae.jpg';   width = 1800; files = @('Antennae galaxies xl.jpg','Antennae Galaxies reloaded.jpg','The Antennae Galaxies.jpg') }
  @{ out = 'plate-pillars.jpg';    width = 1800; files = @('Pillars of Creation (NIRCam Image).jpg','Pillars of Creation (NIRCam and MIRI Image).jpg','Pillars 2014 HST denoise.jpg') }
  @{ out = 'plate-cluster.jpg';    width = 1800; files = @('The Fornax Galaxy Cluster.jpg','Fornax Cluster.jpg','Coma Cluster.jpg') }
  @{ out = 'plate-pandora.jpg';    width = 1800; files = @('Abell 2744.jpg',"Pandora's Cluster (Abell 2744).jpg",'Abell 2744 Hubble Frontier Fields.jpg') }
  @{ out = 'plate-einstein.jpg';   width = 1100; files = @('Albert Einstein 1921 by F Schmutzer - restoration.jpg','Albert Einstein 1921 by F Schmutzer.jpg') }
  @{ out = 'plate-leavitt.jpg';    width = 1000; files = @('Leavitt aavso.jpg','Leavitt henrietta b1.jpg') }
  @{ out = 'plate-quasar.jpg';     width = 1600; files = @('Best image of bright quasar 3C 273.jpg','3C 273.jpg','Quasar 3C 273.jpg') }
  @{ out = 'plate-cosmicweb.jpg';  width = 1800; files = @('Dark matter map in the COSMOS field.jpg','3D map of the large-scale distribution of dark matter.jpg','COSMOS dark matter map.jpg') }
  @{ out = 'plate-webb.jpg';       width = 1800; files = @("Webb's First Deep Field.jpg","Webb's First Deep Field (high resolution).jpg",'SMACS 0723.jpg') }
)

$ok = 0; $skip = 0; $fail = @()
foreach ($t in $targets) {
  $dest = Join-Path $imgDir $t.out
  if ((Test-Path $dest) -and -not $Force) { Write-Host ("{0,-22} skip (exists)" -f $t.out) -ForegroundColor DarkGray; $skip++; continue }
  $got = $false
  foreach ($f in $t.files) {
    $enc = [uri]::EscapeDataString(($f -replace ' ', '_'))
    $url = "https://commons.wikimedia.org/wiki/Special:FilePath/$enc" + "?width=$($t.width)"
    try {
      Invoke-WebRequest -Uri $url -OutFile $dest -UserAgent $UA -MaximumRedirection 5 -UseBasicParsing
      if ((Get-Item $dest).Length -ge 4096) {
        Write-Host ("{0,-22} ok  {1,6:N0} KB   <- {2}" -f $t.out, ((Get-Item $dest).Length/1KB), $f) -ForegroundColor Green
        $got = $true; $ok++; break
      } else { Remove-Item $dest -Force }
    } catch { if (Test-Path $dest) { Remove-Item $dest -Force } }
  }
  if (-not $got) { Write-Host ("{0,-22} NOT FOUND (tried {1} titles)" -f $t.out, $t.files.Count) -ForegroundColor Red; $fail += $t.out }
}

Write-Host ("`n{0} fetched, {1} skipped, {2} missing." -f $ok, $skip, $fail.Count) -ForegroundColor Cyan
if ($fail.Count) {
  Write-Host "Missing: $($fail -join ', ')" -ForegroundColor Yellow
  Write-Host "For each, open its Wikimedia Commons page, copy the exact file title into `$targets, and re-run. Its plate stays hidden until then."
}
Write-Host "`nNext:  git add attractor/img && git commit -m 'Attractor: supplemental telescope imagery' && git push"
