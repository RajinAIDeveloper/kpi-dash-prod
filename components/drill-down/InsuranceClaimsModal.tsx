'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { Calendar, BarChart3, Shield, Building, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, Download, X, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { getThemeForEndpoint } from '@/lib/constants/drillDownThemes'
import { useStoredKpiData } from '@/lib/hooks/useStoredKpiData'
import { TokenStorage } from '@/lib/tokenStorage'
import { callMHPL_API_WithValidation } from '@/lib/api/mhplApi'
import { useFilterState } from '@/components/filters/FilterStateProvider'
import { useDashboardStore } from '@/lib/store/dashboard-store'
import toast from 'react-hot-toast'
import { validateMHPL0006Response } from '@/lib/api/schemas/mhpl0006-schema'

interface InsuranceClaimsModalProps {
  isOpen: boolean
  onClose: () => void
  endpointId: string
  currentValue: string | number
  data?: any
}

// Use actual MHPL0006 JSON data structure
interface MHPL0006InsuranceProvider {
  insurance_provider: string
  claim_count: number
  claimed_amount: number
  average_claim_amount: number
  pending_receivable: number
  claim_percentage: number
}

interface MHPL0006MonthlyClaims {
  month: string
  insurance_provider: string
  claim_count: number
  claimed_amount: number
  pending_receivable: number
}

interface MHPL0006YearlyClaims {
  year: string
  insurance_provider: string
  claim_count: number
  claimed_amount: number
  pending_receivable: number
}

interface MHPL0006DepartmentClaims {
  department: string
  total_claims: number
  total_claimed_amount: number
  pending_receivable: number
}

interface MHPL0006Response {
  groupByInsuranceProvider: MHPL0006ProviderItem[]
  groupByMonth: MHPL0006MonthItem[]
  groupByYear: MHPL0006YearItem[]
  groupByDepartment: MHPL0006DepartmentItem[]
  totals: MHPL0006Totals
}

// Transformed data types for display
interface TransformedProvider {
  providerName: string
  claimCount: number
  claimedAmount: number
  averageClaimAmount: number
  pendingReceivable: number
  claimPercentage: number
}

interface TransformedMonthlyClaim {
  month: string
  providerName: string
  claimCount: number
  claimedAmount: number
  pendingReceivable: number
}

interface TransformedDepartment {
  department: string
  totalClaims: number
  totalClaimedAmount: number
  pendingReceivable: number
}

interface MHPL0006ProviderItem {
  page_number: number
  page_size: number
  total_records: number
  total_pages: number
  items: MHPL0006InsuranceProvider[]
}

interface MHPL0006MonthItem {
  page_number: number
  page_size: number
  total_records: number
  total_pages: number
  items: MHPL0006MonthlyClaims[]
}

interface MHPL0006YearItem {
  page_number: number
  page_size: number
  total_records: number
  total_pages: number
  items: MHPL0006YearlyClaims[]
}

interface MHPL0006DepartmentItem {
  page_number: number
  page_size: number
  total_records: number
  total_pages: number
  items: MHPL0006DepartmentClaims[]
}

interface MHPL0006Totals {
  total_claim_count: number
  total_claimed_amount: number
  total_pending_receivable: number
  average_claim_amount: number
  page_number: number
  page_size: number
  total_records: number
  total_pages: number
}

interface PaginationState {
  currentPage: number
  pageSize: number
  totalItems: number
}

interface SortState {
  key: string
  direction: 'asc' | 'desc'
}

