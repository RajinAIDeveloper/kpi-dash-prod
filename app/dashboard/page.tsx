'use client'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState, useRef, startTransition, memo } from 'react'
import { useFilterState } from '@/components/filters/FilterStateProvider'
import { useDashboardStore } from '@/lib/store/dashboard-store'
import { useRouter } from 'next/navigation'
import {
  Users,
  RefreshCw,
  ArrowLeft,
  BarChart3,
  AlertCircle,
  MapPin,
  Briefcase,
  UserCheck,
  Receipt,
  DollarSign,
  TrendingUp,
  CreditCard,
  BedDouble,
  Users2,
  Package,
  X,
  Edit2
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { callMHPL_API_WithValidation } from '@/lib/api/mhplApi'
import { ensureGlobalToken } from '@/lib/auth/ensureToken'
import { useMhplEndpointQuery } from '@/lib/hooks/useMhplEndpointQuery'
import { Button } from '@/components/ui/button'
import { SkeletonCard } from '@/components/ui/skeleton-card'
// KPI data is loaded live from APIs; no database reads/writes here

// ⚡ PERFORMANCE: Modals loaded ONLY when opened (not upfront!)
// These dynamic() calls create code-split chunks that load on-demand
const PatientDrillDownModal = dynamic(() => import('../../components/drill-down/PatientDrillDownModal'), { ssr: false, loading: () => <div className="p-4">Loading...</div> })
const PayrollBreakdownModal = dynamic(() => import('@/components/drill-down/PayrollBreakdownModal').then(m => ({ default: m.PayrollBreakdownModal })), { ssr: false, loading: () => <div className="p-4">Loading...</div> })
const GeographicDrillDownModal = dynamic(() => import('@/components/drill-down/GeographicDrillDownModal').then(m => ({ default: m.GeographicDrillDownModal })), { ssr: false, loading: () => <div className="p-4">Loading...</div> })
const SpendingAnalysisModal = dynamic(() => import('@/components/drill-down/SpendingAnalysisModal').then(m => ({ default: m.SpendingAnalysisModal })), { ssr: false, loading: () => <div className="p-4">Loading...</div> })
const ConsultantRevenueModal = dynamic(() => import('@/components/drill-down/ConsultantRevenueModal').then(m => ({ default: m.ConsultantRevenueModal })), { ssr: false, loading: () => <div className="p-4">Loading...</div> })
const InsuranceClaimsModal = dynamic(() => import('@/components/drill-down/InsuranceClaimsModal').then(m => ({ default: m.InsuranceClaimsModal })), { ssr: false, loading: () => <div className="p-4">Loading...</div> })
const BedOccupancyModal = dynamic(() => import('@/components/drill-down/BedOccupancyModal').then(m => ({ default: m.BedOccupancyModal })), { ssr: false, loading: () => <div className="p-4">Loading...</div> })
const EmployeePerformanceModal = dynamic(() => import('@/components/drill-down/EmployeePerformanceModal').then(m => ({ default: m.EmployeePerformanceModal })), { ssr: false, loading: () => <div className="p-4">Loading...</div> })
const MedicineWasteModal = dynamic(() => import('@/components/drill-down/MedicineWasteModal').then(m => ({ default: m.MedicineWasteModal })), { ssr: false, loading: () => <div className="p-4">Loading...</div> })
const EmployeeSalaryModal = dynamic(() => import('@/components/drill-down/EmployeeSalaryModal').then(m => ({ default: m.EmployeeSalaryModal })), { ssr: false, loading: () => <div className="p-4">Loading...</div> })

// Modern UI Components
const GradientText = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent ${className}`}>
    {children}
  </span>
)

interface MetricCardProps {
  title: string
  value: string | number
  icon: React.ComponentType<any>
  color: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'emerald'
  change?: number
  trend?: 'up' | 'down'
  onClick?: () => void
  hoverData?: Record<string, string>
  alert?: {
    message: string
    threshold: number
    currentValue: number
  }
  localFilters?: Array<{
    label: string
    value: string
    onEdit?: () => void
    onRemove?: () => void
  }>
  momDebug?: {
    prevMonth: string
    currMonth: string
    prevDisplay: string
    currDisplay: string
    momDisplay: string
    formula: string
  }
  isUpdating?: boolean
  onDebug?: () => void
}

// Collapsible filter chips: shows first chip by default; expand to show all
const CollapsibleFilterChips = ({ localFilters }: { localFilters: Array<{ label: string; value: string; onEdit?: () => void; onRemove?: () => void }> }) => {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? localFilters : localFilters.slice(0, 1)
  const hiddenCount = Math.max(localFilters.length - visible.length, 0)

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((filter, idx) => (
        <div
          key={`${filter.label}-${idx}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-md text-xs group hover:bg-blue-100 transition-colors"
        >
          <span className="font-medium text-blue-700">{filter.label}:</span>
          <span className="text-blue-900 font-semibold">{filter.value}</span>
          {filter.onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); filter.onEdit?.() }}
              className="ml-1 p-0.5 hover:bg-blue-200 rounded transition-colors"
              title="Edit filter"
            >
              <Edit2 className="w-3 h-3 text-blue-600" />
            </button>
          )}
          {filter.onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); filter.onRemove?.() }}
              className="ml-0.5 p-0.5 hover:bg-red-100 rounded transition-colors"
              title="Remove filter"
            >
              <X className="w-3 h-3 text-red-600" />
            </button>
          )}
        </div>
      ))}
      {localFilters.length > 1 && !expanded && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(true) }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs hover:bg-gray-100"
          title="Show more filters"
        >
          Show {hiddenCount} more
        </button>
      )}
      {localFilters.length > 1 && expanded && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(false) }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs hover:bg-gray-100"
          title="Hide extra filters"
        >
          Hide
        </button>
      )}
    </div>
  )
}

