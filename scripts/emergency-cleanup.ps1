# STACK37 EOS - Emergency Manual Cleanup Script
# Safely removes test fixtures if a test execution was interrupted before afterAll executed.
# Fully supports partially completed setups.

param (
    [string]$ManifestPath,
    [switch]$Execute
)

$ALLOWED_PROJECT = "xbiadendaxhoyrcvaybf"

Write-Host "`n========================================================"
Write-Host " STACK37 EOS - TEST FIXTURE EMERGENCY CLEANUP"
Write-Host "========================================================`n"

# Determine target manifest files
$manifestFiles = @()
if (-Not [string]::IsNullOrWhiteSpace($ManifestPath)) {
    if (Test-Path $ManifestPath) {
        $manifestFiles += (Resolve-Path $ManifestPath).Path
    } else {
        Write-Error "Specified ManifestPath does not exist: $ManifestPath"
        exit 1
    }
} else {
    $defaultPaths = @(
        "tests/integration/.auth-test-fixtures.json",
        "tests/db/.last-run-fixtures.json"
    )
    foreach ($p in $defaultPaths) {
        if (Test-Path $p) {
            $manifestFiles += (Resolve-Path $p).Path
        }
    }
}

if ($manifestFiles.Count -eq 0) {
    Write-Host "[OK] No orphaned fixture logs found. Database and workspace are clean." -ForegroundColor Green
    exit 0
}

foreach ($currentManifest in $manifestFiles) {
    Write-Host "`n--- Processing Manifest: $currentManifest ---" -ForegroundColor Cyan
    $fixtureData = Get-Content $currentManifest -Raw | ConvertFrom-Json

    if ($fixtureData.projectRef -ne $ALLOWED_PROJECT) {
        Write-Error "Safety violation: Fixture projectRef does not match approved EOS project ($ALLOWED_PROJECT)."
        exit 1
    }

    $suffix = if ($fixtureData.suffix) { $fixtureData.suffix } elseif ($fixtureData.runSuffix) { $fixtureData.runSuffix } else { "unknown" }
    $orgs = @($fixtureData.organizations | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $plans = @($fixtureData.plans | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $users = @($fixtureData.users | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $audits = @($fixtureData.auditLogIds | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

    Write-Host "Found fixture records from run at: $($fixtureData.timestamp)" -ForegroundColor Yellow
    Write-Host "Run Suffix: $suffix"
    Write-Host "Organizations ($($orgs.Count)): $($orgs -join ', ')"
    Write-Host "Plans ($($plans.Count)): $($plans -join ', ')"
    Write-Host "Auth Users ($($users.Count)): $($users -join ', ')"
    Write-Host "Audit Logs ($($audits.Count)): $($audits -join ', ')"

    $sqlStatements = @()
    $sqlStatements += "-- ========================================================"
    $sqlStatements += "-- TARGETED EMERGENCY CLEANUP SQL (Supabase SQL Editor)"
    $sqlStatements += "-- Targets strictly recorded test IDs from run suffix: $suffix"
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
        $userList = ($users | ForEach-Object { "'$_'" }) -join ", "
        $sqlStatements += "`n-- 3. Remove Auth Users (Supabase SQL Editor / Auth Admin API):"
        $sqlStatements += "DELETE FROM auth.users WHERE id IN ($userList);"
        $sqlStatements += "-- Note: In Supabase SQL Editor running as postgres superuser, DELETE FROM auth.users removes the users and cascades to profiles."
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
        Write-Host "`n[DRY RUN] Run './scripts/emergency-cleanup.ps1 -Execute' to execute automated API cleanup and remove the fixture log." -ForegroundColor Yellow
    } else {
        # Check if environment credentials are present for automated API deletion
        $envFile = ".env.local"
        $supabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
        $serviceKey = $env:SUPABASE_SERVICE_ROLE_KEY

        if ((-not $supabaseUrl -or -not $serviceKey) -and (Test-Path $envFile)) {
            Get-Content $envFile | ForEach-Object {
                if ($_ -match "^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)$") { $supabaseUrl = $matches[1].Trim('"').Trim("'") }
                if ($_ -match "^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)$") { $serviceKey = $matches[1].Trim('"').Trim("'") }
            }
        }

        if ($supabaseUrl -and $serviceKey) {
            Write-Host "`nExecuting automated API cleanup against $supabaseUrl..." -ForegroundColor Cyan

            # 1. Delete organizations via REST API
            foreach ($oid in $orgs) {
                try {
                    $headers = @{ "apikey" = $serviceKey; "Authorization" = "Bearer $serviceKey"; "Content-Type" = "application/json" }
                    Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/organizations?id=eq.$oid" -Method Delete -Headers $headers -ErrorAction Stop | Out-Null
                    Write-Host "  Deleted organization: $oid" -ForegroundColor Green
                } catch {
                    Write-Warning "  Failed to delete organization $oid via API: $_"
                }
            }

            # 2. Delete plans via REST API
            foreach ($pid in $plans) {
                try {
                    $headers = @{ "apikey" = $serviceKey; "Authorization" = "Bearer $serviceKey"; "Content-Type" = "application/json" }
                    Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/plans?id=eq.$pid" -Method Delete -Headers $headers -ErrorAction Stop | Out-Null
                    Write-Host "  Deleted plan: $pid" -ForegroundColor Green
                } catch {
                    Write-Warning "  Failed to delete plan $pid via API: $_"
                }
            }

            # 3. Delete auth users via Admin API
            foreach ($uid in $users) {
                try {
                    $headers = @{ "apikey" = $serviceKey; "Authorization" = "Bearer $serviceKey"; "Content-Type" = "application/json" }
                    Invoke-RestMethod -Uri "$supabaseUrl/auth/v1/admin/users/$uid" -Method Delete -Headers $headers -ErrorAction Stop | Out-Null
                    Write-Host "  Deleted auth user: $uid" -ForegroundColor Green
                } catch {
                    Write-Warning "  Failed to delete auth user $uid via API: $_"
                }
            }
        } else {
            Write-Host "`nNotice: Service role credentials not found; automated API deletion skipped. Please run the SQL above in Supabase SQL Editor." -ForegroundColor Yellow
        }

        Remove-Item $currentManifest -Force
        Write-Host "`nFixture log removed: $currentManifest. Database cleanup completed." -ForegroundColor Green
    }
}

exit 0
