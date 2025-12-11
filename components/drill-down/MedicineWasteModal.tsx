'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { TrendingUp, TrendingDown, Calendar, Trash2, BarChart3, PieChart, Activity, AlertTriangle, Users, Package, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, Filter, X, Download, Loader2, ChevronsLeft, ChevronsRight, RefreshCw } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { getThemeForEndpoint } from '@/lib/constants/drillDownThemes'
import { useStoredKpiData } from '@/lib/hooks/useStoredKpiData'
import { type Medicine, type MonthlyWaste, type YearlyWaste, type ReasonWise, type CategoryWise } from '@/lib/api/schemas/mhpl0009-schema'
import { useFilterState } from '@/components/filters/FilterStateProvider'
import { useDashboardStore } from '@/lib/store/dashboard-store'
import { TokenStorage } from '@/lib/tokenStorage'
import { callMHPL_API_WithValidation } from '@/lib/api/mhplApi'
import toast from 'react-hot-toast'

const COLOR_MAP = {
  'EXPIRED MEDICINE': '#EF4444',
  'WASTED MEDICINE': '#F59E0B',
  'Damaged': '#8B5CF6',
  'Quality Issue': '#10B981',
  'Other': '#6B7280'
} as const

const getColorClass = (reason: string) => {
  switch (reason.toUpperCase()) {
    case 'EXPIRED MEDICINE': return 'bg-red-500'
    case 'WASTED MEDICINE': return 'bg-yellow-500'
    case 'DAMAGED': return 'bg-purple-500'
    case 'QUALITY ISSUE': return 'bg-green-500'
    default: return 'bg-gray-500'
  }
}
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
  LabelList
} from 'recharts'