const MetricCardBase = ({
  title,
  value,
  icon: Icon,
  color,
  change,
  trend,
  onClick,
  hoverData,
  alert,
  localFilters,
  momDebug,
  isUpdating,
  onDebug
}: MetricCardProps) => {
  const [showCalc, setShowCalc] = useState(false)
  const [alertExpanded, setAlertExpanded] = useState(false)
  const iconBgColors = {
    blue: 'bg-blue-50',
    green: 'bg-emerald-50',
    orange: 'bg-orange-50',
    red: 'bg-rose-50',
    purple: 'bg-purple-50',
    emerald: 'bg-emerald-50'
  }

  const iconColors = {
    blue: 'text-blue-600',
    green: 'text-emerald-600',
    orange: 'text-orange-600',
    red: 'text-rose-600',
    purple: 'text-purple-600',
    emerald: 'text-emerald-600'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative overflow-hidden rounded-lg bg-white border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 h-full"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 via-purple-50/0 to-pink-50/0 group-hover:from-blue-50/50 group-hover:via-purple-50/30 group-hover:to-pink-50/20 transition-all duration-500 pointer-events-none" />

      {isUpdating && (
        <div className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 text-white text-[10px] shadow">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Updating
        </div>
      )}

      <div className="relative p-3 space-y-2.5">
        {/* Removed hover debug panel in favor of Show calc toggle */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={cn("p-1.5 rounded-lg flex-shrink-0", iconBgColors[color])}>
              <Icon className={cn("w-4 h-4", iconColors[color])} />
            </div>
            <h3 className="font-semibold text-gray-900 text-xs leading-tight">
              {title}
            </h3>
          </div>
          {onDebug && (
            <button
              type="button"
              className="text-[10px] text-gray-500 hover:text-gray-800 underline decoration-dotted"
              title="View raw JSON"
              onClick={(e) => { e.stopPropagation(); onDebug?.() }}
            >
              Data
            </button>
          )}
        </div>

        {/* Local Filters Display */}
        {localFilters && localFilters.length > 0 && (
          <CollapsibleFilterChips localFilters={localFilters} />
        )}

        <div className="space-y-1">
          <div className="text-2xl font-bold text-gray-900 tracking-tight">
            {formatValue(value)}
          </div>

          {/* {change !== undefined && trend && (
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full",
                trend === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              )}>
                {trend === 'up' ? (
                  <span className="text-sm">↑</span>
                ) : (
                  <span className="text-sm">↓</span>
                )}
                <span className="text-sm font-semibold">
                  {Math.abs(change)}%
                </span>
              </div>
              <span className="text-sm text-gray-600">vs last month</span>
              {momDebug && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowCalc((s) => !s) }}
                  className="text-xs text-blue-600 underline decoration-dotted underline-offset-2 hover:text-blue-800"
                  title="Show calculation"
                >
                  {showCalc ? 'Hide calc' : 'Show calc'}
                </button>
              )}
            </div>
          )} */}
        </div>

        {/* Alert message (e.g., Bed Occupancy below threshold) */}
        {alert && (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {(() => {
                  const msg = alert.message || `Current ${alert.currentValue}% vs threshold ${alert.threshold}%`
                  const needsToggle = (msg?.length || 0) > 90 || (msg || '').includes('\n')
                  return (
                    <div className="flex items-start gap-2">
                      <p className={alertExpanded ? 'whitespace-normal' : 'truncate whitespace-nowrap overflow-hidden text-ellipsis'} title={!alertExpanded ? msg : undefined}>
                        {msg}
                      </p>
                      {needsToggle && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setAlertExpanded(v => !v) }}
                          className="shrink-0 text-amber-700 hover:text-amber-900 underline decoration-dotted underline-offset-2"
                        >
                          {alertExpanded ? 'Less' : 'More'}
                        </button>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        )}

        {showCalc && momDebug && (
          <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2 text-[10px] text-gray-800">
            <div className="font-semibold text-gray-900 mb-1">Calculation</div>
            <div className="grid grid-cols-1 gap-1">
              <div>
                <span className="text-gray-600">Current Month: </span>
                <span className="font-semibold">{momDebug.currMonth}: {momDebug.currDisplay}</span>
              </div>
              <div>
                <span className="text-gray-600">Previous Month: </span>
                <span className="font-semibold">{momDebug.prevMonth}: {momDebug.prevDisplay}</span>
              </div>
              <div>
                <span className="text-gray-600">MoM Change: </span>
                <span className="font-semibold">{momDebug.momDisplay}</span>
              </div>
              <div>
                <span className="text-gray-600">Formula: </span>
                <span className="font-mono">{momDebug.formula}</span>
              </div>
            </div>
          </div>
        )}

        {onClick ? (
          <button
            onClick={onClick}
            className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-medium text-xs transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <BarChart3 className="w-3 h-3" />
            <span>View Details</span>
          </button>
        ) : (
          <button
            disabled
            className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-300 text-gray-600 rounded-lg font-medium text-xs cursor-not-allowed"
          >
            <BarChart3 className="w-3 h-3" />
            <span>View Details</span>
          </button>
        )}
      </div>
    </motion.div>
  )
}

// Memoize KPI card to avoid unnecessary re-renders when props don’t change
const MetricCard = memo(MetricCardBase)

const formatValue = (val: string | number | undefined) => {
  if (val === undefined || val === null) return '0'

  if (typeof val === 'number') {
    // Always render numbers as plain, localized numbers (no auto-currency)
    return val.toLocaleString()
  }

  if (typeof val === 'string') {
    // Respect already-formatted currency/percent strings
    if (val.includes('৳') || val.includes('%')) {
      return val
    }
    const num = Number(val)
    if (!isNaN(num)) {
      return num.toLocaleString()
    }
  }

  return val.toString()
}

const getNumericValue = (value: any): number => {
  const num = Number(value)
  return isNaN(num) ? 0 : num
}

export default function DashboardPage() {
  const router = useRouter()
  const { globalFilters, hasLoadedPreset } = useFilterState()
  const { setEndpointOverride, endpointOverrides, kpiData, setKpiData, updatingKpiIds, setUpdatingKpiIds, setError, error } = useDashboardStore()
  const [loading, setLoading] = useState(true)
  const loadingInProgress = useRef(false) // Guard to prevent concurrent loads
  const [refreshing, setRefreshing] = useState(false)
  const [progress, setProgress] = useState<number>(0)
  const [progressLabel, setProgressLabel] = useState<string>('Initializing…')

  // (Date controls moved to GlobalFilterBar in layout)

  // Modal states
  const [showPatientDrillDown, setShowPatientDrillDown] = useState(false)
  const [showPayrollDrillDown, setShowPayrollDrillDown] = useState(false)
  const [showGeographicDrillDown, setShowGeographicDrillDown] = useState(false)
  const [showSpendingDrillDown, setShowSpendingDrillDown] = useState(false)
  const [showConsultantDrillDown, setShowConsultantDrillDown] = useState(false)
  const [showInsuranceDrillDown, setShowInsuranceDrillDown] = useState(false)
  const [showBedDrillDown, setShowBedDrillDown] = useState(false)
  const [showEmployeePerformanceDrillDown, setShowEmployeePerformanceDrillDown] = useState(false)
  const [showMedicineWasteDrillDown, setShowMedicineWasteDrillDown] = useState(false)
  const [showEmployeeDrillDown, setShowEmployeeDrillDown] = useState(false)
  const [silentReloading, setSilentReloading] = useState(false)
  // JSON debug modal state
  const [showJsonModal, setShowJsonModal] = useState(false)
  const [jsonModalTitle, setJsonModalTitle] = useState('')
  const [jsonModalPayload, setJsonModalPayload] = useState<any>(null)
  const [jsonModalLoading, setJsonModalLoading] = useState(false)
  const [jsonModalError, setJsonModalError] = useState<string | null>(null)
  const [debugEndpointId, setDebugEndpointId] = useState<string | null>(null)
  const [kickoffDone, setKickoffDone] = useState(false)

  // Map endpoint -> KPI IDs used in this grid
  const endpointToKpis = useMemo(() => ({
    mhpl0001: ['total-patients', 'patient-revisit-rate'],
    mhpl0002: ['payroll-expense', 'total-salary', 'total-allowance'],
    mhpl0003: ['geographic-distribution'],
    mhpl0004: ['total-patient-spending'],
    mhpl0005: ['consultant-revenue'],
    mhpl0006: ['insurance-claims'],
    mhpl0007: ['bed-occupancy'],
    mhpl0008: ['employee-attendance'],
    mhpl0009: ['medicine-waste'],
    mhpl0010: ['employee-salary']
  } as Record<string, string[]>), [])

  // Desired KPI ordering for dashboard grid
  const kpiOrder = useMemo(() => [
    'patient-revisit-rate',
    'payroll-expense',
    'geographic-distribution',
    'total-patient-spending',
    'consultant-revenue',
    'employee-salary',
    'insurance-claims',
    'bed-occupancy',
    'employee-attendance',
    'medicine-waste'
  ], [])
  const orderIndex = useMemo(() => Object.fromEntries(kpiOrder.map((id, i) => [id, i])), [kpiOrder])
  const orderSet = useMemo(() => new Set(kpiOrder), [kpiOrder])
  const sortAndFilterKpis = useCallback((list: any[]) => {
    // Filter to only known KPIs, then de-duplicate by id to prevent React key collisions
    const filtered = list.filter(k => orderSet.has(k.id))
    const uniqueById = Array.from(new Map(filtered.map(k => [k.id, k])).values())
    return uniqueById.sort((a, b) => (orderIndex[a.id] ?? 999) - (orderIndex[b.id] ?? 999))
  }, [orderIndex, orderSet])

  // Data states for modals
  const [patientData, setPatientData] = useState<any>(null)
  const [payrollData, setPayrollData] = useState<any>(null)
  const [geographicData, setGeographicData] = useState<any>(null)
  const [spendingData, setSpendingData] = useState<any>(null)
  const [consultantData, setConsultantData] = useState<any>(null)
  const [insuranceData, setInsuranceData] = useState<any>(null)
  const [bedData, setBedData] = useState<any>(null)
  const [performanceData, setPerformanceData] = useState<any>(null)
  const [medicineData, setMedicineData] = useState<any>(null)
  const [employeeData, setEmployeeData] = useState<any>(null)
  // Edit modal state for KPI local filters
  const [showFilterEdit, setShowFilterEdit] = useState(false)
  const [filterEditConfig, setFilterEditConfig] = useState<{
    endpointId: string
    kpiId: string
    label: string
    key: string
    type: 'dropdown' | 'text' | 'number'
    options?: string[]
    value: string
  } | null>(null)

  // ⚡ PERFORMANCE: Lazy-load modals ONLY when user clicks (saves ~400KB initial bundle)
  const openPatientModal = useCallback((data: any) => {
    setPatientData(data)
    setShowPatientDrillDown(true)
  }, [])

  const openPayrollModal = useCallback((data: any) => {
    setPayrollData(data)
    setShowPayrollDrillDown(true)
  }, [])

  const openGeographicModal = useCallback((data: any) => {
    setGeographicData(data)
    setShowGeographicDrillDown(true)
  }, [])

  const openSpendingModal = useCallback((data: any) => {
    setSpendingData(data)
    setShowSpendingDrillDown(true)
  }, [])

  const openConsultantModal = useCallback((data: any) => {
    setConsultantData(data)
    setShowConsultantDrillDown(true)
  }, [])

  const openInsuranceModal = useCallback((data: any) => {
    setInsuranceData(data)
    setShowInsuranceDrillDown(true)
  }, [])

  const openBedModal = useCallback((data: any) => {
    setBedData(data)
    setShowBedDrillDown(true)
  }, [])

  const openPerformanceModal = useCallback((data: any) => {
    setPerformanceData(data)
    setShowEmployeePerformanceDrillDown(true)
  }, [])

  const openMedicineModal = useCallback((data: any) => {
    setMedicineData(data)
    setShowMedicineWasteDrillDown(true)
  }, [])

  const openEmployeeModal = useCallback((data: any) => {
    setEmployeeData(data)
    setShowEmployeeDrillDown(true)
  }, [])

  // ⚡ PERFORMANCE: Stale-while-revalidate - Load cached data instantly
  const loadKPIData = async () => {
    // Guard: Prevent concurrent loads that cause infinite loop
    if (loadingInProgress.current) {
      console.warn('[DASHBOARD] Load already in progress, skipping duplicate call')
      return
    }

    loadingInProgress.current = true
    console.log('[DASHBOARD] Starting initial data load...')

    // ⚡ OPTIMISTIC UI: Try to load cached data FIRST (instant!)
    let hasCachedData = false
    try {
      const cached = localStorage.getItem('kpi-dashboard-cache')
      if (cached) {
        const { data: cachedKpis, timestamp } = JSON.parse(cached)
        const age = Date.now() - timestamp

        // Use cache if < 5 minutes old
        if (age < 5 * 60 * 1000 && Array.isArray(cachedKpis) && cachedKpis.length > 0) {
          console.log(`[DASHBOARD] ⚡ Loading cached KPIs instantly (age: ${Math.round(age / 1000)}s)`)
          setKpiData(cachedKpis)
          setLoading(false)
          hasCachedData = true
          // Continue to fetch fresh data in background
        }
      }
    } catch (error) {
      console.warn('[DASHBOARD] Failed to load cache:', error)
    }

    // Ensure UI shows progress and avoid infinite spinner on failures
    if (!hasCachedData) {
      setLoading(true)
    }
    let loaded = false
    let tick: any
    try {
      const { loadKPIDataLive } = await import('./loadKPIDataNew')

      // Wrapper functions that set data and open modals
      const handleSetPatientData = (data: any) => {
        setPatientData(data)
        setShowPatientDrillDown(true)
      }

      const handleSetPayrollData = (data: any) => {
        setPayrollData(data)
        setShowPayrollDrillDown(true)
      }

      const handleSetGeographicData = (data: any) => {
        setGeographicData(data)
        setShowGeographicDrillDown(true)
      }

      const handleSetSpendingData = (data: any) => {
        setSpendingData(data)
        setShowSpendingDrillDown(true)
      }

      const handleSetConsultantData = (data: any) => {
        setConsultantData(data)
        setShowConsultantDrillDown(true)
      }

      const handleSetInsuranceData = (data: any) => {
        setInsuranceData(data)
        setShowInsuranceDrillDown(true)
      }

      const handleSetBedData = (data: any) => {
        setBedData(data)
        setShowBedDrillDown(true)
      }

      const handleSetPerformanceData = (data: any) => {
        setPerformanceData(data)
        setShowEmployeePerformanceDrillDown(true)
      }

      const handleSetMedicineData = (data: any) => {
        setMedicineData(data)
        setShowMedicineWasteDrillDown(true)
      }

      const handleSetEmployeeData = (data: any) => {
        setEmployeeData(data)
        setShowEmployeeDrillDown(true)
      }

      const setKpiDataTransition = (data: any[]) => {
        // Set immediately - enforce stable ordering & selection
        setKpiData(sortAndFilterKpis(data))
      }

      // Step 1: Load global filters
      try {
        setProgressLabel('Loading global filters…')
        setProgress(5)
        // Wait briefly for presets to load, but do not block long
        const startWait = Date.now()
        while (!hasLoadedPreset && Date.now() - startWait < 800) {
          await new Promise(r => setTimeout(r, 80))
        }

        // CRITICAL: Sync DashboardStore with FilterStateProvider after filters load
        if (globalFilters.startDate && globalFilters.endDate) {
          console.log('[DASHBOARD] Syncing DashboardStore with loaded filters:', globalFilters)
          useDashboardStore.getState().updateGlobalFilter('startDate', globalFilters.startDate)
          useDashboardStore.getState().updateGlobalFilter('endDate', globalFilters.endDate)

          // VERIFY sync worked by reading back
          const storeState = useDashboardStore.getState().globalFilters
          console.log('[DASHBOARD] Verification - DashboardStore now has:', {
            startDate: storeState.startDate,
            endDate: storeState.endDate
          })

          if (storeState.startDate !== globalFilters.startDate || storeState.endDate !== globalFilters.endDate) {
            console.error('❌ [DASHBOARD] SYNC FAILED! Store dates do not match FilterStateProvider!')
            console.error('Expected:', globalFilters)
            console.error('Got:', storeState)
          } else {
            console.log('✅ [DASHBOARD] Both stores synchronized correctly before API calls')
          }
        } else {
          console.warn('⚠️ [DASHBOARD] No dates to sync - FilterStateProvider has no dates yet')
        }
      } catch { }

      // Step 2: Ensure token available (generate or use cached)
      try {
        setProgressLabel('Ensuring authentication token…')
        setProgress(12)
        const result = await ensureGlobalToken()
        if (result.token) {
          console.log('[DASHBOARD] Auth token resolved from', result.source)
        } else {
          console.warn('[DASHBOARD] Failed to acquire auth token; continuing, some API calls may fail')
        }
        // Small delay to keep UI smooth
        await new Promise(r => setTimeout(r, 60))
        setProgress(18)
      } catch { }

      // Step 3: Fetch live data from API endpoints (all 10 endpoints in parallel)
      // Smoothly increase progress while waiting for API responses
      setProgressLabel('Fetching live data from API endpoints…')
      setProgress(25)
      let t = 0
      tick = setInterval(() => {
        t += 1
        setProgress(p => Math.min(90, p + 2))
      }, 120)

      // Final: Build KPI cards from live API data (single pass)
      setProgressLabel('Preparing dashboard KPIs…')
      await loadKPIDataLive(
        setKpiDataTransition,
        setError,
        setLoading,
        openGeographicModal,
        openEmployeeModal,
        openPayrollModal,
        openPatientModal,
        openSpendingModal,
        openConsultantModal,
        openInsuranceModal,
        openBedModal,
        openPerformanceModal,
        openMedicineModal,
        (endpointId: string) => useDashboardStore.getState().getApiParameters(endpointId),
        endpointOverrides,
        (label: string, percent: number) => { setProgressLabel(label); setProgress(percent) },
        (endpointId: string, key: string, value: string) => useDashboardStore.getState().setEndpointOverride(endpointId, key, value)
      )
      if (tick) clearInterval(tick)
      setProgress(100)
      loaded = true

      // ⚡ PERFORMANCE: Cache freshly loaded data for next visit
      // Use a slight delay to ensure kpiData state has been updated
      setTimeout(() => {
        try {
          const currentKpis = useDashboardStore.getState().kpiData
          if (Array.isArray(currentKpis) && currentKpis.length > 0) {
            localStorage.setItem('kpi-dashboard-cache', JSON.stringify({
              data: currentKpis,
              timestamp: Date.now()
            }))
            console.log(`[DASHBOARD] ✅ Cached ${currentKpis.length} KPIs for instant future loads`)
          }
        } catch (error) {
          console.warn('[DASHBOARD] Failed to cache KPIs:', error)
        }
      }, 100)
    } catch (e) {
      console.error('[DASHBOARD] Failed to import or load KPI data:', e)
      setError(e instanceof Error ? e.message : 'Failed to load dashboard data')
    } finally {
      if (tick) clearInterval(tick)
      // Safety net: if inner loader didn't flip loading off, do it here
      if (!loaded) setLoading(false)
      // Reset guard so page can be reloaded if needed
      loadingInProgress.current = false
      console.log('[DASHBOARD] Initial data load complete')
    }
  }

  // Refresh KPI data without showing full loading screen (for filter changes)
  const refreshKPIData = useCallback(async (onlyEndpointId?: string) => {
    try {
      console.log('🔄 [DASHBOARD] Refreshing KPI data (no loading screen)...')

      // Mark relevant KPIs as updating
      const idsToUpdate = onlyEndpointId ? (endpointToKpis[onlyEndpointId] || []) : kpiData.map(kpi => kpi.id)
      setUpdatingKpiIds(new Set(idsToUpdate))

      const { loadKPIDataLive } = await import('./loadKPIDataNew')

      // Get CURRENT endpointOverrides from store (not from stale closure)
      const currentOverrides = useDashboardStore.getState().endpointOverrides
      console.log('📦 [DASHBOARD] Current endpointOverrides:', JSON.stringify(currentOverrides, null, 2))

      const setKpiDataTransition = (data: any[]) => {
        console.log(`📊 [DASHBOARD] Setting KPI data - received ${data.length} KPIs`)
        console.log('📊 [DASHBOARD] First KPI:', JSON.stringify(data[0], null, 2))
        // Don't use startTransition - it defers updates and can be overwritten
        setKpiData(prev => {
          if (!onlyEndpointId) return sortAndFilterKpis(data)
          const targetIds = new Set(endpointToKpis[onlyEndpointId] || [])
          const remaining = prev.filter(k => !targetIds.has(k.id))
          return sortAndFilterKpis([...remaining, ...data])
        })
        // Clear updating state after data is set
        setUpdatingKpiIds(new Set())
        console.log('✅ [DASHBOARD] KPI data state updated IMMEDIATELY')
      }

      // Call loadKPIDataFromDatabase without loading screen
      await loadKPIDataLive(
        setKpiDataTransition,
        setError,
        () => { }, // No-op for setLoading - we don't want full screen loading
        openGeographicModal,
        openEmployeeModal,
        openPayrollModal,
        openPatientModal,
        openSpendingModal,
        openConsultantModal,
        openInsuranceModal,
        openBedModal,
        openPerformanceModal,
        openMedicineModal,
        (endpointId: string) => useDashboardStore.getState().getApiParameters(endpointId),
        currentOverrides, // Use CURRENT store value, not stale closure
        () => { }, // No-op for progress updates
        (endpointId: string, key: string, value: string) => useDashboardStore.getState().setEndpointOverride(endpointId, key, value),
        onlyEndpointId
      )
      console.log('✅ [DASHBOARD] loadKPIDataFromDatabase completed')
    } catch (e) {
      console.error('❌ [DASHBOARD] Failed to refresh KPI data:', e)
      setError(e instanceof Error ? e.message : 'Failed to refresh dashboard data')
      // Clear updating state on error
      setUpdatingKpiIds(new Set())
    }
  }, [kpiData, endpointToKpis, openGeographicModal, openEmployeeModal, openPayrollModal, openPatientModal, openSpendingModal, openConsultantModal, openInsuranceModal, openBedModal, openPerformanceModal, openMedicineModal])

  const refreshData = useCallback(() => {
    setRefreshing(true)
    console.log('🔄 [DASHBOARD] Refreshing data...')
    refreshKPIData().finally(() => setRefreshing(false))
  }, [refreshKPIData])

  useEffect(() => {
    loadKPIData()
  }, [])

  // Ensure data fetch kicks off once presets have loaded (covers direct /dashboard loads in prod)
  useEffect(() => {
    if (!kickoffDone && hasLoadedPreset) {
      setKickoffDone(true)
      refreshKPIData()
    }
  }, [kickoffDone, hasLoadedPreset, refreshKPIData])

  // Safety net: if no KPI data after initial attempts, retry once more
  useEffect(() => {
    if (kickoffDone && !loading && !refreshing && kpiData.length === 0) {
      refreshKPIData()
    }
  }, [kickoffDone, loading, refreshing, kpiData.length, refreshKPIData])

  // Listen for global filter changes broadcast from GlobalFilterBar
  useEffect(() => {
    const handler = () => {
      console.log('🔄 [DASHBOARD] Received dashboard-refresh-request event')
      refreshKPIData()
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('dashboard-refresh-request', handler as any)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('dashboard-refresh-request', handler as any)
      }
    }
  }, [refreshKPIData])

  // Debug helper: fetch live JSON for an endpoint with current filters
  const handleDebugJson = useCallback(async (endpointId: string | undefined) => {
    if (!endpointId) return
    try {
      setShowJsonModal(true)
      setJsonModalTitle(`${endpointId.toUpperCase()} JSON`)
      setJsonModalLoading(true)
      setJsonModalError(null)
      setJsonModalPayload(null)

      const base = useDashboardStore.getState().getApiParameters(endpointId)
      const overrides = endpointOverrides?.[endpointId] || {}
      const params = { ...base, ...overrides }

      const res = await callMHPL_API_WithValidation<any>(endpointId, params)
      setJsonModalPayload(res)
    } catch (err) {
      setJsonModalError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setJsonModalLoading(false)
    }
  }, [endpointOverrides])

  // PHASE 3.3: Removed double refresh event listener
  // Previously listened for 'global-refresh-complete' and called refreshData()
  // This caused unnecessary double refresh since triggerGlobalRefresh() already updates all data
  // The data updates happen via:
  //   1. triggerGlobalRefresh() calls APIs and updates data
  //   2. Individual endpoint refreshes update specific KPIs
  // No need to reload everything again after refresh completes

  // ⚡ PERFORMANCE: Don't show full-screen loading anymore
  // Instead, show skeleton loaders in-grid for better perceived performance
  // (see KPI Grid below - it shows skeletons when loading && kpiData.length === 0)

  const goBack = () => {
    router.push('/')
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load KPIs</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
              <h3 className="font-semibold text-blue-900 mb-2">Try This:</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Go back to the homepage</li>
                <li>Click "Generate Token" if needed</li>
                <li>Click "Test All APIs" to fetch data</li>
                <li>Once all APIs show ✅, return to dashboard</li>
              </ol>
            </div>
          </div>
          <button
            onClick={goBack}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-300"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go to Homepage & Test APIs</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-3 py-4 max-w-[1920px]">
        {/* Date controls moved to global layout filter bar */}
        {/* <div className="mb-8">
          <button
            onClick={goBack}
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Healthcare Analytics Dashboard
              </h1>
              <p className="text-gray-600 mt-2">
                Real-time insights from live APIs
              </p>
            </div>
            <button
              onClick={refreshData}
              disabled={refreshing}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
            </button>
          </div>
        </div> */}

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {/* ⚡ PERFORMANCE: Show skeleton loaders only when truly loading with no data */}
          {loading && kpiData.length === 0 ? (
            // Show 10 skeleton cards while initial load happens
            Array.from({ length: 10 }).map((_, index) => (
              <SkeletonCard key={`skeleton-${index}`} />
            ))
          ) : (
            // Show actual KPI cards (either cached or fresh)
            kpiData.map((kpi) => {
              const endpointId = Object.entries(endpointToKpis).find(([, ids]) => ids.includes(kpi.id))?.[0]
              let wrappedLocalFilters = (kpi.localFilters || []).map((f: any) => {
                const lf = { ...f }
                const label = String(f.label || '')
                const currentVal = String(f.value || '')
                let needsModal = false
                let key = '' as string
                let type: 'dropdown' | 'text' | 'number' = 'text'
                let options: string[] | undefined
                if (endpointId === 'mhpl0001' && label === 'Patient Type') { needsModal = true; key = 'PatCat'; type = 'dropdown'; options = ['INPATIENT', 'OUTPATIENT', 'INPATIENT,OUTPATIENT'] }
                if (endpointId === 'mhpl0003' && label === 'Patient Type') { needsModal = true; key = 'PatCat'; type = 'dropdown'; options = ['IPD', 'OPD'] }
                if (endpointId === 'mhpl0004' && label === 'Patient Type') { needsModal = true; key = 'PatCat'; type = 'dropdown'; options = ['IPD', 'OPD', 'IPD,OPD'] }
                if (endpointId === 'mhpl0005' && label === 'Service Type') { needsModal = true; key = 'ServiceTypes'; type = 'dropdown'; options = ['IPD', 'OPD', 'IPD,OPD'] }
                if (endpointId === 'mhpl0006' && label === 'Insurance Providers') { needsModal = true; key = 'InsuranceProviders'; type = 'text' }
                if (endpointId === 'mhpl0007' && label === 'Threshold') { needsModal = true; key = 'Threshold'; type = 'number' }
                if (endpointId === 'mhpl0009' && label === 'Medicine Categories') { needsModal = true; key = 'medicine_categories'; type = 'text' }
                // Employee Salary (mhpl0010) editable chips
                if (endpointId === 'mhpl0010' && label === 'Departments') { needsModal = true; key = 'Departments'; type = 'text' }
                if (endpointId === 'mhpl0010' && label === 'Emp Type') { needsModal = true; key = 'EmpType'; type = 'text' }
                if (endpointId === 'mhpl0010' && label === 'Summ Type') { needsModal = true; key = 'SummType'; type = 'dropdown'; options = ['Monthly', 'Quarterly', 'Yearly'] }
                if (needsModal) {
                  lf.onRemove = undefined
                  // Read badge value directly from store (source of truth) for instant updates
                  const storeValue = endpointOverrides?.[endpointId || '']?.[key]

                  // Format the store value for display based on filter type
                  if (storeValue !== undefined && endpointId) {
                    const formatValue = (val: string, filterKey: string): string => {
                      // Threshold needs % suffix
                      if (filterKey === 'Threshold') return `${val}%`
                      // PatCat, ServiceTypes, InsuranceProviders need uppercase
                      if (['PatCat', 'ServiceTypes', 'EmpType'].includes(filterKey)) return String(val).toUpperCase()
                      // Others return as-is
                      return String(val)
                    }
                    lf.value = formatValue(String(storeValue), key)
                  }

                  lf.onEdit = () => {
                    if (!endpointId) return
                    // Use store value for editing (not stale currentVal)
                    const editValue = storeValue !== undefined ? String(storeValue) : currentVal
                    setFilterEditConfig({ endpointId, kpiId: kpi.id, label, key, type, options, value: editValue })
                    setShowFilterEdit(true)
                  }
                }
                return lf
              })
              // Ensure mhpl0003 always shows Patient Type chip with default IPD if missing
              if (endpointId === 'mhpl0003') {
                const hasPatientType = wrappedLocalFilters.some((f: any) => String(f.label).toLowerCase() === 'patient type')
                if (!hasPatientType) {
                  const key = 'PatCat'
                  const type: 'dropdown' = 'dropdown'
                  const options = ['IPD', 'OPD']
                  const storeValue = endpointOverrides?.['mhpl0003']?.[key] || 'IPD'
                  const value = String(storeValue).toUpperCase()
                  wrappedLocalFilters = [
                    ...wrappedLocalFilters,
                    {
                      label: 'Patient Type',
                      value,
                      onEdit: () => {
                        const editValue = storeValue ? String(storeValue) : 'IPD'
                        setFilterEditConfig({ endpointId: 'mhpl0003', kpiId: kpi.id, label: 'Patient Type', key, type, options, value: editValue })
                        setShowFilterEdit(true)
                      }
                    }
                  ]
                }
              }
              return (
                <MetricCard
                  key={kpi.id}
                  title={kpi.title}
                  value={kpi.value}
                  icon={
                    kpi.icon === 'Users' ? Users :
                      kpi.icon === 'DollarSign' ? DollarSign :
                        kpi.icon === 'MapPin' ? MapPin :
                          kpi.icon === 'Briefcase' ? Briefcase :
                            kpi.icon === 'UserCheck' ? UserCheck :
                              kpi.icon === 'Receipt' ? Receipt :
                                kpi.icon === 'RefreshCw' ? RefreshCw :
                                  kpi.icon === 'TrendingUp' ? TrendingUp :
                                    kpi.icon === 'CreditCard' ? CreditCard :
                                      kpi.icon === 'BedDouble' ? BedDouble :
                                        kpi.icon === 'Users2' ? Users2 :
                                          kpi.icon === 'Package' ? Package :
                                            Users
                  }
                  color={kpi.color}
                  change={kpi.change}
                  trend={kpi.trend}
                  onClick={kpi.onClick}
                  hoverData={kpi.hoverData}
                  alert={kpi.alert}
                  localFilters={wrappedLocalFilters}
                  momDebug={kpi.momDebug}
                  isUpdating={updatingKpiIds.has(kpi.id)}
                  onDebug={() => handleDebugJson(endpointId)}
                />
              )
            })
          )}
        </div>

        {showFilterEdit && filterEditConfig && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilterEdit(false)} />
            <div className="relative bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Edit {filterEditConfig.label}</h3>
              <p className="text-sm text-gray-600 mb-4">Changes are staged and will apply when you click Update in the Filters bar.</p>
              <div className="mb-4">
                {filterEditConfig.type === 'dropdown' ? (
                  <select
                    aria-label={`Edit ${filterEditConfig.label || 'value'}`}
                    title={filterEditConfig.label || 'Select value'}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={filterEditConfig.value}
                    onChange={(e) => setFilterEditConfig({ ...filterEditConfig, value: e.target.value })}
                  >
                    {(filterEditConfig.options || []).map(opt => (<option key={opt} value={opt}>{opt}</option>))}
                  </select>
                ) : (
                  <input
                    aria-label={`Edit ${filterEditConfig.label || 'value'}`}
                    placeholder={filterEditConfig.label || 'Enter value'}
                    title={filterEditConfig.label || 'Enter value'}

                    type={filterEditConfig.type === 'number' ? 'number' : 'text'}
                    min={filterEditConfig.type === 'number' ? 0 : undefined}
                    max={filterEditConfig.type === 'number' ? 100 : undefined}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={filterEditConfig.value}
                    onChange={(e) => setFilterEditConfig({ ...filterEditConfig, value: e.target.value })}
                  />
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md" onClick={() => setShowFilterEdit(false)}>Cancel</button>
                <button className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md" onClick={async () => {
                  if (!filterEditConfig) return
                  const ep = filterEditConfig.endpointId
                  const key = filterEditConfig.key
                  const val = String(filterEditConfig.value).trim()

                  console.log(`[FILTER_CHANGE] Updating ${ep}.${key} to "${val}"`)

                  // Update store first - badge updates instantly from store
                  setEndpointOverride(ep, key, val)
                  setShowFilterEdit(false)

                  // Refresh only the affected endpoint to update KPI values
                  console.log('[FILTER_CHANGE] Refreshing only affected endpoint...')
                  refreshKPIData(ep)
                }}>Save</button>
              </div>
            </div>
          </div>
        )}

        {kpiData.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No KPI Data Available</h3>
            <p className="text-gray-600">No KPIs could be derived from live API calls. Ensure start/end dates are set and authentication token is valid.</p>
          </div>
        )}
      </div>

      {/* JSON Debug Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowJsonModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl border border-gray-200 w-[90vw] max-w-5xl max-h-[80vh] p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">{jsonModalTitle}</h3>
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100"
                  onClick={() => {
                    const text = jsonModalPayload ? JSON.stringify(jsonModalPayload, null, 2) : (jsonModalError || '')
                    try { navigator.clipboard.writeText(text) } catch { }
                  }}>Copy</button>
                <button className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100" onClick={() => setShowJsonModal(false)}>Close</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50 border border-gray-200 rounded p-3">
              {jsonModalLoading ? (
                <div className="text-sm text-gray-600">Loading JSON…</div>
              ) : jsonModalError ? (
                <div className="text-sm text-rose-600">{jsonModalError}</div>
              ) : (
                <pre className="text-xs text-gray-800 whitespace-pre-wrap break-words">{JSON.stringify(jsonModalPayload, null, 2)}</pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ⚡ PERFORMANCE: Only render (and load) modals when user actually opens them */}
      {showPatientDrillDown && (
        <PatientDrillDownModal
          isOpen={showPatientDrillDown}
          onClose={() => setShowPatientDrillDown(false)}
          data={patientData}
          endpointId="mhpl0001"
          currentValue={patientData?.totals?.[0]?.TOTAL_UNIQUE_PATIENTS || 0}
        />
      )}

      {showPayrollDrillDown && (
        <PayrollBreakdownModal
          isOpen={showPayrollDrillDown}
          onClose={() => setShowPayrollDrillDown(false)}
          data={payrollData}
          endpointId="mhpl0002"
          currentValue={payrollData?.totals?.grand_total_expense || 0}
        />
      )}

      {showGeographicDrillDown && (
        <GeographicDrillDownModal
          isOpen={showGeographicDrillDown}
          onClose={() => setShowGeographicDrillDown(false)}
          data={geographicData}
          endpointId="mhpl0003"
          currentValue={0}
        />
      )}

      {showSpendingDrillDown && (
        <SpendingAnalysisModal
          isOpen={showSpendingDrillDown}
          onClose={() => setShowSpendingDrillDown(false)}
          data={spendingData}
          endpointId="mhpl0004"
          currentValue={spendingData?.data?.totals?.[0]?.TOTAL_BILLED_AMOUNT || 0}
        />
      )}

      {showConsultantDrillDown && (
        <ConsultantRevenueModal
          isOpen={showConsultantDrillDown}
          onClose={() => setShowConsultantDrillDown(false)}
          data={consultantData}
          endpointId="mhpl0005"
          currentValue={0}
        />
      )}

      {showInsuranceDrillDown && (
        <InsuranceClaimsModal
          isOpen={showInsuranceDrillDown}
          onClose={() => setShowInsuranceDrillDown(false)}
          data={insuranceData}
          endpointId="mhpl0006"
          currentValue={0}
        />
      )}

      {showBedDrillDown && (
        <BedOccupancyModal
          isOpen={showBedDrillDown}
          onClose={() => setShowBedDrillDown(false)}
          data={bedData}
          endpointId="mhpl0007"
          currentValue={0}
        />
      )}

      {showEmployeePerformanceDrillDown && (
        <EmployeePerformanceModal
          isOpen={showEmployeePerformanceDrillDown}
          onClose={() => setShowEmployeePerformanceDrillDown(false)}
          data={performanceData}
          endpointId="mhpl0008"
          currentValue={0}
        />
      )}

      {showMedicineWasteDrillDown && (
        <MedicineWasteModal
          isOpen={showMedicineWasteDrillDown}
          onClose={() => setShowMedicineWasteDrillDown(false)}
          data={medicineData}
          endpointId="mhpl0009"
          currentValue={0}
        />
      )}

      {showEmployeeDrillDown && (
        <EmployeeSalaryModal
          isOpen={showEmployeeDrillDown}
          onClose={() => setShowEmployeeDrillDown(false)}
          data={employeeData}
          endpointId="mhpl0010"
          currentValue={employeeData?.totals?.overall_salary || 0}
        />
      )}
    </div>
  )
}
