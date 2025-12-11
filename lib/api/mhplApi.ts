'use client'

import type { MHPLResponse, MHPLEndpoint } from './types'

const isDev = process.env.NODE_ENV === 'development'

// Dynamically import the token storage helper on the client
let TokenStorage: any = {}
if (typeof window !== 'undefined') {
  try {
    const { TokenStorage: clientTokenStorage } = require('../tokenStorage')
    TokenStorage = clientTokenStorage
  } catch (error) {
    console.warn('[MHPL] Failed to load TokenStorage helper, falling back to auth API.', error)
  }
}

export const MHPL_ENDPOINTS: Record<string, MHPLEndpoint> = {
  mhpl0001: { id: 'mhpl0001', name: 'Patient Revisit Analysis', path: '/xapi/xapp/mhpl0001', method: 'GET', description: 'Patient revisit rates and admission data analysis' },
  mhpl0002: { id: 'mhpl0002', name: 'Payroll Total Expense', path: '/xapi/xapp/mhpl0002', method: 'GET', description: 'Track payroll expenses by department and period' },
  mhpl0003: { id: 'mhpl0003', name: 'Patient Location Analysis', path: '/ords/xapi/xapp/mhpl0003', method: 'GET', description: 'Patient geographical distribution by division/district' },
  mhpl0004: { id: 'mhpl0004', name: 'Patient Spending Analysis', path: '/ords/xapi/xapp/mhpl0004', method: 'GET', description: 'Patient spending patterns and categories' },
  mhpl0005: { id: 'mhpl0005', name: 'Revenue Driver Consultant Analysis', path: '/ords/xapi/xapp/mhpl0005', method: 'GET', description: 'Consultant revenue analysis and performance' },
  mhpl0006: { id: 'mhpl0006', name: 'IPD Insurance Claims', path: '/ords/xapi/xapp/mhpl0006', method: 'GET', description: 'Insurance provider claims and settlements' },
  mhpl0007: { id: 'mhpl0007', name: 'IPD Bed Occupancy', path: '/ords/xapi/xapp/mhpl0007', method: 'GET', description: 'Real-time bed occupancy monitoring' },
  mhpl0008: { id: 'mhpl0008', name: 'Employee Performance', path: '/ords/xapi/xapp/mhpl0008', method: 'GET', description: 'Employee attendance and performance tracking' },
  mhpl0009: { id: 'mhpl0009', name: 'Pharmacy Expired Medicine', path: '/ords/xapi/xapp/mhpl0009', method: 'GET', description: 'Medicine expiration and waste tracking' },
  mhpl0010: { id: 'mhpl0010', name: 'Employee Salary Summary', path: '/ords/xapi/xapp/mhpl0010', method: 'GET', description: 'Employee salary distribution and analysis' }
}

const SLOW_ENDPOINTS = new Set<string>(['mhpl0003', 'mhpl0004', 'mhpl0006'])

const getTimeoutBudget = (endpointId: string, attempt: number) => {
  const isSlow = SLOW_ENDPOINTS.has(endpointId)
  const base =
    process.env.NODE_ENV === 'development'
      ? isSlow ? 30000 : 15000
      : isSlow ? 60000 : 30000
  return base * attempt
}

export class MHPLApiClient {
  private baseUrl: string

  constructor(baseUrl?: string) {
    const fallback = 'http://appit.ignitetechno.com:8080'
    const configured = baseUrl || process.env.NEXT_PUBLIC_MHPL_BASE_URL || fallback

    try {
      new URL(configured)
      this.baseUrl = configured
    } catch {
      console.warn('[MHPL] Invalid base URL supplied, falling back to default.')
      this.baseUrl = fallback
    }
  }