interface MedicineWasteModalProps {
  isOpen: boolean
  onClose: () => void
  endpointId: string
  currentValue: string | number
  data?: any
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

export function MedicineWasteModal({
  isOpen,
  onClose,
  endpointId,
  currentValue,
  data
}: MedicineWasteModalProps) {
  const theme = getThemeForEndpoint(endpointId)
  const [activeTab, setActiveTab] = useState('medicines')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [reasonFilter, setReasonFilter] = useState('all')
  const [sortState, setSortState] = useState<SortState>({ key: 'totalValue', direction: 'desc' })

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

  // Live refresh filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [medicineCategories, setMedicineCategories] = useState('')
  const [medicineName, setMedicineName] = useState('')
  const [apiPageSize, setApiPageSize] = useState('25')
  const [apiPageNumber, setApiPageNumber] = useState('1')
  const [updating, setUpdating] = useState(false)
  const [livePayload, setLivePayload] = useState<any | null>(null)
  const [loadingPage, setLoadingPage] = useState(false)
  const [disableCache, setDisableCache] = useState(false)
  const autoRefreshRef = useRef(false)

  // CRITICAL: Always use fresh API data - clear stale data on open
  useEffect(() => {
    if (isOpen) {
      console.log('[MedicineWasteModal] Modal opened - clearing stale data, will fetch fresh')
      setLivePayload(null)
      setUpdating(false)
    }
  }, [isOpen])

  // Initialize filters from Zustand (single source of truth for dates)
  useEffect(() => {
    if (!isOpen) return

    console.log('[MedicineWasteModal] Initializing filters from Zustand')

    // Dates from Zustand (single source of truth)
    const s = globalFilters.startDate || ''
    const e = globalFilters.endDate || ''
    console.log('[MedicineWasteModal] Dates from Zustand:', { startDate: s, endDate: e })
    setStartDate(s)
    setEndDate(e)

    // Try to prefill required medicine_categories from provided data/payload if available
    try {
      const fromProp = (data as any)?.input_parameters?.medicine_categories
      const fromPayload = (payload as any)?.inputParameters?.medicine_categories || (payload as any)?.input_parameters?.medicine_categories
      let inferred = ''
      const candidate = fromProp ?? fromPayload
      if (Array.isArray(candidate)) {
        inferred = candidate.filter(Boolean).join(',')
      } else if (typeof candidate === 'string') {
        inferred = candidate
      }
      setMedicineCategories(inferred || 'tablet,syrup,injection')
    } catch {
      setMedicineCategories('tablet,syrup,injection')
    }

    // Reset other filters
    setMedicineName('')
    setApiPageSize('25')
    setApiPageNumber('1')
    setLoadingPage(false)
    setDisableCache(false)
  }, [isOpen, hasLoadedPreset, globalFilters.startDate, globalFilters.endDate, data, payload])

  // When payload arrives later, infer medicine_categories if still empty
  useEffect(() => {
    if (!isOpen) return
    if (medicineCategories && medicineCategories.trim() !== '') return
    try {
      const fromProp = (data as any)?.input_parameters?.medicine_categories
      const fromPayload = (payload as any)?.inputParameters?.medicine_categories || (payload as any)?.input_parameters?.medicine_categories
      let inferred = ''
      const candidate = fromProp ?? fromPayload
      if (Array.isArray(candidate)) {
        inferred = candidate.filter(Boolean).join(',')
      } else if (typeof candidate === 'string') {
        inferred = candidate
      }
      setMedicineCategories(inferred || 'tablet,syrup,injection')
    } catch {}
  }, [isOpen, payload, data])

  // Auto-refresh on open to fetch page 1 directly from API with current filters
  useEffect(() => {
    if (isOpen) {
      // mhpl0009 requires medicine_categories header
      if (startDate && endDate && endpointId && medicineCategories && !autoRefreshRef.current) {
        autoRefreshRef.current = true
        setDisableCache(true)
        fetchDataFromAPI(1)
      }
    } else {
      autoRefreshRef.current = false
    }
  }, [isOpen, startDate, endDate, endpointId, apiPageSize, medicineCategories])

  // Fetch data from API with pagination (CLIENT-SIDE API call)
  const fetchDataFromAPI = useCallback(async (pageNum: number) => {
    if (!endpointId) {
      console.error('[MHPL0009 Pagination] No endpoint ID provided')
      toast.error('No endpoint ID provided')
      return
    }

    if (!pageNum || pageNum < 1) {
      console.error('[MHPL0009 Pagination] Invalid page number:', pageNum)
      toast.error('Invalid page number')
      return
    }

    console.log(`[MHPL0009 Pagination] Starting fetch for page ${pageNum}`)
    setDisableCache(true)
    setLoadingPage(true)

    try {
      // Resolve auth token
      let token: string | null = null
      try { token = TokenStorage.getValidToken?.() ?? null } catch {}
      if (!token && typeof window !== 'undefined') {
        token = localStorage.getItem('mhpl_bearer_token') || localStorage.getItem('mhpl_token')
      }
      if (!token) {
        console.error('[MHPL0009 Pagination] No token found in storage')
        toast.error('Authentication required. Please sign in.')
        return
      }

      // Validate required inputs
      if (!startDate || !endDate) {
        toast.error('Start and End dates are required')
        return
      }
      if (!medicineCategories || medicineCategories.trim() === '') {
        toast.error('Medicine categories are required')
        return
      }

      // Build API payload
      const payload: Record<string, any> = {
        StartDate: startDate,
        EndDate: endDate,
        PageNumber: pageNum
      }

      // mhpl0009 requires medicine_categories header (comma-separated string allowed)
      payload.medicine_categories = medicineCategories.trim()
      if (medicineName && medicineName.trim() !== '') {
        payload.medicine_name = medicineName.trim()
      }

      const psNum = parseInt(apiPageSize || '25', 10)
      if (Number.isFinite(psNum) && psNum > 0) {
        payload.PageSize = psNum
      }

      console.log(`[MHPL0009 Pagination] API Request:`, {
        endpoint: endpointId,
        pageRequested: pageNum,
        payload: payload
      })

      const result = await callMHPL_API_WithValidation(endpointId, payload, token)
      if ((result as any)?.status !== 'success') {
        const msg = (result as any)?.message || 'MHPL0009 call failed'
        throw new Error(msg)
      }

      console.log(`[MHPL0009 Pagination] API Response received for page ${pageNum}`)

      // Normalize response shape
      const raw = (result as any).data
      const normalized = raw?.data ? raw.data : raw
      setLivePayload(normalized as any)
      setApiPageNumber(String(pageNum))

      console.log(`[MHPL0009 Pagination] ✅ Successfully loaded page ${pageNum}`)
      toast.success(`Page ${pageNum} loaded`)

    } catch (error: any) {
      console.error('[MHPL0009 Pagination] ❌ Error fetching page:', error)
      toast.error(error?.message || `Failed to load page ${pageNum}`)
    } finally {
      setLoadingPage(false)
      console.log(`[MHPL0009 Pagination] Request completed for page ${pageNum}`)
    }
  }, [endpointId, startDate, endDate, medicineCategories, medicineName, apiPageSize])

  // Use live data if available, otherwise fallback to cached payload; preserve categories/reasons across page fetches
  const dataForDisplay = disableCache ? livePayload : (livePayload || payload)

  const mhpl0009Data = useMemo(() => {
    const baseFirst = (payload as any)?.data ?? payload
    const baseActual = (baseFirst as any)?.data ?? baseFirst

    const effFirst = (dataForDisplay as any)?.data ?? dataForDisplay
    const effActual = (effFirst as any)?.data ?? effFirst

    const merged = {
      ...(baseActual || {}),
      ...(effActual || {}),
      groupByReason: (effActual as any)?.groupByReason ?? (baseActual as any)?.groupByReason,
      groupByCategory: (effActual as any)?.groupByCategory ?? (baseActual as any)?.groupByCategory
    }

    console.log('[MHPL0009] Data structure:', {
      hasData: !!merged,
      hasTotals: !!(merged as any)?.totals,
      hasGroupByMedicines: !!(merged as any)?.groupByMedicines,
      hasGroupByReason: !!(merged as any)?.groupByReason,
      hasGroupByCategory: !!(merged as any)?.groupByCategory
    })

    return merged
  }, [payload, dataForDisplay])

  // Transform MHPL0009 data for display
  const transformedData = useMemo(() => {
    if (!mhpl0009Data) return {
      medicines: [] as Array<{
        medicineName: string
        category: string
        totalQuantity: number
        totalValue: number
        wastedQuantity: number
        wastedValue: number
        expiredQuantity: number
        expiredValue: number
        percentageOfLoss: number
      }>,
      monthlyWaste: [] as Array<{
        month: string
        totalValue: number
        totalQuantity: number
        wastedValue: number
        expiredValue: number
        wastedQuantity: number
        expiredQuantity: number
      }>,
      yearlyWaste: [] as Array<{
        year: string
        totalValue: number
        totalQuantity: number
        wastedValue: number
        expiredValue: number
      }>,
      reasons: [] as Array<{
        reason: string
        totalQuantity: number
        totalValue: number
        percentage: number
      }>,
      categories: [] as Array<{
        category: string
        totalQuantity: number
        totalValue: number
        wastedValue: number
        expiredValue: number
        percentageOfLoss: number
      }>,
      totals: {
        totalLossValue: 0,
        totalExpiredValue: 0,
        totalWastedValue: 0,
        totalExpiredQuantity: 0,
        totalWastedQuantity: 0
      }
    }

    const medicines = mhpl0009Data?.groupByMedicines?.items?.map((medicine: Medicine) => ({
      medicineName: medicine.medicine_name,
      category: medicine.category,
      totalQuantity: medicine.total_quantity,
      totalValue: medicine.total_value,
      wastedQuantity: medicine.wasted_quantity,
      wastedValue: medicine.wasted_value,
      expiredQuantity: medicine.expired_quantity,
      expiredValue: medicine.expired_value,
      percentageOfLoss: medicine.percentage_of_total_loss
    })) || []

    const monthlyWaste = mhpl0009Data?.groupByMonth?.items?.map((item: MonthlyWaste) => ({
      month: item.month,
      totalValue: item.total_value,
      totalQuantity: item.total_quantity,
      wastedValue: item.total_wasted_value,
      expiredValue: item.total_expired_value,
      wastedQuantity: item.total_wasted_quantity,
      expiredQuantity: item.total_expired_quantity
    })) || []

    const yearlyWaste = mhpl0009Data?.groupByYear?.items?.map((item: YearlyWaste) => ({
      year: item.year,
      totalValue: item.total_value,
      totalQuantity: item.total_quantity,
      wastedValue: item.total_wasted_value,
      expiredValue: item.total_expired_value
    })) || []

    const reasons = mhpl0009Data?.groupByReason?.items?.map((item: ReasonWise) => ({
      reason: item.reason,
      totalQuantity: item.total_quantity,
      totalValue: item.total_value,
      percentage: item.percentage_of_total_loss
    })) || []

    const categories = mhpl0009Data?.groupByCategory?.items?.map((item: CategoryWise) => ({
      category: item.category,
      totalQuantity: item.total_quantity,
      totalValue: item.total_value,
      wastedValue: item.total_wasted_value,
      expiredValue: item.total_expired_value,
      percentageOfLoss: item.percentage_of_total_loss
    })) || []

    // Handle totals: use totals object (which contains aggregate fields) rather than items[0]
    const totalsData = mhpl0009Data?.totals || {}
    const totals = {
      totalLossValue: totalsData.total_loss_value || 0,
      totalLossPercentage: totalsData.total_loss_percentage || 0,
      totalLossQuantity: totalsData.total_loss_quantity || 0,
      totalExpiredValue: totalsData.total_expired_value || 0,
      totalWastedValue: totalsData.total_wasted_value || 0,
      totalExpiredQuantity: totalsData.total_expired_quantity || 0,
      totalWastedQuantity: totalsData.total_wasted_quantity || 0
    }

    return { medicines, monthlyWaste, yearlyWaste, reasons, categories, totals }
  }, [mhpl0009Data])

  // Extract pagination metadata from API response
  const apiPaginationMeta = useMemo(() => {
    // Check groupByMedicines for pagination metadata (this is the main paginated data)
    if (mhpl0009Data?.groupByMedicines) {
      return {
        pageNumber: mhpl0009Data.groupByMedicines.page_number || mhpl0009Data.groupByMedicines.PAGE_NUMBER || 1,
        pageSize: mhpl0009Data.groupByMedicines.page_size || mhpl0009Data.groupByMedicines.PAGE_SIZE || 25,
        totalPages: mhpl0009Data.groupByMedicines.total_pages || mhpl0009Data.groupByMedicines.TOTAL_PAGES || 1,
        totalRecords: mhpl0009Data.groupByMedicines.total_records || mhpl0009Data.groupByMedicines.TOTAL_RECORDS || 0
      }
    }

    return { pageNumber: 1, pageSize: 25, totalPages: 1, totalRecords: 0 }
  }, [mhpl0009Data])

  // Extract pagination metadata for Reasons and Categories as well
  const reasonsPaginationMeta = useMemo(() => {
    if (mhpl0009Data?.groupByReason) {
      return {
        pageNumber: mhpl0009Data.groupByReason.page_number || mhpl0009Data.groupByReason.PAGE_NUMBER || 1,
        pageSize: mhpl0009Data.groupByReason.page_size || mhpl0009Data.groupByReason.PAGE_SIZE || 25,
        totalPages: mhpl0009Data.groupByReason.total_pages || mhpl0009Data.groupByReason.TOTAL_PAGES || 1,
        totalRecords: mhpl0009Data.groupByReason.total_records || mhpl0009Data.groupByReason.TOTAL_RECORDS || 0
      }
    }
    return { pageNumber: 1, pageSize: 25, totalPages: 1, totalRecords: 0 }
  }, [mhpl0009Data])

  const categoriesPaginationMeta = useMemo(() => {
    if (mhpl0009Data?.groupByCategory) {
      return {
        pageNumber: mhpl0009Data.groupByCategory.page_number || mhpl0009Data.groupByCategory.PAGE_NUMBER || 1,
        pageSize: mhpl0009Data.groupByCategory.page_size || mhpl0009Data.groupByCategory.PAGE_SIZE || 25,
        totalPages: mhpl0009Data.groupByCategory.total_pages || mhpl0009Data.groupByCategory.TOTAL_PAGES || 1,
        totalRecords: mhpl0009Data.groupByCategory.total_records || mhpl0009Data.groupByCategory.TOTAL_RECORDS || 0
      }
    }
    return { pageNumber: 1, pageSize: 25, totalPages: 1, totalRecords: 0 }
  }, [mhpl0009Data])

  // Filtered and sorted medicines
  const filteredMedicines = useMemo(() => {
    let filtered = transformedData.medicines

    if (searchTerm) {
      filtered = filtered.filter((medicine: typeof transformedData.medicines[0]) =>
        medicine.medicineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        medicine.category.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter((medicine: typeof transformedData.medicines[0]) => medicine.category === categoryFilter)
    }

    if (reasonFilter !== 'all') {
      const isExpired = reasonFilter === 'EXPIRED MEDICINE'
      filtered = filtered.filter((medicine: typeof transformedData.medicines[0]) =>
        isExpired ? medicine.expiredQuantity > 0 : medicine.wastedQuantity > 0
      )
    }

    filtered.sort((a: typeof transformedData.medicines[0], b: typeof transformedData.medicines[0]) => {
      const aVal = a[sortState.key as keyof typeof a]
      const bVal = b[sortState.key as keyof typeof b]
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortState.direction === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [transformedData.medicines, searchTerm, categoryFilter, reasonFilter, sortState])

  // Paginated medicines data
  const paginatedMedicines = useMemo(() => {
    setPagination(prev => ({ ...prev, totalItems: filteredMedicines.length }))
    const startIndex = (pagination.currentPage - 1) * pagination.pageSize
    return filteredMedicines.slice(startIndex, startIndex + pagination.pageSize)
  }, [filteredMedicines, pagination.currentPage, pagination.pageSize])

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

  // Removed trends view per requirement

  // Top waste medicines chart data
  const topWasteMedicinesChart = useMemo(() => {
    return transformedData.medicines
      .sort((a: typeof transformedData.medicines[0], b: typeof transformedData.medicines[0]) => b.totalValue - a.totalValue)
      .slice(0, 10)
      .map((medicine: typeof transformedData.medicines[0]) => ({
        name: medicine.medicineName.length > 15
          ? `${medicine.medicineName.substring(0, 15)}...`
          : medicine.medicineName,
        value: medicine.totalValue,
        wasted: medicine.wastedValue,
        expired: medicine.expiredValue
      }))
  }, [transformedData.medicines])

  // Waste by reason chart data
  const wasteByReasonData = useMemo(() => {
    return transformedData.reasons.map((reason: typeof transformedData.reasons[0]) => ({
      reason: reason.reason,
      value: reason.totalValue,
      quantity: reason.totalQuantity,
      percentage: reason.percentage,
      color: COLOR_MAP[reason.reason as keyof typeof COLOR_MAP] || '#6B7280'
    }))
  }, [transformedData.reasons])

  // Export data
  const exportData = () => {
    const csvData = [
      ['Medicine Name', 'Category', 'Total Quantity', 'Expired Quantity', 'Wasted Quantity', 'Total Value', 'Expired Value', 'Wasted Value', '% of Total Loss'],
      ...filteredMedicines.map((medicine: typeof transformedData.medicines[0]) => [
        medicine.medicineName,
        medicine.category,
        medicine.totalQuantity,
        medicine.expiredQuantity,
        medicine.wastedQuantity,
        medicine.totalValue.toFixed(2),
        medicine.expiredValue.toFixed(2),
        medicine.wastedValue.toFixed(2),
        medicine.percentageOfLoss.toFixed(2)
      ])
    ]

    const csvContent = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `medicine-waste-analysis-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (sortState.key !== column) return <Package className="w-3 h-3 ml-1 opacity-30" />
    return sortState.direction === 'asc' ?
      <ChevronUp className="w-3 h-3 ml-1" /> :
      <ChevronDown className="w-3 h-3 ml-1" />
  }

  const formatCurrency = (value: number | undefined | null) => `৳${Number(value || 0).toLocaleString()}`

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-6xl lg:max-w-7xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Enhanced Header */}
        <div className={cn("sticky top-0 z-10 bg-gradient-to-r text-white px-4 sm:px-6 py-4 sm:py-5 shadow-lg", theme.gradient)}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl lg:text-2xl font-bold mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Trash2 className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span className="truncate">Medicine Waste Analysis</span>
              </DialogTitle>
              <DialogDescription className="text-white/90 text-xs sm:text-sm">
                • Total Loss Value: <span className="font-semibold text-white">{formatCurrency(transformedData.totals.totalLossValue)}</span>
                {/* • Total Loss Quantity: <span className="font-semibold text-white">({Number((transformedData as any)?.totals?.totalLossQuantity || 0).toLocaleString()})</span> */}
                {` • Wasted: ${formatCurrency((transformedData as any)?.totals?.totalWastedValue || 0)} `} 
                {/* Wasted Quantity (${Number((transformedData as any)?.totals?.totalWastedQuantity || 0).toLocaleString()}) */}
                {` • Expired: ${formatCurrency((transformedData as any)?.totals?.totalExpiredValue || 0)}`}
                {/* Expired Quantity (${Number((transformedData as any)?.totals?.totalExpiredQuantity || 0).toLocaleString()}) */}
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

          {/* Loading State */}
          {loading && (
            <div className="p-12 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading medicine waste data...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="p-12 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <p className="text-red-600 font-medium">Failed to load waste data</p>
                <p className="text-gray-600 text-sm mt-2">{error}</p>
                <Button className="mt-4" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Loading bar during update */}
          {loadingPage && (
            <div className="px-6 pt-4">
              <div className="flex items-center gap-2 text-sm text-blue-600 mb-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading data...</span>
              </div>
              <Progress value={66} />
            </div>
          )}

          {/* Filter Bar for live refresh */}
          <div className="px-6 pt-4">
            <Card className="mb-4 border-2 hover:shadow-lg transition-shadow">
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
                  <div>
                    <Label className="text-xs">Start Date</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">End Date</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Medicine Categories</Label>
                    <Input type="text" placeholder="e.g. tablet,syrup" value={medicineCategories} onChange={(e) => setMedicineCategories(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Medicine Name (optional)</Label>
                    <Input type="text" placeholder="e.g. Paracetamol" value={medicineName} onChange={(e) => setMedicineName(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Page Size</Label>
                    <Input type="number" min={1} placeholder="25" value={apiPageSize} onChange={(e) => setApiPageSize(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Page Number</Label>
                    <Input type="number" min={1} placeholder="1" value={apiPageNumber} onChange={(e) => setApiPageNumber(e.target.value)} />
                  </div>
                  <div className="flex md:justify-end">
                    <Button
                      className="w-full md:w-auto"
                      disabled={loadingPage || !startDate || !endDate || !medicineCategories}
                      onClick={async () => {
                        const desired = parseInt(apiPageNumber || '1', 10)
                        const targetPage = Number.isFinite(desired) && desired > 0 ? desired : 1
                        await fetchDataFromAPI(targetPage)
                      }}
                    >
                      {loadingPage ? (
                        <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Updating</span>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Update
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Content */}
          {!loading && !error && (
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="medicines" className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Medicines
                  </TabsTrigger>
                  <TabsTrigger value="categories" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Categories
                  </TabsTrigger>
                  <TabsTrigger value="reasons" className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Reasons
                  </TabsTrigger>
                </TabsList>

                {/* Overview tab removed by request */}


                {/* Reasons Tab */}
                <TabsContent value="reasons" className="space-y-6 mt-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          Waste Reasons Analysis
                        </CardTitle>
                        {/* Server-side pagination for reasons */}
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" onClick={() => fetchDataFromAPI(1)} disabled={loadingPage || reasonsPaginationMeta.pageNumber === 1} title="First page" className="h-8 w-8 p-0">
                            <ChevronsLeft className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => fetchDataFromAPI(Math.max(1, reasonsPaginationMeta.pageNumber - 1))} disabled={loadingPage || reasonsPaginationMeta.pageNumber === 1} title="Previous page" className="h-8 w-8 p-0">
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <div className="hidden md:flex items-center gap-1 mx-2">
                            {Array.from({ length: Math.min(5, reasonsPaginationMeta.totalPages) }, (_, i) => {
                              let pageNum: number
                              const current = reasonsPaginationMeta.pageNumber
                              const total = reasonsPaginationMeta.totalPages
                              if (total <= 5) pageNum = i + 1
                              else if (current <= 3) pageNum = i + 1
                              else if (current >= total - 2) pageNum = total - 4 + i
                              else pageNum = current - 2 + i
                              return (
                                <Button key={pageNum} size="sm" variant={reasonsPaginationMeta.pageNumber === pageNum ? 'default' : 'outline'} onClick={() => fetchDataFromAPI(pageNum)} disabled={loadingPage} className="w-10 h-8 text-xs">
                                  {pageNum}
                                </Button>
                              )
                            })}
                          </div>
                          <Button size="sm" variant="outline" onClick={() => fetchDataFromAPI(Math.min(reasonsPaginationMeta.totalPages, reasonsPaginationMeta.pageNumber + 1))} disabled={loadingPage || reasonsPaginationMeta.pageNumber === reasonsPaginationMeta.totalPages} title="Next page" className="h-8 w-8 p-0">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => fetchDataFromAPI(reasonsPaginationMeta.totalPages)} disabled={loadingPage || reasonsPaginationMeta.pageNumber === reasonsPaginationMeta.totalPages} title="Last page" className="h-8 w-8 p-0">
                            <ChevronsRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-end mb-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => exportData()}
                          title="Export all medicines (filtered)"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export CSV
                        </Button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="p-3 text-left font-medium">Reason</th>
                              <th className="p-3 text-center font-medium">Total Quantity</th>
                              <th className="p-3 text-center font-medium">Total Value</th>
                              <th className="p-3 text-center font-medium">% of Total Loss</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transformedData.reasons.map((reason: typeof transformedData.reasons[0], index: number) => (
                              <tr key={index} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-medium">
                                  <div className="flex items-center gap-2">
                                    <div className={cn("w-3 h-3 rounded-full", getColorClass(reason.reason))} />
                                    {reason.reason}
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <Badge variant="outline" className="text-blue-600">
                                    {reason.totalQuantity.toLocaleString()}
                                  </Badge>
                                </td>
                                <td className="p-3 text-center font-bold text-red-600">
                                  {formatCurrency(reason.totalValue)}
                                </td>
                                <td className="p-3 text-center">
                                  <Badge variant="secondary" className="text-purple-600">
                                    {reason.percentage.toFixed(2)}%
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="mt-2 text-xs text-gray-500">Showing page {reasonsPaginationMeta.pageNumber} of {reasonsPaginationMeta.totalPages} • {reasonsPaginationMeta.totalRecords} total reasons</div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Categories Tab */}
                <TabsContent value="categories" className="space-y-6 mt-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          Medicine Categories Analysis
                        </CardTitle>
                        {/* Server-side pagination for categories */}
                        <div className="flex items-center gap-2">
                          <div className="hidden md:flex items-center gap-2">
                            <span className="text-xs text-gray-600">Per page:</span>
                            <Select
                              value={apiPageSize}
                              onValueChange={(value) => {
                                setApiPageSize(value)
                                fetchDataFromAPI(1)
                              }}
                              disabled={loadingPage}
                            >
                              <SelectTrigger className="w-20 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" onClick={() => fetchDataFromAPI(1)} disabled={loadingPage || categoriesPaginationMeta.pageNumber === 1} title="First page" className="h-8 w-8 p-0">
                              <ChevronsLeft className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => fetchDataFromAPI(Math.max(1, categoriesPaginationMeta.pageNumber - 1))} disabled={loadingPage || categoriesPaginationMeta.pageNumber === 1} title="Previous page" className="h-8 w-8 p-0">
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="hidden md:flex items-center gap-1 mx-2">
                              {Array.from({ length: Math.min(5, categoriesPaginationMeta.totalPages) }, (_, i) => {
                                let pageNum: number
                                const current = categoriesPaginationMeta.pageNumber
                                const total = categoriesPaginationMeta.totalPages
                                if (total <= 5) pageNum = i + 1
                                else if (current <= 3) pageNum = i + 1
                                else if (current >= total - 2) pageNum = total - 4 + i
                                else pageNum = current - 2 + i
                                return (
                                  <Button key={pageNum} size="sm" variant={categoriesPaginationMeta.pageNumber === pageNum ? 'default' : 'outline'} onClick={() => fetchDataFromAPI(pageNum)} disabled={loadingPage} className="w-10 h-8 text-xs">
                                    {pageNum}
                                  </Button>
                                )
                              })}
                            </div>
                            <Button size="sm" variant="outline" onClick={() => fetchDataFromAPI(Math.min(categoriesPaginationMeta.totalPages, categoriesPaginationMeta.pageNumber + 1))} disabled={loadingPage || categoriesPaginationMeta.pageNumber === categoriesPaginationMeta.totalPages} title="Next page" className="h-8 w-8 p-0">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => fetchDataFromAPI(categoriesPaginationMeta.totalPages)} disabled={loadingPage || categoriesPaginationMeta.pageNumber === categoriesPaginationMeta.totalPages} title="Last page" className="h-8 w-8 p-0">
                              <ChevronsRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="p-3 text-left font-medium">Category</th>
                              <th className="p-3 text-center font-medium">Total Quantity</th>
                              <th className="p-3 text-center font-medium">Total Value</th>
                              <th className="p-3 text-center font-medium">Wasted Value</th>
                              <th className="p-3 text-center font-medium">Expired Value</th>
                              <th className="p-3 text-center font-medium">% of Total Loss</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transformedData.categories.map((category: typeof transformedData.categories[0], index: number) => (
                              <tr key={index} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-medium">
                                  <div className="flex items-center gap-2">
                                    <Package className="w-4 h-4 text-gray-400" />
                                    {category.category}
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <Badge variant="outline" className="text-blue-600">
                                    {category.totalQuantity.toLocaleString()}
                                  </Badge>
                                </td>
                                <td className="p-3 text-center font-bold text-green-600">
                                  {formatCurrency(category.totalValue)}
                                </td>
                                <td className="p-3 text-center text-orange-600">
                                  {formatCurrency(category.wastedValue)}
                                </td>
                                <td className="p-3 text-center text-red-600">
                                  {formatCurrency(category.expiredValue)}
                                </td>
                                <td className="p-3 text-center">
                                  <Badge variant="secondary" className="text-purple-600">
                                    {category.percentageOfLoss.toFixed(2)}%
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="mt-2 text-xs text-gray-500">Showing page {categoriesPaginationMeta.pageNumber} of {categoriesPaginationMeta.totalPages} • {categoriesPaginationMeta.totalRecords} total categories</div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Top Medicines Tab */}
                <TabsContent value="medicines" className="space-y-6 mt-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="flex items-center gap-2">
                          <Package className="w-5 h-5" />
                          Top Medicines by Loss Value
                        </CardTitle>
                        <Button
                          size="sm"
                          onClick={() => exportData()}
                          className="hidden sm:inline-flex"
                        >
                          <Download className="w-4 h-4 mr-2" /> Export CSV
                        </Button>
                      </div>
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Search className="w-4 h-4 text-gray-400" />
                          <Input
                            placeholder="Search medicines..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-64"
                          />
                        </div>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Filter by category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {(
                              (transformedData as any)?.categories?.map((c: any) => c.category) ||
                              Array.from(new Set(transformedData.medicines.map((m: typeof transformedData.medicines[0]) => m.category)))
                            ).map((cat: string) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={reasonFilter} onValueChange={setReasonFilter}>
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Filter by reason" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Reasons</SelectItem>
                            <SelectItem value="EXPIRED MEDICINE">Expired</SelectItem>
                            <SelectItem value="WASTED MEDICINE">Wasted</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={() => exportData()} className="sm:hidden inline-flex">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="p-3 text-left font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('medicineName')}>
                                Medicine Name <SortIcon column="medicineName" />
                              </th>
                              <th className="p-3 text-center font-medium">Category</th>
                              <th className="p-3 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('expiredQuantity')}>
                                Expired Qty <SortIcon column="expiredQuantity" />
                              </th>
                              <th className="p-3 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('wastedQuantity')}>
                                Wasted Qty <SortIcon column="wastedQuantity" />
                              </th>
                              <th className="p-3 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('expiredValue')}>
                                Expired Value <SortIcon column="expiredValue" />
                              </th>
                              <th className="p-3 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('wastedValue')}>
                                Wasted Value <SortIcon column="wastedValue" />
                              </th>
                              <th className="p-3 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('totalQuantity')}>
                                Total Qty <SortIcon column="totalQuantity" />
                              </th>
                              <th className="p-3 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('totalValue')}>
                                Total Value <SortIcon column="totalValue" />
                              </th>
                              <th className="p-3 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('percentageOfLoss')}>
                                % of Total Loss <SortIcon column="percentageOfLoss" />
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedMedicines.map((medicine: typeof transformedData.medicines[0], index: number) => (
                              <tr key={`${medicine.medicineName}-${index}`} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-medium">
                                  <div className="flex items-center gap-2">
                                    <Package className="w-4 h-4 text-gray-400" />
                                    <div className="truncate max-w-xs" title={medicine.medicineName}>
                                      {medicine.medicineName}
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <Badge variant="outline" className="text-xs">
                                    {medicine.category}
                                  </Badge>
                                </td>
                                <td className="p-3 text-center">{medicine.expiredQuantity}</td>
                                <td className="p-3 text-center">{medicine.wastedQuantity}</td>
                                <td className="p-3 text-center text-red-600">{formatCurrency(medicine.expiredValue)}</td>
                                <td className="p-3 text-center text-orange-600">{formatCurrency(medicine.wastedValue)}</td>
                                <td className="p-3 text-center">{medicine.totalQuantity}</td>
                                <td className="p-3 text-center font-bold text-blue-600">{formatCurrency(medicine.totalValue)}</td>
                                <td className="p-3 text-center">
                                  <Badge variant="secondary" className="text-purple-600">
                                    {medicine.percentageOfLoss.toFixed(2)}%
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Server-Side Pagination Controls */}
                      {apiPaginationMeta.totalPages > 1 && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                            {/* Left side - Page info */}
                            <div className="text-sm text-gray-600 font-medium">
                              Page {apiPaginationMeta.pageNumber} of {apiPaginationMeta.totalPages}
                              <span className="ml-2 text-gray-500">
                                ({apiPaginationMeta.totalRecords} total medicines)
                              </span>
                            </div>

                            {/* Center - Page Size Selection */}
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-gray-600">Show:</span>
                              <Select
                                value={apiPageSize}
                                onValueChange={(value) => {
                                  setApiPageSize(value)
                                  fetchDataFromAPI(1) // Reset to page 1 when changing page size
                                }}
                                disabled={loadingPage}
                              >
                                <SelectTrigger className="w-20 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="10">10</SelectItem>
                                  <SelectItem value="25">25</SelectItem>
                                  <SelectItem value="50">50</SelectItem>
                                  <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Right side - Navigation */}
                            <div className="flex items-center gap-1">
                              {/* First */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => fetchDataFromAPI(1)}
                                disabled={loadingPage || apiPaginationMeta.pageNumber === 1}
                                title="First page"
                                className="h-8 w-8 p-0"
                              >
                                <ChevronsLeft className="h-4 w-4" />
                              </Button>

                              {/* Previous */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => fetchDataFromAPI(apiPaginationMeta.pageNumber - 1)}
                                disabled={loadingPage || apiPaginationMeta.pageNumber === 1}
                                title="Previous page"
                                className="h-8 w-8 p-0"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Button>

                              {/* Page Numbers */}
                              <div className="flex items-center gap-1 mx-2">
                                {Array.from({ length: Math.min(5, apiPaginationMeta.totalPages) }, (_, i) => {
                                  let pageNum: number
                                  const current = apiPaginationMeta.pageNumber
                                  const total = apiPaginationMeta.totalPages

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
                                    <Button
                                      key={pageNum}
                                      size="sm"
                                      variant={apiPaginationMeta.pageNumber === pageNum ? 'default' : 'outline'}
                                      onClick={() => fetchDataFromAPI(pageNum)}
                                      disabled={loadingPage}
                                      className="w-10 h-8 text-xs"
                                    >
                                      {pageNum}
                                    </Button>
                                  )
                                })}
                              </div>

                              {/* Next */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => fetchDataFromAPI(apiPaginationMeta.pageNumber + 1)}
                                disabled={loadingPage || apiPaginationMeta.pageNumber === apiPaginationMeta.totalPages}
                                title="Next page"
                                className="h-8 w-8 p-0"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>

                              {/* Last */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => fetchDataFromAPI(apiPaginationMeta.totalPages)}
                                disabled={loadingPage || apiPaginationMeta.pageNumber === apiPaginationMeta.totalPages}
                                title="Last page"
                                className="h-8 w-8 p-0"
                              >
                                <ChevronsRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
      </DialogContent>
    </Dialog>
  )
}
