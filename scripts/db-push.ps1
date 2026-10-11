$ALLOWED_EOS_PROJECT = "xbiadendaxhoyrcvaybf"
$ProjectRefPath = "supabase/.temp/project-ref"

Write-Host "`n========================================================"
Write-Host " STACK37 EOS - Database Migration Safeguard Workflow"
Write-Host "========================================================`n"

Write-Host "Verifying linked Supabase project reference..."

if (-Not (Test-Path $ProjectRefPath)) {
    Write-Error "CRITICAL: No project is linked locally. Run 'npx supabase link' first."
    exit 1
}

$LinkedProject = (Get-Content $ProjectRefPath).Trim()

if ([string]::IsNullOrWhiteSpace($LinkedProject)) {
    Write-Error "CRITICAL: The linked project reference is empty."
    exit 1
}

if ($LinkedProject -ne $ALLOWED_EOS_PROJECT) {
    Write-Error "CRITICAL: The linked project '$LinkedProject' DOES NOT MATCH the approved EOS project ($ALLOWED_EOS_PROJECT)."
    Write-Error "Halting to protect stack37-erp and production integrity."
    exit 1
}

Write-Host "Linked Project ($LinkedProject) matches authorized target.`n"
Write-Host "NOTE: A local project-ref file DOES NOT mathematically guarantee environment isolation."
Write-Host "Execution is locked. Only DRY-RUN is permitted locally. Actual deployments require CI/CD injection.`n"

Write-Host "Executing DRY RUN mode. No changes will be applied."
npx supabase db push --linked --dry-run
if ($LASTEXITCODE -ne 0) {
    Write-Error "Migration dry run failed!"
    exit $LASTEXITCODE
}

Write-Host "`nDry run completed successfully."
exit 0
