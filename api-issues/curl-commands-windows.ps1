# AUth Token Request
curl -X POST "http://appit.ignitetechno.com:8080/ords/xapi/auth/token" ^
  -u "MHPL.API:1234567890#25" ^
  -H "Content-Type: application/json"


# MHPL0001 - Patient Revisit API Request
curl -X GET "http://appit.ignitetechno.com:8080/xapi/xapp/mhpl0001" ^
  -H "Authorization: Bearer $TOKEN" ^
  -H "StartDate: 2024-12-01" ^
  -H "EndDate: 2025-01-10" ^
  -H "PatCat: OUTPATIENT, INPATIENT" ^
  -H "PageNumber: 2" ^
  -H "PageSize: 5"


  curl -X GET "http://appit.ignitetechno.com:8080/xapi/xapp/mhpl0001" ^
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJJVEMuTUhQTCIsInN1YiI6Ik1IUEwuQVBJIiwiYXVkIjoiSVRDLkFQSSIsImlhdCI6MTc2MzQ1Mzc0MSwiZXhwIjoxNzYzNTQwMTQxfQ.zNIV71zfBx4Ir29hkjgybBJlqSz9mDizzh_jxuXVwKc" ^
  -H "StartDate: 2024-12-01" ^
  -H "EndDate: 2025-01-10" ^
  -H "PatCat: OUTPATIENT, INPATIENT" ^
  -H "PageNumber: 2" ^
  -H "PageSize: 5"

  


# MHPL0002 - Payroll Total Expense API Request
curl -X GET "http://appit.ignitetechno.com:8080/xapi/xapp/mhpl0002" ^
  -H "Authorization: Bearer $TOKEN" ^
  -H "StartDate: 2025-04-20" ^
  -H "EndDate: 2025-05-10" ^
  -H "SummType: " ^
  -H "Dept: " ^
  -H "EmpType: " ^
  -H "PageNumber: 1" ^
  -H "PageSize: 10"


# MHPL0003 - Patient Location API Request
curl -X GET "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0003" ^
  -H "Authorization: Bearer $TOKEN" ^
  -H "StartDate: 2025-07-01" ^
  -H "EndDate: 2025-07-30" ^
  -H "PatCat: OPD" ^
  -H "Division: Dhaka" ^
  -H "District: " ^
  -H "PageSize: 10" ^
  -H "PageNumber: 1"


# MHPL0004 - Patient Spending API Request
curl -X GET "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0004" ^
  -H "Authorization: Bearer $TOKEN" ^
  -H "StartDate: 2025-06-01" ^
  -H "EndDate: 2025-06-30" ^
  -H "PatCat: IPD" ^
  -H "SpendCat: HIGH" ^
  -H "PageNumber: 1" ^
  -H "PageSize: 10"


# MHPL0005 - Consultant Revenue
curl -X GET "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0005" ^
  -H "Authorization: Bearer $TOKEN" ^
  -H "StartDate: 2025-07-01" ^
  -H "EndDate: 2025-07-30" ^
  -H "ServiceTypes: OPD" ^
  -H "Consultants: " ^
  -H "Page_Number: 1" ^
  -H "Page_Size: 5"


# MHPL0006 - Insurance Revenue API Request
curl -X GET "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0006" ^
  -H "Authorization: Bearer $TOKEN" ^
  -H "StartDate: 2025-01-01" ^
  -H "EndDate: 2025-06-01" ^
  -H "insuranceProviders: Green Delta Insurance" ^
  -H "Department: " ^
  -H "PageNumber: 1" ^
  -H "PageSize: 5"


# MHPL0007 - IPD Bed Avaliability API Request
curl -X GET "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0007" ^
  -H "Authorization: Bearer $TOKEN" ^
  -H "StartDate: 2025-01-01" ^
  -H "EndDate: 2025-01-01" ^
  -H "Wards: LEVEL-12 NURSE STATION" ^
  -H "BedTypes: " ^
  -H "Threshold: 50" ^
  -H "PageNumber: 1" ^
  -H "PageSize: 10"

# MHPL0008 - Employee Attendance API Request
curl -X GET "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0008" ^
  -H "Authorization: Bearer $TOKEN" ^
  -H "StartDate: 2025-06-01" ^
  -H "EndDate: 2025-06-30" ^
  -H "DeptName: medicine" ^
  -H "EmpType: " ^
  -H "PageNumber: 1" ^
  -H "PageSize: 2"

# MHPL0009 - Medicinal waste API Request
curl -X GET "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0009" ^
  -H "Authorization: Bearer $TOKEN" ^
  -H "StartDate: 2025-07-01" ^
  -H "EndDate: 2025-07-30" ^
  -H "medicine_name: " ^
  -H "medicine_categories: tablet" ^
  -H "PageNumber: 1" ^
  -H "PageSize: 16"

# MHPL0010 - Employee Salary Summary API Request
curl -X GET "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0010" ^
  -H "Authorization: Bearer $TOKEN" ^
  -H "StartDate: 2025-05-01" ^
  -H "EndDate: 2025-06-30" ^
  -H "Departments: billing, medicine" ^
  -H "EmpType: worker" ^
  -H "PageNumber: 1" ^
  -H "PageSize: 2" ^
  -H "SummType: monthly, yearly"