export function InsuranceClaimsModal({
  isOpen,
  onClose,
  endpointId,
  currentValue,
  data
}: InsuranceClaimsModalProps) {
  const theme = getThemeForEndpoint(endpointId)
  const [activeTab, setActiveTab] = useState('providers')
  const [searchTerm, setSearchTerm] = useState('')
  const [providerFilter, setProviderFilter] = useState('all')
  const [sortState, setSortState] = useState<SortState>({ key: 'claimedAmount', direction: 'desc' })
  const [periodType, setPeriodType] = useState<'monthly' | 'yearly'>('monthly')

  // Pagination state
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize: 25,
    totalItems: 0
  })

  // Loading and data state
  const { payload, loading, error } = useStoredKpiData(endpointId, isOpen, data)
  // CRITICAL: Read from Zustand store (single source of truth for global filters)
  const zustandStore = useDashboardStore()
  const globalFilters = zustandStore.globalFilters
  const endpointOverrides = zustandStore.endpointOverrides || {}
  const { hasLoadedPreset } = useFilterState()

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [providerParam, setProviderParam] = useState('Green Delta Insurance')
  const [departmentParam, setDepartmentParam] = useState('')
  const [apiPageSize, setApiPageSize] = useState('0')
  const [updating, setUpdating] = useState(false)
  const [livePayload, setLivePayload] = useState<any | null>(null)

  // CRITICAL: Always use fresh API data - clear stale data on open
  useEffect(() => {
    if (isOpen) {
      console.log('[InsuranceClaimsModal] Modal opened - clearing stale data, will fetch fresh')
      setLivePayload(null)
      setUpdating(false)
    }
  }, [isOpen])

  // Initialize filters from Zustand (single source of truth for dates)
  useEffect(() => {
    if (!isOpen) return

    console.log('[InsuranceClaimsModal] Initializing filters from Zustand')

    // Dates from Zustand (single source of truth)
    const s = globalFilters.startDate || ''
    const e = globalFilters.endDate || ''
    console.log('[InsuranceClaimsModal] Dates from Zustand:', { startDate: s, endDate: e })
    setStartDate(s)
    setEndDate(e)

    // Reset other filters
    setProviderParam('Green Delta Insurance')
    setDepartmentParam('')
    setApiPageSize('0')
  }, [isOpen, hasLoadedPreset, globalFilters.startDate, globalFilters.endDate])

  // State to hold the actual data to display
  const [mhpl0006Data, setMhpl0006Data] = useState<any | null>(null)

  // Process data whenever livePayload or payload changes
  // CRITICAL: livePayload takes priority over payload to show fresh data
  useEffect(() => {
    // If we have livePayload, ALWAYS use it (ignore stale payload from cache)
    const effective = livePayload || payload
    console.log('[MHPL0006] useEffect - effective:', effective)
    console.log('[MHPL0006] useEffect - using livePayload?', !!livePayload)
    console.log('[MHPL0006] useEffect - payload source:', livePayload ? 'LIVE (fresh API)' : 'CACHED (database/localStorage)')

    if (!effective) {
      setMhpl0006Data(null)
      return
    }

    // Unwrap the data if it's wrapped (database format has {code, status, data})
    const unwrapped = (effective as any)?.data ?? effective
    console.log('[MHPL0006] useEffect - Unwrapped data:', unwrapped)
    console.log('[MHPL0006] useEffect - Setting mhpl0006Data state NOW')

    setMhpl0006Data(unwrapped)
    console.log('[MHPL0006] useEffect - mhpl0006Data state SET COMPLETE')
  }, [livePayload, payload])

  // Transform MHPL0006 data for display
  const transformedData = useMemo(() => {
    console.log('[MHPL0006] transformedData useMemo - mhpl0006Data:', mhpl0006Data)
    if (!mhpl0006Data) return {
      providers: [],
      monthlyClaims: [],
      yearlyClaims: [],
      departments: [],
      totals: { totalClaimCount: 0, totalClaimedAmount: 0, totalPendingReceivable: 0, averageClaimAmount: 0 }
    }

    console.log('[MHPL0006] Transforming groupByInsuranceProvider:', mhpl0006Data.groupByInsuranceProvider)
    const providers = mhpl0006Data.groupByInsuranceProvider?.flatMap((group: MHPL0006ProviderItem) =>
      group.items?.map((provider: MHPL0006InsuranceProvider) => ({
        providerName: provider.insurance_provider,
        claimCount: provider.claim_count,
        claimedAmount: provider.claimed_amount,
        averageClaimAmount: provider.average_claim_amount,
        pendingReceivable: provider.pending_receivable,
        claimPercentage: provider.claim_percentage
      })) || []
    ) || []
    console.log('[MHPL0006] ✅ TRANSFORMED PROVIDERS:', providers)

    const monthlyClaims = mhpl0006Data.groupByMonth?.flatMap((group: MHPL0006MonthItem) =>
      group.items?.map((item: MHPL0006MonthlyClaims) => ({
        month: item.month,
        providerName: item.insurance_provider,
        claimCount: item.claim_count,
        claimedAmount: item.claimed_amount,
        pendingReceivable: item.pending_receivable
      })) || []
    ) || []

    const yearlyClaims = mhpl0006Data.groupByYear?.flatMap((group: MHPL0006YearItem) =>
      group.items?.map((item: MHPL0006YearlyClaims) => ({
        year: item.year,
        providerName: item.insurance_provider,
        claimCount: item.claim_count,
        claimedAmount: item.claimed_amount,
        pendingReceivable: item.pending_receivable
      })) || []
    ) || []

    const departments = mhpl0006Data.groupByDepartment?.flatMap((group: MHPL0006DepartmentItem) =>
      group.items?.map((item: MHPL0006DepartmentClaims) => ({
        department: item.department,
        totalClaims: item.total_claims,
        totalClaimedAmount: item.total_claimed_amount,
        pendingReceivable: item.pending_receivable
      })) || []
    ) || []


    // Prefer API totals; if missing or zero, derive from providers
    const apiTotals = (mhpl0006Data as any)?.totals
      ? {
          totalClaimCount: Number((mhpl0006Data as any).totals.total_claim_count) || 0,
          totalClaimedAmount: Number((mhpl0006Data as any).totals.total_claimed_amount) || 0,
          totalPendingReceivable: Number((mhpl0006Data as any).totals.total_pending_receivable) || 0,
          averageClaimAmount: Number((mhpl0006Data as any).totals.average_claim_amount) || 0,
        }
      : null

    const derivedTotals = (() => {
      const totalClaimCount = providers.reduce((sum: number, p: any) => sum + (Number(p.claimCount) || 0), 0)
      const totalClaimedAmount = providers.reduce((sum: number, p: any) => sum + (Number(p.claimedAmount) || 0), 0)
      const totalPendingReceivable = providers.reduce((sum: number, p: any) => sum + (Number(p.pendingReceivable) || 0), 0)
      const averageClaimAmount = totalClaimCount > 0 ? totalClaimedAmount / totalClaimCount : 0
      return { totalClaimCount, totalClaimedAmount, totalPendingReceivable, averageClaimAmount }
    })()

    const totals = apiTotals && (apiTotals.totalClaimCount > 0 || apiTotals.totalClaimedAmount > 0)
      ? apiTotals
      : derivedTotals

    const result = { providers, monthlyClaims, yearlyClaims, departments, totals }
    console.log('[MHPL0006] ✅ FINAL TRANSFORMED DATA:', result)
    return result
  }, [mhpl0006Data])

  // Filtered and sorted providers
  const filteredProviders = useMemo(() => {
    let filtered = transformedData.providers

    if (searchTerm) {
      filtered = filtered.filter((provider: TransformedProvider) =>
        provider.providerName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    filtered.sort((a: TransformedProvider, b: TransformedProvider) => {
      const aVal = a[sortState.key as keyof typeof a]
      const bVal = b[sortState.key as keyof typeof b]
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortState.direction === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [transformedData.providers, searchTerm, sortState])

  // Paginated providers data
  const paginatedProviders = useMemo(() => {
    setPagination(prev => ({ ...prev, totalItems: filteredProviders.length }))
    const startIndex = (pagination.currentPage - 1) * pagination.pageSize
    return filteredProviders.slice(startIndex, startIndex + pagination.pageSize)
  }, [filteredProviders, pagination.currentPage, pagination.pageSize])

  const totalPages = Math.ceil(pagination.totalItems / pagination.pageSize)

  // Handle sorting
  const handleSort = (key: string) => {
    setSortState(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  // Pagination handlers
  const goToPage = (page: number) => {
    setPagination(prev => ({ ...prev, currentPage: Math.max(1, Math.min(page, totalPages)) }))
  }

  const changePageSize = (size: number) => {
    setPagination(prev => ({
      ...prev,
      pageSize: size,
      currentPage: 1 // Reset to first page
    }))
  }

  // Period rows (monthly / yearly)
  const periodRows = useMemo(() => {
    return periodType === 'monthly'
      ? transformedData.monthlyClaims
      : transformedData.yearlyClaims
  }, [transformedData.monthlyClaims, transformedData.yearlyClaims, periodType])

  // Legacy chart dataset placeholder (keeps any stale chart references harmless)
  const departmentChartData: any[] = []

  // Export providers (By Provider tab)
  const exportProviders = () => {
    const csvData = [
      ['Insurance Provider', 'Claim Count', 'Claimed Amount', 'Average Claim', 'Pending Receivable', 'Claim %'],
      ...filteredProviders.map((provider: TransformedProvider) => [
        provider.providerName,
        provider.claimCount,
        provider.claimedAmount,
        provider.averageClaimAmount,
        provider.pendingReceivable,
      `${provider.claimPercentage}%`
      ])
    ]

    const csvContent = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `insurance-claims-analysis-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportDepartments = () => {
    const csvData = [
      ['Department', 'Total Claims', 'Total Claimed Amount', 'Pending Receivable'],
      ...transformedData.departments.map((dept: TransformedDepartment) => [
        dept.department,
        dept.totalClaims,
        dept.totalClaimedAmount,
        dept.pendingReceivable
      ])
    ]

    const csvContent = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `insurance-claims-by-department-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Export period data (By Period tab)
  const exportPeriodData = () => {
    const periodLabel = periodType === 'monthly' ? 'Month' : 'Year'
    const csvData = [
      [periodLabel, 'Insurance Provider', 'Claim Count', 'Claimed Amount', 'Pending Receivable'],
      ...periodRows.map((row: any) => [
        periodType === 'monthly' ? row.month : row.year,
        row.providerName,
        row.claimCount ?? 0,
        row.claimedAmount ?? 0,
        row.pendingReceivable ?? 0
      ])
    ]

    const csvContent = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `insurance-claims-by-period-${periodType}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  const SortIcon = ({ column }: { column: string }) => {
    if (sortState.key !== column) return <BarChart3 className="w-3 h-3 ml-1 opacity-30" />
    return sortState.direction === 'asc' ?
      <ChevronUp className="w-3 h-3 ml-1" /> :
      <ChevronDown className="w-3 h-3 ml-1" />
  }

  const formatCurrency = (value: number) => `৳${value.toLocaleString()}`

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-6xl lg:max-w-7xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Enhanced Header */}
        <div className={cn("sticky top-0 z-10 bg-gradient-to-r text-white px-4 sm:px-6 py-4 sm:py-5 shadow-lg", theme.gradient)}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl lg:text-2xl font-bold mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span className="truncate">Insurance Claims Analysis</span>
              </DialogTitle>
              <DialogDescription className="text-white/90 text-xs sm:text-sm">
  • Total Claims: <span className="font-semibold text-white">{transformedData.totals.totalClaimCount.toLocaleString()}</span>
  {' '}• Total Claimed Amount: <span className="font-semibold text-white">{formatCurrency(transformedData.totals.totalClaimedAmount)}</span>
  {' '}• Avg Claim Amount: <span className="font-semibold text-white">{formatCurrency(transformedData.totals.averageClaimAmount)}</span>
  {' '}• Pending Receivables: <span className="font-semibold text-white">{formatCurrency(transformedData.totals.totalPendingReceivable)}</span>
</DialogDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              
              <Button
                onClick={onClose}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 hover:bg-white/20 text-white transition-all duration-200"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">

          {/* Loading bar during update */}
          {updating && (
            <div className="px-4 pt-4">
              <Progress value={66} />
            </div>
          )}

          {/* Filter Bar for live refresh */}
          <div className="px-4 pt-4">
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                  <div>
                    <Label className="text-xs">Start Date</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">End Date</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Insurance Providers</Label>
                    <Input
                      type="text"
                      placeholder="e.g. Green Delta Insurance"
                      value={providerParam}
                      onChange={(e) => setProviderParam(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Department (optional)</Label>
                    <Input
                      type="text"
                      placeholder="e.g. Cardiology"
                      value={departmentParam}
                      onChange={(e) => setDepartmentParam(e.target.value)}
                    />
                  </div>
                  <div className="flex md:justify-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Page Size</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0 = all"
                        value={apiPageSize}
                        onChange={(e) => setApiPageSize(e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        className="w-full md:w-auto"
                        disabled={updating || !startDate || !endDate || !providerParam}
                        onClick={async () => {
                          try {
                            setUpdating(true)
                            const token = TokenStorage.getValidToken() || undefined

                            const includePaging = apiPageSize !== '0'
                            // Use the exact header keys the API already accepted to avoid 500s
                            const requestParams: Record<string, any> = {
                              StartDate: startDate,
                              EndDate: endDate,
                              InsuranceProviders: providerParam,
                            }
                            if (departmentParam && departmentParam.trim() !== '') {
                              requestParams.Department = departmentParam.trim()
                            }
                            if (includePaging) {
                              requestParams.Page_Number = '1'
                              requestParams.Page_Size = apiPageSize || '10'
                            }

                            console.log('[MHPL0006] Request params:', requestParams)
                            const response = await callMHPL_API_WithValidation('mhpl0006', requestParams, token)
                            if (response.status !== 'success') {
                              throw new Error((response as any).message || 'MHPL0006 call failed')
                            }

                            const raw = (response as any).data
                            console.log('[MHPL0006] Raw response:', raw)
                            console.log('[MHPL0006] Has .data property?', raw?.data !== undefined)
                            const normalized = raw?.data ? raw.data : raw
                            console.log('[MHPL0006] Normalized data:', normalized)
                            console.log('[MHPL0006] Response sample:', JSON.stringify(normalized)?.slice(0, 500))
                            console.log('[MHPL0006] ✅ SETTING LIVEPAYLOAD NOW:', normalized)
                            setLivePayload(normalized as any)

                            // CRITICAL: Update localStorage cache so useStoredKpiData picks up fresh data
                            if (typeof window !== 'undefined') {
                              const cachePayload = {
                                data: normalized,
                                fetchedAt: new Date().toISOString(),
                                endpoint: 'mhpl0006',
                                inputParameters: requestParams
                              }
                              localStorage.setItem('mhpl0006-payload', JSON.stringify(cachePayload))
                              console.log('[MHPL0006] ✅ LOCALSTORAGE CACHE UPDATED')
                            }

                            console.log('[MHPL0006] ✅ LIVEPAYLOAD SET COMPLETE')
                            toast.success('Insurance claims data refreshed')
                          } catch (err: any) {
                            console.error('[MHPL0006] Update failed:', err)
                            toast.error(err?.message || 'Failed to refresh data')
                          } finally {
                            setUpdating(false)
                          }
                        }}
                      >
                        {updating ? (
                          <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Updating</span>
                        ) : (
                          'Update'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading insurance claims data...</p>
              </div>
            </div>
          ) : error ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-red-600 mb-2">Failed to load insurance data</p>
                <p className="text-gray-500 text-sm mb-4">{error}</p>
                <Button onClick={() => window.location.reload()}>Retry</Button>
              </CardContent>
            </Card>
          ) : transformedData.providers.length > 0 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="providers" className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    By Provider
                  </TabsTrigger>
                  <TabsTrigger value="departments" className="flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Departments
                  </TabsTrigger>
                  <TabsTrigger value="periods" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    By Period
                  </TabsTrigger>
                </TabsList>

                {/* Providers Tab */}
                <TabsContent value="providers" className="space-y-6 mt-6">
                  <Card>
                    <CardHeader className="flex flex-col gap-4">

  {/* TOP ROW: Title left, Export right */}
  <div className="flex items-center justify-between w-full">
    <CardTitle className="flex items-center gap-2">
      <Shield className="w-5 h-5" />
      Insurance Provider Performance
    </CardTitle>

    <Button
      variant="outline"
      size="sm"
      onClick={exportProviders}
      disabled={filteredProviders.length === 0}
      className="inline-flex items-center gap-2"
    >
      <Download className="w-4 h-4" />
      Export
    </Button>
  </div>

  {/* SECOND ROW: Search */}
  <div className="flex items-center gap-2">
    <Search className="w-4 h-4 text-gray-400" />
    <Input
      placeholder="Search providers..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="w-64"
    />
  </div>

</CardHeader>

                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="p-3 text-left font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('providerName')}>
                                Insurance Provider <SortIcon column="providerName" />
                              </th>
                              <th className="p-3 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('claimCount')}>
                                Claim Count <SortIcon column="claimCount" />
                              </th>
                              <th className="p-3 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('claimedAmount')}>
                                Claimed Amount <SortIcon column="claimedAmount" />
                              </th>
                              <th className="p-3 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('averageClaimAmount')}>
                                Avg Claim <SortIcon column="averageClaimAmount" />
                              </th>
                              <th className="p-3 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('pendingReceivable')}>
                                Pending <SortIcon column="pendingReceivable" />
                              </th>
                              <th className="p-3 text-center font-medium">Claim %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedProviders.map((provider: TransformedProvider, index: number) => (
                              <tr key={`${provider.providerName}-${index}`} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-medium">
                                  <div className="flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-gray-400" />
                                    <span className="truncate max-w-xs" title={provider.providerName}>
                                      {provider.providerName}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-3 text-center">{provider.claimCount.toLocaleString()}</td>
                                <td className="p-3 text-center font-bold text-green-600">{formatCurrency(provider.claimedAmount)}</td>
                                <td className="p-3 text-center">{formatCurrency(provider.averageClaimAmount)}</td>
                                <td className="p-3 text-center text-orange-600">{formatCurrency(provider.pendingReceivable)}</td>
                                <td className="p-3 text-center">
                                  <Badge variant="outline" className="text-xs">
                                    {provider.claimPercentage.toFixed(1)}%
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">Show:</span>
                          <Select
                            value={pagination.pageSize.toString()}
                            onValueChange={(value) => changePageSize(Number(value))}
                          >
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="25">25</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                              <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-sm text-gray-600">
                            Showing {((pagination.currentPage - 1) * pagination.pageSize) + 1} to{' '}
                            {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)} of{' '}
                            {pagination.totalItems} providers
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(pagination.currentPage - 1)}
                            disabled={pagination.currentPage === 1}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>

                          <span className="px-3 py-1 text-sm">
                            Page {pagination.currentPage} of {totalPages}
                          </span>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(pagination.currentPage + 1)}
                            disabled={pagination.currentPage === totalPages}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

               

                {/* Departments Tab */}
                <TabsContent value="departments" className="space-y-6 mt-6">
                  <Card>
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <CardTitle className="flex items-center gap-2">
                        <Building className="w-5 h-5" />
                        Claims by Department
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportDepartments}
                        disabled={transformedData.departments.length === 0}
                        className="inline-flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Export
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {transformedData.departments.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="p-3 text-left font-medium">Department</th>
                                <th className="p-3 text-center font-medium">Total Claims</th>
                                <th className="p-3 text-center font-medium">Total Claimed Amount</th>
                                <th className="p-3 text-center font-medium">Pending Receivable</th>
                              </tr>
                            </thead>
                            <tbody>
                              {transformedData.departments.map((dept: TransformedDepartment) => (
                                <tr key={dept.department} className="border-b hover:bg-gray-50">
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <Building className="w-4 h-4 text-gray-600" />
                                      <span className="font-medium">{dept.department}</span>
                                    </div>
                                  </td>
                                  <td className="p-3 text-center">
                                    {dept.totalClaims.toLocaleString()}
                                  </td>
                                  <td className="p-3 text-center text-green-600 font-semibold">
                                    {formatCurrency(dept.totalClaimedAmount)}
                                  </td>
                                  <td className="p-3 text-center text-orange-600 font-semibold">
                                    {formatCurrency(dept.pendingReceivable)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">
                          No department-level insurance claims data available.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* By Period Tab */}
                <TabsContent value="periods" className="space-y-6 mt-6">
                  <Card>
                    <CardHeader className="flex flex-col gap-4">

  {/* TOP ROW: Title left, Export right */}
  <div className="flex items-center justify-between w-full">
    <CardTitle className="flex items-center gap-2">
      <Calendar className="w-5 h-5" />
      Claims by Period
    </CardTitle>

    <Button
      variant="outline"
      size="sm"
      onClick={exportPeriodData}
      disabled={periodRows.length === 0}
      className="inline-flex items-center gap-2"
    >
      <Download className="w-4 h-4" />
      Export
    </Button>
  </div>

  {/* SECOND ROW: Toggle under the title */}
  <div className="inline-flex rounded-md border bg-muted p-1 w-fit">
    <Button
      type="button"
      size="sm"
      variant={periodType === 'monthly' ? 'default' : 'ghost'}
      onClick={() => setPeriodType('monthly')}
      className="px-3"
    >
      Monthly
    </Button>
    <Button
      type="button"
      size="sm"
      variant={periodType === 'yearly' ? 'default' : 'ghost'}
      onClick={() => setPeriodType('yearly')}
      className="px-3"
    >
      Yearly
    </Button>
  </div>

</CardHeader>

                    <CardContent>
                      {periodRows.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="p-3 text-left font-medium">
                                  {periodType === 'monthly' ? 'Month' : 'Year'}
                                </th>
                                <th className="p-3 text-left font-medium">Insurance Provider</th>
                                <th className="p-3 text-center font-medium">Claim Count</th>
                                <th className="p-3 text-center font-medium">Claimed Amount</th>
                                <th className="p-3 text-center font-medium">Pending Receivable</th>
                              </tr>
                            </thead>
                            <tbody>
                              {periodRows.map((row: any, index: number) => (
                                <tr
                                  key={`${periodType}-${row.providerName ?? ''}-${row.month ?? row.year ?? index}`}
                                  className="border-b hover:bg-gray-50"
                                >
                                  <td className="p-3">
                                    {periodType === 'monthly' ? row.month : row.year}
                                  </td>
                                  <td className="p-3">
                                    {row.providerName}
                                  </td>
                                  <td className="p-3 text-center">
                                    {Number(row.claimCount ?? 0).toLocaleString()}
                                  </td>
                                  <td className="p-3 text-center text-green-600 font-semibold">
                                    {formatCurrency(Number(row.claimedAmount ?? 0))}
                                  </td>
                                  <td className="p-3 text-center text-orange-600 font-semibold">
                                    {formatCurrency(Number(row.pendingReceivable ?? 0))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">
                          No {periodType === 'monthly' ? 'monthly' : 'yearly'} period data available.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-gray-500">No insurance claims data available for this endpoint.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
