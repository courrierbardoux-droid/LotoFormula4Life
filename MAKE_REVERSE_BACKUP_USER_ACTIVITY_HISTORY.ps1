$ErrorActionPreference = 'Stop'

$ts = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$root = 'C:\Projects\LotoFormula4Life\BACKUP_REVERSE'
$dest = Join-Path $root ("BACKUP_REVERSE_{0}" -f $ts)

$destPages = Join-Path $dest 'frontend\client\src\pages'
New-Item -ItemType Directory -Force -Path $destPages | Out-Null

$srcFile = 'C:\Projects\LotoFormula4Life\frontend\client\src\pages\UserActivityHistory.tsx'
Copy-Item -Force -Path $srcFile -Destination (Join-Path $destPages 'UserActivityHistory.tsx')

Set-Content -Encoding UTF8 -Path (Join-Path $dest 'LISTE_FICHIERS_MODIFIES.txt') -Value @(
  'frontend/client/src/pages/UserActivityHistory.tsx'
)

Write-Output $dest

