<#
  fetch-images.ps1  —  drop real, license-cleared telescope photos into attractor/img/

  WHY THIS EXISTS
  ---------------
  The build sandbox's network policy blocks every image host (Wikimedia, NASA,
  ESO, STScI) at the proxy, so the site ships with original abstract artwork for
  the section backgrounds and *self-hiding* photo plates. The HTML already
  references the exact filenames below and already carries the correct credits;
  the instant these files exist, the hero photo appears, every plate un-hides,
  and the credit lines light up. No HTML edits required.

  Run this ONCE from anywhere inside the repo (it locates attractor/img itself):

      pwsh ./attractor/src/fetch-images.ps1        # PowerShell 7+  (recommended)
      # or on Windows PowerShell 5.1:
      powershell -ExecutionPolicy Bypass -File .\attractor\src\fetch-images.ps1

  Then commit the new files in attractor/img/ and push. Done.

  LICENSES (all free for a credited portfolio; verified against Wikimedia Commons)
  -------------------------------------------------------------------------------
    Webb's First Deep Field (SMACS 0723) .. CC BY 4.0 .. NASA, ESA, CSA, STScI
    Hubble eXtreme Deep Field (XDF) ....... CC BY 4.0 .. NASA, ESA & the HUDF09 Team
    WMAP nine-year microwave sky .......... Public Domain .. NASA / WMAP Science Team
    ESO Milky Way panorama ................ CC BY 4.0 .. ESO / S. Brunier
    Andromeda (with H-alpha) .............. CC BY 2.0 .. Adam Evans
  Optional extras (not wired into a page yet — ask and they get placed + credited):
    Cosmic Cliffs / Carina NGC 3324 (JWST)  CC BY 4.0 .. NASA, ESA, CSA, STScI
    M87* black hole (EHT) ................. CC BY 3.0 .. Event Horizon Telescope Collab.
#>

[CmdletBinding()]
param(
  # also pull the two optional extras (nebula plate + black-hole "singularity")
  [switch]$IncludeExtras
)

$ErrorActionPreference = 'Stop'
# PowerShell 5.1 defaults to old TLS; force 1.2 so HTTPS to Wikimedia works.
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

# Wikimedia rejects empty/unknown User-Agents. Identify honestly.
$UA = 'AttractorSiteBot/1.0 (+https://bpachter.github.io/attractor/; portfolio image fetch)'

# Locate attractor/img relative to this script (src/ -> ../img).
$imgDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'img'
if (-not (Test-Path $imgDir)) { New-Item -ItemType Directory -Path $imgDir | Out-Null }
Write-Host "Target: $imgDir`n" -ForegroundColor Cyan

# file  = exact Wikimedia Commons filename (Special:FilePath resolves + resizes it)
# out   = filename the site's HTML already expects
# width = longest-edge downscale (keeps the repo light; originals are huge)
$targets = @(
  @{ file = "Webb's First Deep Field.jpg";                       out = 'hero-real.jpg';       width = 2200 }
  @{ file = 'The Hubble eXtreme Deep Field (eso1633c).jpg';       out = 'plate-deepfield.jpg'; width = 1800 }
  @{ file = 'WMAP 2012.png';                                      out = 'plate-cmb.png';       width = 1800 }
  @{ file = 'ESO - Milky Way.jpg';                                out = 'plate-milkyway.jpg';  width = 2000 }
  @{ file = 'Andromeda Galaxy (with h-alpha).jpg';                out = 'plate-andromeda.jpg'; width = 1800 }
)
if ($IncludeExtras) {
  $targets += @(
    @{ file = 'Cosmic Cliffs in the Carina Nebula (NIRCam Image).jpg'; out = 'plate-nebula.jpg';     width = 1800 }
    @{ file = 'Black hole - Messier 87 crop.jpg';                      out = 'hero-singularity.jpg'; width = 1600 }
  )
}

$ok = 0; $fail = @()
foreach ($t in $targets) {
  # Special:FilePath wants the filename with spaces->underscores, then URL-encoded.
  $enc = [uri]::EscapeDataString(($t.file -replace ' ', '_'))
  $url = "https://commons.wikimedia.org/wiki/Special:FilePath/$enc" + "?width=$($t.width)"
  $dest = Join-Path $imgDir $t.out
  Write-Host ("{0,-22} <- {1}" -f $t.out, $t.file)
  try {
    Invoke-WebRequest -Uri $url -OutFile $dest -UserAgent $UA -MaximumRedirection 5 -UseBasicParsing
    $len = (Get-Item $dest).Length
    if ($len -lt 4096) { throw "suspiciously small ($len bytes) — probably an error page" }
    Write-Host ("   ok  {0:N0} KB" -f ($len / 1KB)) -ForegroundColor Green
    $ok++
  } catch {
    Write-Host "   FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if (Test-Path $dest) { Remove-Item $dest -Force }
    $fail += $t.out
  }
}

Write-Host ("`n{0} of {1} downloaded." -f $ok, $targets.Count) -ForegroundColor Cyan
if ($fail.Count) {
  Write-Host "Missing: $($fail -join ', ')" -ForegroundColor Yellow
  Write-Host "If a filename 404s, open its Commons page, copy the exact title into `$targets, and re-run."
}
Write-Host "`nNext:  git add attractor/img && git commit -m 'Attractor: real telescope imagery' && git push"
