'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { TrendingUp, TrendingDown, Calendar, DollarSign, BarChart3, PieChart, Activity, Users, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, Filter, Download, X, Loader2, Eye } from 'lucide-react'
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
import { TokenStorage } from '@/lib/tokenStorage'
import { callMHPL_API_WithValidation } from '@/lib/api/mhplApi'
import { useFilterState } from '@/components/filters/FilterStateProvider'
import { useDashboardStore } from '@/lib/store/dashboard-store'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { getThemeForEndpoint } from '@/lib/constants/drillDownThemes'
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

interface SpendingAnalysisModalProps {
  isOpen: boolean
  onClose: () => void
  data?: any
  endpointId: string
  currentValue: string | number
}

interface MHPL0004Patient {
  PATIENT_ID: number
  PATIENT_NAME: string
  LAST_VISIT_DATE: string
  TOTAL_SPENT: number
}

interface MHPL0004PatientsList {
  PAGE_NUMBER: number
  PAGE_SIZE: number
  TOTAL_RECORDS: number
  TOTAL_PAGES: number
  PATIENTS: MHPL0004Patient[]
}

interface MHPL0004SpendingCategory {
  SPENDING_CATEGORY: string
  PATIENT_COUNT: number
  TOTAL_BILLED_AMOUNT: number
  AVERAGE_SPENT: number
  PATIENTS_LIST: MHPL0004PatientsList[]
}

interface MHPL0004Response {
  groupBySpendingCategory: MHPL0004SpendingCategory[]
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

interface TransformedCategory {
  category: string
  patientCount: number
  totalAmount: number
  averageSpent: number
  patients: any[]
}

interface TransformedPatient {
  patientId: number
  patientName: string
  totalSpending: number
  lastVisit: string
  spendingCategory: string
  category: 'High' | 'Medium' | 'Low'
}

interface SpendingByCategoryItem {
  category: string
  amount: number
  percentage: number
  color: string
}

export function SpendingAnalysisModal({
  isOpen,
  onClose,
  data: propData,
  endpointId,
  currentValue
}: SpendingAnalysisModalProps) {
  const theme = getThemeForEndpoint(endpointId)
  const [activeTab, setActiveTab] = useState('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [divisionFilter, setDivisionFilter] = useState('all')
  const [serviceFilter, setServiceFilter] = useState('all')
  const [sortState, setSortState] = useState<SortState>({ key: 'totalSpending', direction: 'desc' })

  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize: 25,
    totalItems: 0
  })

  const [loading, setLoading] = useState(false)
  const [mhpl0004Data, setMhpl0004Data] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  // CRITICAL: Read from Zustand store (single source of truth for global filters)
  const zustandStore = useDashboardStore()
  const globalFilters = zustandStore.globalFilters
  const endpointOverrides = zustandStore.endpointOverrides || {}
  const { hasLoadedPreset } = useFilterState()

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [patientCategory, setPatientCategory] = useState<'IPD' | 'OPD' | 'EMR'>('OPD')
  const [spendCat, setSpendCat] = useState('')
  const [apiPageSize, setApiPageSize] = useState('10')
  const [updating, setUpdating] = useState(false)
  const [totalsPageLoading, setTotalsPageLoading] = useState(false)
  const [totalsPageInput, setTotalsPageInput] = useState('')
  const [hasAutoUpdated, setHasAutoUpdated] = useState(false)

  // Category patient list viewing
  const [viewingCategoryPatients, setViewingCategoryPatients] = useState<string | null>(null)
  const [categoryPatientPage, setCategoryPatientPage] = useState(1)
  const [categoryPatientLoading, setCategoryPatientLoading] = useState(false)

  // CRITICAL: Always use fresh API data - clear stale data on open
  useEffect(() => {
    if (isOpen) {
      console.log('[SpendingAnalysis] Modal opened - clearing stale data, will fetch fresh')
      setMhpl0004Data(null)
      setLoading(true)
      setError(null)
    }
  }, [isOpen])

