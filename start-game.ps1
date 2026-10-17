param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$taskUrl = 'http://127.0.0.1:8792/'
$taskRunning = $false
try { $taskHealth = Invoke-RestMethod ($taskUrl + 'health') -TimeoutSec 1; $taskRunning = $taskHealth.app -eq 'farm-and-flow' } catch { }
if (-not $taskRunning) {
    if (Get-NetTCPConnection -State Listen -LocalPort 8792 -ErrorAction SilentlyContinue) { throw '8792 端口已由其他程序使用。可通过 FARM_PORT 环境变量手动更换端口。' }
    $taskNodeCommand = Get-Command node -ErrorAction SilentlyContinue
    $taskNode = if ($taskNodeCommand) { $taskNodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
    if (-not (Test-Path -LiteralPath $taskNode)) { throw '未找到 Node.js。请先安装 Node.js 24 或更新版本。' }
    if (-not (Test-Path -LiteralPath (Join-Path $taskRoot 'dist\index.html'))) { throw '缺少 dist 构建文件，请先按 README 执行构建。' }
    Start-Process -FilePath $taskNode -ArgumentList 'server.mjs' -WorkingDirectory $taskRoot -WindowStyle Hidden
    for ($taskAttempt = 0; $taskAttempt -lt 25; $taskAttempt++) {
        Start-Sleep -Milliseconds 200
        try { $taskHealth = Invoke-RestMethod ($taskUrl + 'health') -TimeoutSec 1; if ($taskHealth.app -eq 'farm-and-flow') { $taskRunning = $true; break } } catch { }
    }
    if (-not $taskRunning) { throw '农场预览服务未能启动。请在本目录运行 node server.mjs 查看错误。' }
}
if (-not $NoBrowser) { Start-Process $taskUrl }
