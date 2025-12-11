'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { TrendingUp, TrendingDown, Calendar, Bed, AlertTriangle, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Filter, User, X, Download, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
// Tabs removed: single All Beds view only
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { getThemeForEndpoint } from '@/lib/constants/drillDownThemes'
import { useStoredKpiData } from '@/lib/hooks/useStoredKpiData'
import { type BedDetail, type AvailableBed } from '@/lib/api/schemas/mhpl0007-schema'
import { TokenStorage } from '@/lib/tokenStorage'
import { callMHPL_API_WithValidation } from '@/lib/api/mhplApi'
import { useFilterState } from '@/components/filters/FilterStateProvider'
import { useDashboardStore } from '@/lib/store/dashboard-store'
import toast from 'react-hot-toast'
// Charts removed for simplified header; overview tab disabled

interface BedOccupancyModalProps {
  isOpen: boolean
  onClose: () => void
  endpointId: string
  currentValue: string | number
  data?: any
}

// All type definitions now come from the Zod schema
// BedDetail, AvailableBed, and MHPL0007Response are imported from '@/lib/api/schemas/mhpl0007-schema'

interface PaginationState {
  currentPage: number
  pageSize: number
  totalItems: number
}

interface SortState {
  key: string
  direction: 'asc' | 'desc'
}

