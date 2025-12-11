// components/layout/Header.tsx
'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import {
  Menu,
  Bell,
  Search,
  Settings,
  User,
  LogOut,
  Filter,
  Download,
  RefreshCw,
  Play,
  Pause,
  X
} from 'lucide-react'
import { useDashboardStore } from '@/lib/store/dashboard-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AuthWrapper } from '@/components/auth/AuthWrapper'
import { useUser } from '@clerk/nextjs'
import { useFilterState } from '@/components/filters/FilterStateProvider'
import FilterChip from '@/components/ui/FilterChip'

interface HeaderProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export function Header({ sidebarOpen, setSidebarOpen }: HeaderProps) {
  const {
    toggleGlobalFilters,
    showGlobalFilters,
    apiControlState,
    toggleApiControl,
    isRefreshing,
    triggerGlobalRefresh,
    refreshAllKPIs,
    demoMode,
    setDemoMode
  } = useDashboardStore()
  const { user } = useUser()

  // CRITICAL: Read from Zustand store (single source of truth for dates!)
  const zustandStore = useDashboardStore()
  const globalFilters = zustandStore.globalFilters

  // Defensive normalization: ensure dates are plain strings
  const safeStartDate = typeof globalFilters.startDate === 'string'
    ? globalFilters.startDate
    : (globalFilters.startDate as any)?.startDate ?? ''
  const safeEndDate = typeof globalFilters.endDate === 'string'
    ? globalFilters.endDate
    : (globalFilters.endDate as any)?.endDate ?? ''

  // Keep FilterStateProvider commitChanges for database saves
  const { commitChanges } = useFilterState()

