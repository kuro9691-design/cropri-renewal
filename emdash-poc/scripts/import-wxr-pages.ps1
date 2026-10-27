param(
  [string]$BaseUrl = "http://127.0.0.1:4321",
  [string]$WxrPath = "../../migration/wordpress/cropri.WordPress.2026-10-24.xml"
)

$ErrorActionPreference = "Stop"
$config = Get-Content -Raw (Join-Path $PSScriptRoot "import-pages-config.json")
$file = Get-Item (Join-Path $PSScriptRoot $WxrPath)
$cookie = Join-Path $PSScriptRoot ".migration-cookies.txt"

& curl.exe --max-time 60 -sS -c $cookie -L "$BaseUrl/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin/import/wordpress" -o NUL
if ($LASTEXITCODE -ne 0) { throw "Could not establish the local EmDash admin session." }

function Invoke-ImportPhase {
  param([string]$Phase, $Cursor, $Chunk)
  $args = @(
    "--max-time", "120", "-sS", "-b", $cookie,
    "-H", "X-EmDash-Request: 1",
    "-F", "file=@$($file.FullName)",
    "-F", "config=$config",
    "-F", "phase=$Phase"
  )
  if ($null -ne $Cursor) { $args += @("-F", "cursor=$($Cursor | ConvertTo-Json -Compress -Depth 8)") }
  if ($null -ne $Chunk) { $args += @("-F", "chunk=$($Chunk | ConvertTo-Json -Compress -Depth 8)") }
  $args += "$BaseUrl/_emdash/api/import/wordpress/execute"
  $raw = & curl.exe @args
  if ($LASTEXITCODE -ne 0) { throw "curl failed during $Phase phase." }
  $response = $raw | ConvertFrom-Json
  if (-not $response.success) { throw ($response.error | ConvertTo-Json -Compress) }
  $response
}

$taxonomy = Invoke-ImportPhase -Phase "taxonomy" -Cursor $null -Chunk $null
$cursor = $taxonomy.data.cursor
$chunk = $taxonomy.data.chunk
$totalImported = 0
$totalSkipped = 0
$errors = @()
$rounds = 0

do {
  $rounds++
  $content = Invoke-ImportPhase -Phase "content" -Cursor $cursor -Chunk $chunk
  $totalImported += [int]$content.data.result.imported
  $totalSkipped += [int]$content.data.result.skipped
  $errors += @($content.data.result.errors)
  $cursor = $content.data.cursor
  $chunk = $content.data.chunk
} while (-not $content.data.done -and $rounds -lt 20)

if (-not $content.data.done) { throw "Content import did not finish within 20 chunks." }
$finalize = Invoke-ImportPhase -Phase "finalize" -Cursor $cursor -Chunk $chunk

[pscustomobject]@{
  imported = $totalImported
  skipped = $totalSkipped
  errors = $errors
  chunks = $rounds
  finalized = [bool]$finalize.data.done
} | ConvertTo-Json -Depth 10
