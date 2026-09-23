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

  v2 changes — for machines whose IP is blocked from the internet and for
  machines under AppLocker / WDAC policy:
    - No Add-Type / System.Windows.Forms. It throws under Constrained
      Language Mode, which made every error silent. Uses msg.exe instead.
    - Test-Path no longer aborts the launch. A blocked or slow SMB share
      made it report "File not found" for files that open fine. It now
      only writes a warning to the log.
    - Office is resolved through the App Paths registry key, so it works
      when excel.exe / winword.exe are not in PATH (Office 2010 default).
    - The log records LanguageMode and per-step elapsed milliseconds, so a
      CRL/revocation stall is visible as a large gap at startup.
    - The log is trimmed to the last 200 lines, as originally documented.
#>

param(
    [Parameter(Mandatory = $false, Position = 0)]
    [string]$Url
)

$ErrorActionPreference = 'Stop'
$sw = [System.Diagnostics.Stopwatch]::StartNew()

# ─── Logging (keeps last 200 lines) ──────────────────────────────────
$logDir  = Join-Path $env:LOCALAPPDATA 'KMPortal'
$logFile = Join-Path $logDir 'launcher.log'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

function Write-Log($msg) {
    $line = "{0}  +{1,6}ms  {2}" -f (Get-Date -Format 's'), $sw.ElapsedMilliseconds, $msg
    Add-Content -Path $logFile -Value $line -ErrorAction SilentlyContinue
}

function Trim-Log {
    try {
        if (-not (Test-Path $logFile)) { return }
        $lines = @(Get-Content -Path $logFile -ErrorAction SilentlyContinue)
        if ($lines.Count -gt 200) {
            $lines[($lines.Count - 200)..($lines.Count - 1)] | Set-Content -Path $logFile -ErrorAction SilentlyContinue
        }
    } catch { }
}

# LanguageMode tells us instantly whether WDAC / AppLocker is restricting us.
$langMode = 'unknown'
try { $langMode = $ExecutionContext.SessionState.LanguageMode } catch { }

Write-Log "=== Invoked === PSVersion=$($PSVersionTable.PSVersion) LanguageMode=$langMode User=$env:USERNAME Url='$Url'"

function Show-Error([string]$msg) {
    # msg.exe is a plain Win32 binary: no assembly load, no JIT compile, and
    # no certificate revocation lookup — unlike Add-Type, which stalls or
    # throws on locked-down or internet-blocked machines.
    try {
        $text = $msg -replace "`r?`n", ' '
        & msg.exe $env:USERNAME /TIME:60 "KM Portal: $text" 2>$null
        if ($LASTEXITCODE -eq 0) { return }
    } catch { }
    Write-Host "KM Portal: $msg"
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

    # ─── Existence probe (warning only — never blocks the launch) ─────
    # A firewall policy that blocks SMB makes Test-Path return $false or
    # hang. Treating that as fatal hid files that Windows can still open,
    # so the result is logged and the launch continues either way.
    if ($path -notmatch '^https?://') {
        $exists = $null
        try { $exists = Test-Path -LiteralPath $path } catch { $exists = "error: $($_.Exception.Message)" }
        Write-Log "Probe: exists=$exists"
        if ($exists -ne $true) {
            Write-Log 'WARN: probe failed — launching anyway (share may be slow, blocked, or ACL-restricted)'
        }
    }

    # ─── Resolve an Office executable ────────────────────────────────
    # Office 2010 does not put excel.exe / winword.exe on PATH, so PATH
    # lookup alone always fell through to the file association.
    function Resolve-OfficeExe([string]$exe) {
        $cmd = Get-Command $exe -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
        foreach ($hive in @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths',
                            'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths',
                            'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths')) {
            try {
                $key = Join-Path $hive $exe
                if (Test-Path $key) {
                    $val = (Get-ItemProperty -Path $key -ErrorAction SilentlyContinue).'(default)'
                    if ($val) {
                        $val = $val.Trim('"')
                        if (Test-Path -LiteralPath $val) { return $val }
                    }
                }
            } catch { }
        }
        return $null
    }

    function Start-WithOffice([string]$exe, [string]$file) {
        $resolved = Resolve-OfficeExe $exe
        if ($resolved) {
            Write-Log "Using $exe at '$resolved'"
            Start-Process -FilePath $resolved -ArgumentList "`"$file`""
        } else {
            Write-Log "$exe not found - falling back to file association"
            Start-Process -FilePath $file
        }
    }

    # ─── Dispatch by type ────────────────────────────────────────────
    switch ($type) {
        'powerbi' {
            # Power BI Desktop opens .pbix via association; launching directly is reliable.
            Start-Process -FilePath $path
        }
        'excel' { Start-WithOffice 'excel.exe'   $path }
        'word'  { Start-WithOffice 'winword.exe' $path }
        'file' {
            Start-Process -FilePath $path
        }
        default {
            # Fallback — try default association
            Start-Process -FilePath $path
        }
    }

    Write-Log "Launched OK ($type) -> $path"
}
catch {
    $errMsg = $_.Exception.Message
    Write-Log "ERROR: $errMsg"
    Show-Error "ไม่สามารถเปิดไฟล์ได้: $errMsg"
}
finally {
    Trim-Log
}
