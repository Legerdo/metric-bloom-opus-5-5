$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$docs = [System.IO.Path]::GetFullPath((Join-Path $root 'docs'))
$rootPrefix = $root.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
$dist = Join-Path $root 'dist'
$comparisonRoot = Join-Path $root 'comparison\gpt6-pro'
$comparisonLanding = Join-Path $root 'comparison\index.html'
$buildRoot = Join-Path $root ('.pages-build-' + [guid]::NewGuid().ToString('N'))
$comparisonDist = Join-Path $buildRoot 'gpt6-pro-dist'
$siteStage = Join-Path $buildRoot 'site'
$previousDocs = Join-Path $buildRoot 'previous-docs'

if (-not $docs.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Pages output must be the docs folder inside this project.'
}
if (-not (Test-Path -LiteralPath (Join-Path $comparisonRoot 'package.json') -PathType Leaf)) {
  throw 'The GPT-6 Pro comparison source package.json is missing.'
}
if (-not (Test-Path -LiteralPath $comparisonLanding -PathType Leaf)) {
  throw 'The comparison landing page is missing.'
}

Push-Location -LiteralPath $root
try {
  $null = New-Item -ItemType Directory -Path $buildRoot

  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'The production build failed; Pages output was not changed.' }
  if (-not (Test-Path -LiteralPath (Join-Path $dist 'index.html') -PathType Leaf)) {
    throw 'The production build did not produce dist/index.html.'
  }

  npm --prefix $comparisonRoot ci
  if ($LASTEXITCODE -ne 0) { throw 'Installing GPT-6 Pro dependencies failed; Pages output was not changed.' }
  npm --prefix $comparisonRoot run build -- --base=./ "--outDir=$comparisonDist" --emptyOutDir
  if ($LASTEXITCODE -ne 0) { throw 'The GPT-6 Pro comparison build failed; Pages output was not changed.' }
  if (-not (Test-Path -LiteralPath (Join-Path $comparisonDist 'index.html') -PathType Leaf)) {
    throw 'The GPT-6 Pro comparison build did not produce index.html.'
  }

  $null = New-Item -ItemType Directory -Path $siteStage
  Get-ChildItem -LiteralPath $dist -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $siteStage -Recurse -Force
  }
  $comparisonSite = Join-Path $siteStage 'comparison\gpt6-pro'
  $null = New-Item -ItemType Directory -Path $comparisonSite -Force
  Get-ChildItem -LiteralPath $comparisonDist -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $comparisonSite -Recurse -Force
  }
  Copy-Item -LiteralPath $comparisonLanding -Destination (Join-Path $siteStage 'comparison\index.html') -Force

  if (Test-Path -LiteralPath $docs) {
    $existingDocs = (Resolve-Path -LiteralPath $docs).Path
    if (-not $existingDocs.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw 'Refusing to replace a Pages output folder outside the project.'
    }
    if (-not [string]::Equals($existingDocs, $docs, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw 'Refusing to replace a redirected Pages output folder.'
    }
    Move-Item -LiteralPath $existingDocs -Destination $previousDocs
  }

  try {
    Move-Item -LiteralPath $siteStage -Destination $docs
  } catch {
    if ((Test-Path -LiteralPath $previousDocs) -and -not (Test-Path -LiteralPath $docs)) {
      Move-Item -LiteralPath $previousDocs -Destination $docs
    }
    throw
  }

  if (Test-Path -LiteralPath $previousDocs) {
    Remove-Item -LiteralPath $previousDocs -Recurse -Force
  }
  Write-Output 'Pages output refreshed in docs/ with the main and GPT-6 Pro games.'
} finally {
  Pop-Location
  if (Test-Path -LiteralPath $buildRoot) {
    $resolvedBuildRoot = (Resolve-Path -LiteralPath $buildRoot).Path
    if (-not $resolvedBuildRoot.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw 'Refusing to remove a Pages build stage outside this project.'
    }
    Remove-Item -LiteralPath $resolvedBuildRoot -Recurse -Force
  }
}
