// app/page.tsx - Amazing Modern Homepage with Token Management & Manual API Testing
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useFilterState } from '@/components/filters/FilterStateProvider'
import { useDashboardStore } from '@/lib/store/dashboard-store'
import { TokenStorage } from '@/lib/tokenStorage'

const isDev = process.env.NODE_ENV === 'development'
import { callMHPL_API_WithValidation } from '@/lib/api/mhplApi'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  BarChart3,
  MapPin,
  CreditCard,
  Users,
  TrendingUp,
  Briefcase,
  LogIn,
  TestTube,
  Play,
  Shield,
  Activity,
  Zap,
  Globe,
  Lock,
  Unlock,
  ChevronRight,
  Clock,
  Server,
  Cpu,
  AlertTriangle,
  CheckSquare,
  UserCheck,
  TestTube2,
  BedDouble,
  Users2,
  Receipt,
  Package,
  Stethoscope,
  DollarSign
} from 'lucide-react'
import toast from 'react-hot-toast'

// ============= TOKEN MANAGEMENT (LOCALSTORAGE ONLY) =============
// Client-side auth utilities (adapted from v5 auth.ts)
const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('mhpl_token')
}

const isTokenExpired = (): boolean => {
  const expiresAt = localStorage.getItem('mhpl_token_expires')
  if (!expiresAt) return true
  return Date.now() > parseInt(expiresAt)
}

const getTokenTimeRemaining = (): string => {
  const expiresAt = localStorage.getItem('mhpl_token_expires')
  if (!expiresAt) return 'Unknown'

  const now = Date.now()
  const expiry = parseInt(expiresAt)
  const remaining = Math.max(0, expiry - now)

  const hours = Math.floor(remaining / (1000 * 60 * 60))
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

const setStoredToken = (token: string, expiresIn: string = '24Hrs'): void => {
  if (typeof window === 'undefined') return

  // Store token in the shared TokenStorage used by all API clients
  try {
    TokenStorage.save(token)
  } catch {
    // Fallback to localStorage-only path if TokenStorage fails
  }

  // Backwards-compatible storage for existing UI
  localStorage.setItem('mhpl_token', token)

  // Try to extract expiry from JWT payload first
  try {
    const payloadBase64 = token.split('.')[1]
    const payload = JSON.parse(atob(payloadBase64))

    if (payload.exp) {
      // JWT exp is in seconds, convert to milliseconds
      const expiresAt = payload.exp * 1000
      localStorage.setItem('mhpl_token_expires', expiresAt.toString())
      console.log('✅ [TOKEN] Extracted expiry from JWT:', new Date(expiresAt).toISOString())
      return
    }
  } catch (error) {
    console.log('⚠️ [TOKEN] Could not extract expiry from JWT, using default')
  }

  // Fallback: Calculate expiry time from expiresIn parameter
  let expiryMs: number
  if (expiresIn.includes('Hrs')) {
    const hours = parseInt(expiresIn) || 24
    expiryMs = hours * 60 * 60 * 1000
  } else {
    expiryMs = 24 * 60 * 60 * 1000 // Default to 24 hours
  }

  const expiresAt = Date.now() + expiryMs
  localStorage.setItem('mhpl_token_expires', expiresAt.toString())
}

const clearStoredToken = (): void => {
  if (typeof window === 'undefined') return
  localStorage.removeItem('mhpl_token')
  localStorage.removeItem('mhpl_token_expires')
}

// API State Types
interface MHPL0001State {
  status: 'idle' | 'checking' | 'success' | 'error'
  checkedAt?: Date
  message?: string
  totalPatients?: number
  revisitRate?: number
  error?: string
}

interface MHPL0002State {
  status: 'idle' | 'checking' | 'success' | 'error'
  checkedAt?: Date
  message?: string
  totalExpense?: number
  error?: string
}

interface MHPL0003State {
  status: 'idle' | 'checking' | 'success' | 'error'
  checkedAt?: Date
  message?: string
  totalGeographic?: number
  error?: string
}

interface MHPL0004State {
  status: 'idle' | 'checking' | 'success' | 'error'
  checkedAt?: Date
  message?: string
  totalSpending?: number
  error?: string
}

interface MHPL0005State {
  status: 'idle' | 'checking' | 'success' | 'error'
  checkedAt?: Date
  message?: string
  totalRevenue?: number
  error?: string
}

interface MHPL0006State {
  status: 'idle' | 'checking' | 'success' | 'error'
  checkedAt?: Date
  message?: string
  totalClaims?: number
  error?: string
}

interface MHPL0007State {
  status: 'idle' | 'checking' | 'success' | 'error'
  checkedAt?: Date
  message?: string
  totalBeds?: number
  error?: string
}

interface MHPL0008State {
  status: 'idle' | 'checking' | 'success' | 'error'
  checkedAt?: Date
  message?: string
  totalEmployees?: number
  error?: string
}

interface MHPL0009State {
  status: 'idle' | 'checking' | 'success' | 'error'
  checkedAt?: Date
  message?: string
  totalWaste?: number
  error?: string
}

interface MHPL0010State {
  status: 'idle' | 'checking' | 'success' | 'error'
  checkedAt?: Date
  message?: string
  totalSalary?: number
  error?: string
}

interface StoredKPIRecord {
  endpointId: string
  data?: any
  fetchedAt?: string
  inputParameters?: Record<string, any>
  status?: string
}

// Auth State Type
interface AuthResult {
  token: string
  expiresAt: string
  success: boolean
}

// Type definitions
interface StatusConfig {
  bg: string
  text: string
  border: string
  icon: React.ComponentType<any>
  label: string
  color: string
}

interface StatusConfigMap {
  valid: StatusConfig
  expired: StatusConfig
  checking: StatusConfig
  error: StatusConfig
}

type StatusType = keyof StatusConfigMap

// Amazing UI Components
const GradientText = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent ${className}`}>
    {children}
  </span>
)

const StatusBadge = ({ status, className = "" }: { status: StatusType; className?: string }) => {
  const statusConfig: StatusConfigMap = {
    valid: {
      bg: 'bg-gradient-to-r from-green-50 to-emerald-50',
      text: 'text-green-700',
      border: 'border-green-200',
      icon: CheckCircle2,
      label: '✅ Active',
      color: 'from-green-600 to-emerald-600'
    },
    expired: {
      bg: 'bg-gradient-to-r from-yellow-50 to-orange-50',
      text: 'text-yellow-700',
      border: 'border-yellow-200',
      icon: Clock,
      label: '⏰ Expired',
      color: 'from-yellow-600 to-orange-600'
    },
    checking: {
      bg: 'bg-gradient-to-r from-blue-50 to-indigo-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      icon: Loader2,
      label: '🔄 Checking',
      color: 'from-blue-600 to-indigo-600'
    },
    error: {
      bg: 'bg-gradient-to-r from-red-50 to-pink-50',
      text: 'text-red-700',
      border: 'border-red-200',
      icon: AlertCircle,
      label: '❌ Error',
      color: 'from-red-600 to-pink-600'
    }
  }

  const config = statusConfig[status] || statusConfig.error
  const Icon = config.icon

  return (
    <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full border ${config.bg} ${config.text} ${config.border} ${className}`}>
      {status === 'checking' ? (
        <Icon className="w-4 h-4 animate-spin" />
      ) : (
        <Icon className="w-4 h-4" />
      )}
      <span className="font-medium">{config.label}</span>
    </div>
  )
}

