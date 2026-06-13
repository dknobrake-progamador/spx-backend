param(
  [string]$HostIP
)

$ErrorActionPreference = "Stop"

function Get-LanIp {
  $candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254*" -and
      $_.PrefixOrigin -ne "WellKnown"
    } |
    Sort-Object InterfaceMetric

  if (-not $candidates) {
    throw "Nao foi possivel detectar um IPv4 LAN automaticamente. Informe com -HostIP."
  }

  return $candidates[0].IPAddress
}

function Stop-PortProcess {
  param([int]$Port)

  $procIds = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($procId in $procIds) {
    try {
      Stop-Process -Id $procId -Force -ErrorAction Stop
    } catch {
    }
  }
}

function Wait-ForUrl {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 60,
    [string]$StepName = "recurso"
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 10
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        return $response
      }
    } catch {
    }

    Start-Sleep -Milliseconds 750
  }

  throw "Tempo esgotado aguardando $StepName em $Url"
}

if (-not $HostIP) {
  $HostIP = Get-LanIp
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $projectRoot ".expo"
$stdoutLog = Join-Path $logDir "expo-go-stable.stdout.log"
$stderrLog = Join-Path $logDir "expo-go-stable.stderr.log"
$bundleOut = Join-Path $env:TEMP "expo-android-bundle-stable.js"
$manifestUrl = "http://127.0.0.1:8081"
$bundleUrl = "http://127.0.0.1:8081/node_modules/expo-router/entry.bundle?platform=android&dev=false&hot=false&lazy=true&transform.engine=hermes&minify=true"
$expUrl = "exp://$HostIP`:8081/--/"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Remove-Item -LiteralPath $stdoutLog, $stderrLog -Force -ErrorAction SilentlyContinue

Write-Host "Limpando processos antigos na porta 8081..."
Stop-PortProcess -Port 8081

$env:REACT_NATIVE_PACKAGER_HOSTNAME = $HostIP
$env:EXPO_NO_TELEMETRY = "1"
$env:EXPO_OFFLINE = "1"
$env:NODE_ENV = "production"

$expoArgs = @(
  "./node_modules/expo/bin/cli",
  "start",
  "--offline",
  "--go",
  "--clear",
  "--port", "8081",
  "--no-dev",
  "--minify",
  "--max-workers", "2"
)

Write-Host "Iniciando Expo Go estavel para $HostIP..."
$expoProcess = Start-Process `
  -FilePath "node" `
  -ArgumentList $expoArgs `
  -WorkingDirectory $projectRoot `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog `
  -PassThru

try {
  Wait-ForUrl -Url $manifestUrl -TimeoutSeconds 90 -StepName "manifesto do Expo" | Out-Null
  Write-Host "Manifesto do Expo respondendo."

  Wait-ForUrl -Url $bundleUrl -TimeoutSeconds 180 -StepName "bundle Android" | Out-Null
  Invoke-WebRequest -UseBasicParsing $bundleUrl -TimeoutSec 180 -OutFile $bundleOut
  $bundleSize = (Get-Item $bundleOut).Length

  Write-Host ""
  Write-Host "Bundle Android pre-gerado com sucesso."
  Write-Host "Tamanho: $bundleSize bytes"
  Write-Host "Abra no Expo Go:"
  Write-Host $expUrl
  Write-Host ""
  Write-Host "Logs do Metro abaixo. Pressione Ctrl+C para encerrar."
  Write-Host ""

  Get-Content -Path $stdoutLog -Wait
} finally {
  if ($expoProcess -and -not $expoProcess.HasExited) {
    Stop-Process -Id $expoProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
