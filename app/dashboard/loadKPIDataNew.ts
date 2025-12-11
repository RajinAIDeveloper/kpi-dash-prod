// FIXED VERSION - Key changes marked with // ⚡ FIX comments

// Load KPI data (live from API) - adapted to parallel API calls
import { callMHPL_API_WithValidation } from '@/lib/api/mhplApi'
import { validateMHPL0002Response } from '@/lib/api/schemas/mhpl0002-schema'
import { validateMHPL0003Response } from '@/lib/api/schemas/mhpl0003-schema'
import { ensureGlobalToken } from '@/lib/auth/ensureToken'

export const loadKPIDataFromDatabase = async (
  setKpiData: any,
  setError: any,
  setLoading: any,
  setGeographicData: any,
  setEmployeeData: any,
  setPayrollData: any,
  setPatientData: any,
  setSpendingData: any,
  setConsultantData: any,
  setInsuranceData: any,
  setBedData: any,
  setPerformanceData: any,
  setMedicineData: any,
  getMergedFilters: (endpointId: string) => Record<string, any>,
  endpointOverrides?: Record<string, Record<string, string>>,
  onProgress?: (label: string, percent: number) => void,
  setOverride?: (endpointId: string, key: string, value: string) => void,
  onlyEndpointId?: string
) => {
  // Live API path (no database snapshot usage)
  try {
    const tr = await ensureGlobalToken()
    if (!tr.token) console.warn('[DASHBOARD] ensureGlobalToken returned no token')
  } catch (e) {
    console.error('[DASHBOARD] ensureGlobalToken failed:', e)
  }

  const ensureDateDefaults = (p: Record<string, any>) => {
    const out = { ...(p || {}) }
    const needsStart = !out.StartDate || String(out.StartDate).trim() === ''
    const needsEnd = !out.EndDate || String(out.EndDate).trim() === ''
    if (needsStart || needsEnd) {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const yyyy = (d: Date) => d.getFullYear()
      const mm = (d: Date) => String(d.getMonth() + 1).padStart(2, '0')
      const dd = (d: Date) => String(d.getDate()).padStart(2, '0')
      if (needsStart) out.StartDate = `${yyyy(start)}-${mm(start)}-${dd(start)}`
      if (needsEnd) out.EndDate = `${yyyy(now)}-${mm(now)}-${dd(now)}`
    }
    return out
  }

  const ensureEndpointDefaults = (endpointId: string, p: Record<string, any>) => {
    const out = ensureDateDefaults(p)
    switch (endpointId) {
      case 'mhpl0001': // Patient revisit
        if (!out.PatCat) {
          out.PatCat = 'INPATIENT'
          setOverride?.(endpointId, 'PatCat', 'INPATIENT')
        }
        break
      case 'mhpl0003': // Geographic distribution (default patient category for drill-down alignment)
        if (!out.PatCat) {
          out.PatCat = 'IPD'
          setOverride?.(endpointId, 'PatCat', 'IPD')
        }
        break
      case 'mhpl0004': // Patient spending (include patient category via local filter)
        if (!out.PatCat) {
          out.PatCat = 'IPD'
          setOverride?.(endpointId, 'PatCat', 'IPD')
        }
        break
      case 'mhpl0005': // Consultant revenue
        if (!out.ServiceTypes) {
          out.ServiceTypes = 'IPD'
          setOverride?.(endpointId, 'ServiceTypes', 'IPD')
        }
        if (!out.PageSize && !out.Page_Size) out.PageSize = '5'
        if (!out.PageNumber && !out.Page_Number) out.PageNumber = '1'
        break
      case 'mhpl0006': // Insurance claims
        if (!out.InsuranceProviders) {
          out.InsuranceProviders = 'MetLife Alico'
          setOverride?.(endpointId, 'InsuranceProviders', 'MetLife Alico')
        }
        if (!out.PageSize && !out.Page_Size) out.PageSize = '5'
        if (!out.PageNumber && !out.Page_Number) out.PageNumber = '1'
        break

      case 'mhpl0007': // Bed occupancy
        if (!out.Threshold) {
          out.Threshold = '70'
          setOverride?.(endpointId, 'Threshold', '70')
        }
        break
      case 'mhpl0008': // Employee performance
        // Do not set a default EmpType; align with drilldown behavior
        break
      case 'mhpl0009': // Medicine waste
        if (!out.medicine_categories) {
          out.medicine_categories = 'tablet'
          setOverride?.(endpointId, 'medicine_categories', 'tablet')
        }
        break

      case 'mhpl0010': // Employee salary
        // Ensure required headers for Employee Salary
        if (!out.EmpType) {
          out.EmpType = 'worker'
          setOverride?.(endpointId, 'EmpType', 'worker')
        }
        if (!out.Departments) {
          out.Departments = 'billing, monthly'
          setOverride?.(endpointId, 'Departments', 'billing, monthly')
        }
        if (!out.SummType) out.SummType = 'Monthly'
        break

    }
    return out
  }

  const getNumericValue = (value: any): number => {
    const num = Number(value)
    return isNaN(num) ? 0 : num
  }

  // ========= Trend utilities (month-over-month) =========
  type TrendInfo = { change: number; trend: 'up' | 'down' } | null

  const normalizeMonthKey = (raw: any): string | null => {
    if (!raw) return null
    try {
      const s = String(raw).trim()
      // Accept YYYY-MM, YYYY/MM, YYYY-MM-DD, YYYY/MM/DD
      const m = s.match(/^(\d{4})[-\/]?(\d{2})(?:[-\/]\d{2})?$/)
      if (m) {
        const yyyy = m[1]
        const mm = m[2]
        return `${yyyy}-${mm}`
      }
      // Accept explicit formats like 2025-04 or 2025/04
      const m2 = s.match(/^(\d{4})[-\/]([01]\d)$/)
      if (m2) return `${m2[1]}-${m2[2]}`
      if (/^\d{4}-[01]\d$/.test(s)) return s
    } catch { }
    return null
  }

  const sortMonthKeysAsc = (keys: string[]): string[] =>
    keys.filter(Boolean).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

  const flattenMonthlyItems = (group: any): any[] => {
    if (!group) return []
    if (Array.isArray(group)) {
      const out: any[] = []
      for (const g of group) {
        if (g?.items && Array.isArray(g.items)) out.push(...g.items)
        else out.push(g)
      }
      return out
    }
    if (group?.items && Array.isArray(group.items)) return group.items
    return []
  }

  const pickFirst = (obj: any, keys: string[]): any => {
    for (const k of keys) {
      if (obj && Object.prototype.hasOwnProperty.call(obj, k)) return obj[k]
    }
    return undefined
  }

  const buildMonthlySum = (items: any[], monthKeys: string[], valueKeys: string[]): Map<string, number> => {
    const acc = new Map<string, number>()
    for (const it of items) {
      const rawMonth = pickFirst(it, monthKeys)
      const month = normalizeMonthKey(rawMonth)
      if (!month) continue
      const rawVal = pickFirst(it, valueKeys)
      const val = getNumericValue(rawVal)
      acc.set(month, (acc.get(month) || 0) + val)
    }
    return acc
  }

  const buildMonthlyRatio = (
    items: any[],
    monthKeys: string[],
    numeratorKeys: string[],
    denominatorKeys: string[]
  ): Map<string, number> => {
    const nSum = new Map<string, number>()
    const dSum = new Map<string, number>()
    const explicitRate = new Map<string, number>()
    for (const it of items) {
      const rawMonth = pickFirst(it, monthKeys)
      const month = normalizeMonthKey(rawMonth)
      if (!month) continue
      // Prefer explicit monthly rate if provided (e.g., REVISIT_RATE)
      const explicit = pickFirst(it, ['REVISIT_RATE', 'revisit_rate'])
      if (explicit !== undefined && explicit !== null && String(explicit).trim() !== '') {
        explicitRate.set(month, getNumericValue(explicit))
      } else {
        const n = getNumericValue(pickFirst(it, numeratorKeys))
        const d = getNumericValue(pickFirst(it, denominatorKeys))
        nSum.set(month, (nSum.get(month) || 0) + n)
        dSum.set(month, (dSum.get(month) || 0) + d)
      }
    }
    const out = new Map<string, number>()
    for (const [m, n] of nSum.entries()) {
      const d = dSum.get(m) || 0
      out.set(m, d > 0 ? n / d : 0)
    }
    // Override with explicit rates when available
    for (const [m, r] of explicitRate.entries()) {
      out.set(m, r)
    }
    return out
  }

  const computeTrendFromMap = (byMonth: Map<string, number>): TrendInfo => {
    const months = sortMonthKeysAsc(Array.from(byMonth.keys()))
    // Hide trend when insufficient data (need 2+ months for comparison)
    if (months.length < 2) return null

    const prevMonth = months[months.length - 2]
    const currMonth = months[months.length - 1]
    const prev = getNumericValue(byMonth.get(prevMonth))
    const curr = getNumericValue(byMonth.get(currMonth))

    // Hide trend when previous month is zero (prevents misleading 100% or ∞% increases)
    if (prev === 0) return null

    const deltaPct = ((curr - prev) / Math.abs(prev)) * 100
    const rounded = Math.round(deltaPct * 10) / 10
    return { change: Math.abs(rounded), trend: rounded >= 0 ? 'up' : 'down' }
  }

  try {
    console.log('🔄 [DASHBOARD] Loading data from database...')

    const realKPIs: any[] = []
    const endpointIds = onlyEndpointId && typeof onlyEndpointId === 'string' && onlyEndpointId.trim() !== ''
      ? [onlyEndpointId]
      : ['mhpl0001', 'mhpl0002', 'mhpl0003', 'mhpl0004', 'mhpl0005', 'mhpl0006', 'mhpl0007', 'mhpl0008', 'mhpl0009', 'mhpl0010']
    const base = 25
    const share = 70 / endpointIds.length

    console.log('🔄 [DASHBOARD] Fetching live data from API endpoints...')
    onProgress?.('Fetching live data from API endpoints…', base)
    const allKpiData: Record<string, any> = {}
    await Promise.all(
      endpointIds.map(async (id, idx) => {
        const baseParams = getMergedFilters ? (getMergedFilters(id) || {}) : {}
        const overrides = (endpointOverrides && endpointOverrides[id]) || {}

        console.log(`📅 [${id}] baseParams:`, { StartDate: baseParams.StartDate, EndDate: baseParams.EndDate })
        console.log(`📅 [${id}] overrides:`, overrides)

        const finalParams = ensureEndpointDefaults(id, { ...baseParams, ...overrides })

        console.log(`📅 [${id}] finalParams:`, { StartDate: finalParams.StartDate, EndDate: finalParams.EndDate })

        try {
          const res = await callMHPL_API_WithValidation<any>(id, finalParams)
          if (res.status === 'success') {
            allKpiData[id] = {
              data: {
                _metadata: {
                  timestamp: new Date().toISOString(),
                  endpoint: id,
                  status: 'success',
                  dataSource: 'api',
                  requestedParameters: finalParams
                },
                data: res.data
              }
            }
          } else {
            console.warn('[DASHBOARD] Live API call failed', id, res.message)
            allKpiData[id] = {}
          }
        } catch (e) {
          console.error('[DASHBOARD] Exception calling', id, e)
          allKpiData[id] = {}
        }
      })
    )

    // Process each endpoint
    for (let i = 0; i < endpointIds.length; i++) {
      const endpointId = endpointIds[i]
      onProgress?.(`Preparing ${endpointId.toUpperCase()} (${i + 1}/${endpointIds.length})`, Math.min(95, Math.floor(base + share * (i + 1))))
      const kpiResult = allKpiData[endpointId]

      if (!kpiResult || !kpiResult.data || !kpiResult.data.data) {
        console.log(`⚠️ [DASHBOARD] No data found for ${endpointId}`)
        continue
      }

      const apiData = kpiResult.data.data
      console.log(`✅ [DASHBOARD] Processing ${endpointId} data`)

      // Extract input_parameters from metadata (stored by KPIDatabaseService)
      const inputParams = kpiResult.data._metadata?.requestedParameters || {}
      console.log(`🔍 [DASHBOARD] ${endpointId} input_parameters:`, inputParams)

      // Extract the actual data (it's wrapped in apiData.data for most endpoints)
      const actualData = apiData?.data || apiData

      try {
        switch (endpointId) {
          case 'mhpl0001':
            // Patient Revisit Analysis - 2 KPIs
            console.log('🔍 [MHPL0001] Entered case block')
            console.log('🔍 [MHPL0001] actualData structure:', {
              hasTotals: !!actualData?.totals,
              totalsIsArray: Array.isArray(actualData?.totals),
              totalsLength: actualData?.totals?.length,
              hasGroupByMonth: !!actualData?.groupByMonth
            })

            const totalsArray = Array.isArray(actualData?.totals) ? actualData?.totals : (actualData?.totals?.items || [])
            console.log('🔍 [MHPL0001] totalsArray length:', totalsArray.length)

            if (totalsArray.length > 0) {
              const totals = totalsArray[0]
              console.log('🔍 [MHPL0001] First totals item:', totals)

              // Read local filter from store (endpointOverrides) for instant updates and transparency
              const patCat = endpointOverrides?.['mhpl0001']?.PatCat || 'INPATIENT'
              console.log('🔍 [MHPL0001] PatCat from store:', patCat)

              // Format patient category for display (keep uppercase, just clean it up)
              const formatPatCat = (cat: any) => {
                if (!cat) return ''
                // Handle array format
                if (Array.isArray(cat)) {
                  return cat.join(', ').toUpperCase()
                }
                // Handle comma-separated string
                if (typeof cat === 'string') {
                  return cat.split(',').map(c => c.trim().toUpperCase()).join(', ')
                }
                // Fallback to string conversion
                return String(cat).toUpperCase()
              }

              const formattedPatCat = formatPatCat(patCat)
              console.log('🔍 [MHPL0001] formatted PatCat:', formattedPatCat)

              // Build latest month series for alignment of value and MoM
              const monthlyItems0001 = flattenMonthlyItems(actualData?.groupByMonth)
              console.log(`🔍 [MHPL0001] Total monthly items before filter: ${monthlyItems0001.length}`)

              const selectedCat = String((patCat || '')).toUpperCase().trim()
              const filteredMonthly0001 = selectedCat && selectedCat !== 'INPATIENT,OUTPATIENT'
                ? monthlyItems0001.filter((it: any) => String(it?.PATIENT_CATEGORY || '').toUpperCase() === selectedCat)
                : monthlyItems0001

              console.log(`🔍 [MHPL0001] Filtered monthly items for "${selectedCat}": ${filteredMonthly0001.length}`)
              console.log(`🔍 [MHPL0001] Sample filtered item:`, filteredMonthly0001[0])

              const patientsByMonth = buildMonthlySum(
                filteredMonthly0001,
                ['MONTH', 'month', 'period', 'periods'],
                ['UNIQUE_PATIENT', 'UNIQUE_PATIENTS', 'TOTAL_UNIQUE_PATIENTS']
              )
              console.log(`🔍 [MHPL0001] Patients by month:`, Array.from(patientsByMonth.entries()))

              const months0001 = sortMonthKeysAsc(Array.from(patientsByMonth.keys()))
              const latestMonth0001 = months0001.length > 0 ? months0001[months0001.length - 1] : null
              const latestPatients0001 = latestMonth0001 ? (patientsByMonth.get(latestMonth0001) || 0) : (getNumericValue(totals.TOTAL_UNIQUE_PATIENTS) || 0)

              console.log(`🔍 [MHPL0001] Latest month: ${latestMonth0001}, Latest patients: ${latestPatients0001}`)
              console.log(`🔍 [MHPL0001] Totals from API: ${getNumericValue(totals.TOTAL_UNIQUE_PATIENTS)}`)

              // KPI 2: Patient Revisit Rate
              // For revisit rate, compute latest month (REVISIT_COUNT / UNIQUE_PATIENT)
              const revisitRateByMonth = buildMonthlyRatio(
                filteredMonthly0001,
                ['MONTH', 'month', 'period', 'periods'],
                ['REVISIT_COUNT', 'TOTAL_REVISIT_COUNT'],
                ['UNIQUE_PATIENT', 'UNIQUE_PATIENTS', 'TOTAL_UNIQUE_PATIENTS']
              )
              const monthsRev = sortMonthKeysAsc(Array.from(revisitRateByMonth.keys()))
              const latestRevMonth = monthsRev.length > 0 ? monthsRev[monthsRev.length - 1] : null
              if (!latestRevMonth) {
                console.warn('[MHPL0001] No monthly series for revisit rate; falling back to totals if available.')
              }
              const latestRevisitRate = latestRevMonth ? (revisitRateByMonth.get(latestRevMonth) || 0) : 0

              let avgRevisit = latestRevisitRate
              const avgFromTotals = getNumericValue((totals as any).AVERAGE_REVISIT_RATE)
              if (avgFromTotals) {
                avgRevisit = avgFromTotals > 1 ? avgFromTotals / 100 : avgFromTotals
              }
              realKPIs.push({
                id: 'patient-revisit-rate',
                title: 'Patient Revisit Rate',
                value: `${(avgRevisit * 100).toFixed(1)}%`,
                icon: 'RefreshCw',
                color: 'green',
                hoverData: {
                  'Total Unique Patients': getNumericValue(totals.TOTAL_UNIQUE_PATIENTS).toLocaleString(),
                  'Revisit Count': getNumericValue(totals.TOTAL_REVISIT_COUNT ?? 0).toLocaleString()
                },
                localFilters: formattedPatCat ? [
                  {
                    label: 'Patient Type',
                    value: formattedPatCat,
                    onEdit: () => {
                      console.log('🔧 [FILTER] Edit Patient Type filter')
                      alert('Filter editing will be implemented in the global filter system')
                    },
                    onRemove: () => {
                      console.log('🗑️ [FILTER] Remove Patient Type filter')
                      alert('Filter removal will update the API call with all patient types')
                    }
                  }
                ] : [],
                onClick: () => {
                  // Pass apiData (wrapped) - modal expects apiData.data.totals structure
                  setPatientData(apiData)
                }
              })
              // If monthly series missing, fall back to totals.AVERAGE_REVISIT_RATE
              try {
                if (!latestRevMonth) {
                  const idx = realKPIs.findIndex(k => k.id === 'patient-revisit-rate')
                  if (idx >= 0) {
                    const avgTotals = getNumericValue((totals as any).AVERAGE_REVISIT_RATE)
                    const asFraction = avgTotals > 1 ? avgTotals / 100 : avgTotals
                    if (asFraction > 0) {
                      (realKPIs[idx] as any).value = `${(asFraction * 100).toFixed(1)}%`
                    } else {
                      const totalRev = getNumericValue((totals as any).TOTAL_REVISIT_COUNT ?? (totals as any).REVISIT_COUNT)
                      const totalUniq = getNumericValue((totals as any).TOTAL_UNIQUE_PATIENTS ?? (totals as any).UNIQUE_PATIENTS ?? (totals as any).UNIQUE_PATIENT)
                      const derived = totalUniq > 0 ? totalRev / Math.abs(totalUniq) : 0
                        ; (realKPIs[idx] as any).value = `${(derived * 100).toFixed(1)}%`
                    }
                  }
                }
              } catch (e) { console.warn('[MHPL0001] Monthly series fallback failed', e) }
              // Guarantee Patient Revisit KPI exists using totals fallback when monthly series is missing
              try {
                const exists = realKPIs.some(k => k.id === 'patient-revisit-rate')
                if (!exists) {
                  const avgTotals = getNumericValue((totals as any).AVERAGE_REVISIT_RATE)
                  const asFraction = avgTotals > 1 ? avgTotals / 100 : avgTotals
                  let finalRate = asFraction
                  if (!finalRate || !isFinite(finalRate)) {
                    const totalRev = getNumericValue((totals as any).TOTAL_REVISIT_COUNT ?? (totals as any).REVISIT_COUNT)
                    const totalUniq = getNumericValue((totals as any).TOTAL_UNIQUE_PATIENTS ?? (totals as any).UNIQUE_PATIENTS ?? (totals as any).UNIQUE_PATIENT)
                    finalRate = totalUniq > 0 ? totalRev / Math.abs(totalUniq) : 0
                  }
                  realKPIs.push({
                    id: 'patient-revisit-rate',
                    title: 'Patient Revisit Rate',
                    value: `${((finalRate || 0) * 100).toFixed(1)}%`,
                    icon: 'RefreshCw',
                    color: 'green',
                    hoverData: {
                      'Total Unique Patients': getNumericValue(totals.TOTAL_UNIQUE_PATIENTS).toLocaleString(),
                      'Revisit Count': getNumericValue(totals.TOTAL_REVISIT_COUNT ?? 0).toLocaleString()
                    },
                    localFilters: formattedPatCat ? [
                      {
                        label: 'Patient Type',
                        value: formattedPatCat
                      }
                    ] : [],
                    onClick: () => { setPatientData(apiData) }
                  })
                }
              } catch (e) { console.warn('[MHPL0001] KPI construction fallback failed', e) }
            }
            break

          case 'mhpl0007':
            // Bed Occupancy Rate - 1 KPI
            try {
              const totals = (actualData?.totals as any) || {}
              const alerts = (actualData?.alerts as any) || {}

              const occupancyRate = getNumericValue(
                totals.occupancy_rate ?? totals.OCCUPANCY_RATE ?? 0
              )

              const totalBeds = getNumericValue(
                totals.total_beds ?? totals.TOTAL_BEDS ?? 0
              )
              const occupiedBeds = getNumericValue(
                totals.occupied_beds ?? totals.OCCUPIED_BEDS ?? 0
              )
              const availableBeds = getNumericValue(
                totals.available_beds ?? totals.AVAILABLE_BEDS ?? 0
              )
              const unavailableBeds = getNumericValue(
                totals.unavailable_beds ?? totals.UNAVAILABLE_BEDS ?? 0
              )

              // Threshold from store override if available
              const thresholdStr = endpointOverrides?.['mhpl0007']?.Threshold || '70'
              const thresholdNum = getNumericValue(thresholdStr)

              // Optional alert if below standard
              const occupancyBelow = String(alerts.occupancy_below_standard || '').toLowerCase() === 'true'
              const alertMessage = alerts.message || ''
              const alertBlock = totalBeds > 0 ? {
                message: alertMessage || `Current ${Math.round(occupancyRate)}% vs threshold ${thresholdNum}%`,
                threshold: thresholdNum,
                currentValue: occupancyRate
              } : undefined

              realKPIs.push({
                id: 'bed-occupancy',
                title: 'Bed Occupancy Rate',
                value: `${Math.round(occupancyRate)}%`,
                icon: 'BedDouble',
                color: 'red',
                hoverData: {
                  'Total Beds': totalBeds.toLocaleString(),
                  'Occupied': occupiedBeds.toLocaleString(),
                  'Available': availableBeds.toLocaleString(),
                  'Unavailable': unavailableBeds.toLocaleString()
                },
                alert: occupancyBelow ? alertBlock : undefined,
                localFilters: [
                  {
                    label: 'Threshold',
                    value: `${thresholdNum}%`
                  }
                ],
                onClick: () => {
                  setBedData(apiData)
                }
              })
            } catch (e) { console.error('[MHPL0007] Bed Occupancy processing failed', e) }
            break

          case 'mhpl0002':
            // Payroll Total Expense - 3 KPIs
            const pTotals = actualData?.totals || []

            if (pTotals && (Array.isArray(pTotals) || typeof pTotals === 'object')) {
              let grandTotal = 0
              let totalSalary = 0
              let totalAllowance = 0
              let hasGrandTotalFromArray = false
              let hasGrandTotalFromObject = false

              if (Array.isArray(pTotals)) {
                const grandTotalItem = pTotals.find((t: any) =>
                  t.Expense_Type === 'Grand_Total_Expense' ||
                  t.EXPENSE_TYPE === 'Grand_Total_Expense'
                )
                const salaryItem = pTotals.find((t: any) =>
                  t.Expense_Type === 'Total_Salary' ||
                  t.EXPENSE_TYPE === 'Total_Salary'
                )
                const allowanceItem = pTotals.find((t: any) =>
                  t.Expense_Type === 'Total_Allowance' ||
                  t.EXPENSE_TYPE === 'Total_Allowance'
                )

                hasGrandTotalFromArray = !!grandTotalItem
                grandTotal = getNumericValue(grandTotalItem?.Total_Amount || grandTotalItem?.TOTAL_AMOUNT || 0)
                totalSalary = getNumericValue(salaryItem?.Total_Amount || salaryItem?.TOTAL_AMOUNT || 0)
                totalAllowance = getNumericValue(allowanceItem?.Total_Amount || allowanceItem?.TOTAL_AMOUNT || 0)
              } else if (typeof pTotals === 'object') {
                const rawGrand = (pTotals as any).grand_total_expense ?? (pTotals as any).Grand_Total_Expense
                hasGrandTotalFromObject = rawGrand !== null && rawGrand !== undefined && String(rawGrand).trim() !== ''
                grandTotal = getNumericValue(rawGrand || 0)
                totalSalary = getNumericValue((pTotals as any).total_salary || (pTotals as any).Total_Salary || 0)
                totalAllowance = getNumericValue((pTotals as any).total_allowance || (pTotals as any).Total_Allowance || 0)
              }

              // Also derive latest month values from summaryByPeriod.monthly
              let latestMonthExp = grandTotal
              let latestMonthSal = totalSalary
              let latestMonthAll = totalAllowance
              try {
                const monthly = actualData?.summaryByPeriod?.monthly?.items || []
                const expMap = new Map<string, number>()
                const salMap = new Map<string, number>()
                const allMap = new Map<string, number>()
                for (const it of monthly) {
                  const m = normalizeMonthKey(it?.periods || it?.MONTH || it?.month)
                  if (!m) continue
                  const exp = getNumericValue(it?.total_expense || it?.grand_total_expense)
                  expMap.set(m, (expMap.get(m) || 0) + exp)
                  const departments = it?.departments?.items || []
                  for (const dept of departments) {
                    const cats = dept?.categories || []
                    for (const cat of cats) {
                      const nm = String(cat?.category || '').toLowerCase()
                      const amt = getNumericValue(cat?.amount || 0)
                      if (nm === 'salary') salMap.set(m, (salMap.get(m) || 0) + amt)
                      if (nm === 'allowance') allMap.set(m, (allMap.get(m) || 0) + amt)
                    }
                  }
                }
                const months = sortMonthKeysAsc(Array.from(expMap.keys()))
                const latest = months.length > 0 ? months[months.length - 1] : null
                if (latest) {
                  latestMonthExp = expMap.get(latest) || latestMonthExp
                  latestMonthSal = salMap.get(latest) || latestMonthSal
                  latestMonthAll = allMap.get(latest) || latestMonthAll
                }
              } catch (e) { console.warn('[MHPL0002] Monthly calc failed', e) }

              // KPI 3: Total Payroll Expense
              const shouldShowPayrollExpense = hasGrandTotalFromObject || hasGrandTotalFromArray
              if (shouldShowPayrollExpense) {
                realKPIs.push({
                  id: 'payroll-expense',
                  title: 'Total Payroll Expense',
                  value: grandTotal,
                  icon: 'Briefcase',
                  color: 'purple',
                  // TODO: Implement real MoM calculation
                  // change: 15.2,
                  // trend: 'up',
                  hoverData: {
                    'Total Salary': `৳${totalSalary.toLocaleString()}`,
                    'Total Allowance': `৳${totalAllowance.toLocaleString()}`
                  },
                  onClick: () => {
                    // Opens PayrollBreakdownModal via page handler
                    setPayrollData(actualData)
                  }
                })
              }

              // KPI 4: Total Salary
              if (totalSalary > 0) {
                realKPIs.push({
                  id: 'total-salary',
                  title: 'Total Salary',
                  value: latestMonthSal,
                  icon: 'TrendingUp',
                  color: 'blue',
                  // TODO: Implement real MoM calculation
                  // change: 10.8,
                  // trend: 'up',
                  hoverData: {
                    'Allowance': `৳${totalAllowance.toLocaleString()}`,
                    'Grand Total': `৳${grandTotal.toLocaleString()}`
                  },
                  onClick: () => {
                    setPayrollData(actualData)
                  }
                })
              }

              // KPI 5: Total Allowance
              if (totalAllowance > 0) {
                realKPIs.push({
                  id: 'total-allowance',
                  title: 'Total Allowance',
                  value: latestMonthAll,
                  icon: 'Briefcase',
                  color: 'orange',
                  // TODO: Implement real MoM calculation
                  // change: 5.6,
                  // trend: 'up',
                  hoverData: {
                    'Salary': `৳${totalSalary.toLocaleString()}`,
                    'Grand Total': `৳${grandTotal.toLocaleString()}`
                  },
                  onClick: () => {
                    setPayrollData(actualData)
                  }
                })
              }
            }
            break

          case 'mhpl0003':
            // Geographic Distribution - 1 KPI
            // ⚡ FIX: Check multiple paths for input parameters (same as mhpl0002)
            try {
              const input = (kpiResult?.data?._metadata?.requestedParameters) ||
                (kpiResult?.data?.input_parameters) ||
                (apiData?.input_parameters) ||
                (kpiResult?.input_parameters) ||
                {}

              const input_parameters = {
                start_date: String(input.StartDate || input.start_date || input.start_Date || ''),
                end_date: String(input.EndDate || input.end_date || input.end_Date || ''),
                patient_categories: String(input.PatCat || input.patient_categories || ''),
                district: [],
                page_number: Number(input.PageNumber || input.Page_Number || input.page_number || 1),
                page_size: Number(input.PageSize || input.Page_Size || input.page_size || 10)
              }
              validateMHPL0003Response({ status: 'success', code: 'OK', input_parameters, data: actualData } as any)
            } catch (e) {
              console.warn('[MHPL0003] Invalid schema; skipping Geographic KPI.', e)
              break
            }
            const groupByLocation = Array.isArray(actualData?.groupByLocation)
              ? actualData?.groupByLocation
              : (actualData?.groupByLocation?.items || [])

            if (groupByLocation.length > 0) {
              let totalGeographicPatients = 0

              groupByLocation.forEach((division: any) => {
                if (division.DISTRICTS && Array.isArray(division.DISTRICTS)) {
                  division.DISTRICTS.forEach((district: any) => {
                    totalGeographicPatients += getNumericValue(district.PATIENT_COUNT || 0)
                  })
                }
              })

              const divisionsCount = groupByLocation.length
              const districtsCount = groupByLocation.reduce((count: number, location: any) =>
                count + (location.DISTRICTS?.length || 0), 0)

              // KPI 6: Total Districts
              realKPIs.push({
                id: 'geographic-distribution',
                title: 'Total Districts',
                value: districtsCount || 0,
                icon: 'MapPin',
                color: 'red',
                // TODO: Implement real MoM calculation
                // change: 18.4,
                // trend: 'up',
                hoverData: {
                  'Divisions Covered': divisionsCount.toString(),
                  'Districts': districtsCount.toString(),
                  'Total Patients': totalGeographicPatients.toLocaleString()
                },
                onClick: () => {
                  setGeographicData(actualData)
                },
                localFilters: []
              })
            }
            break

          case 'mhpl0004':
            // Patient Spending Analysis - 1 KPI
            console.log('🔍 [MHPL0004] actualData:', actualData)
            console.log('🔍 [MHPL0004] groupBySpendingCategory:', actualData?.groupBySpendingCategory)
            console.log('🔍 [MHPL0004] totals:', actualData?.totals)
            const groupBySpendingCategory = actualData?.groupBySpendingCategory || []

            if (groupBySpendingCategory.length > 0) {
              let totalPatientSpending = 0

              if (Array.isArray(groupBySpendingCategory)) {
                totalPatientSpending = groupBySpendingCategory.reduce((total: number, category: any) =>
                  total + getNumericValue(category.TOTAL_BILLED_AMOUNT || 0), 0)
              }

              const categoriesCount = Array.isArray(groupBySpendingCategory) ? groupBySpendingCategory.length : 0
              const avgCategory = categoriesCount > 0 ? Math.floor(totalPatientSpending / categoriesCount) : 0

              // Read local filter from store (endpointOverrides) for instant updates and transparency
              const patientType = endpointOverrides?.['mhpl0004']?.PatCat || 'IPD'

              // Format patient type for display (keep uppercase)
              const formatPatientType = (type: any) => {
                if (!type) return ''
                if (Array.isArray(type)) {
                  return type.join(', ').toUpperCase()
                }
                if (typeof type === 'string') {
                  return type.split(',').map((t: string) => t.trim().toUpperCase()).join(', ')
                }
                return String(type).toUpperCase()
              }

              const formattedPatientType = formatPatientType(patientType)

              // Prefer totals.TOTAL_BILLED_AMOUNT if provided by API
              let billedFromTotals = 0
              try {
                const totals = actualData?.totals
                if (Array.isArray(totals) && totals.length > 0) {
                  billedFromTotals = getNumericValue(totals[0]?.TOTAL_BILLED_AMOUNT || totals[0]?.total_billed_amount || 0)
                } else if (totals && typeof totals === 'object') {
                  billedFromTotals = getNumericValue((totals as any)?.TOTAL_BILLED_AMOUNT || (totals as any)?.total_billed_amount || 0)
                }
              } catch (e) { console.warn('[MHPL0004] Totals calc failed', e) }

              // Fallback: derive latest month billed amount if totals absent
              let latestBilled = totalPatientSpending
              try {
                const monthly = flattenMonthlyItems(actualData?.groupByMonth)
                const billedMap = buildMonthlySum(
                  monthly,
                  ['MONTH', 'month', 'period', 'periods'],
                  ['TOTAL_BILLED_AMOUNT', 'total_billed_amount']
                )
                const months = sortMonthKeysAsc(Array.from(billedMap.keys()))
                const latest = months.length > 0 ? months[months.length - 1] : null
                if (latest) latestBilled = billedMap.get(latest) || latestBilled
              } catch (e) { console.warn('[MHPL0004] Monthly calc failed', e) }

              const kpiValue = billedFromTotals > 0 ? billedFromTotals : latestBilled

              // KPI 7: Total Patient Spending (mapped to totals.TOTAL_BILLED_AMOUNT when present)
              realKPIs.push({
                id: 'total-patient-spending',
                title: 'Total Patient Spending',
                value: kpiValue,
                icon: 'CreditCard',
                color: 'purple',
                // TODO: Implement real MoM calculation
                // change: 22.7,
                // trend: 'up',
                hoverData: {
                  'Spending Categories': categoriesCount.toString(),
                  'Average Category': `৳${avgCategory.toLocaleString()}`
                },
                onClick: () => {
                  setSpendingData(apiData)
                },
                localFilters: formattedPatientType ? [
                  {
                    label: 'Patient Type',
                    value: formattedPatientType,
                    onEdit: () => {
                      console.log('🔧 [FILTER] Edit Patient Type filter for MHPL0004')
                      alert('Filter editing will be implemented in the global filter system')
                    },
                    onRemove: () => {
                      console.log('🗑️ [FILTER] Remove Patient Type filter for MHPL0004')
                      alert('Filter removal will update the API call with all patient types')
                    }
                  }
                ] : [],
              })
            }
            break

          case 'mhpl0005':
            // Consultant Revenue Analysis - 1 KPI
            if (actualData?.groupByConsultant || actualData?.totals) {
              const consultantData = actualData.groupByConsultant?.[0]
              // Prefer totals.total_revenue (or TOTAL_REVENUE) for KPI value
              let revenueFromTotals = 0
              try {
                const t = Array.isArray(actualData?.totals) ? actualData?.totals?.[0] : (actualData?.totals as any)
                revenueFromTotals = getNumericValue(t?.total_revenue ?? t?.TOTAL_REVENUE ?? 0)
              } catch (e) { console.warn('[MHPL0005] Totals calc failed', e) }
              // Fallback to summing items if totals missing
              const totalRevenue = revenueFromTotals > 0
                ? revenueFromTotals
                : (consultantData?.items?.reduce((sum: number, item: any) => sum + getNumericValue(item.total_revenue || 0), 0) || 0)

              if (totalRevenue > 0) {
                // Read local filter from store (endpointOverrides) for instant updates and transparency
                const serviceTypes = endpointOverrides?.['mhpl0005']?.ServiceTypes || 'IPD'

                // Format service types for display (keep uppercase)
                const formatServiceTypes = (types: any) => {
                  if (!types) return ''
                  if (Array.isArray(types)) {
                    return types.join(', ').toUpperCase()
                  }
                  if (typeof types === 'string') {
                    return types.split(',').map((t: string) => t.trim().toUpperCase()).join(', ')
                  }
                  return String(types).toUpperCase()
                }

                const formattedServiceTypes = formatServiceTypes(serviceTypes)

                // Latest month revenue if available (secondary fallback for display)
                let latestRevenue = totalRevenue
                try {
                  const monthly = flattenMonthlyItems(actualData?.groupByMonth)
                  const revMap = buildMonthlySum(monthly, ['MONTH', 'month', 'period', 'periods'], ['daily_revenue', 'total_revenue', 'revenue'])
                  const months = sortMonthKeysAsc(Array.from(revMap.keys()))
                  const latest = months.length > 0 ? months[months.length - 1] : null
                  if (latest) latestRevenue = revMap.get(latest) || latestRevenue
                } catch (e) { console.warn('[MHPL0005] Monthly calc failed', e) }

                const kpiValue = revenueFromTotals > 0 ? revenueFromTotals : latestRevenue

                // KPI 8: Consultant Revenue (mapped to totals.total_revenue when present)
                realKPIs.push({
                  id: 'consultant-revenue',
                  title: 'Consultant Revenue',
                  value: kpiValue,
                  icon: 'UserCheck',
                  color: 'purple',
                  // TODO: Implement real MoM calculation
                  // change: 18.7,
                  // trend: 'up',
                  hoverData: {
                    'Total Consultants': (consultantData?.items?.length || 0).toString(),
                    'Avg Revenue': `৳${Math.floor((revenueFromTotals > 0 ? revenueFromTotals : totalRevenue) / ((consultantData?.items?.length || 1))).toLocaleString()}`
                  },
                  onClick: () => {
                    setConsultantData(apiData)
                  },
                  localFilters: formattedServiceTypes ? [
                    {
                      label: 'Service Type',
                      value: formattedServiceTypes,
                      onEdit: () => {
                        console.log('🔧 [FILTER] Edit Service Type filter for MHPL0005')
                        alert('Filter editing will be implemented in the global filter system')
                      },
                      onRemove: () => {
                        console.log('🗑️ [FILTER] Remove Service Type filter for MHPL0005')
                        alert('Filter removal will update the API call with all service types')
                      }
                    }
                  ] : [],
                })
              }
            }
            break

          case 'mhpl0006':
            // Insurance Claims - 1 KPI (live data only)
            try {
              const providersGroup = actualData?.groupByInsuranceProvider?.[0]
              const totalClaims = Array.isArray(providersGroup?.items)
                ? providersGroup.items.reduce(
                  (sum: number, item: any) =>
                    sum + getNumericValue(item.claim_count ?? item.CLAIM_COUNT ?? 0),
                  0
                )
                : 0

              const totals = (actualData?.totals as any) || {}
              const totalClaimedAmount = getNumericValue(
                totals.total_claimed_amount ?? totals.TOTAL_CLAIMED_AMOUNT ?? 0
              )
              const totalPendingReceivable = getNumericValue(
                totals.total_pending_receivable ?? totals.TOTAL_PENDING_RECEIVABLE ?? 0
              )

              if (totalClaims > 0 || totalClaimedAmount > 0) {
                const providerRaw =
                  endpointOverrides?.['mhpl0006']?.InsuranceProviders || 'MetLife Alico'
                const deptRaw = endpointOverrides?.['mhpl0006']?.Department || ''

                const formatList = (v: any) =>
                  Array.isArray(v)
                    ? v.join(', ')
                    : String(v)
                      .split(',')
                      .map((s) => s.trim())
                      .join(', ')

                const providerLabel = formatList(providerRaw)
                const deptLabel = deptRaw ? formatList(deptRaw) : ''

                realKPIs.push({
                  id: 'insurance-claims',
                  title: 'Insurance Claims',
                  value: totalClaims || totalClaimedAmount,
                  icon: 'CreditCard',
                  color: 'purple',
                  hoverData: {
                    'Total Claims': totalClaims.toLocaleString(),
                    'Claimed Amount': totalClaimedAmount.toLocaleString(),
                    'Pending Receivable': totalPendingReceivable.toLocaleString(),
                  },
                  localFilters: [
                    { label: 'Insurance Providers', value: providerLabel },
                    ...(deptLabel ? [{ label: 'Department', value: deptLabel }] : []),
                  ],
                  onClick: () => {
                    setInsuranceData(apiData)
                  },
                })
              }
            } catch (e) { console.error('[MHPL0006] Insurance calc failed', e) }
            break

          case 'mhpl0008':
            // Employee Performance - 1 KPI (align with drilldown's department-based aggregation)
            try {
              let totalPresentDays = 0
              let totalWorkingDays = 0
              let totalEmployees = 0

              const deptGroups = Array.isArray(actualData?.groupByDepartment) ? actualData.groupByDepartment : []
              const deptItems = deptGroups.flatMap((g: any) => Array.isArray(g?.items) ? g.items : [])

              if (deptItems.length > 0) {
                for (const dept of deptItems) {
                  const empCount = getNumericValue((dept as any)?.total_employees ?? 0)
                  const avgPresent = getNumericValue((dept as any)?.average_present_days ?? 0)
                  const nestedGroups = Array.isArray((dept as any)?.employees) ? (dept as any).employees : []
                  const nestedEmployees = nestedGroups.flatMap((eg: any) => Array.isArray(eg?.items) ? eg.items : [])
                  const sampleWorking = nestedEmployees.length > 0 ? getNumericValue(nestedEmployees[0]?.working_days ?? 0) : 0
                  // Match drilldown: round per-department estimated totals before summing
                  const deptPresent = Math.round(avgPresent * empCount)
                  const deptWorking = Math.round(sampleWorking * empCount)
                  totalPresentDays += deptPresent
                  totalWorkingDays += deptWorking
                  totalEmployees += empCount
                }
              } else if (actualData?.groupByEmployee) {
                const empGroup = actualData.groupByEmployee[0]
                const employees = empGroup?.items || []
                totalEmployees = employees.length
                for (const emp of employees) {
                  if (!emp) continue
                  const presentDays = getNumericValue((emp?.present_days as any) ?? 0)
                  const workingDays = getNumericValue((emp?.working_days as any) ?? 0)
                  totalPresentDays += presentDays
                  totalWorkingDays += workingDays
                }
              }

              const attendancePercentage = totalWorkingDays > 0 ? (totalPresentDays / totalWorkingDays) * 100 : 0

              if (totalEmployees > 0) {
                realKPIs.push({
                  id: 'employee-attendance',
                  title: 'Average Attendance Percentage',
                  value: `${Math.round(attendancePercentage)}%`,
                  icon: 'Users2',
                  color: 'purple',
                  // TODO: Implement real MoM calculation
                  // change: 15.2,
                  // trend: 'up',
                  hoverData: {
                    'Total Employees': totalEmployees.toString(),
                    'Present Days': totalPresentDays.toLocaleString(),
                    'Total Working Days': totalWorkingDays.toLocaleString(),
                    'Average Attendance Percentage': `${Math.round(attendancePercentage)}%`
                  },
                  onClick: () => {
                    setPerformanceData(apiData)
                  },
                  localFilters: [],
                })
              }
            } catch (e) { console.error('[MHPL0008] Employee Attendance calc failed', e) }
            break

          case 'mhpl0009':
            // Medicine Waste Value - 1 KPI
            try {
              const totals = (actualData?.totals as any) || {}
              const totalLossValue = getNumericValue(
                totals.total_loss_value ?? totals.TOTAL_LOSS_VALUE ?? 0
              )

              // Local filter badge for categories
              const catRaw = endpointOverrides?.['mhpl0009']?.medicine_categories || 'tablet'
              const formatCats = (v: any) => Array.isArray(v) ? v.join(', ').toUpperCase() : String(v).split(',').map(s => s.trim().toUpperCase()).join(', ')
              const catLabel = formatCats(catRaw)

              // Show KPI only when totals.total_loss_value exists and is > 0
              if (totalLossValue > 0) {
                realKPIs.push({
                  id: 'medicine-waste',
                  title: 'Medicine Waste Value',
                  value: totalLossValue,
                  icon: 'Package',
                  color: 'orange',
                  hoverData: {
                    'Expired Value': (getNumericValue(totals.total_expired_value ?? 0)).toLocaleString(),
                    'Wasted Value': (getNumericValue(totals.total_wasted_value ?? 0)).toLocaleString(),
                    'Total Quantity': (getNumericValue(totals.total_loss_quantity ?? 0)).toLocaleString()
                  },
                  localFilters: catLabel ? [{ label: 'Medicine Categories', value: catLabel }] : [],
                  onClick: () => { setMedicineData(apiData) }
                })
              }
            } catch (e) { console.error('[MHPL0009] Medicine Waste calc failed', e) }
            break

          case 'mhpl0010':
            // Employee Salary (Overall) - 1 KPI
            try {
              const totals = (actualData?.totals as any) || {}
              const overallSalary = getNumericValue(
                totals.overall_salary ?? totals.OVERALL_SALARY ?? 0
              )
              const totalEmployees = getNumericValue(
                totals.total_employees ?? totals.TOTAL_EMPLOYEES ?? 0
              )
              // Local filter chips for transparency/editing
              const deptChip = (endpointOverrides?.['mhpl0010']?.Departments ?? 'billing, monthly') as any
              const empTypeChip = (endpointOverrides?.['mhpl0010']?.EmpType ?? 'worker') as any
              const summTypeChip = (endpointOverrides?.['mhpl0010']?.SummType ?? 'Monthly') as any

              // Show KPI only when overall_salary exists (> 0)
              if (overallSalary > 0) {
                realKPIs.push({
                  id: 'employee-salary',
                  title: 'Total Employee Salary',
                  value: overallSalary,
                  icon: 'DollarSign',
                  color: 'blue',
                  hoverData: {
                    'Total Employees': totalEmployees.toLocaleString()
                  },
                  localFilters: [
                    { label: 'Departments', value: String(deptChip) },
                    { label: 'Emp Type', value: String(empTypeChip).toUpperCase() },
                    { label: 'Summ Type', value: String(summTypeChip) }
                  ],
                  onClick: () => { setEmployeeData(apiData) }
                })
              }
            } catch (e) { console.error('[MHPL0010] Employee Salary calc failed', e) }
            break
        }
      } catch (error) {
        console.error(`❌ [DASHBOARD] Error processing ${endpointId}:`, error)
      }
    }

    // Fallback: ensure core KPIs are present even if API returns sparse data
    const ensureKpi = (id: string, build: () => any) => {
      if (!realKPIs.some(k => k.id === id)) {
        try { realKPIs.push(build()) } catch (e) { console.warn('ensureKpi build failed for', id, e) }
      }
    }

    if (!onlyEndpointId) ensureKpi('patient-revisit-rate', () => ({
      id: 'patient-revisit-rate',
      title: 'Patient Revisit Rate',
      value: '0.0%',
      icon: 'RefreshCw',
      color: 'green'
    }))

    // Intentionally no fallback for payroll-expense: hide when totals.grand_total_expense is null

    if (!onlyEndpointId) ensureKpi('geographic-distribution', () => ({
      id: 'geographic-distribution',
      title: 'Total Districts',
      value: 0,
      icon: 'MapPin',
      color: 'red'
    }))

    if (!onlyEndpointId) ensureKpi('total-patient-spending', () => ({
      id: 'total-patient-spending',
      title: 'Total Patient Spending',
      value: 0,
      icon: 'CreditCard',
      color: 'purple'
    }))

    // Intentionally no fallback for employee-salary: hide when totals.overall_salary is null or 0

    // Always render dashboard even if 0 KPIs; do not block with error UI (full loads only)
    if (!onlyEndpointId) {
      if (realKPIs.length > 0) {
        console.log(`✅ [DASHBOARD] Successfully loaded ${realKPIs.length} KPIs from database`)
      } else {
        console.warn("[DASHBOARD] No KPI cards could be derived from data. Showing empty grid.")
      }
    }
    setKpiData(realKPIs)
    setLoading(false)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ [DASHBOARD] Failed to load data:', errorMessage)
    setError(errorMessage)
    setLoading(false)
  }
}

// Alias for clarity — this function fetches live KPI data now
export const loadKPIDataLive = loadKPIDataFromDatabase
