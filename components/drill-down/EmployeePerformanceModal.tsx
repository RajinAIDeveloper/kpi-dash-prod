'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { TrendingUp, TrendingDown, Calendar, Users, Target, Award, BarChart3, PieChart, Activity, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, Filter, Clock, Star, Download, X, AlertTriangle, Loader2, ChevronsLeft, ChevronsRight, RefreshCw } from 'lucide-react'
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
import { type Employee, type MonthlyPerformance, type DepartmentPerformance, type EmployeeGroup } from '@/lib/api/schemas/mhpl0008-schema'
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
  LabelList
} from 'recharts'

interface EmployeePerformanceModalProps {
  isOpen: boolean
  onClose: () => void
  endpointId: string
  currentValue: string | number
  data?: any
}

// All type definitions now come from the Zod schema
// Employee, MonthlyPerformance, DepartmentPerformance, and EmployeeGroup are imported from '@/lib/api/schemas/mhpl0008-schema'

interface TransformedEmployee {
  employeeName: string
  employeeId: string
  department: string
  designation: string
  employeeType: string
  performanceScore: number
  presentDays: number
  totalWorkingDays: number
  absentDays: number
  lateCount: number
  attendancePercentage: number
  averageRating: number
  performanceCategory: string
}

interface TransformedDepartment {
  department: string
  totalEmployees: number
  presentDays: number
  totalWorkingDays: number
  attendancePercentage: number
  averagePerformanceScore: number
  averagePresentDays: number
}

interface TransformedMonthly {
  month: string
  department: string
  overallAveragePerformance: number
  overallPresentDays: number
  overallTotalDays: number
  overallAttendancePercentage: number
  totalEmployees: number
}

interface TransformedTotals {
  totalEmployees: number
  overallAvgPresentDays: number
  overallAvgPerformance: number
  attendancePercentage: number
}

