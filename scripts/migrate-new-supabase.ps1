param(
  [switch]$SkipFunctions
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Read-EnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Key
  )

  $line = Get-Content -LiteralPath $Path | Where-Object { $_ -match "^\s*$Key\s*=" } | Select-Object -First 1
  if (-not $line) { return $null }

  $value = $line.Split("=", 2)[1].Trim()
  if ($value.StartsWith('"') -and $value.EndsWith('"')) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  if ($value.StartsWith("'") -and $value.EndsWith("'")) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  return $value
}

$root = Split-Path -Parent $PSScriptRoot
$envLocalPath = Join-Path $root ".env.local"

if (-not (Test-Path -LiteralPath $envLocalPath)) {
  throw ".env.local não encontrado em $root. Crie o arquivo antes de rodar este script."
}

$projectRef = Read-EnvValue -Path $envLocalPath -Key "VITE_SUPABASE_PROJECT_ID"
$supabaseUrl = Read-EnvValue -Path $envLocalPath -Key "VITE_SUPABASE_URL"
$publishableKey = Read-EnvValue -Path $envLocalPath -Key "VITE_SUPABASE_PUBLISHABLE_KEY"

if (-not $projectRef -or $projectRef -like "__*__") {
  throw "VITE_SUPABASE_PROJECT_ID inválido em .env.local."
}
if (-not $supabaseUrl -or $supabaseUrl -like "*__NEW_SUPABASE_PROJECT_REF__*") {
  throw "VITE_SUPABASE_URL inválido em .env.local."
}
if (-not $publishableKey -or $publishableKey -like "__*__") {
  throw "VITE_SUPABASE_PUBLISHABLE_KEY inválido em .env.local."
}

# Aceita autenticacao via SUPABASE_ACCESS_TOKEN ou sessao salva do supabase login.
if (-not [Environment]::GetEnvironmentVariable("SUPABASE_ACCESS_TOKEN")) {
  try {
    supabase projects list | Out-Null
  }
  catch {
    throw "Supabase CLI sem autenticacao valida. Rode 'supabase login' ou configure SUPABASE_ACCESS_TOKEN."
  }
}

Write-Host "Linkando projeto Supabase: $projectRef"
supabase link --project-ref $projectRef

Write-Host "Aplicando migrations no banco remoto"
supabase db push

if (-not $SkipFunctions) {
  Write-Host "Deploy das edge functions"
  supabase functions deploy extract-pdf
  supabase functions deploy chat-with-pdf
  supabase functions deploy sync-dois
}

Write-Host "Migração concluída com sucesso."
