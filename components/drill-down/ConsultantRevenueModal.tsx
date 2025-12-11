'use client'

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { TrendingUp, TrendingDown, Calendar, DollarSign, BarChart3, PieChart, Activity, Users, Stethoscope, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, Filter, X, Download, AlertTriangle, Loader2, RefreshCw, ChevronsLeft, ChevronsRight } from 'lucide-react'
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  LabelList,
  Area,
  AreaChart
} from 'recharts'

interface ConsultantRevenueModalProps {
  isOpen: boolean
  onClose: () => void
  endpointId: string
  currentValue: string | number
  data?: any
}

interface MHPL0005Consultant {
  consultant_name: string
  service_type: string
  total_revenue: number
  total_visits: number
  average_revenue_per_visit: number
  revenue_percentage: number
}

interface MHPL0005DailyRevenue {
  date?: string
  month?: string
  year?: string
  consultant_name: string
  service_type: string
  daily_revenue: number
  patient_visits: number
  revenue_percentage: number
}

interface MHPL0005Response {
  groupByConsultant: MHPL0005ConsultantItem[]
  groupByDay?: MHPL0005DayItem[]
  groupByMonth?: MHPL0005MonthItem[]
  groupByYear?: MHPL0005YearItem[]
  totals: MHPL0005Total[]
}

interface MHPL0005ConsultantItem {
  page_number: number
  page_size: number
  total_records: number
  total_page: number
  items: MHPL0005Consultant[]
}

interface MHPL0005DayItem {
  page_number: number
  page_size: number
  total_records: number
  total_page: number
  items: MHPL0005DailyRevenue[]
}

interface MHPL0005MonthItem {
  page_number: number
  page_size: number
  total_records: number
  total_page: number
  items: MHPL0005DailyRevenue[]
}

interface MHPL0005YearItem {
  page_number: number
  page_size: number
  total_records: number
  total_page: number
  items: MHPL0005DailyRevenue[]
}

interface MHPL0005Total {
  total_revenue: number
  total_consultants: number
  total_visits: number
  average_revenue_per_visit: number
  page_number?: number
  page_size?: number
  total_records?: number
  total_page?: number
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

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#6366F1', '#EF4444', '#84CC16', '#F97316']

export function ConsultantRevenueModal({
  isOpen,
  onClose,
  endpointId,
  currentValue,
  data
}: ConsultantRevenueModalProps) {
  const theme = getThemeForEndpoint(endpointId)
  const [activeTab, setActiveTab] = useState('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [serviceFilter, setServiceFilter] = useState('all')
  const [sortState, setSortState] = useState<SortState>({ key: 'totalRevenue', direction: 'desc' })

  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize: 25,
    totalItems: 0
  })

  const { payload, loading, error } = useStoredKpiData(endpointId, isOpen, data)
  // CRITICAL: Read from Zustand store (single source of truth for global filters)
  const zustandStore = useDashboardStore()
  const globalFilters = zustandStore.globalFilters
  const endpointOverrides = zustandStore.endpointOverrides || {}
  const { hasLoadedPreset } = useFilterState()

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [serviceTypeParam, setServiceTypeParam] = useState<'OPD' | 'IPD' | 'EMG'>('OPD')
  const [consultantsParam, setConsultantsParam] = useState('')
  const [apiPageSize, setApiPageSize] = useState('1000')
  const [updating, setUpdating] = useState(false)
  const [livePayload, setLivePayload] = useState<any | null>(null)
  const [showJsonViewer, setShowJsonViewer] = useState(false)
  const [loadingPage, setLoadingPage] = useState(false)
  const autoRefreshRef = useRef(false)

  // CRITICAL: Always use fresh API data - clear stale data on open
  useEffect(() => {
    if (isOpen) {
      console.log('[ConsultantRevenueModal] Modal opened - clearing stale data, will fetch fresh')
      setLivePayload(null)
      setUpdating(false)
      setLoadingPage(false)
      autoRefreshRef.current = false
    }
  }, [isOpen])

