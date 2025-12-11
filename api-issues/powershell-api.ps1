# Auth Token API Endpoint

# Get Auth Token using Basic Authentication
$username = "MHPL.API"
$password = "1234567890#25"
$base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(("{0}:{1}" -f $username, $password)))

$authResponse = Invoke-RestMethod -Uri "http://appit.ignitetechno.com:8080/ords/xapi/auth/token" `
    -Method Post `
    -Headers @{
        "Authorization" = "Basic $base64AuthInfo"
        "Content-Type" = "application/json"
    }

# Display the token
$authResponse

# Store token for subsequent requests
$TOKEN = $authResponse.token
Write-Host "Token: $TOKEN"



# Patient Revisit API Endpoint (MHPL0001)
$response = Invoke-RestMethod -Uri "http://appit.ignitetechno.com:8080/xapi/xapp/mhpl0001" `
    -Method Get `
    -Headers @{
        "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJJVEMuTUhQTCIsInN1YiI6Ik1IUEwuQVBJIiwiYXVkIjoiSVRDLkFQSSIsImlhdCI6MTc2MzQ1Mzc0MSwiZXhwIjoxNzYzNTQwMTQxfQ.zNIV71zfBx4Ir29hkjgybBJlqSz9mDizzh_jxuXVwKc"
        "StartDate" = "2024-12-01"
        "EndDate" = "2025-01-10"
        "PatCat" = "OUTPATIENT, INPATIENT"
        "PageNumber" = "2"
        "PageSize" = "5"
    }

$response | ConvertTo-Json -Depth 10


# Payroll Total Expense API Endpoint (MHPL002)
$response = Invoke-RestMethod -Uri "http://appit.ignitetechno.com:8080/xapi/xapp/mhpl0002" `
    -Method Get `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "StartDate" = "2025-04-20"
        "EndDate" = "2025-05-10"
        "SummType" = ""
        "Dept" = ""
        "EmpType" = ""
        "PageNumber" = "1"
        "PageSize" = "10"
    }

$response | ConvertTo-Json -Depth 10

# Patient Location API Endpoint (MHPL0003)
$response = Invoke-RestMethod -Uri "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0003" `
    -Method Get `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "StartDate" = "2025-07-01"
        "EndDate" = "2025-07-30"
        "PatCat" = "OPD"
        "Division" = "Dhaka"
        "District" = ""
        "PageSize" = "10"
        "PageNumber" = "1"
    }

$response | ConvertTo-Json -Depth 10

# Patient Spending API Endpoint (MHPL0004)
$response = Invoke-RestMethod -Uri "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0004" `
    -Method Get `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "StartDate" = "2025-06-01"
        "EndDate" = "2025-06-30"
        "PatCat" = "IPD"
        "SpendCat" = "HIGH"
        "PageNumber" = "1"
        "PageSize" = "10"
    }

$response | ConvertTo-Json -Depth 10

# Revenue Driver Consultant API Endpoint (MHPL0005)
$response = Invoke-RestMethod -Uri "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0005" `
    -Method Get `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "StartDate" = "2025-07-01"
        "EndDate" = "2025-07-30"
        "ServiceTypes" = "OPD"
        "Consultants" = ""
        "Page_Number" = "1"
        "Page_Size" = "5"
    }

$response | ConvertTo-Json -Depth 10

# IPD Insurance API Endpoint (MHPL0006)
$response = Invoke-RestMethod -Uri "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0006" `
    -Method Get `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "StartDate" = "2025-01-01"
        "EndDate" = "2025-06-01"
        "insuranceProviders" = "Green Delta Insurance"
        "Department" = ""
        "PageNumber" = "1"
        "PageSize" = "5"
    }

$response | ConvertTo-Json -Depth 10

# IPD Bed API Endpoint (MHPL0007)
$response = Invoke-RestMethod -Uri "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0007" `
    -Method Get `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "StartDate" = "2025-01-01"
        "EndDate" = "2025-01-01"
        "Wards" = "LEVEL-12 NURSE STATION"
        "BedTypes" = ""
        "Threshold" = "50"
        "PageNumber" = "1"
        "PageSize" = "10"
    }

$response | ConvertTo-Json -Depth 10

# Employee Attendance API Endpoint (MHPL0008)
$response = Invoke-RestMethod -Uri "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0008" `
    -Method Get `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "StartDate" = "2025-06-01"
        "EndDate" = "2025-06-30"
        "DeptName" = "medicine"
        "EmpType" = ""
        "PageNumber" = "1"
        "PageSize" = "2"
    }

$response | ConvertTo-Json -Depth 10

# Medicine Wastage API Endpoint (MHPL0009)
$response = Invoke-RestMethod -Uri "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0009" `
    -Method Get `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "StartDate" = "2025-07-01"
        "EndDate" = "2025-07-30"
        "medicine_name" = ""
        "medicine_categories" = "tablet"
        "PageNumber" = "1"
        "PageSize" = "16"
    }

$response | ConvertTo-Json -Depth 10


# Employee Salary Summary API Endpoint (MHPL0010)
$response = Invoke-RestMethod -Uri "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0010" `
    -Method Get `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "StartDate" = "2025-05-01"
        "EndDate" = "2025-06-30"
        "Departments" = "billing, medicine"
        "EmpType" = "worker"
        "PageNumber" = "1"
        "PageSize" = "2"
        "SummType" = "monthly, yearly"
    }

$response | ConvertTo-Json -Depth 10