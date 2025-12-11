@echo off
REM =================================================================
REM Windows CMD script to test MHPL0004 API directly
REM =================================================================

echo ========================================
echo STEP 1: Getting Authentication Token
echo ========================================

REM Get auth token first
curl -X POST "http://appit.ignitetechno.com:8080/ords/xapi/auth/token" ^
  -H "Accept: application/json" ^
  -H "Authorization: Basic TVhQTC5BUEk6MTIzNDU2Nzg5MCMyNQ==" ^
  -o token-response.json

echo.
echo Token saved to token-response.json
echo Please extract the token manually and update the TOKEN variable below
echo.
pause

REM ============================================================
REM STEP 2: Set your token here (replace YOUR_TOKEN_HERE)
REM ============================================================
set TOKEN=YOUR_TOKEN_HERE

REM Get current date for testing (YYYY-MM-DD format)
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set CURRENT_DATE=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%
set START_DATE=2024-12-01
set END_DATE=%CURRENT_DATE%

echo.
echo ========================================
echo STEP 2: Testing MHPL0004 with different parameter combinations
echo ========================================

REM Test 1: With IPD only
echo.
echo --- Test 1: IPD Only ---
curl -X GET "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0004" ^
  -H "Accept: application/json" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "PatCat: IPD" ^
  -H "StartDate: %START_DATE%" ^
  -H "EndDate: %END_DATE%" ^
  -o mhpl0004-test1-ipd.json
echo Response saved to: mhpl0004-test1-ipd.json
echo.

REM Test 2: With OPD only
echo --- Test 2: OPD Only ---
curl -X GET "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0004" ^
  -H "Accept: application/json" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "PatCat: OPD" ^
  -H "StartDate: %START_DATE%" ^
  -H "EndDate: %END_DATE%" ^
  -o mhpl0004-test2-opd.json
echo Response saved to: mhpl0004-test2-opd.json
echo.

REM Test 3: With IPD,OPD (the one causing 555 error)
echo --- Test 3: IPD,OPD Combined ---
curl -X GET "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0004" ^
  -H "Accept: application/json" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "PatCat: IPD,OPD" ^
  -H "StartDate: %START_DATE%" ^
  -H "EndDate: %END_DATE%" ^
  -o mhpl0004-test3-both.json
echo Response saved to: mhpl0004-test3-both.json
echo.

REM Test 4: Without PatCat parameter
echo --- Test 4: No PatCat Parameter ---
curl -X GET "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0004" ^
  -H "Accept: application/json" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "StartDate: %START_DATE%" ^
  -H "EndDate: %END_DATE%" ^
  -o mhpl0004-test4-no-patcat.json
echo Response saved to: mhpl0004-test4-no-patcat.json
echo.

echo ========================================
echo All tests complete!
echo Check the JSON files for responses
echo ========================================
pause
