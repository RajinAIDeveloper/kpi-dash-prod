import { MHPLApiClient } from './mhplApi'
import type { MHPLResponse } from './types'

const DEFAULT_AUTH_URL =
  process.env.NEXT_PUBLIC_MHPL_AUTH_URL ||
  'http://appit.ignitetechno.com:8080/ords/xapi/auth/token'
const DEFAULT_AUTH_USERNAME =
  process.env.NEXT_PUBLIC_MHPL_AUTH_USERNAME || 'MHPL.API'
const DEFAULT_AUTH_PASSWORD =
  process.env.NEXT_PUBLIC_MHPL_AUTH_PASSWORD || '1234567890#25'

type TokenStorageModule = typeof import('../tokenStorage')

let ClientTokenStorage: TokenStorageModule['TokenStorage'] | null = null
if (typeof window !== 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const module = require('../tokenStorage') as TokenStorageModule
    ClientTokenStorage = module.TokenStorage
  } catch (error) {
    console.warn('TokenStorage unavailable on client:', error)
  }
}

const encodeBasicAuth = (username: string, password: string): string => {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(`${username}:${password}`)
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(`${username}:${password}`, 'utf8').toString('base64')
  }

  throw new Error('Unable to encode credentials for basic auth')
}

// PatCat parameter mapping for different endpoints
const PATCAT_MAPPING: Record<string, string> = {
  'mhpl0001': 'OUTPATIENT,INPATIENT,EMERGENCY', // ✨ ENHANCED: Add EMERGENCY support
  'mhpl0003': 'OPD',                  // Single value
  'mhpl0004': 'OPD',                  // Single value (avoid IPD+HIGH conflict)
  'mhpl0007': 'INPATIENT'             // Bed management
}

// Parameter format mapping for different endpoints
const PARAM_FORMATS: Record<string, { pageSize: string; pageNumber: string }> = {
  'mhpl0005': { pageSize: 'Page_Size', pageNumber: 'Page_Number' }, // Underscore format
  'default': { pageSize: 'PageSize', pageNumber: 'PageNumber' }     // Standard format
}

export class ProductionMHPLClient extends MHPLApiClient {
  constructor() {
    // Use direct API URL - Next.js 15 handles CORS properly
    super('http://appit.ignitetechno.com:8080')
  }

  private tokenPromise: Promise<string | null> | null = null

  private async resolveAuthToken(
    serverToken?: string | null,
    forceRefresh = false
  ): Promise<string | null> {
    if (serverToken) {
      return serverToken
    }

    // Server-side execution: fall back to environment token
    if (typeof window === 'undefined') {
      return (
        process.env.NEXT_PUBLIC_MHPL_AUTH_TOKEN ||
        process.env.MHPL_AUTH_TOKEN ||
        null
      )
    }

    if (forceRefresh && ClientTokenStorage?.clear) {
      ClientTokenStorage.clear()
    }

    if (!forceRefresh) {
      const existingToken = ClientTokenStorage?.getValidToken?.()
      if (existingToken) {
        return existingToken
      }
    }

    if (!this.tokenPromise) {
      this.tokenPromise = this.generateClientToken().finally(() => {
        this.tokenPromise = null
      })
    }

    return this.tokenPromise
  }

  private async invalidateClientToken() {
    if (typeof window === 'undefined') {
      return
    }
    ClientTokenStorage?.clear?.()
  }

  private extractTokenFromPayload(payload: any): string | null {
    if (!payload) return null

    const candidateKeys = ['Token', 'token', 'access_token', 'bearer']
    for (const key of candidateKeys) {
      const value = payload?.[key]
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim()
      }
    }

    if (Array.isArray(payload?.items)) {
      for (const item of payload.items) {
        const nestedToken = this.extractTokenFromPayload(item)
        if (nestedToken) return nestedToken
      }
    }

