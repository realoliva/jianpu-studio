$ErrorActionPreference = "SilentlyContinue"
$port = if ($env:PORT) { [int]$env:PORT } else { 8765 }
$root = $PSScriptRoot

# 结束占用本端口的旧 Python 服务，避免仍打开旧版页面
$conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
  if ($c.OwningProcess -gt 0) {
    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}
Start-Sleep -Milliseconds 400

Write-Host ""
Write-Host "  简谱工作室" -ForegroundColor Cyan
Write-Host "  http://localhost:$port/" -ForegroundColor Green
Write-Host "  若页面未更新请按 Ctrl+F5 强制刷新" -ForegroundColor DarkYellow
Write-Host "  按 Ctrl+C 停止服务" -ForegroundColor DarkGray
Write-Host ""

Set-Location $root
Start-Process "http://localhost:$port/?v=$((Get-Date).Ticks)"
python -m http.server $port
