$ErrorActionPreference = 'Stop'

$ts = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$root = 'C:\Projects\LotoFormula4Life\BACKUP_REVERSE'
$dest = Join-Path $root ("BACKUP_REVERSE_{0}" -f $ts)

$destDir = Join-Path $dest 'frontend\client\src\pages'
New-Item -ItemType Directory -Force -Path $destDir | Out-Null

$srcFile = 'C:\Projects\LotoFormula4Life\frontend\client\src\pages\Settings.tsx'
Copy-Item -Force -Path $srcFile -Destination (Join-Path $destDir 'Settings.tsx')

Set-Content -Encoding UTF8 -Path (Join-Path $dest 'LISTE_FICHIERS_MODIFIES.txt') -Value @(
  'frontend/client/src/pages/Settings.tsx'
)

Write-Output $dest