  // Initialize filters when opened - Use Zustand dates and endpointOverrides
  useEffect(() => {
    if (!isOpen) return

    console.log('[SpendingAnalysis] Initializing filters from Zustand and endpointOverrides')

    // Dates from Zustand (single source of truth)
    const s = globalFilters.startDate || ''
    const e = globalFilters.endDate || ''
    console.log('[SpendingAnalysis] Dates from Zustand:', { startDate: s, endDate: e })
    setStartDate(s)
    setEndDate(e)

    // Patient category from endpointOverrides (KPI local filter)
    const kpiPatCat = endpointOverrides[endpointId]?.PatCat
    if (kpiPatCat) {
      console.log('[SpendingAnalysis] Patient category from endpointOverrides:', kpiPatCat)
      const normalized = String(kpiPatCat).toUpperCase()
      if (normalized.includes('IPD')) setPatientCategory('IPD')
      else if (normalized.includes('OPD')) setPatientCategory('OPD')
      else if (normalized.includes('EMR')) setPatientCategory('EMR')
      else setPatientCategory('OPD')
    } else {
      console.log('[SpendingAnalysis] No endpointOverride for PatCat, using default OPD')
      setPatientCategory('OPD')
    }

    // Spending category - use default empty
    setSpendCat('')
    setUpdating(false)
    setHasAutoUpdated(false)
  }, [isOpen, hasLoadedPreset, globalFilters.startDate, globalFilters.endDate, endpointId, endpointOverrides])

  // Auto-update on mount with default filters
  useEffect(() => {
    if (isOpen && !hasAutoUpdated && startDate && endDate) {
      setHasAutoUpdated(true)
      handleUpdate()
    }
  }, [isOpen, startDate, endDate, hasAutoUpdated])

  const handleUpdate = async () => {
    if (!startDate || !endDate) {
      toast.error('Start and End dates are required')
      return
    }
    
    try {
      setUpdating(true)
      const token = TokenStorage.getValidToken() || undefined

      const includePaging = apiPageSize !== '0'
      const requestParams: Record<string, any> = {
        StartDate: startDate,
        EndDate: endDate,
        PatCat: patientCategory,
      }
      if (spendCat) requestParams.SpendCat = spendCat
      if (includePaging) {
        requestParams.PageNumber = '1'
        requestParams.PageSize = apiPageSize || '10'
      }

      const response = await callMHPL_API_WithValidation('mhpl0004', requestParams, token)
      if (response.status !== 'success') {
        throw new Error((response as any).message || 'MHPL0004 call failed')
      }

      const raw = (response as any).data
      const normalized = raw?.data ? raw.data : raw
      setMhpl0004Data(normalized as any)
      setLoading(false)
      setTotalsPageInput('')
      toast.success('Spending data refreshed')
    } catch (err: any) {
      console.error('[MHPL0004] Update failed:', err)
      setError(err?.message || 'Failed to refresh data')
      setLoading(false)
      toast.error(err?.message || 'Failed to refresh data')
    } finally {
      setUpdating(false)
    }
  }

  const transformedData = useMemo<{
    categories: TransformedCategory[]
    allPatients: TransformedPatient[]
    spendingByCategory: SpendingByCategoryItem[]
    totals: any
    monthlyData: any[]
    yearlyData: any[]
  }>(() => {
    if (!mhpl0004Data) return {
      categories: [],
      allPatients: [],
      spendingByCategory: [],
      totals: null,
      monthlyData: [],
      yearlyData: []
    }

    const totals = mhpl0004Data.totals?.[0] || null

    const categories: TransformedCategory[] = (mhpl0004Data.groupBySpendingCategory || []).map((category: any) => ({
      category: category.SPENDING_CATEGORY,
      patientCount: category.PATIENT_COUNT,
      totalAmount: category.TOTAL_BILLED_AMOUNT,
      averageSpent: category.AVERAGE_SPENT,
      patients: category.PATIENTS_LIST?.flatMap((list: any) => list.PATIENTS) || []
    }))

    const allPatients: TransformedPatient[] = (mhpl0004Data.groupBySpendingCategory || []).flatMap((category: any) =>
      (category.PATIENTS_LIST || []).flatMap((list: any) =>
        (list.PATIENTS || []).map((patient: any) => ({
          patientId: patient.PATIENT_ID,
          patientName: patient.PATIENT_NAME || '',
          totalSpending: patient.TOTAL_SPENT,
          lastVisit: patient.LAST_VISIT_DATE,
          spendingCategory: category.SPENDING_CATEGORY,
          category: patient.TOTAL_SPENT > 50000 ? 'High' :
                   patient.TOTAL_SPENT > 10000 ? 'Medium' : 'Low'
        }))
      )
    )

    // Use shorter labels for pie chart
    const spendingByCategory: SpendingByCategoryItem[] = (mhpl0004Data.groupBySpendingCategory || []).map((cat: any, index: number) => {
      const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4']
      // Shorten category names for display
      let shortName = cat.SPENDING_CATEGORY
      if (shortName.includes('Low')) shortName = 'Low (<10K)'
      else if (shortName.includes('Medium')) shortName = 'Medium (10K-50K)'
      else if (shortName.includes('High') && !shortName.includes('VIP')) shortName = 'High (50K-200K)'
      else if (shortName.includes('VIP')) shortName = 'VIP (>200K)'
      
      return {
        category: shortName,
        fullCategory: cat.SPENDING_CATEGORY,
        amount: cat.TOTAL_BILLED_AMOUNT,
        percentage: 0,
        color: colors[index % colors.length]
      }
    })

    const totalAllCategories = spendingByCategory.reduce((sum: number, cat: any) => sum + cat.amount, 0)
    spendingByCategory.forEach((cat: any) => {
      cat.percentage = totalAllCategories > 0 ? (cat.amount / totalAllCategories) * 100 : 0
    })

    const monthlyData = mhpl0004Data.groupByMonth || []
    const yearlyData = mhpl0004Data.groupByYear || []

    return { categories, allPatients, spendingByCategory, totals, monthlyData, yearlyData }
  }, [mhpl0004Data])

