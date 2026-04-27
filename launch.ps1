$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

function Get-FreePort {
  param(
    [int]$StartPort = 3000,
    [int]$MaxAttempts = 20
  )

  for ($port = $StartPort; $port -lt ($StartPort + $MaxAttempts); $port++) {
    $listener = $null
    try {
      $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
      $listener.Start()
      return $port
    } catch {
      continue
    } finally {
      if ($listener) {
        $listener.Stop()
      }
    }
  }

  throw "No free port found between $StartPort and $($StartPort + $MaxAttempts - 1)."
}

$port = Get-FreePort
$logPath = Join-Path $PSScriptRoot "server.log"

if (Test-Path $logPath) {
  Remove-Item $logPath -Force
}

$env:PORT = "$port"

$serverProcess = Start-Process `
  -FilePath "node" `
  -ArgumentList "server.js" `
  -WorkingDirectory $PSScriptRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $logPath `
  -RedirectStandardError $logPath `
  -PassThru

$url = "http://127.0.0.1:$port"
$healthUrl = "$url/healthz"
$deadline = (Get-Date).AddSeconds(15)

while ((Get-Date) -lt $deadline) {
  try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
      Start-Process $url
      Write-Host "AI Act Explorer opened at $url"
      exit 0
    }
  } catch {
    Start-Sleep -Milliseconds 300
  }
}

if (-not $serverProcess.HasExited) {
  Stop-Process -Id $serverProcess.Id -Force
}

Write-Error "Server did not become reachable. Check $logPath for details."