  async callEndpoint<T = any>(
    endpointId: string,
    params: Record<string, any> = {},
    serverToken?: string | null
  ): Promise<MHPLResponse<T>> {
    const endpoint = MHPL_ENDPOINTS[endpointId]
    if (!endpoint) {
      return {
        status: 'error',
        code: 'UNKNOWN_ENDPOINT',
        message: `Unknown endpoint: ${endpointId}`,
        data: undefined
      }
    }

    let token = serverToken ?? null
    const isServer = typeof window === 'undefined'

    // On the client, route all MHPL calls through the Next.js server proxy
    // to avoid mixed-content/CORS issues and keep tokens on the server.
    if (!isServer) {
      try {
        const res = await fetch(`/api/mhpl/${endpointId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
          cache: 'no-store',
        })

        const payload = await res.json().catch(() => null as any)

        if (!res.ok || !payload || payload.success === false) {
          const status = payload?.statusFromMHPL ?? res.status
          const message =
            payload?.error ||
            payload?.message ||
            `MHPL proxy request failed (${status})`

          return {
            status: 'error',
            code: 'API_ERROR',
            message,
            data: undefined,
          }
        }

        return {
          status: 'success',
          code: String(payload.statusFromMHPL ?? 200),
          message: 'Request successful',
          data: payload.data as T,
          input_parameters: params,
        }
      } catch (error: any) {
        const msg =
          error instanceof Error && error.message
            ? error.message
            : 'Network error while calling MHPL proxy.'
        return {
          status: 'error',
          code: 'NETWORK_ERROR',
          message: msg,
          data: undefined,
        }
      }
    }

    // Priority 1: Check database for global token (if on client)
    if (!token && !isServer) {
      try {
        const response = await fetch('/api/global-token')
        if (response.ok) {
          const data = await response.json()
          if (data.hasToken && data.token) {
            token = data.token
            if (isDev) console.log('[MHPL] Using global token from database')
          }
        }
      } catch (error) {
        console.warn('[MHPL] Failed to fetch global token from database:', error)
      }
    }

    // Priority 2: Check sessionStorage token
    if (!token && !isServer && TokenStorage?.getValidToken) {
      token = TokenStorage.getValidToken()
    }

    // Priority 3: Check environment variable
    if (!token && process.env.NEXT_PUBLIC_MHPL_AUTH_TOKEN) {
      token = process.env.NEXT_PUBLIC_MHPL_AUTH_TOKEN
    }

    // Priority 4: Try authentication API
    if (!token) {
      try {
        const response = await fetch('/api/authentication', { method: 'POST', headers: { 'Content-Type': 'application/json' } })

        if (response.ok) {
          const payload = await response.json()
          if (payload?.success && payload.token) {
            token = payload.token
            if (!isServer && TokenStorage?.save) {
              TokenStorage.save(payload.token)
            }
          }
        }
      } catch (authError) {
        console.warn('[MHPL] Authentication attempt failed:', authError)
      }
    }

    if (!token) {
      return {
        status: 'error',
        code: 'NO_AUTH_TOKEN',
        message: 'No authentication token available. Please authenticate first.',
        data: undefined
      }
    }

    const urlPath = endpoint.path.startsWith('/') ? endpoint.path : `/${endpoint.path}`
    const url = new URL(urlPath, this.baseUrl)

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'MHPL-Client/1.0'
    }

    console.log(`📤 [MHPL_API] Calling ${endpointId} with params:`, params)

    // Normalize and attach parameters as headers (backend expects headers, not query)
    const normalizeParamsForEndpoint = (id: string, raw: Record<string, any>) => {
      const out: Record<string, any> = {}
      for (const [k, v] of Object.entries(raw)) {
        if (v === undefined || v === null) continue
        if (typeof v === 'string' && v.trim() === '') continue
        out[k] = v
      }

      const isZero = (ps: any) => ps === 0 || ps === '0'

      // MHPL0005 and MHPL0006 use underscore format (Page_Size, Page_Number)
      if (id === 'mhpl0005' || id === 'mhpl0006') {
        if (out.PageSize !== undefined && out.Page_Size === undefined) {
          out.Page_Size = out.PageSize
          delete out.PageSize
        }
        if (out.PageNumber !== undefined && out.Page_Number === undefined) {
          out.Page_Number = out.PageNumber
          delete out.PageNumber
        }
        if (isZero(out.Page_Size)) {
          delete out.Page_Size
          delete out.Page_Number
        }
      } else {
        // Other endpoints use camelCase (PageSize, PageNumber)
        if (isZero(out.PageSize)) {
          delete out.PageSize
          delete out.PageNumber
        }
      }

      return out
    }

    // Server-side safety defaults mirror the proxy to avoid missing required headers
    const applyEndpointDefaults = (id: string, raw: Record<string, any>) => {
      const out = { ...raw }

      // Ensure StartDate/EndDate present
      const needsStart = !out.StartDate || String(out.StartDate).trim() === ''
      const needsEnd = !out.EndDate || String(out.EndDate).trim() === ''
      if (needsStart || needsEnd) {
        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth(), 1)
        const fmt = (d: Date) => {
          const yyyy = d.getFullYear()
          const mm = String(d.getMonth() + 1).padStart(2, '0')
          const dd = String(d.getDate()).padStart(2, '0')
          return `${yyyy}-${mm}-${dd}`
        }
        if (needsStart) out.StartDate = fmt(start)
        if (needsEnd) out.EndDate = fmt(now)
      }

      switch (id) {
        case 'mhpl0003':
          if (!out.PatCat) out.PatCat = 'IPD'
          break
        case 'mhpl0004':
          // Patient spending API fails with empty PatCat; default to both categories
          if (!out.PatCat) out.PatCat = 'IPD,OPD'
          break
        case 'mhpl0005':
          if (!out.ServiceTypes) out.ServiceTypes = 'IPD'
          break
        case 'mhpl0006':
          if (!out.InsuranceProviders) out.InsuranceProviders = 'MetLife Alico'
          break
        case 'mhpl0007':
          if (!out.Threshold) out.Threshold = '70'
          break
        default:
          break
      }

      return out
    }

    const normalizedParams = normalizeParamsForEndpoint(endpointId, params)
    const paramsWithDefaults = applyEndpointDefaults(endpointId, normalizedParams)

    for (const [key, value] of Object.entries(paramsWithDefaults)) {
      headers[key] = String(value)
    }

    console.log(`📤 [MHPL_API] Final headers for ${endpointId}:`, headers)

    const maxRetries = 2

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController()
      const timeoutMs = getTimeoutBudget(endpointId, attempt)
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const response = await fetch(url.toString(), {
          method: endpoint.method,
          headers,
          cache: 'no-store',
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorBody = await response.text().catch(() => undefined)

          if (response.status === 401 && !isServer && TokenStorage?.clear) {
            TokenStorage.clear()
          }

          if (response.status === 401) {
            return { status: 'error', code: 'UNAUTHORIZED', message: 'Authentication failed. Please login again.', data: undefined }
          }

          if (response.status === 555) {
            return { status: 'error', code: '555', message: 'MHPL server error: invalid parameter combination.', data: undefined }
          }

          if (response.status >= 500) {
            return { status: 'error', code: 'SERVER_ERROR', message: `MHPL server error: ${response.status}`, data: undefined }
          }

          return {
            status: 'error',
            code: 'API_ERROR',
            message: `API request failed (${response.status}): ${response.statusText || 'Unknown error'}`,
            data: errorBody as any
          }
        }

        const raw = await response.text()
        let data: any = raw

        try {
          if (raw.trim().startsWith('{') || raw.trim().startsWith('[')) {
            data = JSON.parse(raw)
          } else {
            data = { raw }
          }
        } catch (parseError) {
          console.error('[MHPL] Failed to parse response payload:', parseError)
          return { status: 'error', code: 'PARSE_ERROR', message: 'Failed to parse server response.', data: undefined }
        }

        return {
          status: 'success',
          code: '200',
          message: 'Request successful',
          data,
          input_parameters: params
        }
      } catch (error) {
        clearTimeout(timeoutId)

        const isAbort =
          (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')) ||
          (error instanceof Error && error.name === 'AbortError')
        const isNetworkFailure =
          error instanceof TypeError && typeof error.message === 'string' && error.message.includes('fetch failed')

        if (isAbort) {
          console.warn(`[MHPL] Timeout attempt ${attempt}/${maxRetries} for ${endpointId}`, error)
        } else if (isNetworkFailure) {
          console.warn(`[MHPL] Network issue attempt ${attempt}/${maxRetries} for ${endpointId}`, error)
        } else {
          console.error(`[MHPL] Attempt ${attempt}/${maxRetries} failed for ${endpointId}:`, error)
        }

        if (attempt === maxRetries) {
          return {
            status: 'error',
            code: isAbort ? 'TIMEOUT' : isNetworkFailure ? 'NETWORK_ERROR' : 'REQUEST_FAILED',
            message:
              error instanceof Error
                ? error.message
                : isAbort
                  ? 'Request timed out.'
                  : 'Unknown error occurred while calling the MHPL API.',
            data: undefined
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
      }
    }

    return {
      status: 'error',
      code: 'UNEXPECTED_ERROR',
      message: 'Unexpected error in MHPL API client.',
      data: undefined
    }
  }

  private getMockResponse<T = any>(endpointId: string): MHPLResponse<T> {
    const mockMap: Record<string, any> = {
      mhpl0001: { totals: [{ TOTAL_UNIQUE_PATIENTS: 1200, AVERAGE_REVISIT_RATE: 0.32 }] },
      mhpl0002: { totals: [{ Total_Amount: 450000 }] },
      mhpl0003: { collectedMRN: [{ division: 'Dhaka', count: 250 }] },
      mhpl0004: { groupBySpendingCategory: [{ TOTAL_BILLED_AMOUNT: 125000 }] },
      mhpl0005: { groupByConsultant: [{ items: [{ total_revenue: 25000 }] }] },
      mhpl0006: { groupByInsuranceProvider: [{ items: [{ claim_count: 42 }] }] },
      mhpl0007: { groupByDateAndBed: { items: new Array(25).fill(null) } },
      mhpl0008: { groupByEmployee: [{ items: new Array(10).fill(null) }] },
      mhpl0009: { groupByMedicines: { items: [{ wasted_value: 1200 }] } },
      mhpl0010: { GroupByEmployee: [{ items: [{ TOTAL_SALARY: 150000 }] }] }
    }

    return {
      status: 'success',
      code: 'MOCK',
      message: `Mock data for ${endpointId}`,
      data: mockMap[endpointId] ?? { message: 'Mock data unavailable for this endpoint.' }
    }
  }

  async testAllEndpoints(): Promise<Record<string, MHPLResponse<any>>> {
    const results: Record<string, MHPLResponse<any>> = {}

    for (const endpointId of Object.keys(MHPL_ENDPOINTS)) {
      try {
        results[endpointId] = await this.callEndpoint(endpointId, {})
      } catch (error) {
        results[endpointId] = {
          status: 'error',
          code: 'TEST_FAILED',
          message: `Failed to test ${endpointId}: ${error}`,
          data: undefined
        }
      }
    }

    return results
  }

  async ensureValidToken(): Promise<boolean> {
    try {
      const stored = TokenStorage?.getValidToken?.()
      if (stored) return true

      if (process.env.NEXT_PUBLIC_MHPL_AUTH_TOKEN && process.env.NEXT_PUBLIC_MHPL_AUTH_TOKEN.trim() !== '') {
        return true
      }

      try {
        const response = await fetch('/api/authentication', { method: 'POST' })
        const payload = await response.json()
        return !!payload?.success && !!payload.token
      } catch (error) {
        console.warn('[MHPL] ensureValidToken fallback failed:', error)
      }

      return false
    } catch (error) {
      console.error('[MHPL] ensureValidToken encountered an error:', error)
      return false
    }
  }

  async callEndpointWithFallback<T = any>(
    endpointId: string,
    params: Record<string, any> = {},
    token?: string | null
  ): Promise<MHPLResponse<T>> {
    const response = await this.callEndpoint<T>(endpointId, params, token)
    if (response.status === 'success') {
      return response
    }

    if (response.code === 'TIMEOUT' || response.code === 'NETWORK_ERROR') {
      console.warn(`[MHPL] Using mock data fallback for ${endpointId} due to ${response.code}.`)
      return this.getMockResponse<T>(endpointId)
    }

    return response
  }
}

export const mhplApi = new MHPLApiClient()
export const callMHPLEndpoint = mhplApi.callEndpoint.bind(mhplApi)

export const callMHPL_API_WithValidation = async <T = any>(
  endpointId: string,
  params: Record<string, any>,
  token?: string
): Promise<MHPLResponse<T>> => {
  try {
    if (isDev) console.log(`[MHPL] Calling ${endpointId} with validation wrapper`, params)
    const response = await mhplApi.callEndpointWithFallback<T>(endpointId, params, token)
    if (isDev) console.log(`[MHPL] ${endpointId} call completed with status: ${response.status}`)
    return response
  } catch (error) {
    console.error(`[MHPL] ${endpointId} call failed:`, error)
    throw error
  }
}