  // Initialize filters from Zustand (single source of truth for dates)
  useEffect(() => {
    if (!isOpen) return

    console.log('[ConsultantRevenueModal] Initializing filters from Zustand')

    // Dates from Zustand (single source of truth)
    const s = globalFilters.startDate || ''
    const e = globalFilters.endDate || ''
    console.log('[ConsultantRevenueModal] Dates from Zustand:', { startDate: s, endDate: e })
    setStartDate(s)
    setEndDate(e)

    // Default Service Type from KPI capsule (store override), fallback to IPD
    try {
      const rawSvc = endpointOverrides?.['mhpl0005']?.ServiceTypes
      const upper = String(rawSvc || 'IPD').toUpperCase()
      const first = upper.split(',')[0].trim()
      const allowed = (first === 'OPD' || first === 'IPD' || first === 'EMG') ? first : 'IPD'
      setServiceTypeParam(allowed as 'OPD' | 'IPD' | 'EMG')
    } catch {
      setServiceTypeParam('IPD')
    }
    setConsultantsParam('')
    setApiPageSize('10')
    setLoadingPage(false)
  }, [isOpen, hasLoadedPreset, globalFilters.startDate, globalFilters.endDate])

  // Fetch data from API with pagination (server-side)
  const fetchDataFromAPI = useCallback(async (pageNum: number) => {
    if (!endpointId) {
      console.error('[MHPL0005 Pagination] No endpoint ID provided')
      toast.error('No endpoint ID provided')
      return
    }
    if (!pageNum || pageNum < 1) {
      console.error('[MHPL0005 Pagination] Invalid page number:', pageNum)
      toast.error('Invalid page number')
      return
    }

    console.log(`[MHPL0005 Pagination] Starting fetch for page ${pageNum}`)
    setLoadingPage(true)
    try {
      let token: string | null = null
      try { token = TokenStorage.getValidToken?.() ?? null } catch {}
      if (!token && typeof window !== 'undefined') {
        token = localStorage.getItem('mhpl_bearer_token') || localStorage.getItem('mhpl_token')
      }
      if (!token) {
        console.error('[MHPL0005 Pagination] No token found in storage')
        toast.error('Authentication required. Please sign in.')
        return
      }

      const psNum = parseInt(apiPageSize || '10', 10)
      const payload: Record<string, any> = {
        StartDate: startDate,
        EndDate: endDate,
        ServiceTypes: serviceTypeParam,
        PageNumber: pageNum,
      }
      if (Number.isFinite(psNum) && psNum > 0) payload.PageSize = psNum
      if (consultantsParam && consultantsParam.trim() !== '') payload.Consultants = consultantsParam.trim()

      console.log('[MHPL0005 Pagination] API Request:', { endpoint: endpointId, payload })
      const result = await callMHPL_API_WithValidation('mhpl0005', payload, token)
      if ((result as any)?.status !== 'success') {
        const msg = (result as any)?.message || 'MHPL0005 call failed'
        throw new Error(msg)
      }

      console.log(`[MHPL0005 Pagination] API Response received for page ${pageNum}`)
      const raw = (result as any).data
      const normalized = raw?.data ? raw.data : raw
      setLivePayload(normalized as any)
      toast.success(`Page ${pageNum} loaded`)
    } catch (error: any) {
      console.error('[MHPL0005 Pagination] Error fetching page:', error)
      toast.error(error?.message || `Failed to load page ${pageNum}`)
    } finally {
      setLoadingPage(false)
      console.log(`[MHPL0005 Pagination] Request completed for page ${pageNum}`)
    }
  }, [endpointId, startDate, endDate, serviceTypeParam, consultantsParam, apiPageSize])

  // Auto-refresh page 1 on open if dates are available
  useEffect(() => {
    if (isOpen && startDate && endDate && !autoRefreshRef.current) {
      autoRefreshRef.current = true
      fetchDataFromAPI(1)
    }
  }, [isOpen, startDate, endDate, fetchDataFromAPI])

  const mhpl0005Data = useMemo<MHPL0005Response | null>(() => {
    const effective = livePayload ?? payload
    if (!effective) return null

    const actualData = (effective as any)?.data ?? effective

    if (actualData.groupByConsultant && actualData.totals) {
      return actualData as MHPL0005Response
    }

    return null
  }, [payload, livePayload])