  // Fix: Highest patient spend should be from totals.PATIENTS_LIST or calculate correctly
  const highestPatientSpend = useMemo(() => {
    const totalsPatients = mhpl0004Data?.totals?.[0]?.PATIENTS_LIST?.[0]?.PATIENTS || []
    if (totalsPatients.length > 0) {
      return Math.max(...totalsPatients.map((p: any) => p.TOTAL_SPENT || 0))
    }
    // Fallback to allPatients
    if (transformedData.allPatients.length > 0) {
      return Math.max(...transformedData.allPatients.map(p => p.totalSpending))
    }
    return 0
  }, [mhpl0004Data, transformedData.allPatients])

  // Fix: Patient distribution calculation - use actual totals and better category matching
const patientDistribution = useMemo(() => {
  // First, try to get the total count from the API totals
  const totalFromAPI = mhpl0004Data?.totals?.[0]?.PATIENTS_LIST?.[0]?.TOTAL_RECORDS 
    || mhpl0004Data?.totals?.[0]?.TOTAL_PATIENTS 
    || 0

  // Then calculate from categories with more precise matching
  const getCategoryCount = (searchTerms: string[]) => {
    const category = transformedData.categories.find(c => 
      searchTerms.some(term => {
        const cat = c.category.toUpperCase()
        return cat.includes(term.toUpperCase())
      })
    )
    return category?.patientCount || 0
  }

  const vipCount = getCategoryCount(['VIP', '>200K', 'ABOVE 200K'])
  const highCount = getCategoryCount(['HIGH SPENDER', '50K-200K', '50000-200000'])
  const mediumCount = getCategoryCount(['MEDIUM SPENDER', '10K-50K', '10000-50000'])
  const lowCount = getCategoryCount(['LOW SPENDER', '<10K', 'BELOW 10K'])

  // Calculate sum for verification
  const calculatedTotal = vipCount + highCount + mediumCount + lowCount

  return { 
    high: highCount, 
    medium: mediumCount, 
    low: lowCount, 
    vip: vipCount,
    total: totalFromAPI || calculatedTotal
  }
}, [transformedData.categories, mhpl0004Data])

