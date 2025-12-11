// components/drill-down/PatientDrillDownModal.tsx
// Fixed version with proper drill-down data isolation
'use client'

import { useEffect, useMemo, useState, useCallback, useRef, memo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Users,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Download,
  Search,
  Filter,
  Activity,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Patient, GroupByMonth, GroupByCategory, GroupByYear } from '@/lib/api/schemas/mhpl0001-schema'
import { validateMHPL0001Response } from '@/lib/api/schemas/mhpl0001-schema'
import { useFilterState } from '@/components/filters/FilterStateProvider'
import { TokenStorage } from '@/lib/tokenStorage'
import { useDashboardStore } from '@/lib/store/dashboard-store'
import { callMHPL_API_WithValidation } from '@/lib/api/mhplApi'
import toast from 'react-hot-toast'
import { getThemeForEndpoint } from '@/lib/constants/drillDownThemes'

interface PatientDrillDownModalProps {
  isOpen: boolean
  onClose: () => void
  data?: any
  endpointId?: string
  currentValue?: number | string
}

type SortKey = keyof Pick<Patient, 'PATIENT_ID' | 'PATIENT_NAME' | 'LAST_VISIT_DATE' | 'REVISIT_COUNT'>

interface DrillDownFilter {
  type: 'month' | 'category' | 'year' | null
  value: string | number | null
  label: string | null
}