  // Extract pagination metadata from API response
  const paginationMeta = useMemo(() => {
    const metaFromGroup = (grp: any) => grp ? {
      pageNumber: grp.page_number || 1,
      pageSize: grp.page_size || 10,
      totalPages: grp.total_page || grp.total_pages || 1,
      totalRecords: grp.total_records || 0
    } : null

    const gConsult = mhpl0005Data?.groupByConsultant?.[0]
    const gDay = mhpl0005Data?.groupByDay?.[0]
    const gMonth = mhpl0005Data?.groupByMonth?.[0]
    const gYear = mhpl0005Data?.groupByYear?.[0]
    const t = mhpl0005Data?.totals?.[0]

    return metaFromGroup(gConsult) || metaFromGroup(gDay) || metaFromGroup(gMonth) || metaFromGroup(gYear) || (t ? {
      pageNumber: t.page_number || 1,
      pageSize: t.page_size || 10,
      totalPages: t.total_page || 1,
      totalRecords: t.total_records || 0
    } : { pageNumber: 1, pageSize: 10, totalPages: 1, totalRecords: 0 })
  }, [mhpl0005Data])

  // Range display based on pagination metadata
  const startIndex = paginationMeta.totalRecords > 0
    ? (paginationMeta.pageNumber - 1) * paginationMeta.pageSize + 1
    : 0
  const endIndex = Math.min(paginationMeta.pageNumber * paginationMeta.pageSize, paginationMeta.totalRecords)

  const transformedData = useMemo(() => {
    if (!mhpl0005Data) {
      return {
        consultants: [],
        dailyRevenue: [],
        monthlyRevenue: [],
        yearlyRevenue: [],
        totals: { totalRevenue: 0, totalConsultants: 0, totalVisits: 0, avgRevenuePerVisit: 0 }
      }
    }

    const consultants = mhpl0005Data.groupByConsultant?.flatMap(group =>
      group.items?.map(consultant => ({
        consultantName: consultant.consultant_name,
        serviceType: consultant.service_type,
        totalRevenue: consultant.total_revenue,
        totalVisits: consultant.total_visits,
        averageRevenuePerVisit: consultant.average_revenue_per_visit,
        revenuePercentage: consultant.revenue_percentage
      })) || []
    ) || []

    const dailyRevenue = mhpl0005Data.groupByDay?.flatMap(group =>
      group.items?.map(item => ({
        date: item.date || '',
        consultantName: item.consultant_name,
        serviceType: item.service_type,
        dailyRevenue: item.daily_revenue,
        patientVisits: item.patient_visits,
        revenuePercentage: item.revenue_percentage
      })) || []
    ) || []

    const monthlyRevenue = mhpl0005Data.groupByMonth?.flatMap(group =>
      group.items?.map(item => ({
        month: item.month || '',
        consultantName: item.consultant_name,
        serviceType: item.service_type,
        monthlyRevenue: item.daily_revenue,
        patientVisits: item.patient_visits,
        revenuePercentage: item.revenue_percentage
      })) || []
    ) || []

    const yearlyRevenue = mhpl0005Data.groupByYear?.flatMap(group =>
      group.items?.map(item => ({
        year: item.year || '',
        consultantName: item.consultant_name,
        serviceType: item.service_type,
        yearlyRevenue: item.daily_revenue,
        patientVisits: item.patient_visits,
        revenuePercentage: item.revenue_percentage
      })) || []
    ) || []

    const totals = mhpl0005Data.totals?.[0] ? {
      totalRevenue: mhpl0005Data.totals[0].total_revenue || 0,
      totalConsultants: mhpl0005Data.totals[0].total_consultants || 0,
      totalVisits: mhpl0005Data.totals[0].total_visits || 0,
      avgRevenuePerVisit: mhpl0005Data.totals[0].average_revenue_per_visit || 0
    } : {
      totalRevenue: 0,
      totalConsultants: 0,
      totalVisits: 0,
      avgRevenuePerVisit: 0
    }

    return { consultants, dailyRevenue, monthlyRevenue, yearlyRevenue, totals }
  }, [mhpl0005Data])