export function BedOccupancyModal({
  isOpen,
  onClose,
  endpointId,
  currentValue,
  data
}: BedOccupancyModalProps) {
  const theme = getThemeForEndpoint(endpointId)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [wardFilter, setWardFilter] = useState('all')
  const [sortState, setSortState] = useState<SortState>({ key: 'bedId', direction: 'asc' })

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

  // Live refresh filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [wardsParam, setWardsParam] = useState('')
  const [bedTypeParam, setBedTypeParam] = useState('')
  const [thresholdParam, setThresholdParam] = useState('70')
  const [apiPageSize, setApiPageSize] = useState('10000')
  const [updating, setUpdating] = useState(false)
  const [livePayload, setLivePayload] = useState<any | null>(null)

  // CRITICAL: Always use fresh API data - clear stale data on open
  useEffect(() => {
    if (isOpen) {
      console.log('[BedOccupancyModal] Modal opened - clearing stale data, will fetch fresh')
      setLivePayload(null)
      setUpdating(false)
    }
  }, [isOpen])

  // Initialize filters from Zustand (single source of truth for dates)
  useEffect(() => {
    if (!isOpen) return

    console.log('[BedOccupancyModal] Initializing filters from Zustand')

    // Dates from Zustand (single source of truth)
    const s = globalFilters.startDate || ''
    const e = globalFilters.endDate || ''
    console.log('[BedOccupancyModal] Dates from Zustand:', { startDate: s, endDate: e })
    setStartDate(s)
    setEndDate(e)

    // Initialize threshold from endpointOverrides (KPI chip edit), fallback to globalFilters.threshold or 70
    try {
      const storeThreshold = endpointOverrides?.['mhpl0007']?.Threshold
      const effectiveThreshold = (storeThreshold && String(storeThreshold).trim() !== '')
        ? String(storeThreshold)
        : (globalFilters.threshold || '70')
      setThresholdParam(effectiveThreshold)
    } catch {
      setThresholdParam('70')
    }

    // Reset other filters
    setWardsParam('')
    setBedTypeParam('')
    setApiPageSize('10')
  }, [isOpen, hasLoadedPreset, globalFilters.startDate, globalFilters.endDate, endpointOverrides])

  const mhpl0007Data = useMemo(() => {
    const effective = livePayload ?? payload
    if (!effective) return null

    // Handle double-nesting: the API returns { data: { alerts, totals, ... } }
    // useStoredKpiData extracts the first level, but we need to check for second level
    const actualData = effective.data ? effective.data : effective

    // Log for debugging
    console.log('[MHPL0007] Data structure:', {
      hasData: !!actualData,
      hasAlerts: !!actualData?.alerts,
      hasTotals: !!actualData?.totals,
      hasGroupByDateAndBed: !!actualData?.groupByDateAndBed
    })

    return actualData
  }, [payload, livePayload])

  const transformedData = useMemo(() => {
    if (!mhpl0007Data) return {
      allBeds: [] as BedDetail[],
      occupiedBeds: [] as BedDetail[],
      availableBeds: [] as AvailableBed[],
      unavailableBeds: [] as BedDetail[],
      totals: { totalBeds: 0, occupiedBeds: 0, availableBeds: 0, unavailableBeds: 0, occupancyRate: 0 },
      wards: [] as string[],
      alerts: { occupancyBelowStandard: false, threshold: 50, currentOccupancyRate: 0, message: '' }
    }

    const allBeds = mhpl0007Data.groupByDateAndBed?.items || []
    const availableBeds = mhpl0007Data.groupByAvailable?.items || []
    const occupiedBeds = allBeds.filter((bed: BedDetail) => bed.status === 'OCCUPIED')
    const unavailableBeds = allBeds.filter((bed: BedDetail) => bed.status === 'UNAVAILABLE')

    const totals = mhpl0007Data.totals ? {
      totalBeds: mhpl0007Data.totals.total_beds,
      occupiedBeds: mhpl0007Data.totals.occupied_beds,
      availableBeds: mhpl0007Data.totals.available_beds,
      unavailableBeds: mhpl0007Data.totals.unavailable_beds,
      occupancyRate: mhpl0007Data.totals.occupancy_rate
    } : {
      totalBeds: 0,
      occupiedBeds: 0,
      availableBeds: 0,
      unavailableBeds: 0,
      occupancyRate: 0
    }

    const wards = [...new Set(allBeds.map((bed: BedDetail) => bed.ward).filter(Boolean))]

    const alerts = mhpl0007Data.alerts ? {
      occupancyBelowStandard: mhpl0007Data.alerts.occupancy_below_standard === 'true',
      threshold: mhpl0007Data.alerts.threshold,
      currentOccupancyRate: mhpl0007Data.alerts.current_occupancy_rate,
      message: mhpl0007Data.alerts.message
    } : {
      occupancyBelowStandard: false,
      threshold: 50,
      currentOccupancyRate: 0,
      message: ''
    }

    return { allBeds, occupiedBeds, availableBeds, unavailableBeds, totals, wards, alerts }
  }, [mhpl0007Data])

  const filteredBeds = useMemo(() => {
    let filtered = transformedData.allBeds

    if (searchTerm) {
      filtered = filtered.filter((bed: BedDetail) =>
        bed.bed_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bed.ward.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bed.bed_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bed.occupied_by && bed.occupied_by.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((bed: BedDetail) => bed.status === statusFilter.toUpperCase())
    }

    if (wardFilter !== 'all') {
      filtered = filtered.filter((bed: BedDetail) => bed.ward === wardFilter)
    }

    filtered.sort((a: BedDetail, b: BedDetail) => {
      let aVal: string | number
      let bVal: string | number

      switch (sortState.key) {
        case 'date':
          aVal = new Date(a.date).getTime() || a.date
          bVal = new Date(b.date).getTime() || b.date
          break
        case 'bedId':
          aVal = parseInt(a.bed_id) || a.bed_id
          bVal = parseInt(b.bed_id) || b.bed_id
          break
        case 'ward':
          aVal = a.ward
          bVal = b.ward
          break
        case 'bedType':
          aVal = a.bed_type
          bVal = b.bed_type
          break
        case 'status':
          aVal = a.status
          bVal = b.status
          break
        default:
          aVal = a.bed_id
          bVal = b.bed_id
      }

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortState.direction === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [transformedData.allBeds, searchTerm, statusFilter, wardFilter, sortState])

  const paginatedBeds = useMemo(() => {
    setPagination(prev => ({ ...prev, totalItems: filteredBeds.length }))
    const startIndex = (pagination.currentPage - 1) * pagination.pageSize
    return filteredBeds.slice(startIndex, startIndex + pagination.pageSize)
  }, [filteredBeds, pagination.currentPage, pagination.pageSize])

  const totalPages = Math.ceil(pagination.totalItems / pagination.pageSize)

  const handleSort = (key: string) => {
    setSortState(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const goToPage = (page: number) => {
    setPagination(prev => ({ ...prev, currentPage: Math.max(1, Math.min(page, totalPages)) }))
  }

  const changePageSize = (size: number) => {
    setPagination(prev => ({
      ...prev,
      pageSize: size,
      currentPage: 1
    }))
  }

  // Removed Available tab pagination/state: single All Beds view only

  // Removed unused derived chart data (no tabs/overview)

  const exportData = () => {
    const csvData = [
      ['Date','Bed ID', 'Ward', 'Bed Type', 'Status', 'Occupied By'],
      ...transformedData.allBeds.map((bed: BedDetail) => [
        bed.date,
        bed.bed_id,
        bed.ward,
        bed.bed_type,
        bed.status,
        bed.occupied_by || ''
      ])
    ]

    const csvContent = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bed-occupancy-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  const SortIcon = ({ column }: { column: string }) => {
    if (sortState.key !== column) return <ChevronDown className="w-3 h-3 ml-1 opacity-30" />
    return sortState.direction === 'asc' ?
      <ChevronUp className="w-3 h-3 ml-1" /> :
      <ChevronDown className="w-3 h-3 ml-1" />
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'occupied': return 'bg-red-100 text-red-700 border-red-200'
      case 'available': return 'bg-green-100 text-green-700 border-green-200'
      case 'unavailable': return 'bg-amber-100 text-amber-700 border-amber-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-6xl lg:max-w-7xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Enhanced Header */}
        <div className={cn("sticky top-0 z-10 bg-gradient-to-r text-white px-4 sm:px-6 py-4 sm:py-5", theme.gradient)}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl lg:text-2xl font-bold mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Bed className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span className="truncate">Bed Occupancy Analysis</span>
              </DialogTitle>
              <DialogDescription className="text-white/90 text-xs sm:text-sm">
                • Occupancy Rate: <span className="font-semibold text-white">{transformedData.totals.occupancyRate}%</span>
                {` • Total: ${transformedData.totals.totalBeds?.toLocaleString?.() ?? transformedData.totals.totalBeds}`}
                {` • Occupied: ${transformedData.totals.occupiedBeds?.toLocaleString?.() ?? transformedData.totals.occupiedBeds}`}
                {` • Available: ${transformedData.totals.availableBeds?.toLocaleString?.() ?? transformedData.totals.availableBeds}`}
                {` • Unavailable: ${transformedData.totals.unavailableBeds?.toLocaleString?.() ?? transformedData.totals.unavailableBeds}`}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                onClick={onClose}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 hover:bg-white/20 text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-4 sm:px-6 pb-6">
          {/* Loading bar during update */}
          {updating && (
            <div className="pt-4">
              <Progress value={66} />
            </div>
          )}

          {/* Live filter bar */}
          <div className="pt-4">
            <Card className="mb-4">
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
                    <Label className="text-xs">Wards (optional)</Label>
                    <Input type="text" placeholder="e.g. ICU" value={wardsParam} onChange={(e) => setWardsParam(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Bed Type (optional)</Label>
                    <Input type="text" placeholder="e.g. GENERAL" value={bedTypeParam} onChange={(e) => setBedTypeParam(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Threshold</Label>
                    <Input type="number" min={0} max={100} value={thresholdParam} onChange={(e) => setThresholdParam(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Page Size</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0 = all"
                      value={apiPageSize}
                      onChange={(e) => setApiPageSize(e.target.value)}
                    />
                  </div>
                  <div className="flex md:justify-end">
                    <Button
                      className="w-full md:w-auto"
                      disabled={updating || !startDate || !endDate}
                      onClick={async () => {
                        try {
                          setUpdating(true)
                          const token = TokenStorage.getValidToken() || undefined

                          const requestParams: Record<string, any> = {
                            StartDate: startDate,
                            EndDate: endDate,
                            Threshold: thresholdParam || '70',
                          }
                          if (wardsParam && wardsParam.trim() !== '') requestParams.Wards = wardsParam.trim()
                          if (bedTypeParam && bedTypeParam.trim() !== '') requestParams.BedTypes = bedTypeParam.trim()
                          // Optional paging
                          const includePaging = apiPageSize !== '0'
                          if (includePaging) {
                            requestParams.PageNumber = '1'
                            requestParams.PageSize = apiPageSize || '10'
                          }

                          // Keep KPI chip in sync: persist Threshold to store overrides
                          try { zustandStore.setEndpointOverride('mhpl0007', 'Threshold', String(thresholdParam || '70')) } catch {}

                          const response = await callMHPL_API_WithValidation('mhpl0007', requestParams, token)
                          if (response.status !== 'success') {
                            throw new Error((response as any).message || 'MHPL0007 call failed')
                          }

                          const raw = (response as any).data
                          const normalized = (raw as any)?.data ? (raw as any).data : raw
                          setLivePayload(normalized as any)
                          toast.success('Bed occupancy refreshed')
                        } catch (err: any) {
                          console.error('[MHPL0007] Update failed:', err)
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
              </CardContent>
            </Card>
          </div>
          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-16 sm:py-24">
              <div className="text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-sm sm:text-base text-gray-600 font-medium">Loading bed data...</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Please wait</p>
              </div>
            </div>
          ) : error ? (
            <Card className="mt-6 border-red-200 bg-red-50">
              <CardContent className="p-6 sm:p-8 text-center">
                <AlertTriangle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mx-auto mb-4" />
                <p className="text-red-700 font-semibold text-base sm:text-lg mb-2">Failed to load data</p>
                <p className="text-red-600 text-sm mb-4">{error}</p>
                <Button onClick={() => window.location.reload()} className="bg-red-600 hover:bg-red-700">
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : transformedData.allBeds.length > 0 ? (
            <div className="space-y-4 sm:space-y-6 py-4 sm:py-6">
              {/* Alert Banner */}
              {transformedData.alerts.occupancyBelowStandard && (
                <div className="bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-r-xl p-4 sm:p-5 shadow-sm">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                      <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-red-900 text-sm sm:text-base mb-1">Low Occupancy Alert</h3>
                      <p className="text-red-700 text-xs sm:text-sm leading-relaxed mb-3">{transformedData.alerts.message}</p>
                      <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
                        <div className="flex items-center gap-2 bg-white/60 px-3 py-1.5 rounded-lg">
                          <span className="text-gray-700">Current:</span>
                          <span className="font-bold text-red-600">{transformedData.alerts.currentOccupancyRate}%</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white/60 px-3 py-1.5 rounded-lg">
                          <span className="text-gray-700">Threshold:</span>
                          <span className="font-bold text-gray-900">{transformedData.alerts.threshold}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="w-full">
                {/* Enhanced Tabs Navigation */}
                {/* Tabs removed: single view */}

                {/* Overview Tab removed by request */}

                {/* All Beds (single view) */}
                <div className="space-y-4 mt-0">
                  <Card className="border-2">
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 px-4 sm:px-6 py-4 border-b">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg mb-3">
                        <Bed className="w-5 h-5 text-blue-600" />
                        All Beds ({pagination.totalItems})
                      </CardTitle>
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" onClick={() => {
                          const csvData = [
                            ['Date','Bed ID','Ward','Bed Type','Status','Occupied By'],
                            ...paginatedBeds.map((bed: BedDetail) => [bed.date, bed.bed_id, bed.ward, bed.bed_type, bed.status, bed.occupied_by || ''])
                          ]
                          const csvContent = csvData.map(row => row.join(',')).join('\n')
                          const blob = new Blob([csvContent], { type: 'text/csv' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `beds-page-${pagination.currentPage}.csv`
                          a.click()
                          URL.revokeObjectURL(url)
                        }}>
                          <Download className="w-4 h-4 mr-2" /> Export CSV
                        </Button>
                      </div>
                      {/* Filters */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="lg:col-span-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                              placeholder="Search beds, wards, patients..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-10 bg-white"
                            />
                          </div>
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="occupied">Occupied</SelectItem>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="unavailable">Unavailable</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={wardFilter} onValueChange={setWardFilter}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Ward" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Wards</SelectItem>
                            {(transformedData.wards as string[]).map((ward) => (
                              <SelectItem key={ward} value={ward}>{ward}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <CardContent className="p-0">
                      {/* Mobile Card View */}
                      <div className="block lg:hidden divide-y">
                        {paginatedBeds.map((bed: BedDetail, index: number) => (
                          <div key={`${bed.bed_id}-${index}`} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                  <Bed className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900">{bed.bed_id}</div>
                                  <div className="text-xs text-gray-500">{bed.ward}</div>
                                </div>
                              </div>
                              <Badge className={cn("text-xs font-medium", getStatusColor(bed.status))}>
                                {bed.status}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-500">Type:</span>
                                <span className="ml-2 font-medium">{bed.bed_type}</span>
                              </div>
                              {bed.occupied_by && (
                                <div className="col-span-2">
                                  <span className="text-gray-500">Patient:</span>
                                  <div className="flex items-center gap-1 mt-1">
                                    <User className="w-3 h-3 text-gray-400" />
                                    <span className="font-medium text-gray-900 text-xs">{bed.occupied_by}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table View */}
                      <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b-2 border-gray-200">
                            <tr>
                              <th className="p-4 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('date')}>
                                <div className="flex items-center">
                                  Date <SortIcon column="date" />
                                </div>
                              </th>
                              <th className="p-4 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('bedId')}>
                                <div className="flex items-center">
                                  Bed ID <SortIcon column="bedId" />
                                </div>
                              </th>
                              <th className="p-4 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('ward')}>
                                <div className="flex items-center">
                                  Ward <SortIcon column="ward" />
                                </div>
                              </th>
                              <th className="p-4 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('bedType')}>
                                <div className="flex items-center">
                                  Type <SortIcon column="bedType" />
                                </div>
                              </th>
                              <th className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('status')}>
                                <div className="flex items-center justify-center">
                                  Status <SortIcon column="status" />
                                </div>
                              </th>
                              <th className="p-4 text-left font-semibold text-gray-700">Patient</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {paginatedBeds.map((bed: BedDetail, index: number) => (
                              <tr key={`${bed.bed_id}-${index}`} className="hover:bg-blue-50/50 transition-colors">
                                <td className="p-4 text-gray-700">{bed.date}</td>
                                <td className="p-4">
                                  <div className="flex items-center gap-2 font-medium text-gray-900">
                                    <Bed className="w-4 h-4 text-gray-400" />
                                    {bed.bed_id}
                                  </div>
                                </td>
                                <td className="p-4 text-gray-700">{bed.ward}</td>
                                <td className="p-4 text-gray-700">{bed.bed_type}</td>
                                <td className="p-4">
                                  <div className="flex justify-center">
                                    <Badge className={cn("text-xs font-medium", getStatusColor(bed.status))}>
                                      {bed.status}
                                    </Badge>
                                  </div>
                                </td>
                                <td className="p-4">
                                  {bed.occupied_by ? (
                                    <div className="flex items-center gap-2">
                                      <User className="w-4 h-4 text-gray-400" />
                                      <span className="text-gray-900">{bed.occupied_by}</span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Enhanced Pagination */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-gray-50 border-t">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-600">Show:</span>
                          <Select
                            value={pagination.pageSize.toString()}
                            onValueChange={(value) => changePageSize(Number(value))}
                          >
                            <SelectTrigger className="w-20 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="25">25</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                              <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-gray-600 hidden sm:inline">
                            {((pagination.currentPage - 1) * pagination.pageSize) + 1}-
                            {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)} of {pagination.totalItems}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(pagination.currentPage - 1)}
                            disabled={pagination.currentPage === 1}
                            className="h-8"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <div className="px-3 py-1 text-sm font-medium bg-white rounded-md border">
                            {pagination.currentPage} / {totalPages}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(pagination.currentPage + 1)}
                            disabled={pagination.currentPage === totalPages}
                            className="h-8"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Single view retained; Available tab removed */}
              </div>
            </div>
          ) : (
            <Card className="mt-6">
              <CardContent className="p-12 text-center">
                <Bed className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No bed occupancy data available</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