function PatientDrillDownModal({
  isOpen,
  onClose,
  data,
  endpointId,
  currentValue
}: PatientDrillDownModalProps) {
  const theme = getThemeForEndpoint(endpointId || 'mhpl0001')
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null)
  // CRITICAL: Read from Zustand store (single source of truth for global filters)
  const zustandStore = useDashboardStore()
  const globalFilters = zustandStore.globalFilters
  const endpointOverrides = zustandStore.endpointOverrides || {}
  const { hasLoadedPreset } = useFilterState()

  // API Parameters (controlled inputs)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [patientCategory, setPatientCategory] = useState('INPATIENT')
  const [pageSize, setPageSize] = useState('15')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [disableCache, setDisableCache] = useState(false)

  // Loading states
  const [updating, setUpdating] = useState(false)
  const [liveApiData, setLiveApiData] = useState<any | null>(null)
  const [loadingPage, setLoadingPage] = useState(false)
  const autoRefreshRef = useRef(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [drillDownFilter, setDrillDownFilter] = useState<DrillDownFilter>({
    type: null,
    value: null,
    label: null
  })
  const [revisitFilter, setRevisitFilter] = useState<'all' | 'hasRevisits' | 'noRevisits'>('all')

  // Load initial data
  const apiData = useMemo(() => {
    if (data) return data

    if (endpointId && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`${endpointId}-payload`)
        if (stored) {
          const parsedData = JSON.parse(stored)
          return validateMHPL0001Response(parsedData.data || parsedData)
        }
      } catch (error) {
        console.error(`[PatientDrillDown] Failed to load ${endpointId}:`, error)
      }
    }
    return null
  }, [data, endpointId])

  // Initialize filters on open - Use Zustand dates and endpointOverrides for category
  useEffect(() => {
    if (!isOpen) return

    console.log('[DrillDown] Initializing filters from Zustand and endpointOverrides')

    // Dates from Zustand (single source of truth)
    const s = globalFilters.startDate || ''
    const e = globalFilters.endDate || ''
    console.log('[DrillDown] Dates from Zustand:', { startDate: s, endDate: e })
    setStartDate(s)
    setEndDate(e)

    // Patient category from endpointOverrides (KPI local filter)
    const apiId = endpointId || 'mhpl0001'
    const kpiPatCat = endpointOverrides[apiId]?.PatCat
    if (kpiPatCat) {
      console.log('[DrillDown] Patient category from endpointOverrides:', kpiPatCat)
      setPatientCategory(String(kpiPatCat))
    } else {
      console.log('[DrillDown] No endpointOverride for PatCat, using default INPATIENT')
      setPatientCategory('INPATIENT')
    }

    // Reset states
    setLiveApiData(null)
    setDrillDownFilter({ type: null, value: null, label: null })
    setSearchQuery('')
    setRevisitFilter('all')
    setCurrentPage(1)
    setPageSize('15')
  }, [isOpen, hasLoadedPreset, globalFilters.startDate, globalFilters.endDate, apiData])

  // Fetch data from API with pagination - MOVED BEFORE useEffect that uses it
  const fetchDataFromAPI = useCallback(async (pageNum: number) => {
    if (!endpointId) {
      console.error('[Pagination] No endpoint ID provided')
      toast.error('No endpoint ID provided')
      return
    }

    if (!pageNum || pageNum < 1) {
      console.error('[Pagination] Invalid page number:', pageNum)
      toast.error('Invalid page number')
      return
    }

    console.log(`[Pagination] Starting fetch for page ${pageNum}`)
    try {
      if (typeof window !== 'undefined' && endpointId) {
        localStorage.removeItem(`${endpointId}-payload`)
      }
    } catch { console.warn('[Pagination] Cache cleanup failed') }
    setDisableCache(true)
    setLoadingPage(true)

    try {
      let token: string | null = null
      try { token = TokenStorage.getValidToken?.() ?? null } catch { console.warn('TokenStorage check failed') }
      if (!token && typeof window !== 'undefined') {
        token = localStorage.getItem('mhpl_bearer_token') || localStorage.getItem('mhpl_token')
      }
      if (!token) {
        console.error('[Pagination] No token found in storage')
        toast.error('Authentication required. Please sign in.')
        return
      }

      let patCatValue: string
      if (patientCategory === 'INPATIENT,OUTPATIENT') {
        patCatValue = 'INPATIENT,OUTPATIENT'
      } else {
        patCatValue = patientCategory
      }

      const payload: Record<string, any> = {
        StartDate: startDate,
        EndDate: endDate,
        PatCat: patCatValue,
        PageNumber: pageNum
      }
      const psNum = parseInt(pageSize || '0', 10)
      if (Number.isFinite(psNum) && psNum > 0) {
        payload.PageSize = psNum
      }

      console.log(`[Pagination] API Request:`, {
        endpoint: endpointId,
        pageRequested: pageNum,
        payload: payload
      })

      const result = await callMHPL_API_WithValidation(endpointId || 'mhpl0001', payload, token)
      if ((result as any)?.status !== 'success') {
        const msg = (result as any)?.message || 'MHPL0001 call failed'
        throw new Error(msg)
      }

      console.log(`[Pagination] API Response received:`, {
        pageNumber: result?.data?.data?.groupByYear?.[0]?.UNIQUE_PATIENT_LIST?.[0]?.PAGE_NUMBER,
        totalPages: result?.data?.data?.groupByYear?.[0]?.UNIQUE_PATIENT_LIST?.[0]?.TOTAL_PAGE,
        totalRecords: result?.data?.data?.groupByYear?.[0]?.UNIQUE_PATIENT_LIST?.[0]?.TOTAL_RECORDS,
        patientsCount: result?.data?.data?.groupByYear?.[0]?.UNIQUE_PATIENT_LIST?.[0]?.PATIENTS?.length
      })

      const raw = (result as any).data
      const normalized = raw?.data ? raw.data : raw
      const wrapped = {
        data: normalized,
        input_parameters: {
          start_date: startDate,
          end_date: endDate,
          patient_categories: [patCatValue],
          ...(Number.isFinite(psNum) && psNum > 0 ? { page_number: pageNum, page_size: psNum } : {})
        }
      }
      setLiveApiData(wrapped as any)
      try {
        if (typeof window !== 'undefined' && endpointId) {
          localStorage.removeItem(`${endpointId}-payload`)
        }
      } catch { console.warn('[Pagination] Post-fetch cache cleanup failed') }
      setCurrentPage(pageNum)

      console.log(`[Pagination] ✅ Successfully loaded page ${pageNum}`)
      toast.success(`Page ${pageNum} loaded`)

    } catch (error: any) {
      console.error('[Pagination] ❌ Error fetching page:', error)
      console.error('[Pagination] Error details:', {
        message: error?.message,
        stack: error?.stack,
        response: error?.response
      })
      toast.error(error?.message || `Failed to load page ${pageNum}`)
    } finally {
      setLoadingPage(false)
      console.log(`[Pagination] Request completed for page ${pageNum}`)
    }
  }, [endpointId, startDate, endDate, patientCategory, pageSize])

  // Auto-refresh on open
  useEffect(() => {
    if (isOpen) {
      if (startDate && endDate && endpointId && !autoRefreshRef.current) {
        autoRefreshRef.current = true
        setDisableCache(true)
        fetchDataFromAPI(1)
      }
    } else {
      autoRefreshRef.current = false
    }
  }, [isOpen, startDate, endDate, endpointId, patientCategory, pageSize, fetchDataFromAPI])

  const dataForDisplay = disableCache ? liveApiData : (liveApiData || apiData)
  const rootData = (dataForDisplay as any)?.data ?? dataForDisplay
  const totals = (rootData as any)?.totals?.[0] ?? null
  const groupByMonth = (rootData as any)?.groupByMonth ?? []
  const groupByCategory = (rootData as any)?.groupByPatientCategory ?? []
  const groupByYear = (rootData as any)?.groupByYear ?? []
  const params = (dataForDisplay as any)?.input_parameters

  // NEW: Get the specific drilled-down group
  const drilledDownGroup = useMemo(() => {
    if (!drillDownFilter.type) return null

    if (drillDownFilter.type === 'month') {
      return groupByMonth.find((m: GroupByMonth) => m.MONTH === drillDownFilter.value) || null
    } else if (drillDownFilter.type === 'category') {
      return groupByCategory.find((c: GroupByCategory) => c.PATIENT_CATEGORY === drillDownFilter.value) || null
    } else if (drillDownFilter.type === 'year') {
      return groupByYear.find((y: GroupByYear) => y.YEAR === drillDownFilter.value) || null
    }
    return null
  }, [drillDownFilter, groupByMonth, groupByCategory, groupByYear])

  // NEW: Get pagination metadata from drilled-down group
  const paginationMeta = useMemo(() => {
    if (drilledDownGroup?.UNIQUE_PATIENT_LIST?.[0]) {
      const meta = drilledDownGroup.UNIQUE_PATIENT_LIST[0]
      return {
        pageNumber: meta.PAGE_NUMBER || 1,
        pageSize: meta.PAGE_SIZE || 15,
        totalPages: meta.TOTAL_PAGE || 1,
        totalRecords: meta.TOTAL_RECORDS || 0
      }
    }

    // Fallback: use first available group
    const groups = [...groupByYear, ...groupByMonth, ...groupByCategory]
    for (const group of groups) {
      if (group.UNIQUE_PATIENT_LIST?.[0]) {
        const meta = group.UNIQUE_PATIENT_LIST[0]
        return {
          pageNumber: meta.PAGE_NUMBER || 1,
          pageSize: meta.PAGE_SIZE || 15,
          totalPages: meta.TOTAL_PAGE || 1,
          totalRecords: meta.TOTAL_RECORDS || 0
        }
      }
    }
    return { pageNumber: 1, pageSize: 15, totalPages: 1, totalRecords: 0 }
  }, [drilledDownGroup, groupByYear, groupByMonth, groupByCategory])

  // NEW: Get aggregates from drilled-down group (not global totals)
  const drillDownAggregates = useMemo(() => {
    if (drilledDownGroup) {
      return {
        uniquePatient: drilledDownGroup.UNIQUE_PATIENT || 0,
        revisitCount: drilledDownGroup.REVISIT_COUNT || 0,
        revisitRate: drilledDownGroup.REVISIT_RATE || 0
      }
    }
    return null
  }, [drilledDownGroup])

  // Keep page input in sync
  useEffect(() => {
    setPageInput(String(paginationMeta.pageNumber || 1))
  }, [paginationMeta.pageNumber])

  // Reset cache-disabling flag when modal opens
  useEffect(() => {
    if (isOpen) {
      setDisableCache(false)
    }
  }, [isOpen])

  // NEW: Extract patients from drilled-down group ONLY
  const patients = useMemo(() => {
    if (!dataForDisplay) return []

    if (drilledDownGroup?.UNIQUE_PATIENT_LIST?.[0]?.PATIENTS) {
      // Return patients from drilled-down group only
      return drilledDownGroup.UNIQUE_PATIENT_LIST[0].PATIENTS
    }

    // No drill-down: collect from all groups
    const map = new Map<number, Patient>()
    const collect = (entries: Array<GroupByMonth | GroupByCategory | GroupByYear>) => {
      entries.forEach((entry) => {
        entry.UNIQUE_PATIENT_LIST?.forEach((page) => {
          page.PATIENTS?.forEach((patient) => {
            const id = Number(patient.PATIENT_ID)
            if (!Number.isNaN(id) && !map.has(id)) {
              map.set(id, patient)
            }
          })
        })
      })
    }

    collect(groupByMonth)
    collect(groupByCategory)
    collect(groupByYear)

    return Array.from(map.values())
  }, [dataForDisplay, drilledDownGroup, groupByMonth, groupByCategory, groupByYear])

  // Apply client-side search and revisit filters
  const filteredPatients = useMemo(() => {
    let filtered = [...patients]

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((p: Patient) =>
        String(p.PATIENT_ID).toLowerCase().includes(query) ||
        (p.PATIENT_NAME || '').toLowerCase().includes(query)
      )
    }

    // Revisit filter
    if (revisitFilter === 'hasRevisits') {
      filtered = filtered.filter((p: Patient) => Number(p.REVISIT_COUNT) > 0)
    } else if (revisitFilter === 'noRevisits') {
      filtered = filtered.filter((p: Patient) => Number(p.REVISIT_COUNT) === 0)
    }

    return filtered
  }, [patients, searchQuery, revisitFilter])

  // Sort patients
  const sortedPatients = useMemo(() => {
    if (!filteredPatients.length) return []

    // No sorting - return in API order
    if (!sortConfig) return filteredPatients

    return [...filteredPatients].sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]

      if (sortConfig.key === 'PATIENT_ID' || sortConfig.key === 'REVISIT_COUNT') {
        const aNum = Number(aVal ?? 0)
        const bNum = Number(bVal ?? 0)
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum
      }

      const aStr = String(aVal ?? '')
      const bStr = String(bVal ?? '')
      return sortConfig.direction === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr)
    })
  }, [filteredPatients, sortConfig])

  const toggleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' }
      if (prev.direction === 'asc') return { key, direction: 'desc' }
      return null // Third click clears sorting, returns to API order
    })
  }


  // Server-side pagination helpers
  const goto = (p: number) => fetchDataFromAPI(p)
  const goFirst = () => fetchDataFromAPI(1)
  const goPrev = () => { if (paginationMeta.pageNumber > 1) fetchDataFromAPI(paginationMeta.pageNumber - 1) }
  const goNext = () => { if (paginationMeta.pageNumber < paginationMeta.totalPages) fetchDataFromAPI(paginationMeta.pageNumber + 1) }
  const goLast = () => fetchDataFromAPI(paginationMeta.totalPages)

  // Apply filters and fetch data
  const handleApplyFilters = useCallback(async () => {
    const desired = parseInt(pageInput || '1', 10)
    const targetPage = Number.isFinite(desired) && desired > 0 ? desired : 1
    await fetchDataFromAPI(targetPage)
  }, [fetchDataFromAPI, pageInput])

  // Handle drill-down
  const handleDrillDown = useCallback((type: 'month' | 'category' | 'year', value: string | number, label: string) => {
    setDrillDownFilter({ type, value, label })
    toast.success(`Filtered to ${label}`)
  }, [])

  // Clear drill-down
  const clearDrillDown = useCallback(() => {
    setDrillDownFilter({ type: null, value: null, label: null })
  }, [])

  // Export to CSV
  const exportToCSV = useCallback(() => {
    const headers = ['Patient ID', 'Patient Name', 'Last Visit Date', 'Revisit Count']
    const rows = sortedPatients.map(p => [
      p.PATIENT_ID,
      p.PATIENT_NAME || 'N/A',
      p.LAST_VISIT_DATE || 'N/A',
      p.REVISIT_COUNT ?? 0
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `patient-data-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Data exported successfully')
  }, [sortedPatients])

  if (!isOpen) return null

  // Loading state
  if (!dataForDisplay && endpointId) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading Patient Data...
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Error state
  if (!dataForDisplay) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              No Patient Data Available
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Patient revisit data is not available</p>
            <p className="text-sm text-gray-500">Please run API tests on the homepage first</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Calculate display range
  const startIndex = paginationMeta.totalRecords > 0
    ? (paginationMeta.pageNumber - 1) * paginationMeta.pageSize + 1
    : 0
  const endIndex = Math.min(
    paginationMeta.pageNumber * paginationMeta.pageSize,
    paginationMeta.totalRecords
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-6xl lg:max-w-7xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header with Filters */}
        <div className={cn("sticky top-0 z-10 bg-gradient-to-r text-white px-4 sm:px-6 py-4 shadow-lg", theme.gradient)}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl lg:text-2xl font-bold mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Activity className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                Patient Revisit Analytics
              </DialogTitle>
              <DialogDescription className="text-white/90 text-xs sm:text-sm">
                <span>Total Patients</span>: {drillDownAggregates ? drillDownAggregates.uniquePatient.toLocaleString() : (totals?.TOTAL_UNIQUE_PATIENTS?.toLocaleString() || '0')} &nbsp;•&nbsp;
                <span>Total Revisits</span>: {drillDownAggregates ? drillDownAggregates.revisitCount.toLocaleString() : (totals?.TOTAL_REVISIT_COUNT?.toLocaleString() || '0')} &nbsp;•&nbsp;
                <span>Revisit Rate</span>: {drillDownAggregates ? `${(drillDownAggregates.revisitRate * 100).toFixed(1)}%` : `${((totals?.AVERAGE_REVISIT_RATE || 0) * 100).toFixed(1)}%`}
              </DialogDescription>
            </div>

            {/* Close button */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="text-white hover:bg-white/20"
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filter Controls */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Start Date */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-white/90">Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10 bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:bg-white/30 focus:border-white/50 transition-all"
                  />
                </div>

                {/* End Date */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-white/90">End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10 bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:bg-white/30 focus:border-white/50 transition-all"
                  />
                </div>

                {/* Patient Category */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-white/90">Patient Category</Label>
                  <Select value={patientCategory} onValueChange={setPatientCategory}>
                    <SelectTrigger className="h-10 bg-white/20 border-white/30 text-white focus:bg-white/30 focus:border-white/50 transition-all">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INPATIENT">INPATIENT</SelectItem>
                      <SelectItem value="OUTPATIENT">OUTPATIENT</SelectItem>
                      <SelectItem value="INPATIENT,OUTPATIENT">BOTH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Page Size */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-white/90">Page Size</Label>
                  <Select value={pageSize} onValueChange={setPageSize}>
                    <SelectTrigger className="h-10 bg-white/20 border-white/30 text-white focus:bg-white/30 focus:border-white/50 transition-all">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 per page</SelectItem>
                      <SelectItem value="15">15 per page</SelectItem>
                      <SelectItem value="25">25 per page</SelectItem>
                      <SelectItem value="50">50 per page</SelectItem>
                      <SelectItem value="100">100 per page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Apply Button */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-white/90 opacity-0 pointer-events-none">Action</Label>
                  <Button
                    onClick={handleApplyFilters}
                    disabled={loadingPage || !startDate || !endDate}
                    className="h-10 w-full bg-white text-blue-600 hover:bg-white/90 font-semibold shadow-lg"
                  >
                    {loadingPage ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Update
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active drill-down filter */}
          {drillDownFilter.type && (
            <div className="mt-3 flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
              <Filter className="h-4 w-4" />
              <span className="text-sm">Filtered by: <strong>{drillDownFilter.label}</strong></span>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearDrillDown}
                className="ml-auto text-white hover:bg-white/20 h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Content - Patient List */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {/* Patient Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm text-gray-800">
                  <Users className="h-4 w-4" />
                  Patient List
                  {loadingPage && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                </CardTitle>
                <div className="flex items-center gap-3">
                  {/* Pagination Info */}
                  <div className="text-sm text-gray-600 font-medium">
                    Showing {paginationMeta.totalRecords > 0 ? startIndex : 0}-{endIndex} of {paginationMeta.totalRecords} patients
                  </div>
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fetchDataFromAPI(paginationMeta.pageNumber)}
                      disabled={loadingPage}
                      title="Refresh current page"
                    >
                      <RefreshCw className={cn("h-4 w-4", loadingPage && "animate-spin")} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={exportToCSV}
                      disabled={sortedPatients.length === 0}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>

            {/* Search and Filter Controls */}
            <div className="px-6 pb-4 border-b">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by Patient ID or Name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={revisitFilter} onValueChange={(v) => setRevisitFilter(v as any)}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Patients</SelectItem>
                    <SelectItem value="hasRevisits">Has Revisits</SelectItem>
                    <SelectItem value="noRevisits">No Revisits</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <CardContent>
              {sortedPatients.length > 0 ? (
                <>
                  <div className={cn("transition-opacity", loadingPage && "opacity-50")}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <SortableHead
                            activeKey={sortConfig?.key ?? null}
                            direction={sortConfig?.direction ?? 'asc'}
                            sortKey="PATIENT_ID"
                            onSort={toggleSort}
                          >
                            Patient ID
                          </SortableHead>
                          <SortableHead
                            activeKey={sortConfig?.key ?? null}
                            direction={sortConfig?.direction ?? 'asc'}
                            sortKey="PATIENT_NAME"
                            onSort={toggleSort}
                          >
                            Name
                          </SortableHead>
                          <SortableHead
                            activeKey={sortConfig?.key ?? null}
                            direction={sortConfig?.direction ?? 'asc'}
                            sortKey="LAST_VISIT_DATE"
                            onSort={toggleSort}
                          >
                            Last Visit
                          </SortableHead>
                          <SortableHead
                            activeKey={sortConfig?.key ?? null}
                            direction={sortConfig?.direction ?? 'asc'}
                            sortKey="REVISIT_COUNT"
                            onSort={toggleSort}
                            className="text-right"
                          >
                            Revisits
                          </SortableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedPatients.map((patient) => (
                          <TableRow key={patient.PATIENT_ID}>
                            <TableCell className="font-mono text-sm">
                              {patient.PATIENT_ID}
                            </TableCell>
                            <TableCell className="font-medium text-gray-800">
                              {patient.PATIENT_NAME || 'N/A'}
                            </TableCell>
                            <TableCell>{patient.LAST_VISIT_DATE || 'N/A'}</TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={Number(patient.REVISIT_COUNT) > 0 ? 'default' : 'outline'}
                                className={cn(
                                  Number(patient.REVISIT_COUNT) === 0 && 'bg-green-100 text-green-800',
                                  Number(patient.REVISIT_COUNT) > 0 && 'bg-blue-100 text-blue-800'
                                )}
                              >
                                {patient.REVISIT_COUNT ?? 0}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* SERVER-SIDE PAGINATION CONTROLS */}
                  {paginationMeta.totalPages > 1 && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        {/* Left side - Page info */}
                        <div className="text-sm text-gray-600 font-medium">
                          Page {paginationMeta.pageNumber} of {paginationMeta.totalPages}
                        </div>

                        {/* Center - Page navigation */}
                        <div className="flex items-center gap-1">
                          {/* First */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={goFirst}
                            disabled={loadingPage || paginationMeta.pageNumber === 1}
                            title="First page"
                          >
                            <ChevronsLeft className="h-4 w-4" />
                          </Button>

                          {/* Previous */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={goPrev}
                            disabled={loadingPage || paginationMeta.pageNumber === 1}
                            title="Previous page"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>

                          {/* Page Numbers */}
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
                                <Button
                                  key={pageNum}
                                  size="sm"
                                  variant={paginationMeta.pageNumber === pageNum ? 'default' : 'outline'}
                                  onClick={() => goto(pageNum)}
                                  disabled={loadingPage}
                                  className="w-10"
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
                            onClick={goNext}
                            disabled={loadingPage || paginationMeta.pageNumber === paginationMeta.totalPages}
                            title="Next page"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>

                          {/* Last */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={goLast}
                            disabled={loadingPage || paginationMeta.pageNumber === paginationMeta.totalPages}
                            title="Last page"
                          >
                            <ChevronsRight className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Right side - Total records */}
                        <div className="text-sm text-gray-500">
                          {paginationMeta.totalRecords} total
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-12 text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-1">No patients found</p>
                  <p className="text-sm text-gray-500">Try adjusting your filters or clicking "Apply"</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Sortable Table Head
interface SortableHeadProps {
  children: React.ReactNode
  sortKey: SortKey
  activeKey: SortKey | null
  direction: 'asc' | 'desc'
  onSort: (key: SortKey) => void
  className?: string
}

function SortableHead({
  children,
  sortKey,
  activeKey,
  direction,
  onSort,
  className
}: SortableHeadProps) {
  const isActive = sortKey === activeKey

  return (
    <TableHead
      onClick={() => onSort(sortKey)}
      className={cn(
        'cursor-pointer select-none text-xs font-medium text-gray-600 hover:text-blue-600 transition-colors',
        isActive && 'text-blue-600',
        className
      )}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {isActive && (
          direction === 'asc'
            ? <ChevronUp className="h-3 w-3" />
            : <ChevronDown className="h-3 w-3" />
        )}
      </span>
    </TableHead>
  )
}

// Patient Detail Modal
interface PatientDetailModalProps {
  patient: Patient
  onClose: () => void
}

function PatientDetailModal({ patient, onClose }: PatientDetailModalProps) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Patient Details
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Patient ID</p>
              <p className="font-mono text-sm font-medium">{patient.PATIENT_ID}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Revisit Count</p>
              <Badge className={cn(
                Number(patient.REVISIT_COUNT) === 0 && 'bg-green-100 text-green-800',
                Number(patient.REVISIT_COUNT) > 0 && 'bg-blue-100 text-blue-800'
              )}>
                {patient.REVISIT_COUNT ?? 0}
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Patient Name</p>
            <p className="text-sm font-medium">{patient.PATIENT_NAME || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Last Visit Date</p>
            <p className="text-sm font-medium">{patient.LAST_VISIT_DATE || 'N/A'}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ⚡ PERFORMANCE: Memoized to prevent unnecessary re-renders
export default memo(PatientDrillDownModal, (prevProps, nextProps) => {
  // Only re-render if these props actually change
  return prevProps.isOpen === nextProps.isOpen &&
    prevProps.data === nextProps.data &&
    prevProps.endpointId === nextProps.endpointId
})