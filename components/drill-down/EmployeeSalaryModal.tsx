'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { X, TrendingUp, Calendar, DollarSign, BarChart3, PieChart, Activity, Users, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, Download, Loader2 } from 'lucide-react'
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
import { type EmployeeSalary, type DepartmentSummary, type EmployeeTypeSummary, type MonthlySalary, type YearlySalary } from '@/lib/api/schemas/mhpl0010-schema'
import { useFilterState } from '@/components/filters/FilterStateProvider'
import { useDashboardStore } from '@/lib/store/dashboard-store'
import { TokenStorage } from '@/lib/tokenStorage'
import { callMHPL_API_WithValidation } from '@/lib/api/mhplApi'
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
  Legend
} from 'recharts'

interface EmployeeSalaryModalProps {
  isOpen: boolean
  onClose: () => void
  data?: any
  endpointId: string
  currentValue: string | number
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

export function EmployeeSalaryModal({
  isOpen,
  onClose,
  data,
  endpointId,
  currentValue
}: EmployeeSalaryModalProps) {
  const theme = getThemeForEndpoint(endpointId)
  const [activeTab, setActiveTab] = useState('employees')
  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState('all')
  const [departmentSearch, setDepartmentSearch] = useState('')
  const [sortState, setSortState] = useState<SortState>({ key: 'TOTAL_SALARY', direction: 'desc' })

  // Client-side pagination (legacy, not used for employees after server-side enable)
  const [pagination, setPagination] = useState<PaginationState>({ currentPage: 1, pageSize: 25, totalItems: 0 })

  const { payload, loading, error } = useStoredKpiData(endpointId, isOpen, data)
  const { hasLoadedPreset } = useFilterState()
  const zustandStore = useDashboardStore()
  const globalFilters = zustandStore.globalFilters
  const endpointOverrides = zustandStore.endpointOverrides || {}

  // Live refresh filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [departments, setDepartments] = useState('billing')
  const [empType, setEmpType] = useState('worker')
  const [summType, setSummType] = useState('')
  const [pageSize, setPageSize] = useState('')
  const [updating, setUpdating] = useState(false)
  const [livePayload, setLivePayload] = useState<any | null>(null)
  const [loadingPage, setLoadingPage] = useState(false)
  const autoRefreshRef = useRef(false)

  useEffect(() => {
    if (!isOpen) return

    // Align dates with global filters
    setStartDate(globalFilters.startDate || '')
    setEndDate(globalFilters.endDate || '')

    // Align local filters with KPI-level overrides for mhpl0010
    const overrides = endpointOverrides?.[endpointId] || {}
    const deptDefault = overrides.Departments ?? 'billing, monthly'
    const empTypeDefault = overrides.EmpType ?? 'worker'
    const summTypeDefault = overrides.SummType ?? 'Monthly'

    setDepartments(String(deptDefault))
    setEmpType(String(empTypeDefault))
    setSummType(String(summTypeDefault))

    setPageSize('')
    setUpdating(false)
  }, [isOpen, hasLoadedPreset, globalFilters.startDate, globalFilters.endDate, endpointOverrides, endpointId])

  const mhpl0010Data = useMemo(() => {
    const effective = livePayload ?? payload
    if (!effective) return null

    // Unwrap possible double-nesting: { data: { data: { ... } } }
    const first = (effective as any)?.data ?? effective
    const actualData = (first as any)?.data ?? first

    console.log('[MHPL0010] Data structure:', {
      hasData: !!actualData,
      hasTotals: !!(actualData as any)?.totals,
      hasGroupByEmployee: !!(actualData as any)?.GroupByEmployee
    })

    return actualData
  }, [payload, livePayload])

  // Extract pagination metadata for GroupByEmployee
  const apiPaginationMeta = useMemo(() => {
    const g = (mhpl0010Data as any)?.GroupByEmployee
    if (g) {
      return {
        pageNumber: g.page_number || g.PAGE_NUMBER || 1,
        pageSize: g.page_size || g.PAGE_SIZE || 25,
        totalPages: g.total_pages || g.TOTAL_PAGES || 1,
        totalRecords: g.total_records || g.TOTAL_RECORDS || (g.items?.length || 0),
      }
    }
    return { pageNumber: 1, pageSize: 25, totalPages: 1, totalRecords: 0 }
  }, [mhpl0010Data])

  // Transform MHPL0010 data for display
  const transformedData = useMemo(() => {
    if (!mhpl0010Data) return {
      employees: [] as EmployeeSalary[],
      departments: [] as DepartmentSummary[],
      employeeTypes: [] as EmployeeTypeSummary[],
      monthlyData: [] as MonthlySalary[],
      yearlyData: [] as YearlySalary[],
      totals: { totalEmployees: 0, overallSalary: 0 }
    }

    const employees = mhpl0010Data?.GroupByEmployee?.items || []
    const departments = mhpl0010Data?.groupByDepartment?.items || []
    const employeeTypes = mhpl0010Data?.groupByEmployeeType?.items || []
    const monthlyData = mhpl0010Data?.groupByMonth?.items || []
    const yearlyData = mhpl0010Data?.groupByYear?.items || []

    const totals = {
      totalEmployees: mhpl0010Data?.totals?.total_employees || 0,
      overallSalary: mhpl0010Data?.totals?.overall_salary || 0
    }

    return { employees, departments, employeeTypes, monthlyData, yearlyData, totals }
  }, [mhpl0010Data])

  // Filtered and sorted employees
  const filteredEmployees = useMemo(() => {
    let filtered = transformedData.employees

    if (searchTerm) {
      filtered = filtered.filter((employee: EmployeeSalary) =>
        employee.EMPLOYEE_NAME.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.EMPLOYEE_ID.toString().includes(searchTerm.toLowerCase()) ||
        employee.EMPLOYEE_TYPE.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (departmentFilter !== 'all') {
      filtered = filtered.filter((employee: EmployeeSalary) => employee.DEPARTMENT === departmentFilter)
    }

    if (employeeTypeFilter !== 'all') {
      filtered = filtered.filter((employee: EmployeeSalary) => employee.EMPLOYEE_TYPE === employeeTypeFilter)
    }

    filtered.sort((a: EmployeeSalary, b: EmployeeSalary) => {
      const aVal = a[sortState.key as keyof EmployeeSalary]
      const bVal = b[sortState.key as keyof EmployeeSalary]
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortState.direction === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [transformedData.employees, searchTerm, departmentFilter, employeeTypeFilter, sortState])

  // Server-side pagination (employees)
  const paginatedEmployees = filteredEmployees
  const totalPages = apiPaginationMeta.totalPages

  // Filtered departments for departments tab
  const filteredDepartments = useMemo(() => {
    let list = transformedData.departments as DepartmentSummary[]
    if (departmentSearch) {
      const lower = departmentSearch.toLowerCase()
      list = list.filter(dept =>
        String(dept.DEPARTMENT || '').toLowerCase().includes(lower)
      )
    }
    return list
  }, [transformedData.departments, departmentSearch])

  // Handle sorting
  const handleSort = (key: string) => {
    setSortState(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  // Pagination handlers
  // Server-side page fetcher
  const fetchDataFromAPI = useCallback(async (pageNum: number) => {
    if (!endpointId) return
    if (!pageNum || pageNum < 1) return
    if (!startDate || !endDate) {
      toast.error('Start and End dates are required')
      return
    }
    setLoadingPage(true)
    try {
      let token: string | null = null
      try { token = TokenStorage.getValidToken?.() ?? null } catch {}
      if (!token && typeof window !== 'undefined') {
        token = localStorage.getItem('mhpl_bearer_token') || localStorage.getItem('mhpl_token')
      }
      if (!token) {
        toast.error('Authentication required. Please sign in.')
        return
      }
      const payload: Record<string, any> = {
        StartDate: startDate,
        EndDate: endDate,
        PageNumber: pageNum
      }
      if (departments && departments.trim() !== '') payload.Departments = departments.trim()
      if (empType && empType.trim() !== '') payload.EmpType = empType.trim()
      if (summType && summType.trim() !== '') payload.SummType = summType.trim()
      const psNum = parseInt(pageSize || '0', 10)
      if (Number.isFinite(psNum) && psNum > 0) payload.PageSize = psNum

      const result = await callMHPL_API_WithValidation(endpointId || 'mhpl0010', payload, token)
      if ((result as any)?.status !== 'success') {
        const msg = (result as any)?.message || 'MHPL0010 call failed'
        throw new Error(msg)
      }
      const raw = (result as any).data
      const normalized = raw?.data ? raw.data : raw
      setLivePayload(normalized as any)
      toast.success(`Page ${pageNum} loaded`)
    } catch (error: any) {
      console.error('[MHPL0010 Pagination] Error:', error)
      toast.error(error?.message || `Failed to load page ${pageNum}`)
    } finally {
      setLoadingPage(false)
    }
  }, [endpointId, startDate, endDate, departments, empType, pageSize])

  const goToPage = (page: number) => fetchDataFromAPI(page)

  const changePageSize = (size: number) => {
    setPagination(prev => ({ ...prev, pageSize: size, currentPage: 1 }))
    // Also update server-side page size and reload first page
    setPageSize(String(size))
    fetchDataFromAPI(1)
  }

  // Auto-refresh on open
  useEffect(() => {
    if (isOpen) {
      if (startDate && endDate && !autoRefreshRef.current) {
        autoRefreshRef.current = true
        fetchDataFromAPI(1)
      }
    } else {
      autoRefreshRef.current = false
    }
  }, [isOpen, startDate, endDate, departments, empType, pageSize, fetchDataFromAPI])

  // Salary distribution data for charts
  const salaryRangeData = useMemo(() => {
    const ranges = [
      { range: 'Under ৳20K', min: 0, max: 20000, color: '#EF4444' },
      { range: '৳20K-৳40K', min: 20000, max: 40000, color: '#F59E0B' },
      { range: '৳40K-৳60K', min: 40000, max: 60000, color: '#10B981' },
      { range: '৳60K-৳80K', min: 60000, max: 80000, color: '#3B82F6' },
      { range: 'Over ৳80K', min: 80000, max: Infinity, color: '#8B5CF6' }
    ]

    return ranges.map(range => ({
      ...range,
      count: transformedData.employees.filter((e: EmployeeSalary) => e.TOTAL_SALARY >= range.min && e.TOTAL_SALARY < range.max).length
    }))
  }, [transformedData.employees])

  // Export data - Employees
  const exportEmployees = () => {
    const csvData = [
      ['Employee Name', 'Employee ID', 'Department', 'Employee Type', 'Total Salary'],
      ...filteredEmployees.map((employee: EmployeeSalary) => [
        employee.EMPLOYEE_NAME,
        employee.EMPLOYEE_ID,
        employee.DEPARTMENT,
        employee.EMPLOYEE_TYPE,
        employee.TOTAL_SALARY
      ])
    ]

    const csvContent = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `employee-salary-employees-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Export data - Departments
  const exportDepartments = () => {
    const csvData = [
      ['Department', 'Employee Count', 'Total Salary', 'Average Salary'],
      ...transformedData.departments.map((dept: DepartmentSummary) => [
        dept.DEPARTMENT,
        dept.EMPLOYEE_COUNT,
        dept.TOTAL_SALARY,
        Math.floor(dept.TOTAL_SALARY / Math.max(dept.EMPLOYEE_COUNT, 1)),
      ]),
    ]

    const csvContent = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `employee-salary-departments-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (sortState.key !== column) return <Activity className="w-3 h-3 ml-1 opacity-30" />
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
                  <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span className="truncate">Employee Salary Analysis</span>
              </DialogTitle>
              <DialogDescription className="text-white/90 text-xs sm:text-sm">
                • Total Salary Cost: <span className="font-semibold text-white">{formatCurrency(transformedData.totals.overallSalary)}</span>
                {!loading && transformedData.employees.length > 0 && (
                  <span className="ml-0 sm:ml-4 block sm:inline mt-1 sm:mt-0">• {transformedData.employees.length} Employees</span>
                )}
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading employee salary data...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-12 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <p className="text-red-600 font-medium">Failed to load salary data</p>
              <p className="text-gray-600 text-sm mt-2">{error}</p>
              <Button className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Loading bar during update */}
        {updating && (
          <div className="px-6 pt-4">
            <Progress value={66} />
          </div>
        )}

        {/* Filter Bar for live refresh */}
        <div className="px-6 pt-4">
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
                  <Label className="text-xs">Departments (optional)</Label>
                  <Input type="text" placeholder="billing" value={departments} onChange={(e) => setDepartments(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Employee Type (optional)</Label>
                  <Input type="text" placeholder="worker" value={empType} onChange={(e) => setEmpType(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Summ Type (optional)</Label>
                  <Input
                    type="text"
                    placeholder="Monthly"
                    value={summType}
                    onChange={(e) => setSummType(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Page Size (optional)</Label>
                  <Input type="number" min={0} placeholder="0 = all" value={pageSize} onChange={(e) => setPageSize(e.target.value)} />
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
                          PageNumber: '1'
                        }
                        // Only add optional params if they have values
                        if (departments && departments.trim() !== '') requestParams.Departments = departments.trim()
                        if (empType && empType.trim() !== '') requestParams.EmpType = empType.trim()
                        if (summType && summType.trim() !== '') requestParams.SummType = summType.trim()
                        if (pageSize && pageSize.trim() !== '' && parseInt(pageSize) > 0) {
                          requestParams.PageSize = pageSize.trim()
                        }

                        const response = await callMHPL_API_WithValidation('mhpl0010', requestParams, token)
                        if (response.status !== 'success') {
                          throw new Error((response as any).message || 'MHPL0010 call failed')
                        }

                        const raw = (response as any).data
                        const normalized = raw?.data ? raw.data : raw
                        setLivePayload(normalized as any)
                        toast.success('Employee salary data refreshed')
                      } catch (err: any) {
                        console.error('[MHPL0010] Update failed:', err)
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

        {/* Content */}
        {!loading && !error && (
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="employees" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Employees
                </TabsTrigger>
                <TabsTrigger value="departments" className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Departments
                </TabsTrigger>
                <TabsTrigger value="types" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Employee Types
                </TabsTrigger>
              </TabsList>

              {/* Employees Tab */}
              <TabsContent value="employees" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Employee Salary Details
                    </CardTitle>
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-gray-400" />
                        <Input
                          placeholder="Search employees..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-64"
                        />
                      </div>
                      <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Filter by department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Departments</SelectItem>
                          {(Array.from(new Set(transformedData.employees.map((e: EmployeeSalary) => e.DEPARTMENT))) as string[]).map((dept: string) => (
                            <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={employeeTypeFilter} onValueChange={setEmployeeTypeFilter}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Filter by type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {(Array.from(new Set(transformedData.employees.map((e: EmployeeSalary) => e.EMPLOYEE_TYPE))) as string[]).map((type: string) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportEmployees}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export Employees
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="p-3 text-left font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('EMPLOYEE_NAME')}>
                              Employee <SortIcon column="EMPLOYEE_NAME" />
                            </th>
                            <th className="p-3 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('EMPLOYEE_ID')}>
                              ID <SortIcon column="EMPLOYEE_ID" />
                            </th>
                            <th className="p-3 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('DEPARTMENT')}>
                              Department <SortIcon column="DEPARTMENT" />
                            </th>
                            <th className="p-3 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('EMPLOYEE_TYPE')}>
                              Type <SortIcon column="EMPLOYEE_TYPE" />
                            </th>
                            <th className="p-3 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('TOTAL_SALARY')}>
                              Total Salary <SortIcon column="TOTAL_SALARY" />
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedEmployees.map((employee: EmployeeSalary, index: number) => (
                            <tr key={`${employee.EMPLOYEE_ID}-${index}`} className="border-b hover:bg-gray-50">
                              <td className="p-3 font-medium">
                                <div className="truncate max-w-xs" title={employee.EMPLOYEE_NAME}>
                                  {employee.EMPLOYEE_NAME}
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant="outline" className="text-gray-600">
                                  {employee.EMPLOYEE_ID}
                                </Badge>
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant="outline" className="text-purple-600">
                                  {employee.DEPARTMENT}
                                </Badge>
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant="secondary" className="text-gray-600">
                                  {employee.EMPLOYEE_TYPE}
                                </Badge>
                              </td>
                              <td className="p-3 text-center text-green-600 font-bold text-lg">
                                {formatCurrency(employee.TOTAL_SALARY)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination (server-side for employees) */}
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Show:</span>
                        <Select
                          value={apiPaginationMeta.pageSize.toString()}
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
                          {(() => {
                            const start = apiPaginationMeta.totalRecords > 0
                              ? (apiPaginationMeta.pageNumber - 1) * apiPaginationMeta.pageSize + 1
                              : 0
                            const end = Math.min(apiPaginationMeta.pageNumber * apiPaginationMeta.pageSize, apiPaginationMeta.totalRecords)
                            return <>Showing {start} to {end} of {apiPaginationMeta.totalRecords} employees</>
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => goToPage(apiPaginationMeta.pageNumber - 1)}
                          disabled={apiPaginationMeta.pageNumber === 1 || loadingPage}
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Previous
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum: number
                            const current = apiPaginationMeta.pageNumber
                            const total = totalPages
                            if (total <= 5) pageNum = i + 1
                            else if (current <= 3) pageNum = i + 1
                            else if (current >= total - 2) pageNum = total - 4 + i
                            else pageNum = current - 2 + i
                            return (
                              <Button
                                key={pageNum}
                                variant={apiPaginationMeta.pageNumber === pageNum ? "default" : "outline"}
                                size="sm"
                                onClick={() => goToPage(pageNum)}
                                className="w-8 h-8 p-0"
                                disabled={loadingPage}
                              >
                                {pageNum}
                              </Button>
                            )
                          })}
                          {totalPages > 5 && (
                            <>
                              <span className="px-2 text-gray-400">...</span>
                              <Button
                                variant={apiPaginationMeta.pageNumber === totalPages ? "default" : "outline"}
                                size="sm"
                                onClick={() => goToPage(totalPages)}
                                className="w-8 h-8 p-0"
                                disabled={loadingPage}
                              >
                                {totalPages}
                              </Button>
                            </>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => goToPage(apiPaginationMeta.pageNumber + 1)}
                          disabled={apiPaginationMeta.pageNumber === totalPages || loadingPage}
                        >
                          Next
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
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5" />
                      Department-wise Salary Breakdown
                    </CardTitle>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-gray-400" />
                        <Input
                          placeholder="Search departments..."
                          value={departmentSearch}
                          onChange={(e) => setDepartmentSearch(e.target.value)}
                          className="w-60"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportDepartments}
                        disabled={transformedData.departments.length === 0}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export Departments
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredDepartments.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="p-3 text-left font-medium">Department</th>
                              <th className="p-3 text-center font-medium">Employee Count</th>
                              <th className="p-3 text-center font-medium">Total Salary</th>
                              <th className="p-3 text-center font-medium">Average Salary</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredDepartments.map((dept: DepartmentSummary, index: number) => (
                              <tr key={index} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-medium">{dept.DEPARTMENT}</td>
                                <td className="p-3 text-center">
                                  <Badge variant="outline" className="text-blue-600">
                                    {dept.EMPLOYEE_COUNT}
                                  </Badge>
                                </td>
                                <td className="p-3 text-center font-bold text-green-600">
                                  {formatCurrency(dept.TOTAL_SALARY)}
                                </td>
                                <td className="p-3 text-center font-medium text-purple-600">
                                  {formatCurrency(Math.floor(dept.TOTAL_SALARY / Math.max(dept.EMPLOYEE_COUNT, 1)))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No department data available.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Employee Types Tab */}
              <TabsContent value="types" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Employee Type Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {transformedData.employeeTypes.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="p-3 text-left font-medium">Employee Type</th>
                              <th className="p-3 text-center font-medium">Employee Count</th>
                              <th className="p-3 text-center font-medium">Total Salary</th>
                              <th className="p-3 text-center font-medium">Average Salary</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transformedData.employeeTypes.map((type: EmployeeTypeSummary, index: number) => (
                              <tr key={index} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-medium">{type.EMPLOYEE_TYPE}</td>
                                <td className="p-3 text-center">
                                  <Badge variant="outline" className="text-blue-600">
                                    {type.EMPLOYEE_COUNT}
                                  </Badge>
                                </td>
                                <td className="p-3 text-center font-bold text-green-600">
                                  {formatCurrency(type.TOTAL_SALARY)}
                                </td>
                                <td className="p-3 text-center font-medium text-purple-600">
                                  {formatCurrency(Math.floor(type.TOTAL_SALARY / Math.max(type.EMPLOYEE_COUNT, 1)))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No employee type data available.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Trends Tab */}
              <TabsContent value="trends" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Salary Trends Over Time
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {transformedData.monthlyData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={transformedData.monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="TOTAL_SALARY"
                            stroke="#10B981"
                            strokeWidth={2}
                            name="Total Salary"
                            dot={{ fill: '#10B981' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-4xl mb-2">📊</div>
                        <p>No trend data available for the selected period.</p>
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
