param([switch]$NoBrowser)
$ErrorActionPreference='Stop'
$previewUrl='http://127.0.0.1:8793/verification/playtest.html?checkpoint=operations'
$previewReady=$false
try { $previewPage=Invoke-WebRequest $previewUrl -UseBasicParsing -TimeoutSec 1; $previewReady=$previewPage.Content.Contains('/verification/playtest.ts') } catch { }
if (-not $previewReady) {
    if (Get-NetTCPConnection -State Listen -LocalPort 8793 -ErrorAction SilentlyContinue) { throw '8793 端口被其他程序占用。' }
    $previewNode=(Get-Command node -ErrorAction Stop).Source
    $previewVite=Join-Path $PSScriptRoot 'node_modules/vite/bin/vite.js'
    if (-not (Test-Path -LiteralPath $previewVite)) { throw '请先在农场工程目录运行 pnpm install --frozen-lockfile。' }
    Start-Process -FilePath $previewNode -ArgumentList 'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','8793','--strictPort' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
    for ($previewAttempt=0;$previewAttempt -lt 25;$previewAttempt++) {
        Start-Sleep -Milliseconds 200
        try { $previewPage=Invoke-WebRequest $previewUrl -UseBasicParsing -TimeoutSec 1; if ($previewPage.Content.Contains('/verification/playtest.ts')) { $previewReady=$true;break } } catch { }
    }
    if (-not $previewReady) { throw '独立试玩未能启动，请在工程目录查看 Vite 启动信息。' }
}
if (-not $NoBrowser) { Start-Process $previewUrl }
