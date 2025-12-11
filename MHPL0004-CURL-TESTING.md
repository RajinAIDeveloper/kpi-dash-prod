# MHPL0004 API Testing - Manual cURL Commands for Windows CMD

## Step 1: Get Authentication Token

```cmd
curl -X POST "http://appit.ignitetechno.com:8080/ords/xapi/auth/token" -H "Accept: application/json" -H "Authorization: Basic TVhQTC5BUEk6MTIzNDU2Nzg5MCMyNQ==" 
```

**Expected Response:**
```json
{
  "Token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."
}
```

Copy the token value from the response.

---

## Step 2: Test MHPL0004 Endpoint

Replace `YOUR_TOKEN_HERE` with the token from Step 1.

### Test A: IPD Only (Should work)

```cmd
curl -X GET "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0004" -H "Accept: application/json" -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN_HERE" -H "PatCat: IPD" -H "StartDate: 2024-12-01" -H "EndDate: 2024-12-08"
```

### Test B: OPD Only (Should work)

```cmd
curl -X GET "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0004" -H "Accept: application/json" -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN_HERE" -H "PatCat: OPD" -H "StartDate: 2024-12-01" -H "EndDate: 2024-12-08"
```

### Test C: IPD,OPD Combined (This is likely causing the 555 error)

```cmd
curl -X GET "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0004" -H "Accept: application/json" -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN_HERE" -H "PatCat: IPD,OPD" -H "StartDate: 2024-12-01" -H "EndDate: 2024-12-08"
```

### Test D: Alternative format with space after comma

```cmd
curl -X GET "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0004" -H "Accept: application/json" -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN_HERE" -H "PatCat: IPD, OPD" -H "StartDate: 2024-12-01" -H "EndDate: 2024-12-08"
```

### Test E: Without PatCat parameter

```cmd
curl -X GET "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0004" -H "Accept: application/json" -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN_HERE" -H "StartDate: 2024-12-01" -H "EndDate: 2024-12-08"
```

---

## Understanding the Error

If you get a **555 status code**, it means:
- The MHPL backend doesn't accept the `IPD,OPD` format
- The API might only accept a single patient category at a time
- You may need to make separate calls for IPD and OPD, then merge the results

## Credentials Info

- **Base URL**: `http://appit.ignitetechno.com:8080`
- **Auth Endpoint**: `/ords/xapi/auth/token`
- **MHPL0004 Endpoint**: `/ords/xapi/xapp/mhpl0004`
- **Auth Method**: Basic Auth
- **Username**: MHPL.API
- **Password**: 1234567890#25
- **Base64 Encoded**: `TVhQTC5BUEk6MTIzNDU2Nzg5MCMyNQ==`

---

## Quick One-Liner (After getting token)

Replace `YOUR_TOKEN` with your actual token:

```cmd
curl -v -X GET "http://appit.ignitetechno.com:8080/ords/xapi/xapp/mhpl0004" -H "Authorization: Bearer YOUR_TOKEN" -H "PatCat: IPD,OPD" -H "StartDate: 2024-12-01" -H "EndDate: 2024-12-08"
```

The `-v` flag gives you verbose output to see the full request/response headers.

---

## Expected Behavior

1. **Token Request**: Returns 200 with JWT token
2. **MHPL0004 with IPD**: Returns 200 with spending data for IPD patients
3. **MHPL0004 with OPD**: Returns 200 with spending data for OPD patients  
4. **MHPL0004 with IPD,OPD**: Currently returns 555 (Invalid parameter)

## Solution Options

If Test C returns 555:

### Option 1: Make separate API calls
- Call once with `PatCat: IPD`
- Call again with `PatCat: OPD`
- Merge the results in your frontend

### Option 2: Contact MHPL API team
- Request they support comma-separated values in the PatCat parameter
- Or clarify the correct format for multiple patient categories

### Option 3: Use different parameter format
- Try array format: `PatCat[]: IPD` and `PatCat[]: OPD`
- Try pipe separator: `PatCat: IPD|OPD`
- Try different casing: `PatCat: inpatient,outpatient`
