param (
    [switch]$Execute,
    [switch]$AcceptNoBackupRisk
)

$ALLOWED_EOS_PROJECT = "xbiadendaxhoyrcvaybf"
$ProjectRefPath = "supabase/.temp/project-ref"

Write-Host "`n========================================================"
Write-Host " STACK37 EOS - DATABASE DEPLOYMENT WORKFLOW"
Write-Host "========================================================`n"
Write-Host "WARNING: This script will execute modifications against the remote database." -ForegroundColor Yellow

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
    exit 1
}

Write-Host "1. Target Verification: PASS (Project ID Matches Approved Identity)"

Write-Host "`n2. Pre-Flight Backup & Recovery Instructions:"
Write-Host "- PRE-LAUNCH DEPLOYMENT: Proceeding without backup."
Write-Host "- If a partial migration fails, assess the exact failure point via Supabase Dashboard Migrations table."
Write-Host "- Recover by executing targeted DOWN migrations or manually reverting the specific broken DDL statements. DO NOT indiscriminately drop entire schemas."

Write-Host "`n3. Migration History Review:"
npx supabase migration list --linked
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to retrieve migration list. Aborting deployment."
    exit $LASTEXITCODE
}

Write-Host "`n4. Pre-Flight Dry Run:"
npx supabase db push --linked --dry-run
if ($LASTEXITCODE -ne 0) {
    Write-Error "Dry run failed. Aborting deployment."
    exit $LASTEXITCODE
}

if (-Not $Execute) {
    Write-Host "`nDEPLOYMENT HALTED. Missing -Execute parameter." -ForegroundColor Yellow
    Write-Host "Usage: ./scripts/db-deploy.ps1 -Execute -AcceptNoBackupRisk"
    exit 1
}

if (-Not $AcceptNoBackupRisk) {
    Write-Error "DEPLOYMENT HALTED. Missing -AcceptNoBackupRisk parameter."
    Write-Host "You must explicitly confirm you accept the risk of migrating without a backup during this pre-launch phase."
    exit 1
}

Write-Host "`nUser Authorization (-Execute flag) Confirmed. Beginning push..."
npx supabase db push --linked
if ($LASTEXITCODE -ne 0) {
    Write-Error "Migration execution failed!"
    exit $LASTEXITCODE
}

Write-Host "`nDeployment completed successfully." -ForegroundColor Green
exit 0