  const filteredCategories = useMemo<TransformedCategory[]>(() => {
    let filtered: TransformedCategory[] = [...transformedData.categories]

    if (searchTerm) {
      filtered = filtered.filter(cat =>
        cat.category.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    filtered.sort((a: TransformedCategory, b: TransformedCategory) => {
      const aVal = (a as any)[sortState.key]
      const bVal = (b as any)[sortState.key]
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortState.direction === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [transformedData.categories, searchTerm, sortState])

  const filteredPatients = useMemo<TransformedPatient[]>(() => {
    let filtered: TransformedPatient[] = [...transformedData.allPatients]

    if (searchTerm) {
      const q = searchTerm.toLowerCase().trim()
      filtered = filtered.filter(patient =>
        (patient.patientName || '').toLowerCase().includes(q) ||
        (patient.spendingCategory || '').toLowerCase().includes(q)
      )
    }

    if (serviceFilter !== 'all') {
      filtered = filtered.filter(patient => patient.spendingCategory === serviceFilter)
    }

    filtered.sort((a: TransformedPatient, b: TransformedPatient) => {
      const aVal = (a as any)[sortState.key]
      const bVal = (b as any)[sortState.key]
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortState.direction === 'asc' ? comparison : -comparison
    })

    setPagination(prev => ({ ...prev, totalItems: filtered.length }))
    return filtered
  }, [transformedData.allPatients, searchTerm, serviceFilter, sortState])

  useEffect(() => {
    setPagination(prev => ({ ...prev, currentPage: 1 }))
  }, [searchTerm, serviceFilter])

  const paginatedPatients = useMemo(() => {
    const startIndex = (pagination.currentPage - 1) * pagination.pageSize
    return filteredPatients.slice(startIndex, startIndex + pagination.pageSize)
  }, [filteredPatients, pagination])

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

 

  const SortIcon = ({ column }: { column: string }) => {
    if (sortState.key !== column) return <BarChart3 className="w-3 h-3 ml-1 opacity-30" />
    return sortState.direction === 'asc' ?
      <ChevronUp className="w-3 h-3 ml-1" /> :
      <ChevronDown className="w-3 h-3 ml-1" />
  }

  const formatCurrency = (value: number) => `৳${value.toLocaleString()}`

  // EXPORT FUNCTION - NEW
  const exportPatientsToCSV = () => {
    let dataToExport: any[] = []
    let filename = 'patients_export.csv'

    // Determine which data to export based on current view
    if (patientsTotalsMeta && !viewingCategoryPatients && serviceFilter === 'all' && !searchTerm) {
      // Export from totals pagination
      dataToExport = (patientsTotalsMeta.PATIENTS || [])
        .filter((p: any) => (p.PATIENT_NAME || '').toLowerCase().includes(searchTerm.toLowerCase()))
        .map((p: any) => ({
          name: p.PATIENT_NAME || 'N/A',
          lastVisit: p.LAST_VISIT_DATE || '-',
          spending: p.TOTAL_SPENT || 0
        }))
      filename = `all_patients_page_${patientsTotalsMeta.PAGE_NUMBER}_export.csv`
    } else if (viewingCategoryPatients) {
      // Export from category view
      const categoryData = transformedData.categories.find(c => c.category === viewingCategoryPatients)
      const patientsList = categoryData?.patients || []
      dataToExport = patientsList
        .filter((p: any) => (p.PATIENT_NAME || '').toLowerCase().includes(searchTerm.toLowerCase()))
        .map((p: any) => ({
          name: p.PATIENT_NAME || 'N/A',
          lastVisit: p.LAST_VISIT_DATE || '-',
          spending: p.TOTAL_SPENT || 0
        }))
      filename = `${viewingCategoryPatients.replace(/\s+/g, '_')}_patients_export.csv`
    } else {
      // Export from filtered patients
      dataToExport = filteredPatients.map(p => ({
        name: p.patientName,
        lastVisit: p.lastVisit,
        spending: p.totalSpending
      }))
      filename = 'filtered_patients_export.csv'
    }

    if (dataToExport.length === 0) {
      toast.error('No patients to export')
      return
    }

    // Create CSV content
    const headers = ['Patient Name', 'Last Visit', 'Total Spending (৳)']
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(row => 
        `"${row.name}","${row.lastVisit}",${row.spending}`
      )
    ].join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast.success(`Exported ${dataToExport.length} patients`)
  }

  const patientsTotalsMeta = useMemo(() => {
    try {
      return mhpl0004Data?.totals?.[0]?.PATIENTS_LIST?.[0] || null
    } catch {
      return null
    }
  }, [mhpl0004Data])

  const fetchTotalsPage = async (targetPage: number) => {
    if (!startDate || !endDate) {
      toast.error('Start and End dates are required')
      return
    }
    const pageSize = Number(patientsTotalsMeta?.PAGE_SIZE || apiPageSize || '10')
    setTotalsPageLoading(true)
    try {
      const token = TokenStorage.getValidToken() || undefined
      const payload: Record<string, any> = {
        StartDate: startDate,
        EndDate: endDate,
        PatCat: patientCategory,
        PageNumber: String(targetPage)
      }
      if (Number.isFinite(pageSize) && pageSize > 0) {
        payload.PageSize = String(pageSize)
      }

      const response = await callMHPL_API_WithValidation('mhpl0004', payload, token)
      if (response.status !== 'success') {
        throw new Error((response as any).message || 'MHPL0004 page fetch failed')
      }

      const raw = (response as any).data
      const normalized = raw?.data ? raw.data : raw

      const newMeta = normalized?.totals?.[0]?.PATIENTS_LIST?.[0]
      if (!newMeta || !Array.isArray(newMeta.PATIENTS)) {
        toast.error('No patients returned for requested page')
        return
      }

      setMhpl0004Data((prev: any) => {
        const prevUnwrapped = prev || {}
        const prevTotals = prevUnwrapped?.totals || []
        const updatedTotals = prevTotals.length > 0
          ? [{ ...prevTotals[0], PATIENTS_LIST: [newMeta] }]
          : [{ PATIENTS_LIST: [newMeta] }]
        return { ...prevUnwrapped, totals: updatedTotals }
      })

      setTotalsPageInput(String(targetPage))
    } catch (err: any) {
      console.error('[MHPL0004] Totals page fetch error:', err)
      toast.error(err?.message || 'Failed to load page')
    } finally {
      setTotalsPageLoading(false)
    }
  }

  const fetchCategoryPatientPage = async (categoryName: string, targetPage: number) => {
    if (!startDate || !endDate || !categoryName) {
      toast.error('Start date, end date, and category are required')
      return
    }

    if (targetPage < 1) {
      console.error('[MHPL0004] Invalid page number:', targetPage)
      toast.error('Invalid page number')
      return
    }
    
    setCategoryPatientLoading(true)
    try {
      const token = TokenStorage.getValidToken() || undefined
      
      // Determine SpendCat from category name
      let spendCatValue = ''
      if (categoryName.toLowerCase().includes('vip')) {
        spendCatValue = 'VIP'
      } else if (categoryName.toLowerCase().includes('high') && !categoryName.toLowerCase().includes('vip')) {
        spendCatValue = 'HIGH'
      } else if (categoryName.toLowerCase().includes('medium')) {
        spendCatValue = 'MEDIUM'
      } else if (categoryName.toLowerCase().includes('low')) {
        spendCatValue = 'LOW'
      }

      if (!spendCatValue) {
        toast.error('Unable to determine spending category')
        setCategoryPatientLoading(false)
        return
      }

      const payload: Record<string, any> = {
        StartDate: startDate,
        EndDate: endDate,
        PatCat: patientCategory,
        SpendCat: spendCatValue,
        PageNumber: String(targetPage),
        PageSize: '10'
      }

      console.log('[MHPL0004] Fetching category patients with payload:', payload)

      const response = await callMHPL_API_WithValidation('mhpl0004', payload, token)
      console.log('[MHPL0004] API Response status:', response?.status)
      
      if (response.status !== 'success') {
        throw new Error((response as any).message || 'Failed to fetch category patients')
      }

      const raw = (response as any).data
      const normalized = raw?.data ? raw.data : raw

      const categoryData = normalized?.groupBySpendingCategory?.find(
        (cat: any) => cat.SPENDING_CATEGORY === categoryName
      )

      if (categoryData?.PATIENTS_LIST?.[0]) {
        setMhpl0004Data((prev: any) => {
          const newCategories = (prev?.groupBySpendingCategory || []).map((cat: any) => {
            if (cat.SPENDING_CATEGORY === categoryName) {
              return { ...cat, PATIENTS_LIST: [categoryData.PATIENTS_LIST[0]] }
            }
            return cat
          })
          return { ...prev, groupBySpendingCategory: newCategories }
        })
        setCategoryPatientPage(targetPage)
        toast.success(`Loaded page ${targetPage}`)
      } else {
        toast.error('No patient data returned')
      }
    } catch (err: any) {
      console.error('[MHPL0004] Category patient fetch error:', err)
      console.error('[MHPL0004] Error details:', { categoryName, targetPage, startDate, endDate, patientCategory })
      toast.error(err?.message || 'Failed to load patients')
    } finally {
      setCategoryPatientLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-6xl lg:max-w-7xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className={cn("sticky top-0 z-10 bg-gradient-to-r text-white px-4 sm:px-6 py-4 sm:py-5 shadow-lg", theme.gradient)}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl lg:text-2xl font-bold mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span className="truncate">Patient Spending Analysis</span>
              </DialogTitle>
              <DialogDescription className="text-white/90 text-xs sm:text-sm">
                • Total Expenditure: <span className="font-semibold text-white">{formatCurrency(Number(currentValue))}</span>
                {!loading && transformedData.allPatients.length > 0 && (
                  <span className="ml-0 sm:ml-4 block sm:inline mt-1 sm:mt-0">• {transformedData.allPatients.length} Patients Analyzed</span>
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

        {/* Loading Screen */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Spending Analysis...</h3>
            <p className="text-sm text-gray-500 text-center">
              Fetching fresh data from API with current filter values
            </p>
            <div className="mt-4 w-full max-w-xs">
              <Progress value={66} className="h-2" />
            </div>
          </div>
        )}

        {!loading && (
        <div className="flex-1 overflow-auto">
          {updating && (
            <div className="px-4 pt-4">
              <Progress value={66} />
            </div>
          )}

          <div className="px-4 pt-4">
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
                    <Label className="text-xs">Patient Category</Label>
                    <Select value={patientCategory} onValueChange={(v) => setPatientCategory(v as any)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IPD">IPD</SelectItem>
                        <SelectItem value="OPD">OPD</SelectItem>
                        <SelectItem value="EMR">EMR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-xs">Spend Category</Label>
                    <Select value={spendCat || 'all'} onValueChange={(v) => setSpendCat(v === 'all' ? '' : v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="HIGH">HIGH</SelectItem>
                        <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                        <SelectItem value="LOW">LOW</SelectItem>
                        <SelectItem value="VIP">VIP</SelectItem>
                      </SelectContent>
                    </Select>
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
                      onClick={handleUpdate}
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

          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading spending analysis data...</p>
              </div>
            </div>
          ) : error ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-red-600 mb-2">Failed to load spending data</p>
                <p className="text-gray-500 text-sm mb-4">{error}</p>
                <Button onClick={() => window.location.reload()}>Retry</Button>
              </CardContent>
            </Card>
          ) : transformedData.categories.length > 0 ? (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview" className="flex items-center gap-2">
                    <PieChart className="w-4 h-4" />
                    Overview
                  </TabsTrigger>
                  
                  <TabsTrigger value="patients" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Patients
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 sm:space-y-6 mt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <Card className="overflow-hidden border-2 hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <PieChart className="w-5 h-5 text-purple-600" />
                         Patient Spending Statistics Overview
                        </CardTitle>
                        <p className="text-sm text-gray-600">Spending breakdown across different Patient Categories</p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4 sm:space-y-6">
                        <div className="text-center py-4 bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl text-white shadow-lg">
                          <div className="text-4xl sm:text-5xl font-bold mb-1">
                            {formatCurrency(transformedData.totals?.TOTAL_BILLED_AMOUNT || 0)}
                          </div>
                          <div className="text-sm sm:text-base opacity-90">Total Expenditure</div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                            <div className="text-3xl sm:text-4xl font-bold text-green-600 mb-1">
                              {(transformedData.totals?.PATIENTS_LIST?.[0]?.TOTAL_RECORDS || transformedData.totals?.TOTAL_PATIENTS || 0).toLocaleString()}
                            </div>
                            <div className="text-xs sm:text-sm text-green-700 font-medium">Total Patients</div>
                          </div>
                          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200">
                            <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-1">
                              {formatCurrency(Math.round(transformedData.totals?.AVERAGE_SPENT || 0))}
                            </div>
                            <div className="text-xs sm:text-sm text-blue-700 font-medium">Avg Per Patient</div>
                          </div>
                        </div>
                        <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl border-2 border-orange-200">
                          <div className="text-3xl sm:text-4xl font-bold text-orange-600 mb-1">
                            {transformedData.categories.length}
                          </div>
                          <div className="text-xs sm:text-sm text-orange-700 font-medium">Spending Categories</div>
                        </div>
                      </div>
                      </CardContent>
                    </Card>

                    <Card className="overflow-hidden border-2 hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <TrendingUp className="w-5 h-5 text-blue-600" />
                          Patient Spending Categories Overview
                        </CardTitle>
                        <p className="text-sm text-gray-600">Analysis across spending categories and patient groups</p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {transformedData.categories.slice(0, 5).map((category: TransformedCategory, index: number) => (
                            <div key={category.category} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${
                                  index === 0 ? 'bg-purple-500' :
                                  index === 1 ? 'bg-blue-500' :
                                  index === 2 ? 'bg-green-500' :
                                  index === 3 ? 'bg-orange-500' : 'bg-gray-500'
                                }`}></div>
                                <div>
                                  <div className="font-medium text-gray-900">{category.category}</div>
                                  <div className="text-sm text-gray-600">{category.patientCount} patients</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-gray-900">{formatCurrency(category.totalAmount)}</div>
                                <div className="text-sm text-gray-600">Avg: {formatCurrency(category.averageSpent)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                
                <TabsContent value="patients" className="space-y-6 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        {viewingCategoryPatients ? `${viewingCategoryPatients} - Patient List` : 'All Patients'}
                      </CardTitle>
                      <div className="flex items-center justify-between gap-4 mt-2 flex-wrap">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Search className="w-4 h-4 text-gray-400" />
                            <Input
                              placeholder="Search patients..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="w-64"
                            />
                          </div>
                          <Select value={serviceFilter} onValueChange={setServiceFilter}>
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Filter by category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Categories</SelectItem>
                              {transformedData.categories.map((cat: TransformedCategory) => (
                                <SelectItem key={cat.category} value={cat.category}>{cat.category}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {viewingCategoryPatients && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setViewingCategoryPatients(null)
                                setCategoryPatientPage(1)
                              }}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Clear Filter
                            </Button>
                          )}

                          {/* EXPORT BUTTON - NEW */}
                        <Button
                          onClick={exportPatientsToCSV}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Export CSV
                        </Button>
                        
                        </div>
                        
                        
                      </div>
                    </CardHeader>
                    <CardContent>
                      {patientsTotalsMeta && !viewingCategoryPatients && serviceFilter === 'all' && !searchTerm ? (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="p-3 text-left font-medium">Patient Name</th>
                                  <th className="p-3 text-center font-medium">Last Visit</th>
                                  <th className="p-3 text-center font-medium">Total Spending</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(patientsTotalsMeta.PATIENTS || [])
                                  .filter((p: any) => (p.PATIENT_NAME || '').toLowerCase().includes(searchTerm.toLowerCase()))
                                  .map((patient: any, index: number) => (
                                    <tr key={`${patient.PATIENT_ID}-${index}`} className="border-b hover:bg-gray-50">
                                      <td className="p-3 font-medium">{patient.PATIENT_NAME || 'N/A'}</td>
                                      <td className="p-3 text-center">{patient.LAST_VISIT_DATE || '-'}</td>
                                      <td className="p-3 text-center font-bold text-green-600">{formatCurrency(Number(patient.TOTAL_SPENT || 0))}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 gap-2">
                            <div className="text-sm text-gray-600">
                              {(() => {
                                const pageNum = Number(patientsTotalsMeta.PAGE_NUMBER || 1)
                                const ps = Number(patientsTotalsMeta.PAGE_SIZE || 10)
                                const total = Number(patientsTotalsMeta.TOTAL_RECORDS || 0)
                                const start = total > 0 && ps > 0 ? (pageNum - 1) * ps + 1 : 0
                                const end = total > 0 && ps > 0 ? Math.min(pageNum * ps, total) : 0
                                return `Showing ${start}-${end} of ${total} patients`
                              })()}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={totalsPageLoading || (patientsTotalsMeta.PAGE_NUMBER || 1) <= 1}
                                onClick={() => fetchTotalsPage(Math.max(1, Number(patientsTotalsMeta.PAGE_NUMBER || 1) - 1))}
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </Button>
                              <span className="text-sm text-gray-700">
                                Page {patientsTotalsMeta.PAGE_NUMBER} of {patientsTotalsMeta.TOTAL_PAGES}
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={Number(patientsTotalsMeta.TOTAL_PAGES || 1)}
                                className="h-8 w-16 border rounded px-2 text-sm"
                                value={totalsPageInput || String(patientsTotalsMeta.PAGE_NUMBER || 1)}
                                disabled={totalsPageLoading}
                                aria-label="Go to page"
                                placeholder="Page"
                                onChange={(e) => setTotalsPageInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = parseInt(totalsPageInput || String(patientsTotalsMeta.PAGE_NUMBER || 1))
                                    if (!isNaN(val)) fetchTotalsPage(Math.min(Math.max(1, val), Number(patientsTotalsMeta.TOTAL_PAGES || 1)))
                                  }
                                }}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={totalsPageLoading}
                                onClick={() => {
                                  const val = parseInt(totalsPageInput || String(patientsTotalsMeta.PAGE_NUMBER || 1))
                                  if (!isNaN(val)) fetchTotalsPage(Math.min(Math.max(1, val), Number(patientsTotalsMeta.TOTAL_PAGES || 1)))
                                }}
                              >
                                Go
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={totalsPageLoading || Number(patientsTotalsMeta.PAGE_NUMBER || 1) >= Number(patientsTotalsMeta.TOTAL_PAGES || 1)}
                                onClick={() => fetchTotalsPage(Math.min(Number(patientsTotalsMeta.TOTAL_PAGES || 1), Number(patientsTotalsMeta.PAGE_NUMBER || 1) + 1))}
                              >
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </>
                      ) : viewingCategoryPatients ? (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="p-3 text-left font-medium">Patient Name</th>
                                  <th className="p-3 text-center font-medium">Last Visit</th>
                                  <th className="p-3 text-center font-medium">Total Spending</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const categoryData = transformedData.categories.find(c => c.category === viewingCategoryPatients)
                                  const patientsList = categoryData?.patients || []
                                  return patientsList
                                    .filter((p: any) => (p.PATIENT_NAME || '').toLowerCase().includes(searchTerm.toLowerCase()))
                                    .map((patient: any, index: number) => (
                                      <tr key={`${patient.PATIENT_ID}-${index}`} className="border-b hover:bg-gray-50">
                                        <td className="p-3 font-medium">{patient.PATIENT_NAME || 'N/A'}</td>
                                        <td className="p-3 text-center">{patient.LAST_VISIT_DATE || '-'}</td>
                                        <td className="p-3 text-center font-bold text-green-600">{formatCurrency(Number(patient.TOTAL_SPENT || 0))}</td>
                                      </tr>
                                    ))
                                })()}
                              </tbody>
                            </table>
                          </div>

                          {(() => {
                            const categoryData = mhpl0004Data?.groupBySpendingCategory?.find(
                              (cat: any) => cat.SPENDING_CATEGORY === viewingCategoryPatients
                            )
                            const paginationMeta = categoryData?.PATIENTS_LIST?.[0]

                            if (!paginationMeta) return null

                            const pageNum = Number(paginationMeta.PAGE_NUMBER || 1)
                            const ps = Number(paginationMeta.PAGE_SIZE || 10)
                            const total = Number(paginationMeta.TOTAL_RECORDS || 0)
                            const totalPgs = Number(paginationMeta.TOTAL_PAGES || 1)
                            const start = total > 0 && ps > 0 ? (pageNum - 1) * ps + 1 : 0
                            const end = total > 0 && ps > 0 ? Math.min(pageNum * ps, total) : 0

                            return (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 gap-2">
                                <div className="text-sm text-gray-600">
                                  Showing {start}-{end} of {total} patients
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={categoryPatientLoading || pageNum <= 1}
                                    onClick={() => fetchCategoryPatientPage(viewingCategoryPatients!, pageNum - 1)}
                                  >
                                    <ChevronLeft className="w-4 h-4" />
                                  </Button>
                                  <span className="text-sm text-gray-700">
                                    Page {pageNum} of {totalPgs}
                                  </span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={totalPgs}
                                    className="h-8 w-16 border rounded px-2 text-sm"
                                    value={categoryPatientPage}
                                    disabled={categoryPatientLoading}
                                    aria-label="Go to page"
                                    placeholder="Page"
                                    onChange={(e) => setCategoryPatientPage(Number(e.target.value) || 1)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        const val = categoryPatientPage
                                        if (val >= 1 && val <= totalPgs) {
                                          fetchCategoryPatientPage(viewingCategoryPatients!, val)
                                        }
                                      }
                                    }}
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={categoryPatientLoading}
                                    onClick={() => {
                                      const val = categoryPatientPage
                                      if (val >= 1 && val <= totalPgs) {
                                        fetchCategoryPatientPage(viewingCategoryPatients!, val)
                                      }
                                    }}
                                  >
                                    Go
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={categoryPatientLoading || pageNum >= totalPgs}
                                    onClick={() => fetchCategoryPatientPage(viewingCategoryPatients!, pageNum + 1)}
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            )
                          })()}
                        </>
                      ) : (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="p-3 text-left font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('patientName')}>
                                    Patient Name <SortIcon column="patientName" />
                                  </th>
                                  <th className="p-3 text-left font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('spendingCategory')}>
                                    Category <SortIcon column="spendingCategory" />
                                  </th>
                                  <th className="p-3 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('lastVisit')}>
                                    Last Visit <SortIcon column="lastVisit" />
                                  </th>
                                  <th className="p-3 text-center font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('totalSpending')}>
                                    Total Spending <SortIcon column="totalSpending" />
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {paginatedPatients.map((patient: TransformedPatient, index: number) => (
                                  <tr key={`${patient.patientId}-${index}`} className="border-b hover:bg-gray-50">
                                    <td className="p-3 font-medium">{patient.patientName}</td>
                                    <td className="p-3">{patient.spendingCategory}</td>
                                    <td className="p-3 text-center">{patient.lastVisit}</td>
                                    <td className="p-3 text-center font-bold text-green-600">{formatCurrency(patient.totalSpending)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

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
                                {pagination.totalItems} patients
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
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-gray-500">No spending data available for this endpoint.</p>
              </CardContent>
            </Card>
          )}
        </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
