$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$docs = [System.IO.Path]::GetFullPath((Join-Path $root 'docs'))
$rootPrefix = $root.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
$dist = Join-Path $root 'dist'

if (-not $docs.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Pages output must be the docs folder inside this project.'
}

Push-Location -LiteralPath $root
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'The production build failed; Pages output was not changed.' }
  if (-not (Test-Path -LiteralPath (Join-Path $dist 'index.html') -PathType Leaf)) {
    throw 'The production build did not produce dist/index.html.'
  }

  if (Test-Path -LiteralPath $docs) {
    $existingDocs = (Resolve-Path -LiteralPath $docs).Path
    if (-not $existingDocs.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw 'Refusing to replace a Pages output folder outside the project.'
    }
    if (-not [string]::Equals($existingDocs, $docs, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw 'Refusing to replace a redirected Pages output folder.'
    }
    Remove-Item -LiteralPath $existingDocs -Recurse -Force
  }

  New-Item -ItemType Directory -Path $docs | Out-Null
  Get-ChildItem -LiteralPath $dist -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $docs -Recurse -Force
  }
  Write-Output 'Pages output refreshed in docs/.'
} finally {
  Pop-Location
}