  const filteredConsultants = useMemo(() => {
    let filtered = transformedData.consultants

    if (searchTerm) {
      filtered = filtered.filter(consultant =>
        consultant.consultantName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (serviceFilter !== 'all') {
      filtered = filtered.filter(consultant => consultant.serviceType === serviceFilter)
    }

    filtered.sort((a, b) => {
      const aVal = a[sortState.key as keyof typeof a]
      const bVal = b[sortState.key as keyof typeof b]
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortState.direction === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [transformedData.consultants, searchTerm, serviceFilter, sortState])

  // Removed client-side pagination in favor of server-side controls

  const topConsultantsChart = useMemo(() => {
    return transformedData.consultants
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10)
      .map(consultant => ({
        name: consultant.consultantName.length > 15
          ? `${consultant.consultantName.substring(0, 15)}...`
          : consultant.consultantName,
        fullName: consultant.consultantName,
        revenue: consultant.totalRevenue,
        visits: consultant.totalVisits,
        avgRevenue: consultant.averageRevenuePerVisit
      }))
  }, [transformedData.consultants])

  const topAvgRevenueChart = useMemo(() => {
    return transformedData.consultants
      .sort((a, b) => b.averageRevenuePerVisit - a.averageRevenuePerVisit)
      .slice(0, 10)
      .map(consultant => ({
        name: consultant.consultantName.length > 15
          ? `${consultant.consultantName.substring(0, 15)}...`
          : consultant.consultantName,
        fullName: consultant.consultantName,
        avgRevenue: consultant.averageRevenuePerVisit
      }))
  }, [transformedData.consultants])

  const topVisitsChart = useMemo(() => {
    return transformedData.consultants
      .sort((a, b) => b.totalVisits - a.totalVisits)
      .slice(0, 10)
      .map(consultant => ({
        name: consultant.consultantName.length > 15
          ? `${consultant.consultantName.substring(0, 15)}...`
          : consultant.consultantName,
        fullName: consultant.consultantName,
        visits: consultant.totalVisits
      }))
  }, [transformedData.consultants])

  const dailyTrendData = useMemo(() => {
    const dateMap = new Map<string, { revenue: number, visits: number }>()
    
    transformedData.dailyRevenue.forEach(item => {
      const existing = dateMap.get(item.date)
      if (existing) {
        existing.revenue += item.dailyRevenue
        existing.visits += item.patientVisits
      } else {
        dateMap.set(item.date, { revenue: item.dailyRevenue, visits: item.patientVisits })
      }
    })

    return Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date: date.split('T')[0],
        revenue: data.revenue,
        visits: data.visits
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [transformedData.dailyRevenue])

  const serviceTypeDistribution = useMemo(() => {
    const distribution = transformedData.consultants.reduce((acc, c) => {
      acc[c.serviceType] = (acc[c.serviceType] || 0) + c.totalRevenue
      return acc
    }, {} as Record<string, number>)

    return Object.entries(distribution).map(([type, revenue]) => ({
      name: type,
      value: revenue
    }))
  }, [transformedData.consultants])

  const handleSort = (key: string) => {
    setSortState(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  // Server-side pagination controls
  const goFirst = () => fetchDataFromAPI(1)
  const goPrev = () => { if (paginationMeta.pageNumber > 1) fetchDataFromAPI(paginationMeta.pageNumber - 1) }
  const goNext = () => { if (paginationMeta.pageNumber < paginationMeta.totalPages) fetchDataFromAPI(paginationMeta.pageNumber + 1) }
  const goLast = () => fetchDataFromAPI(paginationMeta.totalPages)
  const goto = (page: number) => fetchDataFromAPI(page)

  const exportData = () => {
    const csvData = [
      ['Consultant Name', 'Service Type', 'Total Revenue', 'Total Visits', 'Avg Revenue/Visit', 'Revenue %'],
      ...filteredConsultants.map(consultant => [
        consultant.consultantName,
        consultant.serviceType,
        consultant.totalRevenue,
        consultant.totalVisits,
        consultant.averageRevenuePerVisit.toFixed(2),
        `${consultant.revenuePercentage.toFixed(2)}%`
      ])
    ]

    const csvContent = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `consultant-revenue-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (sortState.key !== column) return <ChevronDown className="w-3 h-3 ml-1 opacity-30" />
    return sortState.direction === 'asc' ?
      <ChevronUp className="w-3 h-3 ml-1" /> :
      <ChevronDown className="w-3 h-3 ml-1" />
  }

  const formatCurrency = (value: number) => `৳${value.toLocaleString()}`

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 animate-spin" />
              Loading Consultant Data...
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Error Loading Data
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-gray-600 mb-2">Failed to load consultant revenue data</p>
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <Button onClick={onClose} className="mt-4">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!mhpl0005Data) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              No Consultant Data Available
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <Stethoscope className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Consultant revenue data is not available</p>
            <p className="text-sm text-gray-500">Please run API tests on the homepage first</p>
            <Button onClick={onClose} className="mt-4">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-6xl lg:max-w-7xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className={cn("sticky top-0 z-10 bg-gradient-to-r text-white px-4 sm:px-6 py-4 sm:py-5 shadow-lg", theme.gradient)}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl lg:text-2xl font-bold mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Stethoscope className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span className="truncate">Consultant Revenue Analysis</span>
              </DialogTitle>
              <DialogDescription className="text-white/90 text-xs sm:text-sm">
                • Total Revenue: <span className="font-semibold text-white">{formatCurrency(transformedData.totals.totalRevenue)}</span>
                
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

        <div className="flex-1 overflow-auto px-4 sm:px-6 pb-6">
          {updating && (
            <div className="pt-4">
              <Progress value={66} />
            </div>
          )}

          {/* Live filter bar */}
          <div className="pt-4">
            <Card className="mb-4 border-2 hover:shadow-lg transition-shadow">
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
                  <div>
                    <Label className="text-xs">Service Types</Label>
                    <Select value={serviceTypeParam} onValueChange={(v) => setServiceTypeParam(v as any)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Service" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPD">OPD</SelectItem>
                        <SelectItem value="IPD">IPD</SelectItem>
                        <SelectItem value="EMG">EMG</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Consultants (optional)</Label>
                    <Input
                      type="text"
                      placeholder="e.g. Prof. Dr. Ahmed"
                      value={consultantsParam}
                      onChange={(e) => setConsultantsParam(e.target.value)}
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
                    <div className="flex items-end gap-2">
                      <Button
                        className="w-full md:w-auto"
                        disabled={updating || !startDate || !endDate}
                        onClick={async () => {
                          try {
                            setUpdating(true)
                            const token = TokenStorage.getValidToken() || undefined

                            const includePaging = apiPageSize !== '0'
                            const requestParams: Record<string, any> = {
                              StartDate: startDate,
                              EndDate: endDate,
                              ServiceTypes: serviceTypeParam,
                            }
                            if (consultantsParam && consultantsParam.trim() !== '') {
                              requestParams.Consultants = consultantsParam.trim()
                            }
                            if (includePaging) {
                              requestParams.PageNumber = '1'
                              requestParams.PageSize = apiPageSize || '10'
                            }

                            const response = await callMHPL_API_WithValidation('mhpl0005', requestParams, token)
                            if (response.status !== 'success') {
                              throw new Error((response as any).message || 'MHPL0005 call failed')
                            }

                            const raw = (response as any).data
                            const normalized = raw?.data ? raw.data : raw
                            setLivePayload(normalized as any)
                            toast.success('Consultant revenue refreshed')
                          } catch (err: any) {
                            console.error('[MHPL0005] Update failed:', err)
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
                      {/* View JSON button commented out */}
                      {/* {livePayload && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowJsonViewer(!showJsonViewer)}
                          className="whitespace-nowrap"
                        >
                          {showJsonViewer ? 'Hide' : 'View'} JSON
                        </Button>
                      )} */}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* JSON Viewer */}
            {showJsonViewer && livePayload && (
              <Card className="mb-4 border-2 border-blue-200 bg-blue-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      API Response JSON
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(livePayload, null, 2))
                        toast.success('JSON copied to clipboard')
                      }}
                      className="h-7 px-2"
                    >
                      Copy
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-white p-4 rounded-lg overflow-auto max-h-96 text-xs border border-blue-300">
                    {JSON.stringify(livePayload, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>

          {transformedData.consultants.length > 0 ? (
            <div className="space-y-4 sm:space-y-6 py-4 sm:py-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                {/* Tabs Navigation */}
                <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 pb-4 -mx-2 px-2">
                  <TabsList className="grid w-full grid-cols-4 gap-1 bg-gray-100/80 p-1 h-auto rounded-xl">
                    <TabsTrigger
                      value="overview"
                      className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all"
                    >
                      <PieChart className="w-4 h-4" />
                      <span className="hidden sm:inline">Overview</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="consultants"
                      className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all"
                    >
                      <Users className="w-4 h-4" />
                      <span className="hidden sm:inline">Consultants</span>
                    </TabsTrigger>
                    {/* <TabsTrigger
                      value="performance"
                      className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all"
                    >
                      <BarChart3 className="w-4 h-4" />
                      <span className="hidden sm:inline">Performance</span>
                    </TabsTrigger> */}
                    {/* <TabsTrigger
                      value="trends"
                      className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all"
                    >
                      <Calendar className="w-4 h-4" />
                      <span className="hidden sm:inline">Trends</span>
                    </TabsTrigger> */}
                  </TabsList>
                </div>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4 sm:space-y-6 mt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {/* Stats Card */}
                    <Card className="overflow-hidden border-2 hover:shadow-lg transition-shadow">
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 px-4 sm:px-6 py-4 border-b">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                          <DollarSign className="w-5 h-5 text-purple-600" />
                          Revenue Overview
                        </CardTitle>
                      </div>
                      <CardContent className="p-4 sm:p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="text-center p-4 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl text-white shadow-lg col-span-full">
                            <div className="text-3xl sm:text-4xl font-bold mb-1">
                              {formatCurrency(transformedData.totals.totalRevenue)}
                            </div>
                            <div className="text-sm opacity-90">Total Revenue</div>
                          </div>
                          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200">
                            <div className="text-2xl sm:text-3xl font-bold text-purple-600 mb-1">
                              {transformedData.totals.totalConsultants.toLocaleString()}
                            </div>
                            <div className="text-xs sm:text-sm text-purple-700 font-medium">Consultants</div>
                          </div>
                          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl border-2 border-green-200">
                            <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-1">
                              {transformedData.totals.totalVisits.toLocaleString()}
                            </div>
                            <div className="text-xs sm:text-sm text-green-700 font-medium">Patient Visits</div>
                          </div>
                          <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-amber-100 rounded-xl border-2 border-orange-200 col-span-full">
                            <div className="text-2xl sm:text-3xl font-bold text-orange-600 mb-1">
                              {formatCurrency(Math.round(transformedData.totals.avgRevenuePerVisit))}
                            </div>
                            <div className="text-xs sm:text-sm text-orange-700 font-medium">Avg Revenue per Visit</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Top Consultants Chart */}
                    <Card className="overflow-hidden border-2 hover:shadow-lg transition-shadow">
                      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 px-4 sm:px-6 py-4 border-b">
                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-blue-600" />
                          Top 10 Revenue Generators
                        </CardTitle>
                      </div>
                      <CardContent className="p-4 sm:p-6">
                        <ResponsiveContainer width="100%" height={350}>
                          <BarChart data={topConsultantsChart} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                              dataKey="name"
                              angle={-45}
                              textAnchor="end"
                              height={100}
                              fontSize={10}
                            />
                            <YAxis tickFormatter={(value) => `৳${(value / 1000).toFixed(0)}k`} fontSize={11} />
                            <Tooltip
                              formatter={(value) => formatCurrency(Number(value))}
                              labelFormatter={(label, payload) => {
                                if (payload && payload.length > 0) {
                                  return payload[0].payload.fullName
                                }
                                return label
                              }}
                              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                            />
                            <Bar
                              dataKey="revenue"
                              fill="#3B82F6"
                              radius={[8, 8, 0, 0]}
                            >
                              <LabelList dataKey="revenue" position="top" formatter={(value: any) => `৳${(Number(value) / 1000).toFixed(0)}k`} fontSize={10} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Service Type Distribution */}
                   
                  </div>
                </TabsContent>

                {/* Consultants Tab */}
                <TabsContent value="consultants" className="space-y-4 mt-0">
                  <Card className="border-2">
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 px-4 sm:px-6 py-4 border-b">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                          <Users className="w-5 h-5 text-indigo-600" />
                          All Consultants
                        </CardTitle>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={exportData}
                          className="whitespace-nowrap"
                          title="Export current list"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export
                        </Button>
                      </div>
                      {/* Filters */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="lg:col-span-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                              placeholder="Search consultants..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-10 bg-white"
                            />
                          </div>
                        </div>
                        <Select value={serviceFilter} onValueChange={setServiceFilter}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Service Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Services</SelectItem>
                            <SelectItem value="OPD">Outpatient (OPD)</SelectItem>
                            <SelectItem value="IPD">Inpatient (IPD)</SelectItem>
                            <SelectItem value="EMG">Emergency (EMG)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <CardContent className="p-0">
                      {/* Mobile Card View */}
                      <div className="block lg:hidden divide-y">
                        {filteredConsultants.map((consultant, index) => (
                          <div key={`${consultant.consultantName}-${index}`} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
                                  <Stethoscope className="w-4 h-4 text-purple-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-gray-900 truncate" title={consultant.consultantName}>
                                    {consultant.consultantName}
                                  </div>
                                  <Badge className={cn(
                                    "mt-1 text-xs",
                                    consultant.serviceType === "OPD" ? "bg-blue-100 text-blue-700" :
                                    consultant.serviceType === "IPD" ? "bg-green-100 text-green-700" :
                                    "bg-orange-100 text-orange-700"
                                  )}>
                                    {consultant.serviceType}
                                  </Badge>
                                </div>
                              </div>
                              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs flex-shrink-0">
                                {consultant.revenuePercentage.toFixed(1)}%
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="p-2 bg-green-50 rounded-lg">
                                <div className="text-gray-600 text-xs mb-1">Revenue</div>
                                <div className="font-bold text-green-600 text-sm">
                                  {formatCurrency(consultant.totalRevenue)}
                                </div>
                              </div>
                              <div className="p-2 bg-blue-50 rounded-lg">
                                <div className="text-gray-600 text-xs mb-1">Visits</div>
                                <div className="font-bold text-blue-600 text-sm">
                                  {consultant.totalVisits.toLocaleString()}
                                </div>
                              </div>
                              <div className="col-span-2 p-2 bg-orange-50 rounded-lg">
                                <div className="text-gray-600 text-xs mb-1">Avg per Visit</div>
                                <div className="font-bold text-orange-600 text-sm">
                                  {formatCurrency(Math.round(consultant.averageRevenuePerVisit))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table View */}
                      <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b-2 border-gray-200">
                            <tr>
                              <th className="p-4 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('consultantName')}>
                                <div className="flex items-center">
                                  Consultant <SortIcon column="consultantName" />
                                </div>
                              </th>
                              <th className="p-4 text-center font-semibold text-gray-700">Service Type</th>
                              <th className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('totalRevenue')}>
                                <div className="flex items-center justify-center">
                                  Revenue <SortIcon column="totalRevenue" />
                                </div>
                              </th>
                              <th className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('totalVisits')}>
                                <div className="flex items-center justify-center">
                                  Visits <SortIcon column="totalVisits" />
                                </div>
                              </th>
                              <th className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('averageRevenuePerVisit')}>
                                <div className="flex items-center justify-center">
                                  Avg/Visit <SortIcon column="averageRevenuePerVisit" />
                                </div>
                              </th>
                              <th className="p-4 text-center font-semibold text-gray-700">Share %</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {filteredConsultants.map((consultant, index) => (
                              <tr key={`${consultant.consultantName}-${index}`} className="hover:bg-purple-50/50 transition-colors">
                                <td className="p-4">
                                  <div className="flex items-center gap-2">
                                    <Stethoscope className="w-4 h-4 text-purple-400 flex-shrink-0" />
                                    <span className="font-medium text-gray-900 truncate max-w-xs" title={consultant.consultantName}>
                                      {consultant.consultantName}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-4 text-center">
                                  <Badge className={cn(
                                    "text-xs font-semibold",
                                    consultant.serviceType === "OPD" ? "bg-blue-100 text-blue-700 border-blue-200" :
                                    consultant.serviceType === "IPD" ? "bg-green-100 text-green-700 border-green-200" :
                                    "bg-orange-100 text-orange-700 border-orange-200"
                                  )}>
                                    {consultant.serviceType}
                                  </Badge>
                                </td>
                                <td className="p-4 text-center font-bold text-green-600">
                                  {formatCurrency(consultant.totalRevenue)}
                                </td>
                                <td className="p-4 text-center font-semibold text-gray-700">
                                  {consultant.totalVisits.toLocaleString()}
                                </td>
                                <td className="p-4 text-center font-semibold text-orange-600">
                                  {formatCurrency(Math.round(consultant.averageRevenuePerVisit))}
                                </td>
                                <td className="p-4 text-center">
                                  <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs font-semibold">
                                    {consultant.revenuePercentage.toFixed(1)}%
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Server-side Pagination Controls */}
                      {paginationMeta.totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-gray-50 border-t">
                          <div className="text-sm text-gray-600 font-medium">
                            Showing {paginationMeta.totalRecords > 0 ? startIndex : 0}-{endIndex} of {paginationMeta.totalRecords}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" onClick={goFirst} disabled={loadingPage || paginationMeta.pageNumber === 1} title="First">
                              <ChevronsLeft className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={goPrev} disabled={loadingPage || paginationMeta.pageNumber === 1} title="Previous">
                              <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <div className="flex items-center gap-1 mx-2">
                              {Array.from({ length: Math.min(5, paginationMeta.totalPages) }, (_, i) => {
                                let pageNum: number
                                const current = paginationMeta.pageNumber
                                const total = paginationMeta.totalPages
                                if (total <= 5) {
                                  pageNum = i + 1
                                } else if (current <= 3) {
                                  pageNum = i + 1
                                } else if (current >= total - 2) {
                                  pageNum = total - 4 + i
                                } else {
                                  pageNum = current - 2 + i
                                }
                                return (
                                  <Button key={pageNum} size="sm" variant={paginationMeta.pageNumber === pageNum ? 'default' : 'outline'} onClick={() => goto(pageNum)} disabled={loadingPage} className="w-10">
                                    {pageNum}
                                  </Button>
                                )
                              })}
                            </div>
                            <Button size="sm" variant="outline" onClick={goNext} disabled={loadingPage || paginationMeta.pageNumber === paginationMeta.totalPages} title="Next">
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={goLast} disabled={loadingPage || paginationMeta.pageNumber === paginationMeta.totalPages} title="Last">
                              <ChevronsRight className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="text-sm text-gray-500">
                            Page {paginationMeta.pageNumber} of {paginationMeta.totalPages}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Performance Tab */}
                {/* <TabsContent value="performance" className="space-y-4 sm:space-y-6 mt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <Card className="overflow-hidden border-2 hover:shadow-lg transition-shadow">
                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 px-4 sm:px-6 py-4 border-b">
                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-orange-600" />
                          Top 10 Consultants - Highest Avg Revenue per Visit
                        </CardTitle>
                      </div>
                      <CardContent className="p-4 sm:p-6">
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={topAvgRevenueChart}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                              dataKey="name"
                              angle={-45}
                              textAnchor="end"
                              height={100}
                              fontSize={10}
                            />
                            <YAxis tickFormatter={(value) => formatCurrency(value)} fontSize={11} />
                            <Tooltip
                              formatter={(value) => formatCurrency(Number(value))}
                              labelFormatter={(label, payload) => {
                                if (payload && payload.length > 0) {
                                  return payload[0].payload.fullName
                                }
                                return label
                              }}
                              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                            />
                            <Bar
                              dataKey="avgRevenue"
                              fill="#F59E0B"
                              radius={[8, 8, 0, 0]}
                            >
                              <LabelList dataKey="avgRevenue" position="top" formatter={(value: any) => `৳${(Number(value) / 1000).toFixed(0)}k`} fontSize={10} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    
                  </div>

                  <Card className="border-2">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 px-4 sm:px-6 py-4 border-b">
                      <CardTitle className="text-base sm:text-lg">Performance Insights</CardTitle>
                    </div>
                    <CardContent className="p-4 sm:p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        <div className="p-4 sm:p-5 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 hover:shadow-md transition-all">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                              <TrendingUp className="w-5 h-5 text-green-600" />
                            </div>
                            <span className="font-semibold text-green-800">Top Earner</span>
                          </div>
                          <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-1">
                            {transformedData.consultants.length > 0 ? formatCurrency(Math.max(...transformedData.consultants.map(c => c.averageRevenuePerVisit))) : '৳0'}
                          </div>
                          <div className="text-xs sm:text-sm text-green-700">Highest avg per visit</div>
                        </div>

                        <div className="p-4 sm:p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 hover:shadow-md transition-all">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <Users className="w-5 h-5 text-blue-600" />
                            </div>
                            <span className="font-semibold text-blue-800">Most Active</span>
                          </div>
                          <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-1">
                            {transformedData.consultants.length > 0 ? Math.max(...transformedData.consultants.map(c => c.totalVisits)).toLocaleString() : '0'}
                          </div>
                          <div className="text-xs sm:text-sm text-blue-700">Patient consultations</div>
                        </div>

                        <div className="p-4 sm:p-5 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200 hover:shadow-md transition-all sm:col-span-2 xl:col-span-1">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                              <DollarSign className="w-5 h-5 text-purple-600" />
                            </div>
                            <span className="font-semibold text-purple-800">Revenue Leader</span>
                          </div>
                          <div className="text-2xl sm:text-3xl font-bold text-purple-600 mb-1">
                            {transformedData.consultants.length > 0 ? formatCurrency(Math.max(...transformedData.consultants.map(c => c.totalRevenue))) : '৳0'}
                          </div>
                          <div className="text-xs sm:text-sm text-purple-700">Highest total revenue</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent> */}

                {/* Trends Tab */}
                
              </Tabs>
            </div>
          ) : (
            <Card className="mt-6">
              <CardContent className="p-12 text-center">
                <Stethoscope className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No consultant revenue data available</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