interface TokenDisplayProps {
  tokenInfo: {
    token: string
    expiresAt: string
    timeRemaining: string
  }
  onCopy: () => void
  onRegenerate?: () => void
}

const TokenDisplay = ({ tokenInfo, onCopy, onRegenerate }: TokenDisplayProps) => (
  <div className="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 rounded-2xl p-6 border border-purple-500/20 backdrop-blur-sm">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-2">
        <Shield className="w-5 h-5 text-purple-400" />
        <h3 className="text-white font-medium">Access Token</h3>
      </div>
      <div className="flex items-center space-x-2">
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            title="Regenerate token"
            className="p-2 text-green-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onCopy}
          title="Copy token to clipboard"
          className="p-2 text-purple-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </div>
    
    <div className="bg-black/30 rounded-lg p-4 mb-4 border border-purple-500/10">
      <p className="text-purple-300 font-mono text-sm break-all">
        {tokenInfo.token.substring(0, 20)}...{tokenInfo.token.substring(tokenInfo.token.length - 20)}
      </p>
    </div>
    
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <p className="text-purple-400">Expires</p>
        <p className="text-white font-medium">
          {new Date(tokenInfo.expiresAt).toLocaleDateString()}
        </p>
      </div>
      <div>
        <p className="text-purple-400">Time Left</p>
        <p className="text-white font-medium flex items-center">
          <Clock className="w-4 h-4 mr-1" />
          {tokenInfo.timeRemaining}
        </p>
      </div>
    </div>
  </div>
)

