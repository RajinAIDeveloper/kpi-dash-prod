'use client'

import React, { useState, useEffect, useRef } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import {
  MapPin,
  Users,
  ChevronDown,
  ChevronUp,
  X,
  TrendingUp,
  Activity,
  Building2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
} from 'lucide-react'
import { TokenStorage } from '@/lib/tokenStorage'
import { callMHPL_API_WithValidation } from '@/lib/api/mhplApi'
import { useFilterState } from '@/components/filters/FilterStateProvider'
import { useDashboardStore } from '@/lib/store/dashboard-store'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { getThemeForEndpoint } from '@/lib/constants/drillDownThemes'

interface GeographicDrillDownModalProps {
  isOpen: boolean
  onClose: () => void
  data?: any
  endpointId: string
  currentValue: string | number
}

interface MHPL0003Patient {
  PATIENT_ID: number
  PATIENT_NAME: string
  LAST_VISIT_DATE: string
}

interface MHPL0003District {
  DISTRICT: string
  PATIENT_TYPE: string
  PATIENT_COUNT: number
  PERCENTAGE: number
  PATIENTS_LIST: {
    PAGE_NUMBER: number
    PAGE_SIZE: number
    TOTAL_RECORDS: number
    TOTAL_PAGES: number
    PATIENTS: MHPL0003Patient[]
  }[]
}

interface MHPL0003Division {
  DIVISION: string
  DISTRICTS: MHPL0003District[]
}

