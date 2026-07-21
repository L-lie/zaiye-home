$ErrorActionPreference = "Stop"

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
  $node = $nodeCommand.Source
} else {
  $node = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
}

if (-not (Test-Path -LiteralPath $node)) {
  throw "Node.js was not found. Run this command in Codex or install Node.js first."
}

& $node (Join-Path $PSScriptRoot "validate-notebook.mjs") "blender"
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