    return null
  }

  private async generateClientToken(): Promise<string | null> {
    if (typeof window === 'undefined') {
      return (
        process.env.NEXT_PUBLIC_MHPL_AUTH_TOKEN ||
        process.env.MHPL_AUTH_TOKEN ||
        null
      )
    }

    const controller = new AbortController()
    const timeoutMs = 15000
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      console.log('dY"? [AUTH] Generating MHPL token from client')
      const response = await fetch(DEFAULT_AUTH_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${encodeBasicAuth(
            DEFAULT_AUTH_USERNAME,
            DEFAULT_AUTH_PASSWORD
          )}`,
          'Content-Type': 'application/json',
          'User-Agent': 'MHPL-API-Client/1.0'
        },
        body: JSON.stringify({}),
        cache: 'no-store',
        signal: controller.signal
      })

      const rawText = await response.text().catch(() => '')
      let parsed: any = null

      try {
        parsed = rawText ? JSON.parse(rawText) : null
      } catch (error) {
        console.warn('�?O Failed to parse auth response JSON:', error)
      }

      if (!response.ok) {
        console.error(
          '�?O MHPL authentication failed:',
          response.status,
          response.statusText,
          rawText
        )
        return null
      }

      const token = this.extractTokenFromPayload(parsed)

      if (token) {
        ClientTokenStorage?.save?.(token)
        console.log('�o. [AUTH] Token generated and stored for client session')
        return token
      }

      console.error('�?O MHPL auth response did not contain a token', parsed)
      return null
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('�?O MHPL authentication request timed out')
      } else {
        console.error('�?O MHPL authentication error:', error)
      }
      return null
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // Override to use correct endpoint paths matching Postman
  getEndpointPath(endpointId: string): string {
    // Endpoints that need /ords/xapi/xapp/ based on Postman analysis
    const ordsEndpoints = [
      'mhpl0003', 'mhpl0004', 'mhpl0005', 'mhpl0006',
      'mhpl0007', 'mhpl0008', 'mhpl0009', 'mhpl0010'
    ];

    if (ordsEndpoints.includes(endpointId)) {
      return `/ords/xapi/xapp/${endpointId}`;
    }

    // Default to original path for mhpl0001, mhpl0002
    return `/xapi/xapp/${endpointId}`;
  }

  // Override callEndpoint to handle client-side authentication and retries
  async callEndpoint<T = any>(
    endpointId: string,
    params: Record<string, any> = {},
    serverToken?: string | null
  ): Promise<MHPLResponse<T>> {
    const normalizedParams = this.normalizeParams(endpointId, params)

    console.log(
      `[MHPL] Calling ${endpointId} with params:`,
      normalizedParams
    )

    const baseUrl = 'http://appit.ignitetechno.com:8080'
    const endpointPath = this.getEndpointPath(endpointId)
    const url = new URL(endpointPath, baseUrl)

    console.log(`[MHPL] Request URL: ${url.toString()}`)

    const buildHeaders = (authToken: string | null): Record<string, string> => {
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'MHPL-API-Client/1.0'
      }

      if (authToken) {
        requestHeaders.Authorization = `Bearer ${authToken}`
      }

      Object.entries(normalizedParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          requestHeaders[key] = String(value)
        }
      })

      const sanitizedHeaders = Object.keys(requestHeaders).reduce(
        (acc, key) => {
          acc[key] =
            key === 'Authorization' ? '[BEARER_TOKEN]' : requestHeaders[key]
          return acc
        },
        {} as Record<string, string>
      )

      console.log('[MHPL] Headers:', sanitizedHeaders)
      return requestHeaders
    }

    const executeRequest = async (
      authToken: string | null
    ): Promise<Response> => {
      const headers = buildHeaders(authToken)
      const controller = new AbortController()
      const timeoutMs = 15000
      const timeoutId = setTimeout(() => {
        console.warn(`[MHPL] ${endpointId} timed out after ${timeoutMs}ms`)
        controller.abort()
      }, timeoutMs)

      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers,
          signal: controller.signal,
          cache: 'no-store'
        })
        clearTimeout(timeoutId)
        return response
      } catch (error) {
        clearTimeout(timeoutId)
        throw error
      }
    }

    let response: Response | null = null
    let authToken = await this.resolveAuthToken(serverToken)

    try {
      response = await executeRequest(authToken)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          status: 'error',
          message: 'Request timeout after 15000ms',
          code: 'TIMEOUT',
          data: undefined
        }
      }

      return {
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Network request failed',
        code: 'NETWORK_ERROR',
        data: undefined
      }
    }

    if (
      response &&
      (response.status === 401 || response.status === 403) &&
      typeof window !== 'undefined'
    ) {
      console.warn('[MHPL] Token expired, attempting refresh')
      await this.invalidateClientToken()
      authToken = await this.resolveAuthToken(null, true)

      if (authToken) {
        try {
          response = await executeRequest(authToken)
        } catch (error) {
          return {
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Network request failed after refresh',
            code: 'NETWORK_ERROR',
            data: undefined
          }
        }
      }
    }

    if (!response) {
      return {
        status: 'error',
        message: 'No response received from MHPL endpoint',
        code: 'UNKNOWN_ERROR',
        data: undefined
      }
    }

    console.log(
      `[MHPL] Response status ${response.status} (${response.statusText})`
    )

    const rawText = await response.text().catch(() => '')
    let parsedBody: any = undefined

    if (rawText) {
      try {
        parsedBody = JSON.parse(rawText)
      } catch {
        parsedBody = rawText as unknown as T
      }
    }

    if (!response.ok) {
      console.error(`[MHPL] API error ${response.status}`, rawText)
      if (response.status === 401 || response.status === 403) {
        await this.invalidateClientToken()
      }

      return {
        status: 'error',
        message: `HTTP ${response.status}: ${response.statusText}`,
        code: String(response.status),
        data: parsedBody
      }
    }

    return {
      status: 'success',
      message: 'Request successful',
      code: '200',
      data: parsedBody as T
    }
  }
  // Call endpoint with retry logic for better reliability
  async callEndpointWithRetry<T = any>(
    endpointId: string,
    params: Record<string, any> = {},
    retries: number = 3,
    serverToken?: string | null
  ): Promise<MHPLResponse<T>> {
    console.log(`🔄 [CLIENT DEBUG] Starting API call to ${endpointId} with ${retries} retries`, {
      params,
      hasToken: !!serverToken
    })

    for (let attempt = 1; attempt <= retries; attempt++) {
      console.log(`🎯 [CLIENT DEBUG] Attempt ${attempt}/${retries} for ${endpointId}`)

      try {
        const response = await this.callEndpoint<T>(endpointId, params, serverToken)
        console.log(`📡 [CLIENT DEBUG] API response for ${endpointId}:`, {
          status: response.status,
          code: response.code,
          hasData: !!response.data
        })

        // If successful or non-retryable error, return immediately
        if (response.status === 'success' ||
            response.code === 'ENDPOINT_DOWN' ||
            response.code === '555') {
          console.log(`✅ [CLIENT DEBUG] Successful response for ${endpointId}`)
          return response
        }

        // If last attempt, return the error
        if (attempt === retries) {
          console.log(`❌ [CLIENT DEBUG] Max retries reached for ${endpointId}, returning error`)
          return response
        }

        // Wait before retry with exponential backoff
        const delay = 1000 * attempt
        console.log(`⏱️ [CLIENT DEBUG] Retrying ${endpointId} in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))

      } catch (error) {
        console.error(`💥 [CLIENT DEBUG] Exception on attempt ${attempt} for ${endpointId}:`, error)

        if (attempt === retries) {
          console.log(`❌ [CLIENT DEBUG] Max retries reached (with exception) for ${endpointId}`)
          throw error
        }

        const delay = 1000 * attempt
        console.log(`⏱️ [CLIENT DEBUG] Retrying ${endpointId} after exception in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    console.log(`💥 [CLIENT DEBUG] This should never be reached for ${endpointId}`)
    throw new Error('Max retries exceeded')
  }

  // Normalize parameters for specific endpoints
  public normalizeParams(endpointId: string, params: Record<string, any>): Record<string, any> {
    const normalized = { ...params }

    // 1. Map PatCat values per endpoint to prevent conflicts
    if (PATCAT_MAPPING[endpointId]) {
      normalized.PatCat = PATCAT_MAPPING[endpointId]
      console.log(`📋 Mapped PatCat for ${endpointId}: ${normalized.PatCat}`)
    }

    // 2. Handle parameter format variations (Page_Size vs PageSize)
    const format = PARAM_FORMATS[endpointId] || PARAM_FORMATS.default

    if (params.pageSize && format.pageSize !== 'pageSize') {
      normalized[format.pageSize] = params.pageSize
      delete normalized.pageSize
    }

    if (params.pageNumber && format.pageNumber !== 'pageNumber') {
      normalized[format.pageNumber] = params.pageNumber
      delete normalized.pageNumber
    }

    // 3. Apply business rule validation to prevent 555 errors
    if (endpointId === 'mhpl0004' &&
        normalized.PatCat === 'INPATIENT' &&
        normalized.SpendCat === 'HIGH') {
      console.warn('⚠️ Preventing IPD+HIGH conflict for mhpl0004 - using OPD instead')
      normalized.PatCat = 'OPD'
    }

    // 4. Set smart defaults for common parameters
    if (!normalized.PageSize && !normalized.Page_Size) {
      normalized[format.pageSize] = '10'
    }

    if (!normalized.PageNumber && !normalized.Page_Number) {
      normalized[format.pageNumber] = '1'
    }

    // 5. Clean empty parameters
    return this.cleanParams(normalized)
  }

  // Clean and validate parameters - COMPREHENSIVE PARAMETER VALIDATION
  private cleanParams(params: Record<string, any>): Record<string, any> {
    const cleaned: Record<string, any> = {}

    // ALWAYS ensure StartDate and EndDate are present FIRST
    const currentDate = new Date().toISOString().split('T')[0]
    const lastMonthDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Set default dates first
    cleaned.StartDate = params.StartDate || lastMonthDate
    cleaned.EndDate = params.EndDate || currentDate

    console.log('📅 Ensuring date parameters:', {
      StartDate: cleaned.StartDate,
      EndDate: cleaned.EndDate
    })

    // Process all other parameters
    Object.entries(params).forEach(([key, value]) => {
      // Skip dates as they're already handled above
      if (key === 'StartDate' || key === 'EndDate') {
        return
      }

      // Include all non-empty parameters
      if (value !== undefined && value !== null && value !== '') {
        const stringValue = value.toString().trim()

        if (stringValue !== '') {
          // Validate numeric parameters
          if ((key.includes('Size') || key.includes('Number') || key === 'Threshold') &&
              typeof value === 'string') {
            const numValue = parseInt(stringValue, 10)
            if (!isNaN(numValue) && numValue > 0) {
              cleaned[key] = stringValue
            } else {
              console.warn(`⚠️ Invalid numeric value for ${key}: ${value}. Using default.`)
              // Set sensible defaults
              if (key.includes('Size')) cleaned[key] = '10'
              else if (key.includes('Number')) cleaned[key] = '1'
              else if (key === 'Threshold') cleaned[key] = '50'
            }
          }
          // Include all other parameters as strings
          else {
            cleaned[key] = stringValue
          }
        }
      }
    })

    // Final validation - ensure dates are in correct format
    if (!this.isValidDate(cleaned.StartDate)) {
      cleaned.StartDate = lastMonthDate
      console.log('📅 Fixed invalid StartDate, using:', cleaned.StartDate)
    }
    if (!this.isValidDate(cleaned.EndDate)) {
      cleaned.EndDate = currentDate
      console.log('📅 Fixed invalid EndDate, using:', cleaned.EndDate)
    }

    // Log final cleaned parameters
    console.log('✨ Final cleaned parameters:', Object.keys(cleaned).reduce((acc, key) => {
      acc[key] = cleaned[key]
      return acc
    }, {} as Record<string, any>))

    return cleaned
  }

  // Date validation helper
  private isValidDate(dateString: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false
    const date = new Date(dateString)
    return date instanceof Date &&
           !isNaN(date.getTime()) &&
           dateString === date.toISOString().split('T')[0]
  }

  // Get API defaults for specific endpoints
  getApiDefaults(endpointId: string): Record<string, any> {
    const currentDate = new Date().toISOString().split('T')[0]
    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const defaults: Record<string, Record<string, any>> = {
      'mhpl0001': {
        PatCat: 'OUTPATIENT,INPATIENT,EMERGENCY', // ✨ ENHANCED: Add EMERGENCY support
        PageSize: '10',
        PageNumber: '1',
        StartDate: lastMonth,
        EndDate: currentDate
      },
      'mhpl0002': {
        SummType: 'MONTHLY',
        Dept: 'ALL',
        EmpType: 'ALL',
        PageSize: '10',
        PageNumber: '1',
        StartDate: lastMonth,
        EndDate: currentDate
      },
      'mhpl0003': {
        PatCat: 'OPD',
        Division: 'ALL',
        District: 'ALL',
        PageSize: '10',
        PageNumber: '1',
        StartDate: lastMonth,
        EndDate: currentDate
      },
      'mhpl0004': {
        PatCat: 'OPD', // Avoid IPD+HIGH conflict
        SpendCat: 'LOW',
        PageSize: '10',
        PageNumber: '1',
        StartDate: lastMonth,
        EndDate: currentDate
      },
      'mhpl0005': {
        ServiceTypes: 'OPD',
        Consultants: 'ALL',
        Page_Size: '10', // Note underscore format
        Page_Number: '1',
        StartDate: lastMonth,
        EndDate: currentDate
      },
      'mhpl0006': {
        insuranceProviders: 'BIMA',
        Department: 'ALL',
        PageSize: '10',
        PageNumber: '1',
        StartDate: lastMonth,
        EndDate: currentDate
      },
      'mhpl0007': {
        PatCat: 'INPATIENT',
        Wards: 'ALL',
        BedTypes: 'ALL',
        Threshold: '75',
        PageSize: '10',
        PageNumber: '1',
        StartDate: lastMonth,
        EndDate: currentDate
      },
      'mhpl0008': {
        DeptName: 'ALL',
        PageSize: '10',
        PageNumber: '1',
        StartDate: lastMonth,
        EndDate: currentDate
      },
      'mhpl0009': {
        medicine_name: 'Paracetamol',
        medicine_categories: 'Analgesic',
        PageSize: '10',
        PageNumber: '1',
        StartDate: lastMonth,
        EndDate: currentDate
      },
      'mhpl0010': {
        Departments: 'ALL',
        PageSize: '10',
        PageNumber: '1',
        StartDate: lastMonth,
        EndDate: currentDate
      }
    }

    return defaults[endpointId] || {
      PageSize: '10',
      PageNumber: '1',
      StartDate: lastMonth,
      EndDate: currentDate
    }
  }
}

export const mhplClient = new ProductionMHPLClient()

// Export convenience functions
export const callMHPLEndpoint = mhplClient.callEndpoint.bind(mhplClient)
export const callMHPLEndpointWithRetry = mhplClient.callEndpointWithRetry.bind(mhplClient)