  // Staged dates for quick actions in the sticky active filters bar
  const [pendingStartDate, setPendingStartDate] = useState<string>('')
  const [pendingEndDate, setPendingEndDate] = useState<string>('')
  const [savingDates, setSavingDates] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    // Read from Zustand store - this is what API uses!
    setPendingStartDate(globalFilters.startDate ?? '')
    setPendingEndDate(globalFilters.endDate ?? '')
    console.log('📅 [HEADER] Displaying Zustand dates:', {
      startDate: globalFilters.startDate,
      endDate: globalFilters.endDate
    })
  }, [globalFilters.startDate, globalFilters.endDate])

  const toISODate = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const setLastWeek = () => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 6)
    setPendingStartDate(toISODate(start))
    setPendingEndDate(toISODate(end))
    setShowConfirm(true)
  }

  const setMonthToDate = () => {
    const end = new Date()
    const start = new Date(end.getFullYear(), end.getMonth(), 1)
    setPendingStartDate(toISODate(start))
    setPendingEndDate(toISODate(end))
    setShowConfirm(true)
  }

  const setYearToDate = () => {
    const end = new Date()
    const start = new Date(end.getFullYear(), 0, 1)
    setPendingStartDate(toISODate(start))
    setPendingEndDate(toISODate(end))
    setShowConfirm(true)
  }

  const applyDateUpdates = async () => {
    if (!pendingStartDate || !pendingEndDate) return
    setSavingDates(true)
    try {
      console.log('🔄 [HEADER] Applying date updates:', { startDate: pendingStartDate, endDate: pendingEndDate })

      // STEP 1: Update Zustand (single source of truth - used by API!)
      useDashboardStore.getState().updateGlobalFilter('startDate', pendingStartDate)
      useDashboardStore.getState().updateGlobalFilter('endDate', pendingEndDate)

      // VERIFY Zustand was updated correctly
      const storeState = useDashboardStore.getState().globalFilters
      console.log('✅ [HEADER] Zustand updated:', {
        startDate: storeState.startDate,
        endDate: storeState.endDate
      })

      if (storeState.startDate !== pendingStartDate || storeState.endDate !== pendingEndDate) {
        console.error('❌ [HEADER] CRITICAL: Zustand update FAILED!')
        console.error('Expected:', { startDate: pendingStartDate, endDate: pendingEndDate })
        console.error('Got:', storeState)
        return // Don't proceed if Zustand update failed
      }

      // STEP 2: Dispatch a single dashboard refresh event (DashboardPage runs loader + updates KPIs)
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('dashboard-refresh-request', { detail: { reason: 'header-date-change' } }))
        }
      } catch {}

      // STEP 3: Save to database in background (non-blocking)
      console.log('💾 [HEADER] Saving to database in background...')
      commitChanges().catch(err => {
        console.warn('⚠️ [HEADER] Database save failed (non-critical):', err)
      })

    } finally {
      setTimeout(() => setSavingDates(false), 500)
    }
  }

  // Utility function to format field names
  const formatFieldName = (key: string) => {
    const fieldMappings: Record<string, string> = {
      startDate: 'Start Date',
      endDate: 'End Date',
      pageSize: 'Page Size',
      pageNumber: 'Page Number',
      patientCategory: 'Patient Category',
      divisions: 'Divisions',
      districts: 'Districts',
      spendingCategories: 'Spending Categories',
      departments: 'Departments',
      employeeTypes: 'Employee Types',
      medicineCategories: 'Medicine Categories',
      summaryTypes: 'Summary Types',
      serviceTypes: 'Service Types',
      insuranceProviders: 'Insurance Providers',
      threshold: 'Threshold',
      bedTypes: 'Bed Types',
      wards: 'Wards',
      consultants: 'Consultants',
      medicineName: 'Medicine Name',
      departmentName: 'Department Name'
    }
    return fieldMappings[key] || key.charAt(0).toUpperCase() + key.slice(1)
  }

  return (
    <>
      <motion.header
        className="bg-white border-b border-gray-200 px-4 py-3"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          {/* Left Section */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </Button>

            <div className="hidden lg:block">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-gray-900">
                  KPI Dashboard
                </h1>
                <Badge variant="outline" className="text-xs">
                  {demoMode ? 'Demo Mode' : 'Live Mode'}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">
                Comprehensive analytics at your fingertips
              </p>
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-3">
            {/* Global Filter Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleGlobalFilters}
              className="flex items-center"
              title="Toggle global filters"
            >
              <Filter className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Filters</span>
            </Button>

            {/* Play/Pause API Control */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleApiControl}
              title={apiControlState === 'playing' ? 'Pause automatic API calls' : 'Resume automatic API calls'}
            >
              {apiControlState === 'playing' ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>

            {/* Refresh Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Single refresh path: dispatch dashboard event (DashboardPage runs loader)
                try { useDashboardStore.getState().refreshAllKPIs() } catch {}
              }}
              disabled={isRefreshing}
              title="Refresh all data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>

            {/* Export Button */}
            <Button variant="outline" size="sm" className="hidden md:flex">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="relative">
                  <Bell className="w-5 h-5" />
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    3
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="p-3 border-b">
                  <h3 className="font-semibold">Notifications</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <DropdownMenuItem className="p-3 border-b">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Low Bed Occupancy Alert</p>
                      <p className="text-xs text-gray-600">
                        LEVEL-12 NURSE STATION is below threshold
                      </p>
                      <p className="text-xs text-gray-400">2 minutes ago</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="p-3 border-b">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">High Overtime Alert</p>
                      <p className="text-xs text-gray-600">
                        NURSING department exceeded overtime limits
                      </p>
                      <p className="text-xs text-gray-400">1 hour ago</p>
                    </div>
                  </DropdownMenuItem>
                </div>
                <div className="p-2">
                  <Button variant="ghost" size="sm" className="w-full">
                    View all notifications
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Authentication Section - Clerk Integration */}
            <AuthWrapper />

            {/* Settings Menu - Only show when authenticated */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuItem onClick={() => window.location.href = '/settings'}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.location.href = '/settings/rbac'}>
                    <User className="mr-2 h-4 w-4" />
                    <span>RBAC Management</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </motion.header>

      {/* Sticky Active Filters Bar */}
      {(safeStartDate || safeEndDate) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-2 shadow-sm"
        >
          <div className="flex items-center gap-3 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200/60 px-4 py-2.5 shadow-sm">
  {/* Left Section: Icon, Title, Count, Quick Ranges */}
  <div className="flex items-center gap-2 flex-shrink-0 relative">
    <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-md shadow-sm">
      <Filter className="w-3.5 h-3.5 text-white" />
    </div>
    <span className="text-sm font-semibold text-gray-700">Filters</span>
    {/* {Object.values(globalFilters).filter(v => v && (Array.isArray(v) ? v.length > 0 : true)).length > 0 && (
      <span className="inline-flex items-center justify-center min-w-[18px] h-5 px-1.5 text-xs font-bold text-blue-600 bg-blue-100 rounded-full">
        {Object.values(globalFilters).filter(v => v && (Array.isArray(v) ? v.length > 0 : true)).length}
      </span>
    )} */}

    {/* Quick range buttons (always available when bar is visible) */}
    <div className="ml-2 flex items-center gap-1.5 relative z-10">
      <Button variant="secondary" size="sm" className="h-6 px-2 text-xs" onClick={setLastWeek}>Last Week</Button>
      <Button variant="secondary" size="sm" className="h-6 px-2 text-xs" onClick={setMonthToDate}>Last Month</Button>
      <Button variant="secondary" size="sm" className="h-6 px-2 text-xs" onClick={setYearToDate}>YTD</Button>
    </div>
  </div>

  {/* Middle Section: Filter Chips - ONLY show dates (truly global filters) */}
  <div className="flex-1 min-w-0 relative z-0">
    {(safeStartDate || safeEndDate) ? (
      <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 pb-1 -mb-1">
        {/* Only show startDate and endDate - these are the ONLY truly global filters */}
        {safeStartDate && (
          <FilterChip
            key="startDate"
            label="Start Date"
            value={safeStartDate}
            variant="global"
            onEdit={(newValue) => {
              setPendingStartDate(newValue)
              setShowConfirm(true)
            }}
            onRemove={() => {}}
            removable={false}
            editable={true}
          />
        )}
        {safeEndDate && (
          <FilterChip
            key="endDate"
            label="End Date"
            value={safeEndDate}
            variant="global"
            onEdit={(newValue) => {
              setPendingEndDate(newValue)
              setShowConfirm(true)
            }}
            onRemove={() => {}}
            removable={false}
            editable={true}
          />
        )}
      </div>
    ) : (
      <span className="text-xs text-gray-400 italic">No date filters set</span>
    )}
  </div>

  {/* Right Section: Update, Clear All & Status */}
  <div className="flex items-center gap-2 flex-shrink-0">
    <Button
      variant="default"
      size="sm"
      onClick={applyDateUpdates}
      disabled={!pendingStartDate || !pendingEndDate || savingDates}
      className="h-7 px-3 text-xs font-medium"
      title="Apply date changes"
    >
      {savingDates ? 'Updating…' : 'Update'}
    </Button>
    
  </div>
</div>
        </motion.div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Apply Date Range</h3>
            <p className="text-sm text-gray-600 mb-4">Confirm the new global date range. KPIs will refresh after applying.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                <input title='start date' type="date" value={pendingStartDate} onChange={(e)=>setPendingStartDate(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">End Date</label>
                <input title='end date' type="date" value={pendingEndDate} onChange={(e)=>setPendingEndDate(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={()=>setShowConfirm(false)}>Cancel</Button>
              <Button size="sm" onClick={() => { setShowConfirm(false); applyDateUpdates(); }} disabled={!pendingStartDate || !pendingEndDate || savingDates}>
                {savingDates ? 'Updating…' : 'Update'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


