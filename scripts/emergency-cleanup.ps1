# STACK37 EOS - Emergency Manual Cleanup Script
# Safely removes test fixtures if a test execution was interrupted before afterAll executed.
# Fully supports partially completed setups.

param (
    [switch]$Execute
)

$FixturePath = "tests/db/.last-run-fixtures.json"
$ALLOWED_PROJECT = "xbiadendaxhoyrcvaybf"

Write-Host "`n========================================================"
Write-Host " STACK37 EOS - TEST FIXTURE EMERGENCY CLEANUP"
Write-Host "========================================================`n"

if (-Not (Test-Path $FixturePath)) {
    Write-Host "[OK] No orphaned fixture log found at $FixturePath. Database is clean." -ForegroundColor Green
    exit 0
}

$fixtureData = Get-Content $FixturePath -Raw | ConvertFrom-Json

if ($fixtureData.projectRef -ne $ALLOWED_PROJECT) {
    Write-Error "Safety violation: Fixture projectRef does not match approved EOS project ($ALLOWED_PROJECT)."
    exit 1
}

$orgs = @($fixtureData.organizations | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
$plans = @($fixtureData.plans | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
$users = @($fixtureData.users | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
$audits = @($fixtureData.auditLogIds | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

Write-Host "Found fixture records from run at: $($fixtureData.timestamp)" -ForegroundColor Yellow
Write-Host "Run Suffix: $($fixtureData.suffix)"
Write-Host "Organizations ($($orgs.Count)): $($orgs -join ', ')"
Write-Host "Plans ($($plans.Count)): $($plans -join ', ')"
Write-Host "Auth Users ($($users.Count)): $($users -join ', ')"
Write-Host "Audit Logs ($($audits.Count)): $($audits -join ', ')"

$sqlStatements = @()
$sqlStatements += "-- ========================================================"
$sqlStatements += "-- TARGETED EMERGENCY CLEANUP SQL (Supabase SQL Editor)"
$sqlStatements += "-- Targets strictly recorded test IDs from run suffix: $($fixtureData.suffix)"
$sqlStatements += "-- ========================================================"

if ($orgs.Count -gt 0) {
    $orgList = ($orgs | ForEach-Object { "'$_'" }) -join ", "
    $sqlStatements += "`n-- 1. Remove Organizations (Cascades to memberships, roles, branches, subscriptions):"
    $sqlStatements += "DELETE FROM public.organizations WHERE id IN ($orgList);"
} else {
    $sqlStatements += "`n-- 1. No organizations were created in this run."
}

if ($plans.Count -gt 0) {
    $planList = ($plans | ForEach-Object { "'$_'" }) -join ", "
    $sqlStatements += "`n-- 2. Remove Test Plans:"
    $sqlStatements += "DELETE FROM public.plans WHERE id IN ($planList);"
} else {
    $sqlStatements += "`n-- 2. No plans were created in this run."
}

if ($users.Count -gt 0) {
    $sqlStatements += "`n-- 3. Note: Auth users must be deleted via Supabase Auth Dashboard or Admin API:"
    $sqlStatements += "-- User IDs ($($users.Count)): $($users -join ', ')"
} else {
    $sqlStatements += "`n-- 3. No auth users were created in this run."
}

if ($audits.Count -gt 0) {
    $sqlStatements += "`n-- 4. Note: Test audit logs ($($audits -join ', ')) are append-only and remain immutably."
}

$sqlOutput = $sqlStatements -join "`n"

Write-Host "`nTargeted SQL Cleanup Script for Supabase SQL Editor:`n" -ForegroundColor Cyan
Write-Host $sqlOutput

if (-Not $Execute) {
    Write-Host "`n[DRY RUN] Run './scripts/emergency-cleanup.ps1 -Execute' to remove the fixture log after executing manual cleanup." -ForegroundColor Yellow
    exit 0
}

Remove-Item $FixturePath -Force
Write-Host "`nFixture log removed. Database cleanup confirmed." -ForegroundColor Green
exit 0
