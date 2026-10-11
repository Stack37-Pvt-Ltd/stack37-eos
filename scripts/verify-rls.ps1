$migrationsPath = "supabase/migrations"
$sqlFiles = Get-ChildItem -Path $migrationsPath -Filter "*.sql" | Sort-Object Name

$tables = @()
$rlsEnabled = @()
$functions = @()
$errors = @()

$combinedContent = ""

foreach ($file in $sqlFiles) {
    $content = Get-Content $file.FullName -Raw
    $combinedContent += $content
    
    $matches = [regex]::Matches($content, 'CREATE TABLE (public\.\w+|private\.\w+)')
    foreach ($match in $matches) { $tables += $match.Groups[1].Value }

    $rlsMatches = [regex]::Matches($content, 'ALTER TABLE (public\.\w+|private\.\w+) ENABLE ROW LEVEL SECURITY')
    foreach ($match in $rlsMatches) { $rlsEnabled += $match.Groups[1].Value }

    $funcMatches = [regex]::Matches($content, 'CREATE OR REPLACE FUNCTION (public\.\w+|private\.\w+)')
    foreach ($match in $funcMatches) { $functions += $match.Groups[1].Value }
}

Write-Host "`n--- Static Verification Report ---`n"

Write-Host "1. Tables vs RLS Enforcement:"
foreach ($table in $tables) {
    if ($table -like "private.*") {
        Write-Host "  [SKIP] $table (Private schema does not require RLS)"
    } else {
        if ($rlsEnabled -contains $table) {
            Write-Host "  [PASS] $table has RLS Enabled"
        } else {
            Write-Host "  [FAIL] $table is MISSING RLS Enabled"
            $errors += "Missing RLS on $table"
        }
    }
}

Write-Host "`n2. SECURITY DEFINER Functions Discovered:"
foreach ($func in $functions) { Write-Host "  - $func" }

if (-Not ($functions -contains "private.insert_audit_log")) {
    $errors += "private.insert_audit_log function is missing!"
}

# Verify db-push.ps1
$dbPushContent = Get-Content "scripts/db-push.ps1" -Raw
if ($dbPushContent -notmatch "\`$LinkedProject\s+-ne\s+\`$ALLOWED_EOS_PROJECT") {
    $errors += "scripts/db-push.ps1 does not strictly compare `$LinkedProject with `$ALLOWED_EOS_PROJECT"
}

if ($combinedContent -notmatch '(?s)CREATE POLICY "Auth Delete MemRoles" ON public\.membership_roles FOR DELETE USING .*?private\.can_assign_role') {
    $errors += "membership_roles DELETE policy does not check private.can_assign_role"
}

Write-Host "`n----------------------------------"
if ($errors.Count -gt 0) {
    Write-Host "STATIC VERIFICATION FAILED!" -ForegroundColor Red
    foreach ($err in $errors) { Write-Host $err -ForegroundColor Red }
    exit 1
} else {
    Write-Host "STATIC VERIFICATION PASSED." -ForegroundColor Green
    exit 0
}
