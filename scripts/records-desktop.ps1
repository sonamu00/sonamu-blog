param([string]$NodePath)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$repo = Split-Path -Parent $PSScriptRoot
$settings = Join-Path $repo 'records.local.json'
$title = '블로그 기록 발행'

function Run-Records([string]$arguments) {
    $start = [System.Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $NodePath
    $start.Arguments = "scripts/publish-records.mjs $arguments"
    $start.WorkingDirectory = $repo
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $start.StandardErrorEncoding = [System.Text.Encoding]::UTF8
    $process = [System.Diagnostics.Process]::Start($start)
    try {
        $output = $process.StandardOutput.ReadToEndAsync()
        $errors = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()
        if ($process.ExitCode -ne 0) { throw $errors.Result.Trim() }
        return $output.Result.Trim()
    } finally {
        $process.Dispose()
    }
}

try {
    if (-not $NodePath) { $NodePath = (Get-Command node.exe).Source }
    if (-not (Test-Path -LiteralPath $settings)) {
        $picker = [System.Windows.Forms.FolderBrowserDialog]::new()
        try {
            $picker.Description = '블로그에 연결할 옵시디언 폴더를 선택하세요.'
            $picker.ShowNewFolderButton = $false
            if ($picker.ShowDialog() -ne 'OK') { return }
            @{ folder = $picker.SelectedPath } | ConvertTo-Json | Set-Content -LiteralPath $settings -Encoding UTF8
        } finally {
            $picker.Dispose()
        }
    }

    $review = Run-Records '--review' | ConvertFrom-Json
    $form = [System.Windows.Forms.Form]::new()
    $form.Text = $title
    $form.StartPosition = 'CenterScreen'
    $form.ClientSize = [System.Drawing.Size]::new(560, 385)
    $form.FormBorderStyle = 'FixedDialog'
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false

    $summary = [System.Windows.Forms.Label]::new()
    $summary.SetBounds(16, 16, 528, 52)
    $summary.Text = "공개 대상 기록 $(@($review.records).Count)개.`r`n이 목록에서 빠진 기존 기록은 발행 후 사이트에서 내려갑니다."
    $form.Controls.Add($summary)

    $list = [System.Windows.Forms.ListBox]::new()
    $list.SetBounds(16, 74, 528, 252)
    $list.HorizontalScrollbar = $true
    foreach ($record in $review.records) {
        [void]$list.Items.Add("$($record.date)    $($record.title)")
    }
    $form.Controls.Add($list)

    $cancel = [System.Windows.Forms.Button]::new()
    $cancel.Text = '닫기'
    $cancel.DialogResult = 'Cancel'
    $cancel.SetBounds(368, 340, 84, 30)
    $form.CancelButton = $cancel
    $form.Controls.Add($cancel)

    $publish = [System.Windows.Forms.Button]::new()
    $publish.Text = '발행'
    $publish.DialogResult = 'OK'
    $publish.SetBounds(460, 340, 84, 30)
    $form.Controls.Add($publish)
    $form.ActiveControl = $cancel

    try {
        if ($form.ShowDialog() -eq 'OK') {
            $message = Run-Records "--reviewed $($review.fingerprint)"
            [void][System.Windows.Forms.MessageBox]::Show($message, $title)
        }
    } finally {
        $form.Dispose()
    }
} catch {
    [void][System.Windows.Forms.MessageBox]::Show($_.Exception.Message, $title, 'OK', 'Error')
}
