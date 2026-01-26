$ErrorActionPreference = 'Stop'

$ts = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$src = 'C:\Projects\LotoFormula4Life'
$dest = Join-Path $src ("LotoFormula4Life_BACKUP_{0}" -f $ts)

New-Item -ItemType Directory -Force -Path $dest | Out-Null

$backupInfo = @(
  "BACKUP DATE: $ts"
  "SOURCE: $src"
  "DEST: $dest"
  "EXCLUDED DIRS (frontend): node_modules, dist, .vite, .turbo, coverage, .next, .git"
)
Set-Content -Encoding ASCII -Path (Join-Path $dest 'BACKUP_INFO.txt') -Value $backupInfo

foreach ($f in @('GUIDE_BACKEND.md', 'Règles de travail et de reverse.md')) {
  $p = Join-Path $src $f
  if (Test-Path $p) {
    Copy-Item -Force -Path $p -Destination $dest
  }
}

$srcFrontend = Join-Path $src 'frontend'
$destFrontend = Join-Path $dest 'frontend'

if (!(Test-Path $srcFrontend)) {
  throw "Source frontend introuvable: $srcFrontend"
}

& robocopy $srcFrontend $destFrontend /E /XD node_modules dist .vite .turbo coverage .next .git | Out-Null

Write-Output ("BACKUP_DONE {0}" -f $dest)

