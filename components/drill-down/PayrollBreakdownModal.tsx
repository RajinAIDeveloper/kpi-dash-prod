'use client'

import React, { useMemo, useState, useEffect, useRef, useCallback, memo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  DollarSign, Calendar, ChevronDown, ChevronUp, Loader2, X,
  Download, Search
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStoredKpiData } from '@/lib/hooks/useStoredKpiData'
import { useFilterState } from '@/components/filters/FilterStateProvider'
import { useDashboardStore } from '@/lib/store/dashboard-store'
import { TokenStorage } from '@/lib/tokenStorage'
import { callMHPL_API_WithValidation } from '@/lib/api/mhplApi'
import toast from 'react-hot-toast'

interface PayrollBreakdownModalProps {
  isOpen: boolean
  onClose: () => void
  endpointId: string
  currentValue: string | number
  data?: any
}

// ⚡ PERFORMANCE: Internal component function
function PayrollBreakdownModalComponent({
  isOpen,
  onClose,
  endpointId,
  currentValue,
  data
}: PayrollBreakdownModalProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  }>({ key: 'periods', direction: 'desc' })

  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null)
  const [expandedDepartment, setExpandedDepartment] = useState<string | null>(null)
  const [periodFilter, setPeriodFilter] = useState('')
  const [selectedPeriodTypes, setSelectedPeriodTypes] = useState<string[]>(['monthly', 'quarterly', 'yearly'])

  const { payload, loading, error } = useStoredKpiData(endpointId, isOpen, data)

  // Read from Zustand store
  const zustandStore = useDashboardStore()
  const globalFilters = zustandStore.globalFilters

  // Live refresh filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [summType, setSummType] = useState('')
  const [dept, setDept] = useState('')
  const [empType, setEmpType] = useState('')
  const [pageSize, setPageSize] = useState('')
  const [updating, setUpdating] = useState(false)
  const [livePayload, setLivePayload] = useState<any | null>(null)
  const autoRefreshRef = useRef(false)

  // Pagination meta from API totals
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [totalRecords, setTotalRecords] = useState<number>(0)

  // Normalize any incoming mhpl0002 shape
  const normalizeMhpl0002 = useCallback((input: any) => {
    if (!input) return null
    const inner = input?.data?.data?.data ?? input?.data?.data ?? input?.data ?? input
    return inner ?? null
  }, [])

  // Extract uniform totals object from either array or object form
  const extractTotalsObj = useCallback((input: any) => {
    const t = input?.totals as any
    if (Array.isArray(t)) {
      const out: any = {}
      let sum = 0
      t.forEach((it: any) => {
        const k = String(it?.Expense_Type || it?.EXPENSE_TYPE || '').toLowerCase()
        const amt = Number(it?.Total_Amount ?? it?.TOTAL_AMOUNT ?? 0)
        if (Number.isFinite(amt)) sum += amt
        if (k.includes('grand_total_expense')) out.grand_total_expense = amt
        if (k.includes('total_salary')) out.total_salary = amt
        if (k.includes('total_allowance')) out.total_allowance = amt
        if (k.includes('total_overtime')) out.total_overtime = amt
        if (k.includes('total_contractor')) out.total_contractor_expense = amt
      })
      if (out.grand_total_expense === undefined && sum > 0) {
        out.grand_total_expense = sum
      }
      return out
    }
    return t || {}
  }, [])

  // Initialize filters only when modal opens
  const prevIsOpenRef = useRef(false)
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setStartDate(globalFilters.startDate || '')
      setEndDate(globalFilters.endDate || '')
      setSummType('monthly')
      setDept('')
      setEmpType('')
      setPageSize('')
      setUpdating(false)
      setPeriodFilter('')
      setSelectedPeriodTypes(['monthly', 'quarterly', 'yearly'])
      setExpandedPeriod(null)
      setExpandedDepartment(null)
    }
    prevIsOpenRef.current = isOpen
  }, [isOpen, globalFilters.startDate, globalFilters.endDate])

  const mhpl0002Data = useMemo(() => {
    const effective = normalizeMhpl0002(livePayload ?? payload)
    return effective
  }, [payload, livePayload, normalizeMhpl0002])

  // Data accessors
  const getMonthlyData = () => mhpl0002Data?.summaryByPeriod?.monthly?.items || []
  const getQuarterlyData = () => mhpl0002Data?.summaryByPeriod?.quarterly?.items || []
  const getYearlyData = () => mhpl0002Data?.summaryByPeriod?.yearly?.items || []
  const getTotals = () => extractTotalsObj(mhpl0002Data)

  // Unified period data combining monthly, quarterly, and yearly
  const unifiedPeriodData = useMemo(() => {
    const mapPeriodItems = (items: any[], kind: 'monthly' | 'quarterly' | 'yearly') =>
      (items || []).map((item: any) => ({
        ...item,
        _periodKind: kind,
        _periodTypeLabel:
          kind === 'monthly' ? 'Monthly' : kind === 'quarterly' ? 'Quarterly' : 'Yearly',
      }))

    return [
      ...mapPeriodItems(getMonthlyData(), 'monthly'),
      ...mapPeriodItems(getQuarterlyData(), 'quarterly'),
      ...mapPeriodItems(getYearlyData(), 'yearly'),
    ]
  }, [mhpl0002Data])

  // Filtered period data based on search and period type
  const filteredPeriodData = useMemo(() => {
    let filtered = unifiedPeriodData

    // Filter by period type
    if (selectedPeriodTypes.length > 0 && selectedPeriodTypes.length < 3) {
      filtered = filtered.filter(item => selectedPeriodTypes.includes(item._periodKind))
    }

    // Filter by search text
    if (periodFilter) {
      const lower = periodFilter.toLowerCase()
      filtered = filtered.filter(item =>
        item.periods?.toLowerCase().includes(lower) ||
        item._periodTypeLabel?.toLowerCase().includes(lower)
      )
    }

    return filtered
  }, [unifiedPeriodData, periodFilter, selectedPeriodTypes])

  // Sync pagination meta from totals whenever data changes
  useEffect(() => {
    const t = getTotals() as any
    const pn = Number(t?.page_number ?? t?.Page_Number ?? 1)
    const ps = Number(t?.page_size ?? t?.Page_Size ?? (pageSize ? Number(pageSize) : 0))
    const tp = Number(t?.total_pages ?? t?.Total_Pages ?? 1)
    const tr = Number(t?.total_records ?? t?.Total_Records ?? 0)
    setPageNumber(Number.isFinite(pn) && pn > 0 ? pn : 1)
    setTotalPages(Number.isFinite(tp) && tp > 0 ? tp : 1)
    setTotalRecords(Number.isFinite(tr) && tr >= 0 ? tr : 0)
    if (!pageSize && Number.isFinite(ps) && ps > 0) {
      setPageSize(String(ps))
    }
  }, [mhpl0002Data])

  // Sort function
  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const getSortedData = (data: any[]) => {
    if (!Array.isArray(data)) return []
    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return '৳0'
    return `৳${value.toLocaleString()}`
  }

  const formatPercentage = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return '0%'
    return `${(value).toFixed(1)}%`
  }

  // Toggle period type filter
  const togglePeriodType = (type: string) => {
    setSelectedPeriodTypes(prev => {
      if (prev.includes(type)) {
        // Don't allow unchecking all
        if (prev.length === 1) return prev
        return prev.filter(t => t !== type)
      } else {
        return [...prev, type]
      }
    })
  }

  // Reset expanded department when period is collapsed
  useEffect(() => {
    if (!expandedPeriod) {
      setExpandedDepartment(null)
    }
  }, [expandedPeriod])

  // CSV Export Handler
  const handleExport = () => {
    if (!unifiedPeriodData || unifiedPeriodData.length === 0) {
      toast.error('No data to export')
      return
    }

    const toCsvValue = (value: any) => {
      if (value === null || value === undefined) return ''
      const str = String(value)
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const rows: string[] = []

    // Header
    rows.push([
      'Level',
      'Period Type',
      'Period',
      'Department',
      'Category',
      'Total Expense',
      'Overtime %',
      'High OT Alert',
      'Contractor Change',
      'Contractor Decrease Alert',
    ].join(','))

    // Data rows
    unifiedPeriodData.forEach((item: any) => {
      const periodType = item._periodTypeLabel || ''
      const departments = item?.departments?.items ?? []

      // Period summary row
      rows.push([
        'Period',
        toCsvValue(periodType),
        toCsvValue(item.periods),
        '',
        '',
        toCsvValue(item.total_expense || 0),
        toCsvValue((item.overtime_percentage || 0).toFixed(2)),
        toCsvValue(item.high_overtime_alert),
        toCsvValue(item.contractor_expense_change ?? ''),
        toCsvValue(item.contractor_expense_decrease_alert),
      ].join(','))

      // Department detail rows
      departments.forEach((dept: any) => {
        // Department summary row
        rows.push([
          'Department',
          toCsvValue(periodType),
          toCsvValue(item.periods),
          toCsvValue(dept.dept_name),
          '',
          toCsvValue(dept.total_expense || 0),
          toCsvValue((dept.overtime_percentage || 0).toFixed(2)),
          toCsvValue(dept.high_overtime_alert),
          toCsvValue(dept.contractor_expense_change ?? ''),
          toCsvValue(dept.contractor_expense_decrease_alert),
        ].join(','))

        // Category rows for this department
        const categories = dept.categories || []
        categories.forEach((cat: any) => {
          rows.push([
            'Category',
            toCsvValue(periodType),
            toCsvValue(item.periods),
            toCsvValue(dept.dept_name),
            toCsvValue(cat.category),
            toCsvValue(cat.amount || 0),
            '',
            '',
            '',
            '',
          ].join(','))
        })
      })
    })

    const csvContent = rows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `payroll_breakdown_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success('CSV exported successfully')
  }

  // Fetch fresh data from API using current filters
  const refreshPayrollData = async (targetPage?: number) => {
    if (!startDate || !endDate) return
    try {
      setUpdating(true)
      const token = TokenStorage.getValidToken() || undefined
      const requestParams: Record<string, any> = {
        StartDate: startDate,
        EndDate: endDate,
      }
      if (summType && summType.trim() !== '') requestParams.SummType = summType.trim()
      if (dept && dept.trim() !== '') requestParams.Dept = dept.trim()
      if (empType && empType.trim() !== '') requestParams.EmpType = empType.trim()
      if (pageSize && pageSize.trim() !== '' && parseInt(pageSize) > 0) {
        requestParams.PageSize = pageSize.trim()
      }
      if (targetPage && targetPage > 0) {
        requestParams.PageNumber = targetPage
      } else if (pageNumber && pageNumber > 0) {
        requestParams.PageNumber = pageNumber
      }

      const response = await callMHPL_API_WithValidation('mhpl0002', requestParams, token)
      if (response.status !== 'success') {
        throw new Error((response as any).message || 'MHPL0002 call failed')
      }
      const normalized = normalizeMhpl0002((response as any))

      // Check if API returned meaningful data
      const totalsObj = extractTotalsObj(normalized)
      const monthlyItems = (normalized?.summaryByPeriod?.monthly?.items
        || (Array.isArray(normalized?.summaryByPeriod?.monthly) ? normalized.summaryByPeriod.monthly : [])
        || []) as any[]
      const quarterlyItems = (normalized?.summaryByPeriod?.quarterly?.items || []) as any[]
      const yearlyItems = (normalized?.summaryByPeriod?.yearly?.items || []) as any[]
      const hasAnyItems = monthlyItems.length > 0 || quarterlyItems.length > 0 || yearlyItems.length > 0
      const hasTotals = (
        (typeof totalsObj?.grand_total_expense === 'number' && totalsObj.grand_total_expense > 0) ||
        (typeof totalsObj?.total_salary === 'number' && totalsObj.total_salary > 0) ||
        (typeof totalsObj?.total_allowance === 'number' && totalsObj.total_allowance > 0)
      )
      const hasMeaningful = hasAnyItems || hasTotals

      if (!hasMeaningful) {
        const emptyData = {
          totals: {
            grand_total_expense: 0,
            total_salary: 0,
            total_allowance: 0,
            total_overtime: 0,
            total_contractor_expense: 0,
            page_number: 1,
            page_size: Number(pageSize) || 0,
            total_pages: 1,
            total_records: 0
          },
          summaryByPeriod: {
            monthly: { items: [] },
            quarterly: { items: [] },
            yearly: { items: [] }
          }
        }
        setLivePayload(emptyData)
        toast.error('No data found for selected filters.')
        return
      }

      setLivePayload(normalized as any)

      // Persist to localStorage
      try {
        if (typeof window !== 'undefined') {
          const cachePayload = { data: normalized, fetchedAt: new Date().toISOString(), endpoint: endpointId, inputParameters: requestParams }
          localStorage.setItem(`${endpointId}-payload`, JSON.stringify(cachePayload))
        }
      } catch { }

      // Update pagination from response totals
      const t: any = normalized?.totals
      if (t) {
        setPageNumber(Number(t.page_number ?? t.Page_Number ?? requestParams.PageNumber ?? 1))
        setTotalPages(Number(t.total_pages ?? t.Total_Pages ?? totalPages))
        setTotalRecords(Number(t.total_records ?? t.Total_Records ?? totalRecords))
        if (!pageSize && (t.page_size ?? t.Page_Size)) setPageSize(String(t.page_size ?? t.Page_Size))
      }

      toast.success('Payroll data refreshed')
    } catch (err: any) {
      console.error('[MHPL0002] Update failed:', err)
      toast.error(err?.message || 'Failed to refresh data')
    } finally {
      setUpdating(false)
    }
  }

  // Auto-refresh on open to show latest data from API
  useEffect(() => {
    if (isOpen) {
      if (startDate && endDate && !autoRefreshRef.current) {
        const hasData = !!mhpl0002Data && (
          Array.isArray(getMonthlyData()) ? getMonthlyData().length > 0 : false
        )
        if (!hasData) {
          autoRefreshRef.current = true
          refreshPayrollData()
        }
      }
    } else {
      autoRefreshRef.current = false
    }
  }, [isOpen, startDate, endDate])

  // Pagination handlers
  const goFirst = () => refreshPayrollData(1)
  const goPrev = () => {
    const prev = Math.max(1, pageNumber - 1)
    if (prev !== pageNumber) refreshPayrollData(prev)
  }
  const goNext = () => {
    const next = Math.min(totalPages, pageNumber + 1)
    if (next !== pageNumber) refreshPayrollData(next)
  }
  const goLast = () => refreshPayrollData(totalPages)
  const goto = (p: number) => {
    if (p >= 1 && p <= totalPages) refreshPayrollData(p)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-6xl lg:max-w-7xl h-[95vh] flex flex-col overflow-hidden p-0 [&>button]:hidden">

        {/* FIXED HEADER SECTION */}
        <div className="flex-none">
          {/* Title Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-4 sm:px-6 py-4 sm:py-5 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl lg:text-2xl font-bold mb-2">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <span className="truncate">Payroll Expense Analysis</span>
                </DialogTitle>
                <DialogDescription className="text-emerald-100 text-sm sm:text-base">
                  {getTotals()?.grand_total_expense ? <>• Total Expense: <span className="font-semibold text-white">{formatCurrency(getTotals()?.grand_total_expense)}</span> </> : null}
                  {getTotals()?.total_salary ? <>• Salary: <span className="font-semibold text-white">{formatCurrency(getTotals()?.total_salary)}</span> </> : null}
                  {getTotals()?.total_allowance ? <>• Allowances: <span className="font-semibold text-white">{formatCurrency(getTotals()?.total_allowance)}</span> </> : null}
                  {getTotals()?.total_overtime ? <>• Overtime: <span className="font-semibold text-white">{formatCurrency(getTotals()?.total_overtime)}</span> </> : null}
                  {getTotals()?.total_bonus ? <>• Bonus: <span className="font-semibold text-white">{formatCurrency(getTotals()?.total_bonus)}</span> </> : null}
                  {getTotals()?.total_contractor_expense ? <>• Contractor Expense: <span className="font-semibold text-white">{formatCurrency(getTotals()?.total_contractor_expense)}</span> </> : null}
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

          {/* Loading bar during update */}
          {updating && (
            <div className="px-6 pt-2">
              <Progress value={66} className="h-1" />
            </div>
          )}

          {/* Filter Bar */}
          <div className="px-4 sm:px-6 pt-4 bg-gray-50 border-b">
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
                  <div>
                    <Label className="text-xs">Start Date</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">End Date</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Summary Type</Label>
                    <Input type="text" placeholder="monthly" value={summType} onChange={(e) => setSummType(e.target.value)} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Department</Label>
                    <Input type="text" placeholder="BILLING" value={dept} onChange={(e) => setDept(e.target.value)} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Employee Type</Label>
                    <Input type="text" placeholder="Full-time" value={empType} onChange={(e) => setEmpType(e.target.value)} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Page Size</Label>
                    <Input type="number" min={0} placeholder="0 = all" value={pageSize} onChange={(e) => setPageSize(e.target.value)} className="h-9" />
                  </div>
                  <div className="flex md:justify-end">
                    <Button
                      className="w-full md:w-auto h-9"
                      disabled={updating || !startDate || !endDate}
                      onClick={() => refreshPayrollData()}
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
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading payroll data...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <p className="text-red-600 font-medium">Failed to load payroll data</p>
              <p className="text-gray-600 text-sm mt-2">{error}</p>
              <Button className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </div>
        )}

        {/* SCROLLABLE CONTENT SECTION - Single table */}
        {!loading && !error && (
          <div className="flex-1 overflow-y-auto flex flex-col bg-white/30 backdrop-blur-sm">
            <div className="flex-1 overflow-auto p-4 sm:p-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Payroll Breakdown (Monthly / Quarterly / Yearly)
                        </CardTitle>
                        <CardDescription>
                          Periods with overtime and contractor alerts, with department drilldown.
                        </CardDescription>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        {totalRecords > 0 && (
                          <div className="text-xs sm:text-sm text-gray-600 font-medium whitespace-nowrap">
                            Page {pageNumber} of {totalPages} · {totalRecords} total
                          </div>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExport}
                          disabled={!unifiedPeriodData || unifiedPeriodData.length === 0}
                          className="gap-1 whitespace-nowrap"
                        >
                          <Download className="w-4 h-4" />
                          Export CSV
                        </Button>
                      </div>
                    </div>

                    {/* Filters Row */}
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                      {/* Period Type Filter */}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-medium text-gray-700 whitespace-nowrap">Period Type:</Label>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={selectedPeriodTypes.includes('monthly') ? 'default' : 'outline'}
                            onClick={() => togglePeriodType('monthly')}
                            className="h-8 text-xs"
                          >
                            Monthly
                          </Button>
                          <Button
                            size="sm"
                            variant={selectedPeriodTypes.includes('quarterly') ? 'default' : 'outline'}
                            onClick={() => togglePeriodType('quarterly')}
                            className="h-8 text-xs"
                          >
                            Quarterly
                          </Button>
                          <Button
                            size="sm"
                            variant={selectedPeriodTypes.includes('yearly') ? 'default' : 'outline'}
                            onClick={() => togglePeriodType('yearly')}
                            className="h-8 text-xs"
                          >
                            Yearly
                          </Button>
                        </div>
                      </div>

                      {/* Search Filter */}
                      <div className="relative w-full sm:w-64 ml-auto">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="Search periods..."
                          value={periodFilter}
                          onChange={(e) => setPeriodFilter(e.target.value)}
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {filteredPeriodData && filteredPeriodData.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead
                              className="cursor-pointer hover:bg-gray-50 select-none w-24"
                              onClick={() => handleSort('_periodTypeLabel')}
                            >
                              <div className="flex items-center gap-1">
                                <span>Period Type</span>
                                {sortConfig.key === '_periodTypeLabel' && (
                                  sortConfig.direction === 'asc' ?
                                    <ChevronUp className="w-3 h-3" /> :
                                    <ChevronDown className="w-3 h-3" />
                                )}
                              </div>
                            </TableHead>
                            <TableHead
                              className="cursor-pointer hover:bg-gray-50 select-none w-28"
                              onClick={() => handleSort('periods')}
                            >
                              <div className="flex items-center gap-1">
                                <span>Period</span>
                                {sortConfig.key === 'periods' && (
                                  sortConfig.direction === 'asc' ?
                                    <ChevronUp className="w-3 h-3" /> :
                                    <ChevronDown className="w-3 h-3" />
                                )}
                              </div>
                            </TableHead>
                            <TableHead
                              className="cursor-pointer hover:bg-gray-50 select-none text-right w-32"
                              onClick={() => handleSort('total_expense')}
                            >
                              <div className="flex items-center justify-end gap-1">
                                <span>Total Expense</span>
                                {sortConfig.key === 'total_expense' && (
                                  sortConfig.direction === 'asc' ?
                                    <ChevronUp className="w-3 h-3" /> :
                                    <ChevronDown className="w-3 h-3" />
                                )}
                              </div>
                            </TableHead>
                            <TableHead
                              className="cursor-pointer hover:bg-gray-50 select-none text-center w-28"
                              onClick={() => handleSort('overtime_percentage')}
                            >
                              <div className="flex items-center justify-center gap-1">
                                <span>Overtime %</span>
                                {sortConfig.key === 'overtime_percentage' && (
                                  sortConfig.direction === 'asc' ?
                                    <ChevronUp className="w-3 h-3" /> :
                                    <ChevronDown className="w-3 h-3" />
                                )}
                              </div>
                            </TableHead>
                            <TableHead className="w-28 text-center">High OT Alert</TableHead>
                            <TableHead
                              className="cursor-pointer hover:bg-gray-50 select-none text-center w-36"
                              onClick={() => handleSort('contractor_expense_change')}
                            >
                              <div className="flex items-center justify-center gap-1">
                                <span>Contractor Change</span>
                                {sortConfig.key === 'contractor_expense_change' && (
                                  sortConfig.direction === 'asc' ?
                                    <ChevronUp className="w-3 h-3" /> :
                                    <ChevronDown className="w-3 h-3" />
                                )}
                              </div>
                            </TableHead>
                            <TableHead className="w-36 text-center">Contractor Decrease</TableHead>
                            <TableHead className="text-center w-32">
                              Departments
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getSortedData(filteredPeriodData).map((item: any, index: number) => {
                            const periodKey = `${item._periodKind}-${item.periods}`
                            const departments = item?.departments?.items ?? []

                            return (
                              <React.Fragment key={periodKey}>
                                {/* Period row */}
                                <TableRow>
                                  <TableCell className="font-medium w-24">
                                    <Badge variant="outline" className="font-normal">
                                      {item._periodTypeLabel}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-mono font-medium w-28">{item.periods}</TableCell>
                                  <TableCell className="text-right font-semibold w-32">
                                    {formatCurrency(item.total_expense)}
                                  </TableCell>
                                  <TableCell className="text-center w-28">
                                    <Badge
                                      className={cn(
                                        (item.overtime_percentage ?? 0) > 0
                                          ? 'bg-yellow-100 text-yellow-800'
                                          : 'bg-green-100 text-green-800'
                                      )}
                                    >
                                      {formatPercentage(item.overtime_percentage)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center w-28">
                                    <Badge
                                      className={cn(
                                        item.high_overtime_alert === 'true'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-gray-100 text-gray-700'
                                      )}
                                    >
                                      {item.high_overtime_alert === 'true' ? 'High' : 'Normal'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center w-36">
                                    {item.contractor_expense_change !== null &&
                                      item.contractor_expense_change !== undefined ? (
                                      <Badge
                                        className={cn(
                                          item.contractor_expense_change >= 0
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                        )}
                                      >
                                        {item.contractor_expense_change >= 0 ? '+' : ''}
                                        {formatCurrency(item.contractor_expense_change)}
                                      </Badge>
                                    ) : (
                                      <span className="text-gray-400 text-sm">N/A</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center w-36">
                                    <Badge
                                      className={cn(
                                        item.contractor_expense_decrease_alert === 'true'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-gray-100 text-gray-700'
                                      )}
                                    >
                                      {item.contractor_expense_decrease_alert === 'true'
                                        ? 'Alert'
                                        : 'OK'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center w-32">
                                    {departments.length > 0 ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          setExpandedPeriod(
                                            expandedPeriod === periodKey ? null : periodKey
                                          )
                                        }
                                        className="gap-1 h-8"
                                      >
                                        <span className="text-xs sm:text-sm">
                                          {departments.length} dept
                                          {departments.length > 1 ? 's' : ''}
                                        </span>
                                        {expandedPeriod === periodKey ? (
                                          <ChevronUp className="w-3 h-3" />
                                        ) : (
                                          <ChevronDown className="w-3 h-3" />
                                        )}
                                      </Button>
                                    ) : (
                                      <span className="text-gray-400 text-xs">No depts</span>
                                    )}
                                  </TableCell>
                                </TableRow>

                                {/* Departments Section - Separate Table */}
                                {expandedPeriod === periodKey && departments.length > 0 && (
                                  <TableRow>
                                    <TableCell colSpan={8} className="p-0 bg-gray-50/80">
                                      <div className="p-4 border-l-4 border-blue-500">
                                        <div className="mb-3 flex items-center gap-2">
                                          <div className="h-px flex-1 bg-gray-300" />
                                          <h4 className="text-sm font-semibold text-gray-700 px-3 bg-white rounded-full border">
                                            Departments for {item.periods}
                                          </h4>
                                          <div className="h-px flex-1 bg-gray-300" />
                                        </div>

                                        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                                          <Table>
                                            <TableHeader>
                                              <TableRow className="bg-gray-50">
                                                <TableHead className="font-semibold">Department Name</TableHead>
                                                <TableHead className="text-right font-semibold">Total Expense</TableHead>
                                                <TableHead className="text-center font-semibold">Overtime %</TableHead>
                                                <TableHead className="text-center font-semibold">High OT Alert</TableHead>
                                                <TableHead className="text-center font-semibold">Contractor Change</TableHead>
                                                <TableHead className="text-center font-semibold">Contractor Decrease</TableHead>
                                                <TableHead className="text-center font-semibold">Categories</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {departments.map((dept: any, deptIndex: number) => {
                                                const deptKey = `${periodKey}-dept-${deptIndex}`
                                                const categories = dept.categories || []

                                                return (
                                                  <React.Fragment key={deptKey}>
                                                    <TableRow className="hover:bg-gray-50">
                                                      <TableCell className="font-medium">
                                                        {dept.dept_name}
                                                      </TableCell>
                                                      <TableCell className="text-right font-medium">
                                                        {formatCurrency(dept.total_expense)}
                                                      </TableCell>
                                                      <TableCell className="text-center">
                                                        <Badge
                                                          className={cn(
                                                            (dept.overtime_percentage ?? 0) > 0
                                                              ? 'bg-yellow-100 text-yellow-800'
                                                              : 'bg-green-100 text-green-800'
                                                          )}
                                                        >
                                                          {formatPercentage(dept.overtime_percentage)}
                                                        </Badge>
                                                      </TableCell>
                                                      <TableCell className="text-center">
                                                        <Badge
                                                          className={cn(
                                                            dept.high_overtime_alert === 'true'
                                                              ? 'bg-red-100 text-red-800'
                                                              : 'bg-gray-100 text-gray-700'
                                                          )}
                                                        >
                                                          {dept.high_overtime_alert === 'true' ? 'High' : 'Normal'}
                                                        </Badge>
                                                      </TableCell>
                                                      <TableCell className="text-center">
                                                        {dept.contractor_expense_change !== null &&
                                                          dept.contractor_expense_change !== undefined ? (
                                                          <Badge
                                                            className={cn(
                                                              dept.contractor_expense_change >= 0
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-red-100 text-red-800'
                                                            )}
                                                          >
                                                            {dept.contractor_expense_change >= 0 ? '+' : ''}
                                                            {formatCurrency(dept.contractor_expense_change)}
                                                          </Badge>
                                                        ) : (
                                                          <span className="text-gray-400 text-sm">N/A</span>
                                                        )}
                                                      </TableCell>
                                                      <TableCell className="text-center">
                                                        <Badge
                                                          className={cn(
                                                            dept.contractor_expense_decrease_alert === 'true'
                                                              ? 'bg-red-100 text-red-800'
                                                              : 'bg-gray-100 text-gray-700'
                                                          )}
                                                        >
                                                          {dept.contractor_expense_decrease_alert === 'true' ? 'Alert' : 'OK'}
                                                        </Badge>
                                                      </TableCell>
                                                      <TableCell className="text-center">
                                                        {categories.length > 0 ? (
                                                          <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                              setExpandedDepartment(
                                                                expandedDepartment === deptKey ? null : deptKey
                                                              )
                                                            }
                                                            className="gap-1 h-7"
                                                          >
                                                            <span className="text-xs">
                                                              {categories.length} cat{categories.length > 1 ? 's' : ''}
                                                            </span>
                                                            {expandedDepartment === deptKey ? (
                                                              <ChevronUp className="w-3 h-3" />
                                                            ) : (
                                                              <ChevronDown className="w-3 h-3" />
                                                            )}
                                                          </Button>
                                                        ) : (
                                                          <span className="text-gray-400 text-xs">No cats</span>
                                                        )}
                                                      </TableCell>
                                                    </TableRow>

                                                    {/* Categories Section - Separate Table */}
                                                    {expandedDepartment === deptKey && categories.length > 0 && (
                                                      <TableRow>
                                                        <TableCell colSpan={7} className="p-0 bg-blue-50/30">
                                                          <div className="p-4 border-l-4 border-green-500 ml-4">
                                                            <div className="mb-3 flex items-center gap-2">
                                                              <div className="h-px flex-1 bg-blue-300" />
                                                              <h5 className="text-xs font-semibold text-gray-600 px-3 bg-white rounded-full border border-blue-200">
                                                                Categories for {dept.dept_name}
                                                              </h5>
                                                              <div className="h-px flex-1 bg-blue-300" />
                                                            </div>

                                                            <div className="bg-white rounded-lg border border-blue-200 shadow-sm overflow-hidden">
                                                              <Table>
                                                                <TableHeader>
                                                                  <TableRow className="bg-blue-50">
                                                                    <TableHead className="font-semibold">Category Name</TableHead>
                                                                    <TableHead className="text-right font-semibold">Amount</TableHead>
                                                                  </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                  {categories.map((cat: any, catIndex: number) => (
                                                                    <TableRow key={`${deptKey}-cat-${catIndex}`} className="hover:bg-blue-50/50">
                                                                      <TableCell className="font-medium">
                                                                        {cat.category}
                                                                      </TableCell>
                                                                      <TableCell className="text-right font-semibold text-blue-700">
                                                                        {formatCurrency(cat.amount)}
                                                                      </TableCell>
                                                                    </TableRow>
                                                                  ))}
                                                                </TableBody>
                                                              </Table>
                                                            </div>
                                                          </div>
                                                        </TableCell>
                                                      </TableRow>
                                                    )}
                                                  </React.Fragment>
                                                )
                                              })}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="font-medium">No payroll data available</p>
                      <p className="text-sm mt-1">
                        {periodFilter
                          ? 'Try adjusting your search filter or date range'
                          : 'Try adjusting your filters or date range'}
                      </p>
                    </div>
                  )}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <span className="whitespace-nowrap">Page size:</span>
                          <input
                            title="Items per page"
                            className="w-20 h-8 border rounded px-2 text-sm"
                            value={pageSize}
                            onChange={(e) => setPageSize(e.target.value)}
                            onBlur={() => {
                              if (startDate && endDate) refreshPayrollData(pageNumber)
                            }}
                            type="number"
                            min={1}
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" onClick={goFirst} disabled={updating || pageNumber === 1}>⟪</Button>
                          <Button size="sm" variant="outline" onClick={goPrev} disabled={updating || pageNumber === 1}>‹</Button>
                          <div className="flex items-center gap-1 mx-2">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let p: number
                              const current = pageNumber
                              const total = totalPages
                              if (total <= 5) {
                                p = i + 1
                              } else if (current <= 3) {
                                p = i + 1
                              } else if (current >= total - 2) {
                                p = total - 4 + i
                              } else {
                                p = current - 2 + i
                              }
                              return (
                                <Button
                                  key={p}
                                  size="sm"
                                  variant={pageNumber === p ? 'default' : 'outline'}
                                  className="w-10"
                                  disabled={updating}
                                  onClick={() => goto(p)}
                                >
                                  {p}
                                </Button>
                              )
                            })}
                          </div>
                          <Button size="sm" variant="outline" onClick={goNext} disabled={updating || pageNumber === totalPages}>›</Button>
                          <Button size="sm" variant="outline" onClick={goLast} disabled={updating || pageNumber === totalPages}>⟫</Button>
                        </div>

                        <div className="text-sm text-gray-600 whitespace-nowrap">
                          {totalRecords > 0 ? (
                            (() => {
                              const ps = Math.max(1, Number(pageSize) || 0)
                              const start = (pageNumber - 1) * ps + 1
                              const end = Math.min(pageNumber * ps, totalRecords)
                              return <span>Showing {start}-{end} of {totalRecords}</span>
                            })()
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ⚡ PERFORMANCE: Memoized export to prevent unnecessary re-renders
export const PayrollBreakdownModal = memo(PayrollBreakdownModalComponent, (prevProps, nextProps) => {
  return prevProps.isOpen === nextProps.isOpen &&
    prevProps.data === nextProps.data &&
    prevProps.endpointId === nextProps.endpointId
})