interface TransformedData {
  employees: TransformedEmployee[]
  monthlyPerformance: TransformedMonthly[]
  yearlyPerformance: { year: string; department: string; averagePerformanceScore: number }[]
  departmentPerformance: TransformedDepartment[]
  totals: TransformedTotals
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

export function EmployeePerformanceModal({
  isOpen,
  onClose,
  endpointId,
  currentValue,
  data
}: EmployeePerformanceModalProps) {
  const theme = getThemeForEndpoint(endpointId)
  const [activeTab, setActiveTab] = useState('employees')
  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [performanceFilter, setPerformanceFilter] = useState('all')
  const [designationFilter, setDesignationFilter] = useState('all')
  const [empTypeFilter, setEmpTypeFilter] = useState('all')
  const [sortState, setSortState] = useState<SortState>({ key: 'performance_score', direction: 'desc' })

  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize: 25,
    totalItems: 0
  })
  // Departments tab pagination + expansion state
  const [deptPagination, setDeptPagination] = useState<PaginationState>({ currentPage: 1, pageSize: 10, totalItems: 0 })
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({})
  const [nestedDeptPaging, setNestedDeptPaging] = useState<Record<string, { currentPage: number; pageSize: number }>>({})

  const { payload, loading, error } = useStoredKpiData(endpointId, isOpen, data)
  // CRITICAL: Read from Zustand store (single source of truth for global filters)
  const zustandStore = useDashboardStore()
  const globalFilters = zustandStore.globalFilters
  const endpointOverrides = zustandStore.endpointOverrides || {}
  const { hasLoadedPreset } = useFilterState()

  // Live refresh filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [deptName, setDeptName] = useState('')
  const [empType, setEmpType] = useState('')
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
      console.log('[EmployeePerformanceModal] Modal opened - clearing stale data, will fetch fresh')
      setLivePayload(null)
      setUpdating(false)
    }
  }, [isOpen])

  // Initialize filters from Zustand (single source of truth for dates)
  useEffect(() => {
    if (!isOpen) return

    console.log('[EmployeePerformanceModal] Initializing filters from Zustand')

    // Dates from Zustand (single source of truth)
    const s = globalFilters.startDate || ''
    const e = globalFilters.endDate || ''
    console.log('[EmployeePerformanceModal] Dates from Zustand:', { startDate: s, endDate: e })
    setStartDate(s)
    setEndDate(e)

    // Reset other filters
    setDeptName('')
    setEmpType('')
    setApiPageSize('25')
    setApiPageNumber('1')
    setLoadingPage(false)
    setDisableCache(false)
  }, [isOpen, hasLoadedPreset, globalFilters.startDate, globalFilters.endDate])

  // Auto-refresh on open to fetch page 1 directly from API with current filters
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
  }, [isOpen, startDate, endDate, endpointId, apiPageSize])

  // Fetch data from API with pagination (CLIENT-SIDE API call)
  const fetchDataFromAPI = useCallback(async (pageNum: number) => {
    if (!endpointId) {
      console.error('[MHPL0008 Pagination] No endpoint ID provided')
      toast.error('No endpoint ID provided')
      return
    }

    if (!pageNum || pageNum < 1) {
      console.error('[MHPL0008 Pagination] Invalid page number:', pageNum)
      toast.error('Invalid page number')
      return
    }

    console.log(`[MHPL0008 Pagination] Starting fetch for page ${pageNum}`)
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
        console.error('[MHPL0008 Pagination] No token found in storage')
        toast.error('Authentication required. Please sign in.')
        return
      }

      // Build API payload
      const payload: Record<string, any> = {
        StartDate: startDate,
        EndDate: endDate,
        PageNumber: pageNum
      }

      if (deptName && deptName.trim() !== '') payload.Departments = deptName.trim()
      if (empType && empType.trim() !== '') payload.EmpType = empType.trim()

      const psNum = parseInt(apiPageSize || '25', 10)
      if (Number.isFinite(psNum) && psNum > 0) {
        payload.PageSize = psNum
      }

      console.log(`[MHPL0008 Pagination] API Request:`, {
        endpoint: endpointId,
        pageRequested: pageNum,
        payload: payload
      })

      const result = await callMHPL_API_WithValidation(endpointId, payload, token)
      if ((result as any)?.status !== 'success') {
        const msg = (result as any)?.message || 'MHPL0008 call failed'
        throw new Error(msg)
      }

      console.log(`[MHPL0008 Pagination] API Response received for page ${pageNum}`)

      // Normalize response shape
      const raw = (result as any).data
      const normalized = raw?.data ? raw.data : raw
      setLivePayload(normalized as any)
      setApiPageNumber(String(pageNum))

      console.log(`[MHPL0008 Pagination] ✅ Successfully loaded page ${pageNum}`)
      toast.success(`Page ${pageNum} loaded`)

    } catch (error: any) {
      console.error('[MHPL0008 Pagination] ❌ Error fetching page:', error)
      toast.error(error?.message || `Failed to load page ${pageNum}`)
    } finally {
      setLoadingPage(false)
      console.log(`[MHPL0008 Pagination] Request completed for page ${pageNum}`)
    }
  }, [endpointId, startDate, endDate, deptName, empType, apiPageSize])

  // Use live data if available, otherwise fallback to cached payload
  const dataForDisplay = disableCache ? livePayload : (livePayload || payload)

  const mhpl0008Data = useMemo(() => {
    const effective = dataForDisplay
    if (!effective) return null

    // Handle double-nesting: the API returns { data: { code, data: { actual data } } }
    // useStoredKpiData extracts the first 'data', so we need to check for the second 'data'
    const actualData = effective.data ? effective.data : effective

    // Log for debugging
    console.log('[MHPL0008] Data structure:', {
      hasData: !!actualData,
      hasTotals: !!actualData?.totals,
      hasGroupByEmployee: !!actualData?.groupByEmployee
    })

    return actualData
  }, [dataForDisplay])

  // Build filter option lists from groupByEmployee
  const employeeFilterOptions = useMemo(() => {
    const groups: any[] = Array.isArray(mhpl0008Data?.groupByEmployee) ? mhpl0008Data?.groupByEmployee : []
    const items: any[] = groups.flatMap((g: any) => (Array.isArray(g?.items) ? g.items : []))
    const depts = new Set<string>()
    const designations = new Set<string>()
    const empTypes = new Set<string>()
    for (const e of items) {
      if (e?.department) depts.add(String(e.department))
      if (e?.designation) designations.add(String(e.designation))
      if (e?.employee_type) empTypes.add(String(e.employee_type))
    }
    const sorted = (s: Set<string>) => Array.from(s).filter(Boolean).sort((a, b) => a.localeCompare(b))
    return {
      departments: sorted(depts),
      designations: sorted(designations),
      empTypes: sorted(empTypes)
    }
  }, [mhpl0008Data])

  // Helper available to memoized mappers below
  const safeNumber = (value: any, defaultValue: number = 0): number => {
    const num = Number(value)
    return isNaN(num) || !isFinite(num) ? defaultValue : num
  }

  // Raw departments list from API (flattened)
  const rawDepartments = useMemo(() => {
    try {
      const groups = Array.isArray(mhpl0008Data?.groupByDepartment) ? mhpl0008Data.groupByDepartment : []
      const items = groups.flatMap((g: any) => (Array.isArray(g?.items) ? g.items : []))
      return items as any[]
    } catch { return [] as any[] }
  }, [mhpl0008Data])

  // Department pagination helpers
  const pagedDepartments = useMemo(() => {
    const total = rawDepartments.length
    setDeptPagination(prev => ({ ...prev, totalItems: total }))
    const start = Math.max(0, (deptPagination.currentPage - 1) * deptPagination.pageSize)
    const end = Math.min(total, start + deptPagination.pageSize)
    return rawDepartments.slice(start, end)
  }, [rawDepartments, deptPagination.currentPage, deptPagination.pageSize])

  const toggleDeptExpand = (deptName: string) => {
    setExpandedDepts(prev => ({ ...prev, [deptName]: !prev[deptName] }))
    setNestedDeptPaging(prev => ({ ...prev, [deptName]: prev[deptName] || { currentPage: 1, pageSize: 10 } }))
  }

  const getDeptEmployees = (deptItem: any) => {
    const groups = Array.isArray(deptItem?.employees) ? deptItem.employees : []
    const items = groups.flatMap((eg: any) => (Array.isArray(eg?.items) ? eg.items : []))
    return items as any[]
  }

  const getPagedDeptEmployees = (deptItem: any) => {
    const all = getDeptEmployees(deptItem)
    const key = String(deptItem?.department || '')
    const meta = nestedDeptPaging[key] || { currentPage: 1, pageSize: 10 }
    const start = Math.max(0, (meta.currentPage - 1) * meta.pageSize)
    const end = Math.min(all.length, start + meta.pageSize)
    return { items: all.slice(start, end), total: all.length, meta }
  }

  const setDeptEmployeesPage = (deptName: string, page: number, pageSize?: number) => {
    setNestedDeptPaging(prev => {
      const cur = prev[deptName] || { currentPage: 1, pageSize: 10 }
      return { ...prev, [deptName]: { currentPage: Math.max(1, page), pageSize: pageSize ?? cur.pageSize } }
    })
  }

  // Export helpers
  const exportDepartmentsCsv = () => {
    try {
      const header = ['Department', 'Total Employees', 'Average Present Days']
      const rows = pagedDepartments.map((d: any) => [
        d?.department ?? 'Unknown',
        String(d?.total_employees ?? 0),
        String(d?.average_present_days ?? 0)
      ])
      const csv = [header, ...rows].map(r => r.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `departments-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { toast.error('Failed to export departments') }
  }

  const exportDeptEmployeesCsv = (deptItem: any) => {
    try {
      const { items } = getPagedDeptEmployees(deptItem)
      const header = ['Employee ID','Employee Name','Department','Designation','Employee Type','Working Days','Present Days','Absent Days','Late Count']
      const rows = items.map((e: any) => [
        e?.employee_id ?? 'N/A',
        e?.employee_name ?? 'Unknown',
        e?.department ?? 'Unknown',
        e?.designation ?? 'N/A',
        e?.employee_type ?? 'N/A',
        String(e?.working_days ?? 0),
        String(e?.present_days ?? 0),
        String(e?.absent_days ?? 0),
        String(e?.late_count ?? 0)
      ])
      const csv = [header, ...rows].map(r => r.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dept-${(deptItem?.department || 'employees')}-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { toast.error('Failed to export employees') }
  }

  // Replace the transformedData useMemo with this corrected version:

const transformedData = useMemo((): TransformedData => {
  // Early return with empty structure if no data
  if (!mhpl0008Data) {
    return {
      employees: [],
      monthlyPerformance: [],
      yearlyPerformance: [],
      departmentPerformance: [],
      totals: { 
        totalEmployees: 0, 
        overallAvgPresentDays: 0, 
        overallAvgPerformance: 0, 
        attendancePercentage: 0 
      }
    }
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  
  const safeNumber = (value: any, defaultValue: number = 0): number => {
    const num = Number(value)
    return isNaN(num) || !isFinite(num) ? defaultValue : num
  }

  const calculateAttendancePercentage = (presentDays: number, workingDays: number): number => {
    if (!workingDays || workingDays <= 0) return 0
    return (presentDays / workingDays) * 100
  }

  const getPerformanceCategory = (attendancePercentage: number): string => {
    if (attendancePercentage >= 90) return 'Excellent'
    if (attendancePercentage >= 80) return 'Good'
    if (attendancePercentage >= 70) return 'Average'
    if (attendancePercentage > 0) return 'Below Average'
    return 'Not Rated'
  }

  // ============================================
  // TRANSFORM EMPLOYEES DATA
  // ============================================
  
  const employees: TransformedEmployee[] = (mhpl0008Data?.groupByEmployee || [])
    .flatMap((group: EmployeeGroup) => {
      if (!group?.items || !Array.isArray(group.items)) return []
      
      return group.items.map((employee: Employee): TransformedEmployee => {
        const presentDays = safeNumber(employee?.present_days)
        const workingDays = safeNumber(employee?.working_days)
        const attendancePct = calculateAttendancePercentage(presentDays, workingDays)
        
        return {
          employeeName: employee?.employee_name || 'Unknown',
          employeeId: employee?.employee_id || 'N/A',
          department: employee?.department || 'Unknown',
          designation: employee?.designation || 'N/A',
          employeeType: employee?.employee_type || 'N/A',
          performanceScore: safeNumber(employee?.performance_score),
          presentDays: presentDays,
          totalWorkingDays: workingDays,
          absentDays: safeNumber(employee?.absent_days),
          lateCount: safeNumber(employee?.late_count),
          attendancePercentage: attendancePct,
          averageRating: safeNumber(employee?.performance_score) / 20,
          performanceCategory: getPerformanceCategory(attendancePct)
        }
      })
    })

  // ============================================
  // TRANSFORM MONTHLY PERFORMANCE DATA
  // ============================================
  
  const monthlyPerformance: TransformedMonthly[] = (mhpl0008Data?.groupByMonth || [])
    .flatMap((group: any) => {
      if (!group?.items || !Array.isArray(group.items)) return []
      
      return group.items.map((item: MonthlyPerformance): TransformedMonthly => ({
        month: item?.month || '',
        department: item?.department || '',
        overallAveragePerformance: safeNumber(item?.average_performance_score),
        overallPresentDays: 0,
        overallTotalDays: 0,
        overallAttendancePercentage: 0,
        totalEmployees: safeNumber(item?.total_employees)
      }))
    })

  // ============================================
  // TRANSFORM YEARLY PERFORMANCE DATA
  // ============================================
  
  const yearlyPerformance: { year: string; department: string; averagePerformanceScore: number }[] = 
    (mhpl0008Data?.groupByYear || [])
      .flatMap((group: any) => {
        if (!group?.items || !Array.isArray(group.items)) return []
        
        return group.items.map((item: any) => ({
          year: item?.year || '',
          department: item?.department || '',
          averagePerformanceScore: safeNumber(item?.average_performance_score)
        }))
      })

  // ============================================
  // TRANSFORM DEPARTMENT PERFORMANCE DATA
  // ============================================
  
  const departmentPerformance: TransformedDepartment[] = (mhpl0008Data?.groupByDepartment || [])
    .flatMap((group: any) => {
      if (!group?.items || !Array.isArray(group.items)) return []
      
      return group.items.map((item: DepartmentPerformance): TransformedDepartment => {
        const deptName = item?.department || 'Unknown'
        const totalEmployeesInDept = safeNumber(item?.total_employees)
        const avgPresentDays = safeNumber(item?.average_present_days)
        const avgPerformanceScore = safeNumber(item?.average_performance_score)

        // Get sample working days from nested employees
        const nestedEmployees: any[] = (item?.employees || [])
          .flatMap((empGroup: EmployeeGroup) => empGroup?.items || [])
        
        const sampleWorkingDays = nestedEmployees.length > 0 
          ? safeNumber(nestedEmployees[0]?.working_days) 
          : 0

        // Calculate estimated totals for department
        const estimatedTotalPresentDays = avgPresentDays * totalEmployeesInDept
        const estimatedTotalWorkingDays = sampleWorkingDays * totalEmployeesInDept
        
        // Calculate attendance percentage for department
        const attendancePct = calculateAttendancePercentage(
          avgPresentDays, 
          sampleWorkingDays
        )

        return {
          department: deptName,
          totalEmployees: totalEmployeesInDept,
          presentDays: Math.round(estimatedTotalPresentDays),
          totalWorkingDays: Math.round(estimatedTotalWorkingDays),
          attendancePercentage: attendancePct,
          averagePerformanceScore: avgPerformanceScore,
          averagePresentDays: avgPresentDays
        }
      })
    })

  // ============================================
  // CALCULATE OVERALL TOTALS
  // ============================================
  
  // Get API-provided totals (accounts for ALL employees across all pages)
  const apiTotals = Array.isArray(mhpl0008Data?.totals) && mhpl0008Data.totals.length > 0
    ? mhpl0008Data.totals[0]
    : {}

  // Total employees from API
  const totalEmployees = safeNumber(apiTotals?.total_employees, 0)

  // Aggregate attendance from department performance (has complete data)
  let totalPresentAllDepts = 0
  let totalWorkingAllDepts = 0
  
  departmentPerformance.forEach((dept: TransformedDepartment) => {
    totalPresentAllDepts += safeNumber(dept.presentDays)
    totalWorkingAllDepts += safeNumber(dept.totalWorkingDays)
  })

  // Calculate overall attendance percentage (matches KPI formula used in this modal)
  const overallAttendancePct = calculateAttendancePercentage(
    totalPresentAllDepts,
    totalWorkingAllDepts
  )

  // Calculate average present days per employee
  const overallAvgPresentDays = totalEmployees > 0 
    ? totalPresentAllDepts / totalEmployees 
    : 0

  // Calculate average performance score
  const overallAvgPerformance = safeNumber(
    apiTotals?.overall_average_performance_score, 
    0
  )

  // Build totals object
  const totals: TransformedTotals = {
    totalEmployees: totalEmployees,
    overallAvgPresentDays: overallAvgPresentDays,
    overallAvgPerformance: overallAvgPerformance,
    attendancePercentage: overallAttendancePct
  }

  // ============================================
  // DEBUG LOGGING
  // ============================================
  
  console.log('[MHPL0008] Transformation Complete:', {
    source: 'API Response',
    employees: {
      count: employees.length,
      sample: employees[0]?.employeeName || 'None'
    },
    departments: {
      count: departmentPerformance.length,
      list: departmentPerformance.map(d => d.department).join(', ')
    },
    totals: {
      totalEmployees: totals.totalEmployees,
      attendancePercentage: `${totals.attendancePercentage.toFixed(2)}%`,
      avgPresentDays: totals.overallAvgPresentDays.toFixed(2),
      avgPerformance: totals.overallAvgPerformance.toFixed(2)
    },
    calculation: {
      totalPresentDays: totalPresentAllDepts,
      totalWorkingDays: totalWorkingAllDepts,
      formula: '(totalPresentDays / totalWorkingDays) × 100'
    }
  })

  // ============================================
  // RETURN TRANSFORMED DATA
  // ============================================
  
  return {
    employees,
    monthlyPerformance,
    yearlyPerformance,
    departmentPerformance,
    totals
  }
}, [mhpl0008Data])

  // Extract pagination metadata from API response
  const apiPaginationMeta = useMemo(() => {
    const groups = [
      ...(mhpl0008Data?.groupByEmployee || []),
      ...(mhpl0008Data?.groupByDepartment || []),
      ...(mhpl0008Data?.groupByMonth || []),
      ...(mhpl0008Data?.groupByYear || []),
      ...(mhpl0008Data?.totals || [])
    ]

    for (const group of groups) {
      if (group.page_number || group.PAGE_NUMBER) {
        return {
          pageNumber: group.page_number || group.PAGE_NUMBER || 1,
          pageSize: group.page_size || group.PAGE_SIZE || 25,
          totalPages: group.total_pages || group.TOTAL_PAGES || 1,
          totalRecords: group.total_records || group.TOTAL_RECORDS || 0
        }
      }
    }

    return { pageNumber: 1, pageSize: 25, totalPages: 1, totalRecords: 0 }
  }, [mhpl0008Data])

  const filteredEmployees = useMemo(() => {
    try {
      // Build directly from raw groupByEmployee items and only keep requested fields
      const base: any[] = (mhpl0008Data?.groupByEmployee || [])
        .flatMap((group: EmployeeGroup) => group?.items || [])
        .map((emp: any) => ({
          employee_id: emp?.employee_id || 'N/A',
          employee_name: emp?.employee_name || 'Unknown',
          department: emp?.department || 'Unknown',
          designation: emp?.designation || 'N/A',
          employee_type: emp?.employee_type || 'N/A',
          working_days: safeNumber(emp?.working_days),
          present_days: safeNumber(emp?.present_days),
          absent_days: safeNumber(emp?.absent_days),
          late_count: safeNumber(emp?.late_count),
          performance_score: safeNumber(emp?.performance_score)
        }))

      let filtered = base

      if (searchTerm && searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase().trim()
        filtered = filtered.filter(employee =>
          (employee?.employee_name || '').toLowerCase().includes(searchLower) ||
          (employee?.department || '').toLowerCase().includes(searchLower) ||
          (employee?.employee_id || '').toLowerCase().includes(searchLower)
        )
      }

      if (departmentFilter && departmentFilter !== 'all') {
        filtered = filtered.filter(employee => employee?.department === departmentFilter)
      }
      if (designationFilter && designationFilter !== 'all') {
        filtered = filtered.filter(employee => employee?.designation === designationFilter)
      }
      if (empTypeFilter && empTypeFilter !== 'all') {
        filtered = filtered.filter(employee => employee?.employee_type === empTypeFilter)
      }

      // Ignore performance category filter for raw view

      filtered.sort((a, b) => {
        try {
          const aVal: any = (a as any)?.[sortState.key]
          const bVal: any = (b as any)?.[sortState.key]
          if (aVal == null && bVal == null) return 0
          if (aVal == null) return 1
          if (bVal == null) return -1
          const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
          return sortState.direction === 'asc' ? comparison : -comparison
        } catch (err) {
          return 0
        }
      })

      return filtered
    } catch (err) {
      console.error('Error filtering employees:', err)
      return []
    }
  }, [mhpl0008Data, searchTerm, departmentFilter, designationFilter, empTypeFilter, performanceFilter, sortState])

  const paginatedEmployees = useMemo(() => {
    try {
      const totalItems = filteredEmployees?.length || 0
      setPagination(prev => ({ ...prev, totalItems }))

      if (totalItems === 0) return []

      const startIndex = Math.max(0, (pagination.currentPage - 1) * pagination.pageSize)
      const endIndex = Math.min(totalItems, startIndex + pagination.pageSize)

      return filteredEmployees?.slice(startIndex, endIndex) || []
    } catch (err) {
      return []
    }
  }, [filteredEmployees, pagination.currentPage, pagination.pageSize])

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

  const topPerformersChart = useMemo(() => {
    try {
      return (transformedData?.employees || [])
        .filter(emp => emp && typeof emp.attendancePercentage === 'number')
        .sort((a, b) => (b?.attendancePercentage || 0) - (a?.attendancePercentage || 0))
        .slice(0, 10)
        .map(employee => ({
          name: employee?.employeeName && employee.employeeName.length > 15
            ? `${employee.employeeName.substring(0, 15)}...`
            : employee?.employeeName || 'Unknown',
          performance: employee?.attendancePercentage || 0,
          attendance: employee?.attendancePercentage || 0,
          rating: employee?.averageRating || 0
        }))
    } catch (err) {
      return []
    }
  }, [transformedData?.employees])

  const departmentChartData = useMemo(() => {
    try {
      return (transformedData?.departmentPerformance || [])
        .filter(dept => dept && dept.department)
        .map(dept => ({
          department: dept?.department && dept.department.length > 15
            ? `${dept.department.substring(0, 15)}...`
            : dept?.department || 'Unknown',
          attendance: dept?.attendancePercentage || 0,
          employees: dept?.totalEmployees || 0
        }))
        .sort((a, b) => (b?.attendance || 0) - (a?.attendance || 0))
    } catch (err) {
      return []
    }
  }, [transformedData?.departmentPerformance])

  const performanceCategoriesData = useMemo(() => {
    try {
      const employees = transformedData?.employees || []
      const categorize = (pct: number) => pct >= 90 ? 'Excellent' : pct >= 80 ? 'Good' : pct >= 70 ? 'Average' : 'Below Average'
      const categories = employees.reduce((acc, emp) => {
        const pct = typeof emp?.attendancePercentage === 'number' ? emp.attendancePercentage : 0
        const working = typeof emp?.totalWorkingDays === 'number' ? emp.totalWorkingDays : 0
        const category = working > 0 ? categorize(pct) : 'Not Rated'
        acc[category] = (acc[category] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const colors = {
        'Excellent': '#10B981',
        'Good': '#3B82F6',
        'Average': '#F59E0B',
        'Below Average': '#EF4444',
        'Not Rated': '#6B7280'
      }

      return Object.entries(categories).map(([category, count]) => ({
        category,
        count,
        percentage: employees.length > 0 ? (count / employees.length) * 100 : 0,
        color: colors[category as keyof typeof colors] || '#6B7280'
      }))
    } catch (err) {
      return []
    }
  }, [transformedData?.employees])

  const exportData = () => {
    try {
      const csvData = [
        ['Employee ID','Employee Name','Department','Designation','Employee Type','Working Days','Present Days','Absent Days','Late Count','Performance Score'],
        ...(filteredEmployees || []).map((e: any) => [
          e?.employee_id ?? 'N/A',
          e?.employee_name ?? 'Unknown',
          e?.department ?? 'Unknown',
          e?.designation ?? 'N/A',
          e?.employee_type ?? 'N/A',
          e?.working_days ?? 0,
          e?.present_days ?? 0,
          e?.absent_days ?? 0,
          e?.late_count ?? 0,
          e?.performance_score ?? 0
        ])
      ]

      const csvContent = csvData.map(row => row.join(',')).join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `employee-attendance-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error('Failed to export data')
    }
  }

  if (!isOpen) return null

  const SortIcon = ({ column }: { column: string }) => {
    if (sortState.key !== column) return <ChevronDown className="w-3 h-3 ml-1 opacity-30" />
    return sortState.direction === 'asc' ?
      <ChevronUp className="w-3 h-3 ml-1" /> :
      <ChevronDown className="w-3 h-3 ml-1" />
  }

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-700 border-green-200'
    if (score >= 80) return 'bg-blue-100 text-blue-700 border-blue-200'
    if (score >= 70) return 'bg-amber-100 text-amber-700 border-amber-200'
    return 'bg-red-100 text-red-700 border-red-200'
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
                  <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span className="truncate">Employee Attendance</span>
              </DialogTitle>
              <DialogDescription className="text-white/90 text-xs sm:text-sm">
                Avg Attendance: <span className="font-semibold text-white">{Math.round(transformedData.totals.attendancePercentage)}%</span>
                <span className="mx-2">•</span>
                Avg Present Days: <span className="font-semibold text-white">{Math.round(transformedData.totals.overallAvgPresentDays)}</span>
                <span className="mx-2">•</span>
                Employees: <span className="font-semibold text-white">{transformedData.totals.totalEmployees}</span>
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
          {loadingPage && (
            <div className="pt-4">
              <div className="flex items-center gap-2 text-sm text-blue-600 mb-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading data...</span>
              </div>
              <Progress value={66} />
            </div>
          )}

          {/* Filter Bar for live refresh */}
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
                    <Label className="text-xs">Dept Name (optional)</Label>
                    <Input type="text" placeholder="e.g. MEDICINE" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Emp Type (optional)</Label>
                    <Input type="text" placeholder="e.g. nurse" value={empType} onChange={(e) => setEmpType(e.target.value)} />
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
                      disabled={loadingPage || !startDate || !endDate}
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

          {loading ? (
            <div className="flex items-center justify-center py-16 sm:py-24">
              <div className="text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-sm sm:text-base text-gray-600 font-medium">Loading attendance data...</p>
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
          ) : transformedData.employees.length > 0 ? (
            <div className="space-y-4 sm:space-y-6 py-4 sm:py-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                {/* Enhanced Tabs Navigation */}
                <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 pb-4 -mx-2 px-2">
                  <TabsList className="grid w-full grid-cols-4 gap-1 bg-gray-100/80 p-1 h-auto rounded-xl">
                    
                    <TabsTrigger
                      value="employees"
                      className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all"
                    >
                      <Users className="w-4 h-4" />
                      <span className="hidden sm:inline">Employees</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="departments"
                      className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all"
                    >
                      <Award className="w-4 h-4" />
                      <span className="hidden sm:inline">Departments</span>
                    </TabsTrigger>
                   
                  </TabsList>
                </div>

                {/* Employees Tab */}
                <TabsContent value="employees" className="space-y-4 mt-0">
                  <Card className="border-2">
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 px-4 sm:px-6 py-4 border-b">
                      <div className="flex items-center justify-between mb-3">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                          <Users className="w-5 h-5 text-blue-600" />
                          All Employees ({pagination.totalItems})
                        </CardTitle>
                        <Button onClick={exportData} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                          <Download className="w-4 h-4 mr-2" />
                          Export
                        </Button>
                      </div>
                      {/* Filters */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="lg:col-span-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                              placeholder="Search employees..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-10 bg-white"
                            />
                          </div>
                        </div>
                        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {employeeFilterOptions.departments.map((d) => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {/* <Select value={performanceFilter} onValueChange={setPerformanceFilter}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Attendance" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Levels</SelectItem>
                            <SelectItem value="Excellent">Excellent (≥90%)</SelectItem>
                            <SelectItem value="Good">Good (≥80%)</SelectItem>
                            <SelectItem value="Average">Average (≥70%)</SelectItem>
                            <SelectItem value="Below Average">Below Avg (&lt;70%)</SelectItem>
                          </SelectContent>
                        </Select> */}
                        {/* <Select value={designationFilter} onValueChange={setDesignationFilter}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Designation" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Designations</SelectItem>
                            {employeeFilterOptions.designations.map((d) => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select> */}
                        {/* <Select value={empTypeFilter} onValueChange={setEmpTypeFilter}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Employee Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {employeeFilterOptions.empTypes.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select> */}
                      </div>
                    </div>
                    <CardContent className="p-0">
                      {/* Mobile Card View (raw fields) */}
                      <div className="block lg:hidden divide-y">
                        {paginatedEmployees.map((employee: any, index: number) => (
                          <div key={`${employee.employee_id}-${index}`} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start gap-2 mb-3">
                              <div className="p-2 bg-orange-100 rounded-lg flex-shrink-0">
                                <Users className="w-4 h-4 text-orange-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-gray-900 truncate" title={employee.employee_name}>
                                  {employee.employee_name}
                                </div>
                                <div className="text-xs text-gray-500">ID: {employee.employee_id}</div>
                                <div className="text-xs text-gray-500">{employee.department} • {employee.designation}</div>
                                <div className="text-xs text-gray-500">Type: {employee.employee_type}</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="p-2 bg-blue-50 rounded-lg">
                                <div className="text-gray-600 text-xs mb-1">Working Days</div>
                                <div className="font-bold text-blue-600 text-sm">{employee.working_days}</div>
                              </div>
                              <div className="p-2 bg-green-50 rounded-lg">
                                <div className="text-gray-600 text-xs mb-1">Present Days</div>
                                <div className="font-bold text-green-600 text-sm">{employee.present_days}</div>
                              </div>
                              <div className="p-2 bg-amber-50 rounded-lg">
                                <div className="text-gray-600 text-xs mb-1">Absent Days</div>
                                <div className="font-bold text-amber-600 text-sm">{employee.absent_days}</div>
                              </div>
                              <div className="p-2 bg-purple-50 rounded-lg">
                                <div className="text-gray-600 text-xs mb-1">Late Count</div>
                                <div className="font-bold text-purple-600 text-sm">{employee.late_count}</div>
                              </div>
                              <div className="p-2 bg-cyan-50 rounded-lg col-span-2">
                                <div className="text-gray-600 text-xs mb-1">Performance Score</div>
                                <div className="font-bold text-cyan-700 text-sm">{employee.performance_score}</div>
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
                              <th className="p-4 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('employee_id')}>
                                <div className="flex items-center">Employee ID <SortIcon column="employee_id" /></div>
                              </th>
                              <th className="p-4 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('employee_name')}>
                                <div className="flex items-center">Employee Name <SortIcon column="employee_name" /></div>
                              </th>
                              <th className="p-4 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('department')}>
                                <div className="flex items-center">Department <SortIcon column="department" /></div>
                              </th>
                              <th className="p-4 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('designation')}>
                                <div className="flex items-center">Designation <SortIcon column="designation" /></div>
                              </th>
                              <th className="p-4 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('employee_type')}>
                                <div className="flex items-center">Employee Type <SortIcon column="employee_type" /></div>
                              </th>
                              <th className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('working_days')}>
                                <div className="flex items-center justify-center">Working Days <SortIcon column="working_days" /></div>
                              </th>
                              <th className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('present_days')}>
                                <div className="flex items-center justify-center">Present Days <SortIcon column="present_days" /></div>
                              </th>
                              <th className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('absent_days')}>
                                <div className="flex items-center justify-center">Absent Days <SortIcon column="absent_days" /></div>
                              </th>
                              <th className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('late_count')}>
                                <div className="flex items-center justify-center">Late Count <SortIcon column="late_count" /></div>
                              </th>
                              <th className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('performance_score')}>
                                <div className="flex items-center justify-center">Performance Score <SortIcon column="performance_score" /></div>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {paginatedEmployees.map((employee: any, index: number) => (
                              <tr key={`${employee.employee_id}-${index}`} className="hover:bg-orange-50/50 transition-colors">
                                <td className="p-4 text-gray-700">{employee.employee_id}</td>
                                <td className="p-4 text-gray-900 font-medium">{employee.employee_name}</td>
                                <td className="p-4 text-gray-700">{employee.department}</td>
                                <td className="p-4 text-gray-700">{employee.designation}</td>
                                <td className="p-4 text-gray-700">{employee.employee_type}</td>
                                <td className="p-4 text-center text-gray-700">{employee.working_days}</td>
                                <td className="p-4 text-center text-gray-700">{employee.present_days}</td>
                                <td className="p-4 text-center text-gray-700">{employee.absent_days}</td>
                                <td className="p-4 text-center text-gray-700">{employee.late_count}</td>
                                <td className="p-4 text-center text-gray-700">{employee.performance_score}</td>
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
                                ({apiPaginationMeta.totalRecords} total employees)
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

{/* Departments Tab */}
<TabsContent value="departments" className="space-y-4 sm:space-y-6 mt-0">
  <Card className="border-2">
    <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b bg-gradient-to-br from-emerald-50 to-green-50">
      <CardTitle className="text-base sm:text-lg">Departments</CardTitle>
      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={exportDepartmentsCsv}>Export</Button>
    </div>
    <CardContent className="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b-2 border-gray-200">
            <tr>
              <th className="p-3 text-left font-semibold text-gray-700">Department</th>
              <th className="p-3 text-center font-semibold text-gray-700">Total Employees</th>
              <th className="p-3 text-center font-semibold text-gray-700">Average Present Days</th>
              <th className="p-3 text-right font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pagedDepartments.map((dept: any, idx: number) => {
              const key = String(dept?.department || `dept-${idx}`)
              const expanded = !!expandedDepts[key]
              const { items: empItems, total: empTotal, meta } = getPagedDeptEmployees(dept)
              const empTotalPages = Math.max(1, Math.ceil(empTotal / (meta.pageSize || 10)))
              return (
                <React.Fragment key={key}>
                  <tr className="hover:bg-emerald-50/40 transition-colors">
                    <td className="p-3 text-gray-900 font-medium">{dept?.department || 'Unknown'}</td>
                    <td className="p-3 text-center text-gray-700">{dept?.total_employees ?? 0}</td>
                    <td className="p-3 text-center text-gray-700">{dept?.average_present_days ?? 0}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => toggleDeptExpand(key)}>
                          {expanded ? 'Hide Employees' : 'View Employees'}
                        </Button>
                        {expanded && (
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => exportDeptEmployeesCsv(dept)}>
                            <Download className="w-4 h-4 mr-2" /> Export
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={4} className="p-0">
                        <div className="px-3 sm:px-4 py-3 bg-white border-t">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-semibold text-gray-700">Employees in {dept?.department}</div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-gray-500">Page</span>
                              <div className="inline-flex rounded-md shadow-sm border overflow-hidden">
                                <button aria-label='Previous Page' className="px-2 py-1 hover:bg-gray-100" onClick={() => setDeptEmployeesPage(key, Math.max(1, meta.currentPage - 1))}><ChevronLeft className="w-4 h-4" /></button>
                                <span className="px-2 py-1 bg-gray-50 border-x">{meta.currentPage} / {empTotalPages}</span>
                                <button aria-label='Next Page' className="px-2 py-1 hover:bg-gray-100" onClick={() => setDeptEmployeesPage(key, Math.min(empTotalPages, meta.currentPage + 1))}><ChevronRight className="w-4 h-4" /></button>
                              </div>
                              <span className="ml-2 text-gray-500">Rows</span>
                              <Select value={String(meta.pageSize || 10)} onValueChange={(v) => setDeptEmployeesPage(key, 1, parseInt(v, 10))}>
                                <SelectTrigger className="h-7 w-[80px] text-xs bg-white"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="5">5</SelectItem>
                                  <SelectItem value="10">10</SelectItem>
                                  <SelectItem value="20">20</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs sm:text-sm">
                              <thead className="bg-gray-50 border-b">
                                <tr>
                                  <th className="p-2 text-left font-semibold text-gray-700">Employee ID</th>
                                  <th className="p-2 text-left font-semibold text-gray-700">Name</th>
                                  <th className="p-2 text-left font-semibold text-gray-700">Department</th>
                                  <th className="p-2 text-left font-semibold text-gray-700">Designation</th>
                                  <th className="p-2 text-left font-semibold text-gray-700">Type</th>
                                  <th className="p-2 text-center font-semibold text-gray-700">Working</th>
                                  <th className="p-2 text-center font-semibold text-gray-700">Present</th>
                                  <th className="p-2 text-center font-semibold text-gray-700">Absent</th>
                                  <th className="p-2 text-center font-semibold text-gray-700">Late</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {empItems.map((e: any, i: number) => (
                                  <tr key={`${e?.employee_id || i}-${idx}`} className="hover:bg-gray-50">
                                    <td className="p-2 text-gray-700">{e?.employee_id}</td>
                                    <td className="p-2 text-gray-900 font-medium">{e?.employee_name}</td>
                                    <td className="p-2 text-gray-700">{e?.department}</td>
                                    <td className="p-2 text-gray-700">{e?.designation}</td>
                                    <td className="p-2 text-gray-700">{e?.employee_type}</td>
                                    <td className="p-2 text-center text-gray-700">{e?.working_days}</td>
                                    <td className="p-2 text-center text-gray-700">{e?.present_days}</td>
                                    <td className="p-2 text-center text-gray-700">{e?.absent_days}</td>
                                    <td className="p-2 text-center text-gray-700">{e?.late_count}</td>
                                  </tr>
                                ))}
                                {empItems.length === 0 && (
                                  <tr><td colSpan={9} className="p-3 text-center text-gray-500">No employees found</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
            {pagedDepartments.length === 0 && (
              <tr><td colSpan={4} className="p-4 text-center text-gray-500">No departments found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Departments pagination */}
      <div className="flex items-center justify-between gap-2 p-3 border-t text-xs sm:text-sm">
        <div className="text-gray-600">Page {deptPagination.currentPage} of {Math.max(1, Math.ceil((deptPagination.totalItems || 0) / (deptPagination.pageSize || 10)))}</div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md shadow-sm border overflow-hidden">
            <button aria-label='Previous Page' className="px-2 py-1 hover:bg-gray-100" onClick={() => setDeptPagination(p => ({ ...p, currentPage: Math.max(1, p.currentPage - 1) }))}><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-3 py-1 bg-gray-50 border-x">{deptPagination.currentPage}</span>
            <button aria-label='Next Page' className="px-2 py-1 hover:bg-gray-100" onClick={() => setDeptPagination(p => ({ ...p, currentPage: Math.min(Math.max(1, Math.ceil((p.totalItems || 0) / (p.pageSize || 10))), p.currentPage + 1) }))}><ChevronRight className="w-4 h-4" /></button>
          </div>
          <span className="text-gray-500">Rows</span>
          <Select value={String(deptPagination.pageSize)} onValueChange={(v) => setDeptPagination(p => ({ ...p, pageSize: parseInt(v, 10) || 10, currentPage: 1 }))}>
            <SelectTrigger className="h-7 w-[80px] text-xs bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </CardContent>
  </Card>
</TabsContent>

               
                
              </Tabs>
            </div>
          ) : (
            <Card className="mt-6">
              <CardContent className="p-12 text-center">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No employee attendance data available</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}



