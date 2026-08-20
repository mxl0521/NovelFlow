$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$uiRoot = Join-Path $root "web-ui"
$runtime = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies"
$bundledNode = Join-Path $runtime "node\bin\node.exe"
$bundledPnpm = Join-Path $runtime "bin\fallback\pnpm.cmd"

function Resolve-Executable([string]$bundled, [string]$fallback) {
    if ($bundled -and (Test-Path -LiteralPath $bundled)) { return $bundled }
    $command = Get-Command $fallback -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    return $null
}

function Test-LocalUrl([string]$url) {
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1 | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Start-HiddenProcess([string]$workingDirectory, [string]$executable, [string]$arguments) {
    $info = [System.Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $executable
    $info.Arguments = $arguments
    $info.WorkingDirectory = $workingDirectory
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    [System.Diagnostics.Process]::Start($info) | Out-Null
}

function Wait-ForUrl([string]$url, [int]$attempts = 25) {
    for ($index = 0; $index -lt $attempts; $index++) {
        if (Test-LocalUrl $url) { return $true }
        Start-Sleep -Milliseconds 800
    }
    return $false
}

$python = Resolve-Executable "" "python.exe"
$node = Resolve-Executable $bundledNode "node.exe"
$pnpm = Resolve-Executable $bundledPnpm "pnpm.cmd"

if (-not $python) { Write-Host "未找到 Python 3.11 或更高版本。" -ForegroundColor Red; Read-Host "按回车退出"; exit 1 }
if (-not $node -or -not $pnpm) { Write-Host "未找到 Node.js 或 pnpm 运行环境。" -ForegroundColor Red; Read-Host "按回车退出"; exit 1 }

if (-not (Test-LocalUrl "http://127.0.0.1:8787/api/health")) {
    Write-Host "正在启动 NovelFlow 后端..."
    Start-HiddenProcess $root $python "api_server.py"
}

if (-not (Wait-ForUrl "http://127.0.0.1:8787/api/health")) {
    Write-Host "NovelFlow 后端启动失败，请查看 api-start-error.log。" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}

if (-not (Test-LocalUrl "http://127.0.0.1:4173")) {
    Write-Host "正在启动 NovelFlow 界面..."
    $viteEntry = Join-Path $uiRoot "node_modules\vite\bin\vite.js"
    if (-not (Test-Path -LiteralPath $viteEntry)) {
        Write-Host "前端依赖尚未安装，请在 web-ui 目录运行 pnpm install。" -ForegroundColor Red
        Read-Host "按回车退出"
        exit 1
    }
    Start-HiddenProcess $uiRoot $node 'node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort'
}

if (-not (Wait-ForUrl "http://127.0.0.1:4173")) {
    Write-Host "NovelFlow 界面启动失败，请检查端口 4173 是否被占用。" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}

Write-Host "NovelFlow 已启动：http://127.0.0.1:4173/" -ForegroundColor Green
$browserInfo = [System.Diagnostics.ProcessStartInfo]::new()
$browserInfo.FileName = "http://127.0.0.1:4173/"
$browserInfo.UseShellExecute = $true
[System.Diagnostics.Process]::Start($browserInfo) | Out-Null
exit 0