export default function HomePage() {
  const router = useRouter()

  // CRITICAL: Read from Zustand store (single source of truth for global filters)
  const zustandStore = useDashboardStore()
  const globalFilters = zustandStore.globalFilters
  const { hasLoadedPreset } = useFilterState()
  const [authResult, setAuthResult] = useState<AuthResult | null>(null)
  const [loading, setLoading] = useState(false)

  const [startDate, setStartDate] = useState(globalFilters.startDate ?? '')
  const [endDate, setEndDate] = useState(globalFilters.endDate ?? '')
  const lastVerifiedDatesRef = useRef<{ start: string; end: string } | null>(null)

  useEffect(() => {
    if (!hasLoadedPreset) {
      return
    }

    const nextStartDate = globalFilters.startDate ?? ''
    const nextEndDate = globalFilters.endDate ?? ''

    console.log('📅 [HOMEPAGE] Syncing dates from Zustand globalFilters:', {
      nextStartDate,
      nextEndDate,
      hasLoadedPreset,
      globalFilters,
      source: 'Zustand DashboardStore'
    })

    setStartDate(nextStartDate)
    setEndDate(nextEndDate)
  }, [hasLoadedPreset, globalFilters.startDate, globalFilters.endDate])

  // Date Validation - Check if user needs to set dates before proceeding
  const needsDateSetup = !startDate || !endDate

  // Token Management State
  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'expired' | 'error'>('checking')
  const [tokenInfo, setTokenInfo] = useState<{ token: string; expiresAt: string; timeRemaining: string } | null>(null)

  // API Testing States
  const [mhpl0001Check, setMHPL0001Check] = useState<MHPL0001State>({ status: 'idle' })
  const [mhpl0002Check, setMHPL0002Check] = useState<MHPL0002State>({ status: 'idle' })
  const [mhpl0003Check, setMHPL0003Check] = useState<MHPL0003State>({ status: 'idle' })
  const [mhpl0004Check, setMHPL0004Check] = useState<MHPL0004State>({ status: 'idle' })
  const [mhpl0005Check, setMHPL0005Check] = useState<MHPL0005State>({ status: 'idle' })
  const [mhpl0006Check, setMHPL0006Check] = useState<MHPL0006State>({ status: 'idle' })
  const [mhpl0007Check, setMHPL0007Check] = useState<MHPL0007State>({ status: 'idle' })
  const [mhpl0008Check, setMHPL0008Check] = useState<MHPL0008State>({ status: 'idle' })
  const [mhpl0009Check, setMHPL0009Check] = useState<MHPL0009State>({ status: 'idle' })
  const [mhpl0010Check, setMHPL0010Check] = useState<MHPL0010State>({ status: 'idle' })

  // JSON viewer state (guards against ReferenceError when rendering debug modal)
  const [showJsonViewer, setShowJsonViewer] = useState(false)
  const [jsonViewerData, setJsonViewerData] = useState<any | null>(null)
  const openJsonViewer = (data: any) => {
    try { setJsonViewerData(data) } catch { setJsonViewerData(null) }
    setShowJsonViewer(true)
  }
  const closeJsonViewer = () => setShowJsonViewer(false)

  // Auto-verify MHPL0001 on successful auth
  const verifyMHPL0001ApiAndTrigger = useCallback(async (token: string) => {
    lastVerifiedDatesRef.current = { start: startDate, end: endDate }
    setMHPL0001Check({ status: 'checking' })

    try {
      console.log('📅 [MHPL0001] Using dates from homepage state:', { startDate, endDate })
      console.log('📅 [MHPL0001] globalFilters from context:', globalFilters)
      console.log('🔑 [MHPL0001] Using token:', token ? token.substring(0, 20) + '...' : 'No token')
      const response = await callMHPL_API_WithValidation('mhpl0001', {
        StartDate: startDate,
        EndDate: endDate,
        PatCat: 'INPATIENT',
      }, token)

      if ((response as any).status !== 'success') {
        throw new Error(response.message || 'MHPL0001 API call failed')
      }

      const patientData = response.data

      const totals = patientData?.totals?.[0]
      setMHPL0001Check({
        status: 'success',
        checkedAt: new Date(),
        message: 'Patient Revisit API active with valid schema',
        totalPatients: totals?.TOTAL_UNIQUE_PATIENTS || 0,
        revisitRate: Math.round((totals?.AVERAGE_REVISIT_RATE || 0) * 100)
      })

      toast.success('MHPL0001: Patient Revisit Analysis verified and saved!')

      // Auto-trigger MHPL0002 after short delay
      setTimeout(() => verifyMHPL0002ApiAndTrigger(token), 1000)

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to verify MHPL0001'
      setMHPL0001Check({
        status: 'error',
        error: message
      })
      toast.error(`MHPL0001: ${message}`)
    }
  }, [startDate, endDate])

  // Re-fetch all APIs when selected dates change
  useEffect(() => {
    if (tokenStatus !== 'valid' || !tokenInfo?.token) {
      return
    }

    if (!hasLoadedPreset) {
      return
    }

    const hasDateChanged =
      !lastVerifiedDatesRef.current ||
      lastVerifiedDatesRef.current.start !== startDate ||
      lastVerifiedDatesRef.current.end !== endDate

    if (!hasDateChanged) {
      return
    }

    console.log('🔄 [FILTER_CHANGE] Global filters changed, re-fetching all APIs...')
    console.log('🔄 [FILTER_CHANGE] New dates:', { startDate, endDate, globalFilters })

    lastVerifiedDatesRef.current = { start: startDate, end: endDate }
    verifyMHPL0001ApiAndTrigger(tokenInfo.token)
  }, [startDate, endDate, tokenStatus, tokenInfo, hasLoadedPreset, verifyMHPL0001ApiAndTrigger])

  // Auto-verify MHPL0002 after MHPL0001 success
  const verifyMHPL0002ApiAndTrigger = useCallback(async (token: string) => {
    setMHPL0002Check({ status: 'checking' })

    try {
      console.log('📅 [MHPL0002] Using dates from homepage state:', { startDate, endDate })
      console.log('📅 [MHPL0002] globalFilters from context:', globalFilters)
      const response = await callMHPL_API_WithValidation('mhpl0002', {
        StartDate: startDate,
        EndDate: endDate
      }, token)

      if (response.status !== 'success') {
        throw new Error(response.message || 'MHPL0002 API call failed')
      }

      const payrollData = response.data

      const totals = payrollData?.totals || []
      const grandTotal = totals.find((t: any) => t.Expense_Type === 'Grand_Total_Expense')?.Total_Amount || 0

      setMHPL0002Check({
        status: 'success',
        checkedAt: new Date(),
        message: 'Payroll Breakdown API active with valid schema',
        totalExpense: grandTotal
      })

      toast.success('MHPL0002: Payroll Breakdown verified and saved!')

      // Auto-trigger MHPL0003 after short delay
      setTimeout(() => verifyMHPL0003ApiAndTrigger(token), 1000)

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to verify MHPL0002'
      setMHPL0002Check({
        status: 'error',
        error: message
      })
      toast.error(`MHPL0002: ${message}`)
    }
  }, [startDate, endDate])

  // Auto-verify MHPL0003 after MHPL0002 success
  const verifyMHPL0003ApiAndTrigger = useCallback(async (token: string) => {
  setMHPL0003Check({ status: 'checking' })

  try {
    console.log('📅 [MHPL0003] Using dates from homepage state:', { startDate, endDate })
    console.log('📅 [MHPL0003] globalFilters from context:', globalFilters)
    const response = await callMHPL_API_WithValidation('mhpl0003', {
      StartDate: startDate,
      EndDate: endDate,
    }, token)

    if (response.status !== 'success') {
      throw new Error(response.message || 'MHPL0003 API call failed')
    }

    const geographicData = response.data
    console.log('🔍 [PAGE] MHPL0003 response.data structure:', JSON.stringify(geographicData).substring(0, 200))
    
    // Check if groupByLocation exists at different levels
    const hasGroupByLocation = !!(
      geographicData?.groupByLocation || 
      geographicData?.data?.groupByLocation
    )
    
    console.log('🔍 [PAGE] MHPL0003 has groupByLocation:', hasGroupByLocation)
    
    let collectedCount = 0
    const groupByLocation = geographicData?.groupByLocation || geographicData?.data?.groupByLocation || []
    
    if (groupByLocation?.length > 0) {
      collectedCount = groupByLocation.reduce((total: number, location: any) => {
        const districtTotal = location.DISTRICTS?.reduce((sum: number, district: any) => {
          return sum + (district?.PATIENT_COUNT || 0)
        }, 0) || 0
        return total + districtTotal
      }, 0)
      console.log('🔍 [PAGE] MHPL0003 calculated patient count:', collectedCount)
    }

    setMHPL0003Check({
      status: 'success',
      checkedAt: new Date(),
      message: 'Geographic Distribution API active with valid schema',
      totalGeographic: collectedCount
    })

    toast.success('MHPL0003: Geographic Distribution verified and saved!')

    setTimeout(() => verifyMHPL0004Api(token), 1000)

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to verify MHPL0003'
    setMHPL0003Check({
      status: 'error',
      error: message
    })
    toast.error(`MHPL0003: ${message}`)
  }
}, [startDate, endDate])


  // Verify MHPL0004 after MHPL0003 success
  const verifyMHPL0004Api = useCallback(async (token: string) => {
    setMHPL0004Check({ status: 'checking' })

    try {
      console.log('📅 [MHPL0004] Using dates from homepage state:', { startDate, endDate })
      console.log('📅 [MHPL0004] globalFilters from context:', globalFilters)
      const response = await callMHPL_API_WithValidation('mhpl0004', {
        StartDate: startDate,
        EndDate: endDate,
        PatCat: 'IPD',
      }, token)

      if (response.status !== 'success') {
        throw new Error(response.message || 'MHPL0004 API call failed')
      }

      const spendingData = response.data

      const groupBySpendingCategory = spendingData?.groupBySpendingCategory || []
      const totalSpent = groupBySpendingCategory.reduce((total: number, category: any) => {
        return total + (category.TOTAL_BILLED_AMOUNT || 0)
      }, 0)

      setMHPL0004Check({
        status: 'success',
        checkedAt: new Date(),
        message: 'Patient Spending API active with valid schema',
        totalSpending: totalSpent
      })

      toast.success('MHPL0004: Patient Spending verified and saved!')

      // Auto-trigger MHPL0005 after short delay
      setTimeout(() => verifyMHPL0005Api(token), 1000)

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to verify MHPL0004'
      setMHPL0004Check({
        status: 'error',
        error: message
      })
      toast.error(`MHPL0004: ${message}`)
    }
  }, [startDate, endDate])

  // Verify MHPL0005 after MHPL0004 success
const verifyMHPL0005Api = useCallback(async (token: string) => {
  setMHPL0005Check({ status: 'checking' })

  try {
    console.log('📅 [MHPL0005] Using dates from homepage state:', { startDate, endDate })
    console.log('📅 [MHPL0005] globalFilters from context:', globalFilters)
    const response = await callMHPL_API_WithValidation('mhpl0005', {
      StartDate: startDate,
      EndDate: endDate,
      ServiceTypes: 'OPD'
      // Omit pagination to get full totals
    }, token)

    if (response.status !== 'success') {
      throw new Error(response.message || 'MHPL0005 API call failed')
    }

    const consultantData = response.data

    const totalRevenue = consultantData?.totals?.[0]?.total_revenue || 0

    setMHPL0005Check({
      status: 'success',
      checkedAt: new Date(),
      message: 'Consultant Revenue Analysis API active with valid schema',
      totalRevenue: totalRevenue
    })

    toast.success('MHPL0005: Consultant Revenue verified and saved!')
    setTimeout(() => verifyMHPL0006Api(token), 1000)

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to verify MHPL0005'
    setMHPL0005Check({ status: 'error', error: message })
    toast.error(`MHPL0005: ${message}`)
  }
}, [startDate, endDate])

// Verify MHPL0006 after MHPL0005 success
const verifyMHPL0006Api = useCallback(async (token: string) => {
  setMHPL0006Check({ status: 'checking' })

  try {
    console.log('📅 [MHPL0006] Using dates from homepage state:', { startDate, endDate })
    console.log('📅 [MHPL0006] globalFilters from context:', globalFilters)
    const response = await callMHPL_API_WithValidation('mhpl0006', {
      StartDate: startDate,
      EndDate: endDate,
      InsuranceProviders: 'MetLife Alico',
      Page_Size: '5',
      Page_Number: '1'
    }, token)

    if (response.status !== 'success') {
      throw new Error(response.message || 'MHPL0006 API call failed')
    }

    const claimsData = response.data

    const totalClaims = claimsData?.groupByInsuranceProvider?.[0]?.items?.reduce((total: number, item: any) =>
      total + (item?.claim_count || 0), 0) || 0

    setMHPL0006Check({
      status: 'success',
      checkedAt: new Date(),
      message: 'Insurance Claims Analysis API active with valid schema',
      totalClaims: totalClaims
    })

    toast.success('MHPL0006: Insurance Claims verified and saved!')
    setTimeout(() => verifyMHPL0007Api(token), 1000)

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to verify MHPL0006'
    setMHPL0006Check({ status: 'error', error: message })
    toast.error(`MHPL0006: ${message}`)
  }
}, [startDate, endDate])

// Verify MHPL0007 after MHPL0006 success
const verifyMHPL0007Api = useCallback(async (token: string) => {
  setMHPL0007Check({ status: 'checking' })

  try {
    console.log('📅 [MHPL0007] Using dates from homepage state:', { startDate, endDate })
    console.log('📅 [MHPL0007] globalFilters from context:', globalFilters)
    const response = await callMHPL_API_WithValidation('mhpl0007', {
      StartDate: startDate,
      EndDate: endDate,
      Threshold: '70'
    }, token)

    if (response.status !== 'success') {
      throw new Error(response.message || 'MHPL0007 API call failed')
    }

    const bedData = response.data

    const totalBeds = bedData?.groupByDateAndBed?.items?.length || 0

    setMHPL0007Check({
      status: 'success',
      checkedAt: new Date(),
      message: 'Bed Occupancy Analysis API active with valid schema',
      totalBeds: totalBeds
    })

    toast.success('MHPL0007: Bed Occupancy verified and saved!')
    setTimeout(() => verifyMHPL0008Api(token), 1000)

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to verify MHPL0007'
    setMHPL0007Check({ status: 'error', error: message })
    toast.error(`MHPL0007: ${message}`)
  }
}, [startDate, endDate])

// Verify MHPL0008 after MHPL0007 success
const verifyMHPL0008Api = useCallback(async (token: string) => {
  setMHPL0008Check({ status: 'checking' })

  try {
    console.log('📅 [MHPL0008] Using dates from homepage state:', { startDate, endDate })
    console.log('📅 [MHPL0008] globalFilters from context:', globalFilters)
    const response = await callMHPL_API_WithValidation('mhpl0008', {
      StartDate: startDate,
      EndDate: endDate,
      Departments: 'medicine,surgery,pediatrics',
      PageSize: '3',
      PageNumber: '1'
    }, token)

    if (response.status !== 'success') {
      throw new Error(response.message || 'MHPL0008 API call failed')
    }

    const employeeData = response.data

    const totalEmployees = employeeData?.groupByEmployee?.[0]?.items?.length || 0

    setMHPL0008Check({
      status: 'success',
      checkedAt: new Date(),
      message: 'Employee Performance API active with valid schema',
      totalEmployees: totalEmployees
    })

    toast.success('MHPL0008: Employee Performance verified and saved!')
    setTimeout(() => verifyMHPL0009Api(token), 1000)

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to verify MHPL0008'
    setMHPL0008Check({ status: 'error', error: message })
    toast.error(`MHPL0008: ${message}`)
  }
}, [startDate, endDate])

// Verify MHPL0009 after MHPL0008 success
const verifyMHPL0009Api = useCallback(async (token: string) => {
  setMHPL0009Check({ status: 'checking' })

  try {
    console.log('📅 [MHPL0009] Using dates from homepage state:', { startDate, endDate })
    console.log('📅 [MHPL0009] globalFilters from context:', globalFilters)
    const response = await callMHPL_API_WithValidation('mhpl0009', {
      StartDate: startDate,
      EndDate: endDate,
      medicine_categories: 'tablet,syrup,injection',
      PageNumber: '1',
      PageSize: '5'
    }, token)

    if (response.status !== 'success') {
      throw new Error(response.message || 'MHPL0009 API call failed')
    }

    const medicineData = response.data

    const totalWaste = medicineData?.groupByMedicines?.items?.reduce((total: number, item: any) =>
      total + (item?.wasted_value || 0), 0) || 0

    setMHPL0009Check({
      status: 'success',
      checkedAt: new Date(),
      message: 'Medicine Waste Analysis API active with valid schema',
      totalWaste: totalWaste
    })

    toast.success('MHPL0009: Medicine Waste verified and saved!')
    setTimeout(() => verifyMHPL0010Api(token), 1000)

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to verify MHPL0009'
    setMHPL0009Check({ status: 'error', error: message })
    toast.error(`MHPL0009: ${message}`)
  }
}, [startDate, endDate])

// Verify MHPL0010 after MHPL0009 success
const verifyMHPL0010Api = useCallback(async (token: string) => {
  setMHPL0010Check({ status: 'checking' })

  try {
    console.log('📅 [MHPL0010] Using dates from homepage state:', { startDate, endDate })
    console.log('📅 [MHPL0010] globalFilters from context:', globalFilters)
    const response = await callMHPL_API_WithValidation('mhpl0010', {
      StartDate: startDate,
      EndDate: endDate,
      Departments: 'billing',
      EmpType: 'worker',
    }, token)

    if (response.status !== 'success') {
      throw new Error(response.message || 'MHPL0010 API call failed')
    }

    const salaryData = response.data

    const totalSalary = salaryData?.GroupByEmployee?.items?.reduce((total: number, item: any) =>
      total + (item?.TOTAL_SALARY || 0), 0) || 0

    setMHPL0010Check({
      status: 'success',
      checkedAt: new Date(),
      message: 'Employee Salary Summary API active with valid schema',
      totalSalary: totalSalary
    })

    toast.success('MHPL0010: Employee Salary verified and saved!')

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to verify MHPL0010'
    setMHPL0010Check({ status: 'error', error: message })
    toast.error(`MHPL0010: ${message}`)
  }
}, [startDate, endDate])

  // Check token status on mount - prioritize database token
  useEffect(() => {
    const checkTokenStatus = async () => {
      try {
        console.log('🔑 [TOKEN] Checking for global token in database...')

        // Check localStorage only (no database)
        const currentToken = getStoredToken()

        if (!currentToken) {
          setTokenStatus('error')
          console.log('🔑 [TOKEN] No token found in localStorage')
          return
        }

        if (isTokenExpired()) {
          console.log('🔑 [TOKEN] Token expired, please regenerate')
          setTokenStatus('error')
        } else {
          console.log('🔑 [TOKEN] Valid token found in localStorage')
          setTokenStatus('valid')

          const expiresAt = localStorage.getItem('mhpl_token_expires')

          setTokenInfo({
            token: currentToken,
            expiresAt: expiresAt ? new Date(parseInt(expiresAt)).toISOString() : '',
            timeRemaining: getTokenTimeRemaining()
          })
        }
      } catch (error) {
        console.error('🔑 [TOKEN] Error checking token status:', error)
        setTokenStatus('error')
      }
    }

    checkTokenStatus()
  }, [])

  // Client-side version of the working MHPL authentication
  const loadNewToken = async () => {
    setLoading(true)
    try {
      console.log('[CLIENT] Generating authentication token...')

      const response = await fetch('/api/authentication', {
        method: 'POST',
        cache: 'no-store',
      })

      const text = await response.text()
      let payload: any = null

      try {
        payload = text ? JSON.parse(text) : null
      } catch {
        payload = null
      }

      if (!response.ok) {
        console.error('[CLIENT] Request failed:', response.status, response.statusText)
        console.error('[CLIENT] Response body:', text)
        throw new Error(`MHPL authentication failed (${response.status} ${response.statusText})`)
      }

      // Token extraction logic: prefer Token inside rawBody from /api/authentication
      const extractToken = (payload: any, raw: string): string | null => {
        if (!payload || typeof payload !== 'object') {
          return null
        }

        // 1) Prefer Token inside the rawBody returned by /api/authentication
        if (typeof (payload as any).rawBody === 'string' && (payload as any).rawBody.trim().length > 0) {
          try {
            const inner = JSON.parse((payload as any).rawBody)
            const innerToken = inner.Token || inner.token || inner.access_token || inner.bearer
            if (typeof innerToken === 'string') {
              const trimmedInner = innerToken.trim()
              if (trimmedInner.length > 0 && !trimmedInner.includes('<') && !trimmedInner.includes('>')) {
                return trimmedInner
              }
            }
          } catch {
            // ignore parse errors and fall through
          }
        }

        // 2) Fallback to top-level fields
        const token =
          (payload as any).Token ||
          (payload as any).token ||
          (payload as any).access_token ||
          (payload as any).bearer ||
          null

        if (token && typeof token === 'string') {
          const trimmed = token.trim()
          if (trimmed.length > 0 && !trimmed.includes('<') && !trimmed.includes('>')) {
            return trimmed
          }
        }

        // 3) Search nested items
        if (Array.isArray((payload as any).items)) {
          for (const item of (payload as any).items) {
            const nested = extractToken(item, '')
            if (nested) return nested
          }
        }

        // 4) As a last resort, inspect raw text
        if (raw && raw.includes('Token')) {
          try {
            const parsed = JSON.parse(raw)
            return extractToken(parsed, '')
          } catch {
            // ignore
          }
        }

        return null
      }

      const token = extractToken(payload, text)

      if (!token) {
        console.error('[CLIENT] No token found in response')
        console.error('[CLIENT] Response payload:', payload)
        toast.error('Authentication succeeded but no token was found in response')
        setTokenStatus('error')
        return
      }

      console.log('[CLIENT] Token generated successfully')
      console.log('[CLIENT] Token preview:', `${token.substring(0, 30)}...${token.substring(token.length - 10)}`)

      // Store the successful token
      setStoredToken(token, '24Hrs')

      const tokenData = {
        token,
        expiresAt: '',
        success: true
      }

      const expiresAt = localStorage.getItem('mhpl_token_expires')
      tokenData.expiresAt = expiresAt ? new Date(parseInt(expiresAt)).toISOString() : ''

      setAuthResult(tokenData)
      setTokenStatus('valid')

      setTokenInfo({
        token,
        expiresAt: tokenData.expiresAt,
        timeRemaining: getTokenTimeRemaining()
      })

      console.log('[CLIENT] Client-side authentication successful')
      console.log('[CLIENT] Token expires:', tokenData.expiresAt)
      console.log('[CLIENT] Time remaining:', getTokenTimeRemaining())

      toast.success('Token generated successfully!')

      // Auto-verify APIs after successful auth
      setTimeout(() => verifyMHPL0001ApiAndTrigger(token), 1000)
    } catch (error) {
      console.error('[CLIENT] Client-side authentication failed:', error)
      if (error instanceof Error) {
        toast.error(`Authentication failed: ${error.message}`)
      } else {
        toast.error('Authentication failed - please try again')
      }
      setTokenStatus('error')
    } finally {
      setLoading(false)
    }
  }


  // Manual API Testing Functions
  const testAPIsManually = () => {
    if (tokenInfo?.token) {
      verifyMHPL0001ApiAndTrigger(tokenInfo.token)
    } else {
      toast.error('No valid token available for testing')
    }
  }

  // Check if all APIs have been tested successfully
  const allAPIsTested = 
    mhpl0001Check.status === 'success' &&
    mhpl0002Check.status === 'success' &&
    mhpl0003Check.status === 'success' &&
    mhpl0004Check.status === 'success' &&
    mhpl0005Check.status === 'success' &&
    mhpl0006Check.status === 'success' &&
    mhpl0007Check.status === 'success' &&
    mhpl0008Check.status === 'success' &&
    mhpl0009Check.status === 'success' &&
    mhpl0010Check.status === 'success'

  // Navigate to dashboard or demo mode
  const goToDashboard = () => {
    const anyAPIFailed = mhpl0001Check.status === 'error' ||
                        mhpl0002Check.status === 'error' ||
                        mhpl0003Check.status === 'error' ||
                        mhpl0004Check.status === 'error' ||
                        mhpl0005Check.status === 'error' ||
                        mhpl0006Check.status === 'error' ||
                        mhpl0007Check.status === 'error' ||
                        mhpl0008Check.status === 'error' ||
                        mhpl0009Check.status === 'error' ||
                        mhpl0010Check.status === 'error'

    if (allAPIsTested) {
      // All APIs successful - go to main dashboard
      router.push('/dashboard')
    } else if (anyAPIFailed) {
      // Some APIs failed - offer demo mode
      toast.error('Some APIs are unavailable. Redirecting to demo mode...')
      setTimeout(() => router.push('/dashboard?mode=demo'), 2000)
    } else {
      // APIs not tested yet
      toast.error('Please test all APIs before accessing dashboard')
    }
  }

  // Copy token to clipboard
  const copyToken = () => {
    if (tokenInfo?.token) {
      navigator.clipboard.writeText(tokenInfo.token)
      toast.success('Token copied to clipboard')
    }
  }

  // FeatureCard component with access to state
  const FeatureCard = ({
    icon: Icon,
    title,
    description,
    status,
    onClick,
    disabled = false,
    endpointId
  }: {
    icon: React.ComponentType<any>
    title: string
    description: string
    status: 'success' | 'error' | 'checking' | 'idle'
    onClick?: () => void
    disabled?: boolean
    endpointId?: string
  }) => {
    const statusColors = {
      success: 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50',
      error: 'border-red-200 bg-gradient-to-br from-red-50 to-pink-50',
      checking: 'border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50',
      idle: 'border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50'
    }

    return (
      <div
        onClick={disabled ? undefined : onClick}
        className={`relative group ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} transform transition-all duration-300 hover:scale-105 hover:shadow-xl`}
      >
        <div className={`p-6 rounded-2xl border-2 ${statusColors[status]} backdrop-blur-sm`}>
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-xl ${
              status === 'success' ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white' :
              status === 'error' ? 'bg-gradient-to-br from-red-500 to-pink-600 text-white' :
              status === 'checking' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white' :
              'bg-gradient-to-br from-gray-400 to-gray-600 text-white'
            }`}>
              {status === 'checking' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Icon className="w-6 h-6" />}
            </div>
            <div className={`text-sm font-medium px-3 py-1 rounded-full ${
              status === 'success' ? 'bg-green-100 text-green-700' :
              status === 'error' ? 'bg-red-100 text-red-700' :
              status === 'checking' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {status === 'success' ? '✅' : status === 'error' ? '❌' : status === 'checking' ? '⏳' : '⏸️'}
            </div>
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600 text-sm mb-4">{description}</p>

          <div className="flex items-center text-sm text-gray-500">
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Subtle glow effect on hover */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-xl pointer-events-none"></div>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Amazing Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10"></div>
        <div className="relative container mx-auto px-6 py-16">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center space-x-2 bg-white/90 backdrop-blur-sm rounded-full px-6 py-2 border border-white/20">
              <Zap className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-600">MHPL Healthcare Analytics</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
              Smart <GradientText>API Gateway</GradientText>
            </h1>
            
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Real-time authentication and API testing for MHPL healthcare analytics with 
              <span className="font-semibold text-purple-600"> seamless integration</span>
            </p>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-10 left-10 w-20 h-20 bg-blue-200 rounded-full opacity-20 blur-xl"></div>
        <div className="absolute top-20 right-20 w-32 h-32 bg-purple-200 rounded-full opacity-20 blur-xl"></div>
        <div className="absolute bottom-10 left-1/4 w-24 h-24 bg-pink-200 rounded-full opacity-20 blur-xl"></div>
      </div>

      <div className="container mx-auto px-6 py-12 space-y-12">
        {/* Token Management Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="w-6 h-6 text-purple-600" />
              <h2 className="text-3xl font-bold text-gray-900">Token Management</h2>
            </div>
            <StatusBadge status={tokenStatus} />
          </div>

          {/* Date Range Required Warning */}
          {needsDateSetup && hasLoadedPreset && (
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-6 mb-6">
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
                <h3 className="text-lg font-bold text-yellow-900">
                  Date Range Required
                </h3>
              </div>
              <p className="text-yellow-800 mb-4">
                Please set your preferred date range using the Global Filters above
                before generating an authentication token and accessing the dashboard.
              </p>
              <p className="text-sm text-yellow-700">
                💡 Tip: Use the filter bar at the top to set your StartDate and EndDate
              </p>
            </div>
          )}

          {tokenStatus === 'error' && (
            <div className="flex justify-center">
              <button
                onClick={loadNewToken}
                disabled={loading || needsDateSetup}
                title={needsDateSetup ? 'Please set date range in Global Filters first' : ''}
                className="group relative inline-flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 text-white font-semibold rounded-2xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-700 via-pink-700 to-purple-700 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                ) : needsDateSetup ? (
                  <AlertTriangle className="w-5 h-5 relative z-10" />
                ) : (
                  <Lock className="w-5 h-5 relative z-10 group-hover:scale-110 transition-transform" />
                )}
                <span className="relative z-10">
                  {needsDateSetup ? '⚠️ Set Dates First' : loading ? 'Generating...' : 'Generate Token'}
                </span>
                <ChevronRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {tokenInfo && (
            <TokenDisplay tokenInfo={tokenInfo} onCopy={copyToken} onRegenerate={loadNewToken} />
          )}
        </div>

        {/* API Testing Section */}
        {tokenInfo && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Server className="w-6 h-6 text-purple-600" />
                <h2 className="text-3xl font-bold text-gray-900">API Testing Suite</h2>
              </div>
              <button
                onClick={testAPIsManually}
                disabled={loading || mhpl0001Check.status === 'checking'}
                className="group relative inline-flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-green-600 via-emerald-600 to-green-600 text-white font-semibold rounded-2xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-green-700 via-emerald-700 to-green-700 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                {mhpl0001Check.status === 'checking' ? (
                  <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                ) : (
                  <TestTube className="w-5 h-5 relative z-10 group-hover:scale-110 transition-transform" />
                )}
                <span className="relative z-10">
                  {mhpl0001Check.status === 'checking' ? 'Testing...' : 'Test All APIs'}
                </span>
                <ChevronRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* API Feature Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {/* Row 1 */}
              <FeatureCard
                icon={Users}
                title="MHPL0001"
                description="Patient Revisit Analysis - Track patient return rates and patterns"
                status={mhpl0001Check.status}
                disabled={loading || mhpl0001Check.status !== 'idle'}
                endpointId="mhpl0001"
              />

              <FeatureCard
                icon={Briefcase}
                title="MHPL0002"
                description="Payroll Breakdown - Comprehensive expense analytics"
                status={mhpl0002Check.status}
                disabled={false}
                endpointId="mhpl0002"
              />

              <FeatureCard
                icon={MapPin}
                title="MHPL0003"
                description="Geographic Distribution - Patient location insights"
                status={mhpl0003Check.status}
                disabled={false}
                endpointId="mhpl0003"
              />

              <FeatureCard
                icon={CreditCard}
                title="MHPL0004"
                description="Patient Spending - Healthcare spending analysis"
                status={mhpl0004Check.status}
                endpointId="mhpl0004"
                disabled={false}
              />

              <FeatureCard
                icon={UserCheck}
                title="MHPL0005"
                description="Consultant Revenue - Revenue analysis"
                status={mhpl0005Check.status}
                disabled={false}
                endpointId="mhpl0005"
              />

              <FeatureCard
                icon={Receipt}
                title="MHPL0006"
                description="Insurance Claims - Claims analysis"
                status={mhpl0006Check.status}
                disabled={false}
                endpointId="mhpl0006"
              />

              <FeatureCard
                icon={BedDouble}
                title="MHPL0007"
                description="Bed Occupancy - Real-time monitoring"
                status={mhpl0007Check.status}
                disabled={false}
                endpointId="mhpl0007"
              />

              <FeatureCard
                icon={Users2}
                title="MHPL0008"
                description="Employee Performance - Staff analytics"
                status={mhpl0008Check.status}
                endpointId="mhpl0008"
                disabled={false}
              />

              <FeatureCard
                icon={Package}
                title="MHPL0009"
                description="Medicine Waste - Inventory tracking"
                status={mhpl0009Check.status}
                disabled={false}
                endpointId="mhpl0009"
              />

              <FeatureCard
                icon={DollarSign}
                title="MHPL0010"
                description="Employee Salary - Salary analysis"
                status={mhpl0010Check.status}
                disabled={false}
                endpointId="mhpl0010"
              />
            </div>
          </div>
        )}

        {/* Dashboard Access Section */}
        <div className="relative overflow-hidden bg-gradient-to-r from-purple-50 via-pink-50 to-purple-50 rounded-3xl p-8 border-2 border-purple-200">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-100/50 via-transparent to-purple-100/50"></div>
          
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
                  <BarChart3 className="w-8 h-8 text-purple-600" />
                  <span>Analytics Dashboard</span>
                </h2>
                <p className="text-gray-600 text-lg">
                  {allAPIsTested 
                    ? '✨ All systems ready! Access your real-time healthcare analytics dashboard.'
                    : '⚡ Complete API testing to unlock your analytics dashboard.'}
                </p>
              </div>

              <button
                onClick={goToDashboard}
                disabled={!allAPIsTested}
                className={`group relative inline-flex items-center space-x-4 px-10 py-5 text-lg font-bold rounded-2xl transition-all duration-300 ${
                  allAPIsTested 
                    ? 'bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white shadow-2xl hover:shadow-3xl transform hover:scale-105 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {allAPIsTested && (
                  <div className="absolute inset-0 bg-gradient-to-r from-green-700 via-emerald-700 to-teal-700 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                )}
                
                <BarChart3 className="w-6 h-6 relative z-10 group-hover:scale-110 transition-transform" />
                <span className="relative z-10">Go to Dashboard</span>
                <ArrowRight className="w-6 h-6 relative z-10 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {allAPIsTested && (
              <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-green-200">
                  <CheckSquare className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Patient Data</p>
                  <p className="text-xs text-green-600">✅ Connected</p>
                </div>
                <div className="text-center p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-green-200">
                  <CheckSquare className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Payroll Data</p>
                  <p className="text-xs text-green-600">✅ Connected</p>
                </div>
                <div className="text-center p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-green-200">
                  <CheckSquare className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Geographic Data</p>
                  <p className="text-xs text-green-600">✅ Connected</p>
                </div>
                <div className="text-center p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-green-200">
                  <CheckSquare className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Spending Data</p>
                  <p className="text-xs text-green-600">✅ Connected</p>
                </div>
                
                {/* Row 2 */}
                <div className="text-center p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-green-200">
                  <CheckSquare className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Consultant Revenue</p>
                  <p className="text-xs text-green-600">✅ Connected</p>
                </div>
                <div className="text-center p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-green-200">
                  <CheckSquare className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Insurance Claims</p>
                  <p className="text-xs text-green-600">✅ Connected</p>
                </div>
                
                {/* Row 3 */}
                <div className="text-center p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-green-200">
                  <CheckSquare className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Bed Occupancy</p>
                  <p className="text-xs text-green-600">✅ Connected</p>
                </div>
                <div className="text-center p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-green-200">
                  <CheckSquare className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Employee Performance</p>
                  <p className="text-xs text-green-600">✅ Connected</p>
                </div>
                
                {/* Row 4 */}
                <div className="text-center p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-green-200">
                  <CheckSquare className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Medicine Waste</p>
                  <p className="text-xs text-green-600">✅ Connected</p>
                </div>
                <div className="text-center p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-green-200">
                  <CheckSquare className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Employee Salary</p>
                  <p className="text-xs text-green-600">✅ Connected</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
