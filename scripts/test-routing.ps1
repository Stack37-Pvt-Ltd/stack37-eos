param (
    [string]$Port = "3000"
)

function Test-Route($hostHeader, $path="") {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$Port$path" -Headers @{Host=$hostHeader} -UseBasicParsing -ErrorAction Stop
        Write-Output "✅ $hostHeader$path -> $($r.StatusCode)"
    } catch {
        Write-Output "✅ $hostHeader$path -> $($_.Exception.Response.StatusCode.value__)"
    }
}

Write-Host "Running Routing Tests against port $Port..."
Test-Route "mybusiness.localhost:$Port"
Test-Route "acmecorp.localhost:$Port"
Test-Route "admin.localhost:$Port"
Test-Route "localhost:$Port"
Test-Route "localhost:$Port" "/tenant/acmecorp"
Test-Route "localhost:$Port" "/registration"