export function GeographicDrillDownModal({
  isOpen,
  onClose,
  data: propData,
  endpointId,
  currentValue
}: GeographicDrillDownModalProps) {
  const theme = getThemeForEndpoint(endpointId)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(new Set())
  const [expandedDistricts, setExpandedDistricts] = useState<Set<string>>(new Set())
  const [districtPages, setDistrictPages] = useState<Record<string, number>>({})
  const [districtPageInputs, setDistrictPageInputs] = useState<Record<string, string>>({})
  const [districtLoading, setDistrictLoading] = useState<Record<string, boolean>>({})
  // CRITICAL: Read from Zustand store (single source of truth for global filters)
  const zustandStore = useDashboardStore()
  const globalFilters = zustandStore.globalFilters
  const endpointOverrides = zustandStore.endpointOverrides || {}
  const { hasLoadedPreset } = useFilterState()

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [patientCategory, setPatientCategory] = useState<'IPD' | 'OPD' | 'IPD,OPD'>('OPD')
  const [division, setDivision] = useState('')
  const [district, setDistrict] = useState('')
  const [pageSize, setPageSize] = useState('10')
  const [updating, setUpdating] = useState(false)
  // Auto-refresh guard per open
  const autoRefreshRef = useRef(false)

  // Export patient data to CSV
  const exportPatientsToCsv = (
    patients: MHPL0003Patient[],
    divisionName: string,
    districtName: string,
    patientType: string
  ) => {
    if (!patients || patients.length === 0) {
      toast.error('No patient data to export')
      return
    }

    // Create CSV headers
    const headers = ['Patient ID', 'Patient Name', 'Last Visit Date']

    // Create CSV rows
    const rows = patients.map(patient => [
      patient.PATIENT_ID,
      `"${patient.PATIENT_NAME}"`, // Wrap in quotes to handle commas in names
      patient.LAST_VISIT_DATE
    ])

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    // Create filename with division, district, and timestamp
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `patients_${divisionName}_${districtName}_${patientType}_${timestamp}.csv`
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_.-]/g, '')

    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success(`Exported ${patients.length} patients to CSV`)
  }

  // Refresh data from API using current filters (loads page 1)
  const refreshGeographicData = async () => {
    if (!startDate || !endDate) return
    try {
      setUpdating(true)
      const token = TokenStorage.getValidToken() || undefined
      const includePaging = pageSize !== '0'
      const requestParams: Record<string, any> = {
        StartDate: startDate,
        EndDate: endDate,
        PatCat: patientCategory,
      }
      if (division) requestParams.Division = division
      if (district) requestParams.District = district
      if (includePaging) {
        requestParams.PageNumber = '1'
        requestParams.PageSize = pageSize || '10'
      }

      const response = await callMHPL_API_WithValidation('mhpl0003', requestParams, token)
      if (response.status !== 'success') {
        throw new Error((response as any).message || 'MHPL0003 call failed')
      }

      const raw = (response as any).data
      const normalized = raw?.data ? raw.data : raw
      const wrapped = {
        data: normalized,
        input_parameters: {
          start_date: startDate,
          end_date: endDate,
          patient_categories: patientCategory,
          ...(division ? { division } : {}),
          ...(district ? { district } : {}),
          ...(pageSize !== '0'
            ? { page_number: 1, page_size: Number(pageSize || '10') }
            : {}),
        },
      }

      setData(wrapped as any)
      setLoading(false)
      setDistrictPages({})
      setDistrictPageInputs({})
      toast.success('Geographic data refreshed')
    } catch (err: any) {
      console.error('[MHPL0003] Update failed:', err)
      toast.error(err?.message || 'Failed to refresh data')
    } finally {
      setUpdating(false)
    }
  }

  // CRITICAL: Always use fresh API data - clear stale data on open
  useEffect(() => {
    if (isOpen) {
      console.log('[GeographicDrillDown] Modal opened - clearing stale data, will fetch fresh')
      setData(null)
      setLoading(true)
    }
  }, [isOpen])

  // Initialize local filters when opened - Use Zustand dates and endpointOverrides
  useEffect(() => {
    if (!isOpen) return

    console.log('[GeographicDrillDown] Initializing filters from Zustand and endpointOverrides')

    // Dates from Zustand (single source of truth)
    const s = globalFilters.startDate || ''
    const e = globalFilters.endDate || ''
    console.log('[GeographicDrillDown] Dates from Zustand:', { startDate: s, endDate: e })
    setStartDate(s)
    setEndDate(e)

    // Patient category: default to the KPI capsule's local filter (store override), fallback to 'IPD'
    const storePatCat = endpointOverrides?.['mhpl0003']?.PatCat
    const normalized = String(storePatCat || 'IPD').toUpperCase()
    const allowed = (normalized === 'IPD' || normalized === 'OPD' || normalized === 'IPD,OPD') ? normalized : 'IPD'
    console.log('[GeographicDrillDown] Using patient category from store override:', allowed)
    setPatientCategory(allowed as 'IPD' | 'OPD' | 'IPD,OPD')

    setDivision('')
    setDistrict('')
    setUpdating(false)
  }, [isOpen, hasLoadedPreset, globalFilters.startDate, globalFilters.endDate, endpointId, endpointOverrides])

  // Auto-refresh on open to load fresh data from API (page 1)
  useEffect(() => {
    if (isOpen) {
      if (startDate && endDate && !autoRefreshRef.current) {
        autoRefreshRef.current = true
        refreshGeographicData()
      }
    } else {
      autoRefreshRef.current = false
    }
  }, [isOpen, startDate, endDate, patientCategory, division, district, pageSize])

  const toggleDivisionExpanded = (division: string) => {
    const newExpanded = new Set(expandedDivisions)
    if (newExpanded.has(division)) {
      newExpanded.delete(division)
    } else {
      newExpanded.add(division)
    }
    setExpandedDivisions(newExpanded)
  }

  const toggleDistrictExpanded = (districtKey: string) => {
    const newExpanded = new Set(expandedDistricts)
    if (newExpanded.has(districtKey)) {
      newExpanded.delete(districtKey)
    } else {
      newExpanded.add(districtKey)
    }
    setExpandedDistricts(newExpanded)
  }

  const handlePageChange = (districtKey: string, newPage: number) => {
    setDistrictPages(prev => ({
      ...prev,
      [districtKey]: newPage
    }))
  }

  // Fetch a specific district page from API and merge into current data tree
  const fetchDistrictPage = async (
    divisionName: string,
    districtName: string,
    districtKey: string,
    newPage: number,
    pageSizeForReq?: number,
    patCatOverride?: string
  ) => {
    if (!startDate || !endDate) {
      toast.error('Start and End dates are required')
      return
    }

    setDistrictLoading(prev => ({ ...prev, [districtKey]: true }))
    try {
      const token = TokenStorage.getValidToken() || undefined
      const payload: Record<string, any> = {
        StartDate: startDate,
        EndDate: endDate,
        PatCat: patCatOverride || patientCategory,
        // Include both Division and District to maximize server match accuracy
        Division: divisionName,
        District: districtName,
        PageNumber: String(newPage)
      }
      if (Number.isFinite(pageSizeForReq) && (pageSizeForReq || 0) > 0) {
        payload.PageSize = String(pageSizeForReq)
      } else if (pageSize && pageSize !== '0') {
        payload.PageSize = pageSize || '10'
      }

      const response = await callMHPL_API_WithValidation('mhpl0003', payload, token)
      if (response.status !== 'success') {
        throw new Error((response as any).message || 'MHPL0003 page fetch failed')
      }

      const raw = (response as any).data
      const normalized = raw?.data ? raw.data : raw
      const newLocations = normalized?.groupByLocation || []

      // Extract the requested district's first PATIENTS_LIST entry from fresh response
      const norm = (s: any) => String(s ?? '').trim().toLowerCase()
      // Prefer exact division+district match
      let fromDiv = newLocations.find((d: any) => norm(d.DIVISION) === norm(divisionName))
      let fromDist = fromDiv?.DISTRICTS?.find((dd: any) => norm(dd.DISTRICT) === norm(districtName))
      // Fallback: search across all divisions by district name
      if (!fromDist) {
        for (const div of newLocations) {
          const candidate = (div?.DISTRICTS || []).find((dd: any) => norm(dd.DISTRICT) === norm(districtName))
          if (candidate) { fromDiv = div; fromDist = candidate; break }
        }
      }
      const newPatientsListEntry = fromDist?.PATIENTS_LIST?.[0]
      const isValidList = newPatientsListEntry && Array.isArray(newPatientsListEntry.PATIENTS)

      if (!isValidList) {
        toast.error('No data returned for requested district/page. Try different filters.')
        return
      }

      // Merge into current data tree, replacing that district's PATIENTS_LIST with only the new page entry
      setData((prev: any) => {
        const prevUnwrapped = (prev?.data ? prev.data : prev) || {}
        const prevLocations = prevUnwrapped.groupByLocation || []

        const updatedLocations = prevLocations.map((div: any) => {
          if (String(div.DIVISION).toLowerCase() !== String(divisionName).toLowerCase()) return div
          return {
            ...div,
            DISTRICTS: (div.DISTRICTS || []).map((dist: any) =>
              String(dist.DISTRICT).toLowerCase() === String(districtName).toLowerCase()
                ? { ...dist, PATIENTS_LIST: [newPatientsListEntry] }
                : dist
            )
          }
        })

        const updated = { ...prevUnwrapped, groupByLocation: updatedLocations }
        // Preserve wrapper shape if it existed
        return prev?.data ? { ...prev, data: updated } : updated
      })

      // Update visible page for this district
      setDistrictPages(prev => ({ ...prev, [districtKey]: newPage }))
      setDistrictPageInputs(prev => ({ ...prev, [districtKey]: String(newPage) }))
    } catch (err: any) {
      console.error('[MHPL0003] District page fetch error:', err)
      toast.error(err?.message || 'Failed to load page')
    } finally {
      setDistrictLoading(prev => ({ ...prev, [districtKey]: false }))
    }
  }

  const geographicData = data?.groupByLocation || data?.data?.groupByLocation || []

  // Calculate summary statistics
  const totalDivisions = geographicData.length
  const totalDistricts = geographicData.reduce((sum: number, div: MHPL0003Division) =>
    sum + (div.DISTRICTS?.length || 0), 0)
  const totalPatients = geographicData.reduce((sum: number, div: MHPL0003Division) =>
    sum + (div.DISTRICTS?.reduce((distSum: number, dist: MHPL0003District) =>
      distSum + (dist.PATIENT_COUNT || 0), 0) || 0), 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-6xl lg:max-w-7xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Enhanced Header */}
        <div className={cn("sticky top-0 z-10 bg-gradient-to-r text-white px-4 sm:px-6 py-4 sm:py-5", theme.gradient)}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl lg:text-2xl font-bold mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span className="truncate">Geographic Distribution Analysis</span>
              </DialogTitle>
              <DialogDescription className="text-white/90 text-xs sm:text-sm">
                • Total Districts: <span className="font-semibold text-white">{totalDistricts}</span>
                {!loading && geographicData.length > 0 && (
                  <span className="ml-0 sm:ml-4 block sm:inline mt-1 sm:mt-0">• {geographicData.length} Divisions</span>
                )}
                {!loading && totalDistricts > 0 && (
                  <span className="ml-0 sm:ml-4 block sm:inline mt-1 sm:mt-0">• {totalPatients} Patients</span>
                )}
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

        {/* Content */}
        {/* Loading Screen */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Geographic Data...</h3>
            <p className="text-sm text-gray-500 text-center">
              Fetching fresh data from API with current filter values
            </p>
            <div className="mt-4 w-full max-w-xs">
              <Progress value={66} className="h-2" />
            </div>
          </div>
        )}

        {!loading && (
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {/* Loading bar during update */}
            {updating && (
              <div className="mb-3">
                <Progress value={66} />
              </div>
            )}

            {/* Filter Bar for live refresh */}
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
                  <div>
                    <Label className="text-xs">Patient Category</Label>
                    <Select value={patientCategory} onValueChange={(v) => setPatientCategory(v as any)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IPD">IPD</SelectItem>
                        <SelectItem value="OPD">OPD</SelectItem>
                        <SelectItem value="IPD,OPD">IPD, OPD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Division (optional)</Label>
                    <Input type="text" placeholder="e.g. Dhaka" value={division} onChange={(e) => setDivision(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">District (optional)</Label>
                    <Input type="text" placeholder="e.g. Gazipur" value={district} onChange={(e) => setDistrict(e.target.value)} />
                  </div>
                  <div className="flex md:justify-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Page Size</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0 = all"
                        value={pageSize}
                        onChange={(e) => setPageSize(e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        className="w-full md:w-auto"
                        disabled={updating || !startDate || !endDate}
                        onClick={refreshGeographicData}
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
            <Tabs value="divisions" className="w-full">
              {/* Enhanced Tabs Navigation */}


              <TabsContent value="divisions" className="space-y-6 mt-6">


                <div className="space-y-4">
                  {geographicData.map((division: MHPL0003Division, index: number) => {
                    const divisionId = `division-${index}`
                    const isExpanded = expandedDivisions.has(divisionId)

                    return (
                      <Card key={index} className="border-l-4 border-l-purple-500">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-sm">Division: {division.DIVISION}</CardTitle>
                              <CardDescription className="text-xs">
                                {division.DISTRICTS?.length || 0} districts
                              </CardDescription>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleDivisionExpanded(divisionId)}
                              className="h-6 w-6 p-0"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </CardHeader>

                        {isExpanded && division.DISTRICTS && (
                          <CardContent className="pt-0">
                            <div className="space-y-4">
                              {division.DISTRICTS.map((district: MHPL0003District, distIndex: number) => {
                                const districtKey = `${divisionId}-district-${distIndex}`
                                const isDistrictExpanded = expandedDistricts.has(districtKey)
                                const currentPage = districtPages[districtKey] || 1
                                const patientsList = district.PATIENTS_LIST || []
                                const desiredPage = Number(districtPages[districtKey] || patientsList[0]?.PAGE_NUMBER || 1)
                                const patientsData =
                                  patientsList.find((p: any) => Number(p?.PAGE_NUMBER) === desiredPage) ||
                                  patientsList[0]
                                const hasPatients = patientsData?.PATIENTS && patientsData.PATIENTS.length > 0

                                return (
                                  <div key={distIndex} className="border rounded-lg p-3">
                                    <div className="flex justify-between items-center mb-2">
                                      <h6 className="text-xs font-medium">{district.DISTRICT}</h6>
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">
                                          {district.PATIENT_COUNT} patients
                                        </Badge>
                                        <Badge variant="secondary" className="text-xs">
                                          {district.PERCENTAGE}%
                                        </Badge>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Patient Type:</span>
                                        <span className="font-medium">{district.PATIENT_TYPE}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Count:</span>
                                        <span className="font-medium">{district.PATIENT_COUNT}</span>
                                      </div>
                                    </div>

                                    {hasPatients && (
                                      <div className="border-t pt-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <h6 className="text-xs font-medium">Patient Details</h6>
                                            {districtLoading[districtKey] && (
                                              <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                                            )}
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => toggleDistrictExpanded(districtKey)}
                                              className="h-6 w-6 p-0"
                                            >
                                              {isDistrictExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                            </Button>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">
                                              {patientsData.TOTAL_RECORDS} total
                                            </Badge>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => exportPatientsToCsv(
                                                patientsData.PATIENTS,
                                                division.DIVISION,
                                                district.DISTRICT,
                                                district.PATIENT_TYPE
                                              )}
                                              className="h-7 gap-1 text-xs"
                                              title="Export patients to CSV"
                                            >
                                              <Download className="w-3 h-3" />
                                              Export
                                            </Button>
                                          </div>
                                        </div>

                                        {isDistrictExpanded && (
                                          <>
                                            <div className="max-h-64 overflow-y-auto border rounded">
                                              <Table>
                                                <TableHeader>
                                                  <TableRow>
                                                    <TableHead className="text-xs">Patient ID</TableHead>
                                                    <TableHead className="text-xs">Name</TableHead>
                                                    <TableHead className="text-xs">Last Visit</TableHead>
                                                  </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                  {Array.isArray(patientsData.PATIENTS) && patientsData.PATIENTS.length > 0 ? (
                                                    patientsData.PATIENTS.map((patient: MHPL0003Patient) => (
                                                      <TableRow key={patient.PATIENT_ID}>
                                                        <TableCell className="text-xs">{patient.PATIENT_ID}</TableCell>
                                                        <TableCell className="text-xs">{patient.PATIENT_NAME}</TableCell>
                                                        <TableCell className="text-xs">{patient.LAST_VISIT_DATE}</TableCell>
                                                      </TableRow>
                                                    ))
                                                  ) : (
                                                    <TableRow>
                                                      <TableCell colSpan={3} className="text-xs text-center text-gray-500 py-4">
                                                        {districtLoading[districtKey] ? 'Loading…' : 'No patients found for this page.'}
                                                      </TableCell>
                                                    </TableRow>
                                                  )}
                                                </TableBody>
                                              </Table>
                                            </div>

                                            {/* Pagination Controls */}
                                            {patientsData.TOTAL_PAGES > 1 && (
                                              <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-3 pt-3 border-t gap-2">
                                                <div className="flex items-center gap-2">
                                                  {/* First */}
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                      fetchDistrictPage(
                                                        division.DIVISION,
                                                        district.DISTRICT,
                                                        districtKey,
                                                        1,
                                                        patientsData.PAGE_SIZE,
                                                        district.PATIENT_TYPE
                                                      )
                                                    }
                                                    disabled={(patientsData.PAGE_NUMBER || 1) === 1 || districtLoading[districtKey]}
                                                    className="h-7 w-7 p-0"
                                                    title="First page"
                                                  >
                                                    <ChevronsLeft className="h-4 w-4" />
                                                  </Button>

                                                  {/* Previous */}
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                      fetchDistrictPage(
                                                        division.DIVISION,
                                                        district.DISTRICT,
                                                        districtKey,
                                                        Math.max(1, (patientsData.PAGE_NUMBER || 1) - 1),
                                                        patientsData.PAGE_SIZE,
                                                        district.PATIENT_TYPE
                                                      )
                                                    }
                                                    disabled={(patientsData.PAGE_NUMBER || 1) === 1 || districtLoading[districtKey]}
                                                    className="h-7 w-7 p-0"
                                                    title="Previous page"
                                                  >
                                                    <ChevronLeft className="h-4 w-4" />
                                                  </Button>

                                                  {/* Page Numbers */}
                                                  {(() => {
                                                    const current = Number(patientsData.PAGE_NUMBER || 1)
                                                    const total = Number(patientsData.TOTAL_PAGES || 1)
                                                    let pages: number[] = []
                                                    if (total <= 5) {
                                                      pages = Array.from({ length: total }, (_, i) => i + 1)
                                                    } else if (current <= 3) {
                                                      pages = [1, 2, 3, 4, 5]
                                                    } else if (current >= total - 2) {
                                                      pages = [total - 4, total - 3, total - 2, total - 1, total].filter(p => p >= 1)
                                                    } else {
                                                      pages = [current - 2, current - 1, current, current + 1, current + 2]
                                                    }
                                                    return (
                                                      <div className="hidden sm:flex items-center gap-1 mx-1">
                                                        {pages.map((p) => (
                                                          <Button
                                                            key={p}
                                                            size="sm"
                                                            variant={current === p ? 'default' : 'outline'}
                                                            className="h-7 w-8 p-0 text-xs"
                                                            disabled={districtLoading[districtKey]}
                                                            onClick={() =>
                                                              fetchDistrictPage(
                                                                division.DIVISION,
                                                                district.DISTRICT,
                                                                districtKey,
                                                                p,
                                                                patientsData.PAGE_SIZE,
                                                                district.PATIENT_TYPE
                                                              )
                                                            }
                                                          >
                                                            {p}
                                                          </Button>
                                                        ))}
                                                      </div>
                                                    )
                                                  })()}

                                                  {/* Next */}
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                      fetchDistrictPage(
                                                        division.DIVISION,
                                                        district.DISTRICT,
                                                        districtKey,
                                                        Math.min(patientsData.TOTAL_PAGES, (patientsData.PAGE_NUMBER || 1) + 1),
                                                        patientsData.PAGE_SIZE,
                                                        district.PATIENT_TYPE
                                                      )
                                                    }
                                                    disabled={(patientsData.PAGE_NUMBER || 1) >= patientsData.TOTAL_PAGES || districtLoading[districtKey]}
                                                    className="h-7 w-7 p-0"
                                                    title="Next page"
                                                  >
                                                    <ChevronRight className="h-4 w-4" />
                                                  </Button>

                                                  {/* Last */}
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                      fetchDistrictPage(
                                                        division.DIVISION,
                                                        district.DISTRICT,
                                                        districtKey,
                                                        Number(patientsData.TOTAL_PAGES || 1),
                                                        patientsData.PAGE_SIZE,
                                                        district.PATIENT_TYPE
                                                      )
                                                    }
                                                    disabled={(patientsData.PAGE_NUMBER || 1) >= patientsData.TOTAL_PAGES || districtLoading[districtKey]}
                                                    className="h-7 w-7 p-0"
                                                    title="Last page"
                                                  >
                                                    <ChevronsRight className="h-4 w-4" />
                                                  </Button>
                                                </div>

                                                {/* Right side: Page input + info */}
                                                <div className="flex items-center gap-2">
                                                  <span className="text-xs text-gray-600">
                                                    Page {patientsData.PAGE_NUMBER} of {patientsData.TOTAL_PAGES}
                                                  </span>
                                                  <input
                                                    type="number"
                                                    min={1}
                                                    max={patientsData.TOTAL_PAGES}
                                                    className="h-7 w-16 border rounded px-2 text-xs"
                                                    value={districtPageInputs[districtKey] ?? String(patientsData.PAGE_NUMBER || 1)}
                                                    disabled={districtLoading[districtKey]}
                                                    aria-label="Go to page"
                                                    title="Go to page"
                                                    placeholder={String(patientsData.PAGE_NUMBER || 1)}
                                                    onChange={(e) =>
                                                      setDistrictPageInputs(prev => ({ ...prev, [districtKey]: e.target.value }))
                                                    }
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter') {
                                                        const val = parseInt(districtPageInputs[districtKey] || String(patientsData.PAGE_NUMBER || 1))
                                                        if (!isNaN(val)) {
                                                          const target = Math.min(Math.max(1, val), patientsData.TOTAL_PAGES)
                                                          fetchDistrictPage(
                                                            division.DIVISION,
                                                            district.DISTRICT,
                                                            districtKey,
                                                            target,
                                                            patientsData.PAGE_SIZE,
                                                            district.PATIENT_TYPE
                                                          )
                                                        }
                                                      }
                                                    }}
                                                  />
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    disabled={districtLoading[districtKey]}
                                                    onClick={() => {
                                                      const val = parseInt(districtPageInputs[districtKey] || String(patientsData.PAGE_NUMBER || 1))
                                                      if (!isNaN(val)) {
                                                        const target = Math.min(Math.max(1, val), patientsData.TOTAL_PAGES)
                                                        fetchDistrictPage(
                                                          division.DIVISION,
                                                          district.DISTRICT,
                                                          districtKey,
                                                          target,
                                                          patientsData.PAGE_SIZE,
                                                          district.PATIENT_TYPE
                                                        )
                                                      }
                                                    }}
                                                  >
                                                    Go
                                                  </Button>
                                                  <span className="text-xs text-gray-500">
                                                    {(() => {
                                                      const pageNum = Number(patientsData.PAGE_NUMBER || 1)
                                                      const ps = Number(patientsData.PAGE_SIZE || 0)
                                                      const total = Number(patientsData.TOTAL_RECORDS || 0)
                                                      const start = total > 0 && ps > 0 ? (pageNum - 1) * ps + 1 : 0
                                                      const end = total > 0 && ps > 0 ? Math.min(pageNum * ps, total) : 0
                                                      return `Showing ${start}-${end} of ${total}`
                                                    })()}
                                                  </span>
                                                </div>
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    )
                  })}
                </div>
              </TabsContent>

              {/* No Data State */}
              {geographicData.length === 0 && (
                <div className="flex items-center justify-center min-h-[300px]">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                      <Building2 className="w-8 h-8 text-gray-400" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-gray-900">No Geographic Data</h3>
                      <p className="text-gray-600">No geographic data is available for this endpoint.</p>
                    </div>
                  </div>
                </div>
              )}
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default GeographicDrillDownModal
