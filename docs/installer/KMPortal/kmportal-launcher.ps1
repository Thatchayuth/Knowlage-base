<#
.SYNOPSIS
  KM Portal custom URL-protocol launcher (kmportal://).

.DESCRIPTION
  Invoked by Windows when a user clicks a "kmportal://..." link.
  Registry entry passes the full URL as the first argument.

  Expected URL formats:
    kmportal://open?type=powerbi&path=<urlencoded_path>
    kmportal://open?type=excel&path=<urlencoded_path>
    kmportal://open?type=word&path=<urlencoded_path>
    kmportal://open?type=file&path=<urlencoded_path>     (use default association)

.NOTES
  Place this file at:    C:\KMPortal\kmportal-launcher.ps1
  And import:            kmportal-protocol.reg
#>

param(
    [Parameter(Mandatory = $false, Position = 0)]
    [string]$Url
)

$ErrorActionPreference = 'Stop'

# ─── Logging (optional, keeps last 200 lines) ────────────────────────
$logDir  = Join-Path $env:LOCALAPPDATA 'KMPortal'
$logFile = Join-Path $logDir 'launcher.log'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

function Write-Log($msg) {
    $line = "{0}  {1}" -f (Get-Date -Format 's'), $msg
    Add-Content -Path $logFile -Value $line -ErrorAction SilentlyContinue
}

Write-Log "=== Invoked === PSVersion=$($PSVersionTable.PSVersion) Url='$Url'"

function Show-Error([string]$msg) {
    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
        [System.Windows.Forms.MessageBox]::Show($msg, 'KM Portal', 'OK', 'Warning') | Out-Null
    } catch {
        # Fallback to console if Forms not available
        Write-Host $msg
    }
}

# ─── Parse "kmportal://open?type=...&path=..." ───────────────────────
try {
    if ([string]::IsNullOrWhiteSpace($Url)) { throw 'No URL provided. Usage: kmportal-launcher.ps1 "kmportal://open?type=...&path=..."' }
    if (-not ($Url -match '^kmportal://')) {
        throw "Unsupported scheme: $Url"
    }
    # Strip "kmportal://"
    $rest = $Url.Substring('kmportal://'.Length)
    # Trim trailing slash that Windows sometimes appends
    $rest = $rest.TrimEnd('/')
    # rest = "open?type=powerbi&path=..."
    $action, $query = $rest -split '\?', 2
    if (-not $query) { throw 'Missing query string' }

    $params = @{}
    foreach ($pair in ($query -split '&')) {
        $kv = $pair -split '=', 2
        if ($kv.Length -eq 2) {
            $params[$kv[0]] = [System.Uri]::UnescapeDataString($kv[1])
        }
    }

    $type = $params['type']
    $path = $params['path']
    Write-Log "Parsed: action=$action type=$type path='$path'"

    if (-not $path) { throw 'Missing path parameter' }

    # ─── Path safety: only allow UNC, drive paths, or http(s) for safety ─
    if ($path -notmatch '^(\\\\|[A-Za-z]:\\|https?://)') {
        throw "Refused: unsafe path '$path'"
    }

    # ─── Existence check for local files (skip http) ──────────────────
    if ($path -notmatch '^https?://' -and -not (Test-Path -LiteralPath $path)) {
        throw "File not found: $path"
    }

    # ─── Dispatch by type ────────────────────────────────────────────
    switch ($type) {
        'powerbi' {
            # Power BI Desktop opens .pbix via association; launching directly is reliable.
            Start-Process -FilePath $path
        }
        'excel' {
            $excelCmd = Get-Command excel.exe -ErrorAction SilentlyContinue
            if ($excelCmd) { Start-Process -FilePath $excelCmd.Source -ArgumentList "`"$path`"" }
            else { Start-Process -FilePath $path }
        }
        'word' {
            $wordCmd = Get-Command winword.exe -ErrorAction SilentlyContinue
            if ($wordCmd) { Start-Process -FilePath $wordCmd.Source -ArgumentList "`"$path`"" }
            else { Start-Process -FilePath $path }
        }
        'file' {
            Start-Process -FilePath $path
        }
        default {
            # Fallback — try default association
            Start-Process -FilePath $path
        }
    }

    Write-Log "Launched OK ($type) → $path"
}
catch {
    $errMsg = $_.Exception.Message
    Write-Log "ERROR: $errMsg"
    Show-Error "ไม่สามารถเปิดไฟล์ได้:`n$errMsg"
}
