'use client'
// lib/store/dashboard-store.tsx

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { callMHPL_API_WithValidation } from '@/lib/api/mhplApi'
import { ensureGlobalToken } from '@/lib/auth/ensureToken'

export interface GlobalFilterState {
  startDate: string
  endDate: string
  pageNumber: string
  pageSize: string
  patientCategory: string[]
  divisions: string[]
  districts: string[]
  spendingCategories: string[]
  departments: string[]
  employeeTypes: string[]
  medicineCategories: string[]
  summaryTypes: string[]
  serviceTypes: string[]
  insuranceProviders: string[]
  threshold: string
  bedTypes: string[]
  wards: string[]
  consultants: string[]
  medicineName: string
  departmentName: string[]
}

export interface DashboardSettings {
  autoApplyDefaults: boolean
  comparisonPeriod: 'week' | 'month' | 'quarter' | 'year'
  comparisonEnabled: boolean
  defaultFilterMode: 'basic' | 'advanced'
  debugMode: boolean
  autoPlayOnLoad: boolean
  defaultMode: 'demo' | 'live'
}

interface DashboardStore {
  globalFilters: GlobalFilterState
  settings: DashboardSettings
  hasInitializedFilters: boolean

  activeTab: string
  filtersVisible: boolean
  filterModalOpen: boolean
  showGlobalFilters: boolean

  apiControlState: 'playing' | 'paused'
  isRefreshing: boolean
  demoMode?: boolean

  // KPI view state
  kpiData: any[]
  updatingKpiIds: Set<string>
  error: string | null

  endpointOverrides: Record<string, Record<string, string>>
  drillDownModal: { isOpen: boolean; type: string; data: any; title: string }

  setDemoMode: (mode: boolean) => void
  toggleApiControl: () => void
  toggleGlobalFilters: () => void
  setShowGlobalFilters: (show: boolean) => void
  updateGlobalFilter: (key: keyof GlobalFilterState, value: any) => void
  updateGlobalFilters: (partial: Partial<GlobalFilterState>) => void
  setDateRange: (startDate: string, endDate: string) => void
  setPatientCategory: (categories: string[]) => void
  setDepartments: (departments: string[]) => void
  resetAllFilters: () => void
  updateSettings: (partial: Partial<DashboardSettings>) => void

  setEndpointOverride: (endpointId: string, key: string, value: string) => void
  clearEndpointOverrides: (endpointId?: string) => void
  openDrillDown: (type: string, data: any, title: string) => void
  closeDrillDown: () => void
  setDrillDownData: (payload: { title: string; apiSource: string; data: any; chartType: string }) => void

  getApiParameters: (apiSource: string) => Record<string, any>
  triggerGlobalRefresh: () => Promise<void>
  triggerEndpointRefresh: (endpointId: string) => Promise<void>
  refreshAllKPIs: () => Promise<void>
  setRefreshing: (refreshing: boolean) => void

  // KPI state setters
  setKpiData: (data: any[] | ((prev: any[]) => any[])) => void
  setUpdatingKpiIds: (ids: Set<string> | string[]) => void
  setError: (msg: string | null) => void

  initializeAutoPlay: () => void
}

const getDefaults = (): GlobalFilterState => ({
  startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  pageNumber: '1',
  pageSize: '10',
  patientCategory: [],
  divisions: [],
  districts: [],
  spendingCategories: [],
  departments: [],
  employeeTypes: [],
  medicineCategories: [],
  summaryTypes: ['Monthly'],
  serviceTypes: [],
  insuranceProviders: [],
  threshold: '70',
  bedTypes: [],
  wards: [],
  consultants: [],
  medicineName: '',
  departmentName: []
})

const defaultSettings: DashboardSettings = {
  autoApplyDefaults: true,
  comparisonPeriod: 'month',
  comparisonEnabled: true,
  defaultFilterMode: 'basic',
  debugMode: false,
  autoPlayOnLoad: true,
  defaultMode: 'live'
}

export const useDashboardStore = create<DashboardStore>()(persist(
  (set, get) => ({
    globalFilters: getDefaults(),
    settings: defaultSettings,
    hasInitializedFilters: false,

    activeTab: 'dashboard',
    filtersVisible: false,
    filterModalOpen: false,
    showGlobalFilters: true,

    apiControlState: 'paused',
    isRefreshing: false,
    demoMode: false,

    // KPI view state
    kpiData: [],
    updatingKpiIds: new Set<string>(),
    error: null,

    endpointOverrides: {},
    drillDownModal: { isOpen: false, type: '', data: null, title: '' },

    setDemoMode: (mode) => set({ demoMode: mode, settings: { ...get().settings, defaultMode: mode ? 'demo' : 'live' } }),
    toggleApiControl: () => set({ apiControlState: get().apiControlState === 'paused' ? 'playing' : 'paused' }),
    toggleGlobalFilters: () => set({ showGlobalFilters: !get().showGlobalFilters }),
    setShowGlobalFilters: (show) => set({ showGlobalFilters: show }),
    updateGlobalFilter: (key, value) => {
      console.log(`📅 [STORE] updateGlobalFilter called: ${key} = ${value}`)

      // Update state
      set((state) => ({
        globalFilters: { ...state.globalFilters, [key]: value }
      }))

      // Immediately verify the update
      const updated = get().globalFilters
      console.log(`📅 [STORE] globalFilters after update:`, {
        startDate: updated.startDate,
        endDate: updated.endDate
      })

      // Also update localStorage immediately to prevent persist middleware from overwriting
      if (typeof window !== 'undefined') {
        try {
          const storageKey = 'mhpl-dashboard-store'
          const stored = localStorage.getItem(storageKey)
          if (stored) {
            const parsed = JSON.parse(stored)
            if (parsed.state && parsed.state.globalFilters) {
              parsed.state.globalFilters[key] = value
              localStorage.setItem(storageKey, JSON.stringify(parsed))
              console.log(`📅 [STORE] Also updated localStorage for ${key}`)
            }
          }
        } catch (e) {
          console.warn('Failed to update localStorage:', e)
        }
      }
    },

    setEndpointOverride: (endpointId, key, value) => set((state) => ({
      endpointOverrides: {
        ...state.endpointOverrides,
        [endpointId]: { ...(state.endpointOverrides[endpointId] || {}), [key]: value }
      }
    })),
    clearEndpointOverrides: (endpointId) => set((state) => {
      if (!endpointId) return { endpointOverrides: {} }
      const next = { ...state.endpointOverrides }
      delete next[endpointId]
      return { endpointOverrides: next }
    }),
    openDrillDown: (type, data, title) => set({ drillDownModal: { isOpen: true, type, data, title } }),
    closeDrillDown: () => set({ drillDownModal: { isOpen: false, type: '', data: null, title: '' } }),
    setDrillDownData: (payload) => set({ drillDownModal: { isOpen: true, type: payload.chartType, data: payload.data, title: payload.title } }),

    getApiParameters: (apiSource) => {
      const { globalFilters } = get()
      console.log(`📅 [STORE] globalFilters for ${apiSource}:`, {
        startDate: globalFilters.startDate,
        endDate: globalFilters.endDate
      })

      const base: Record<string, any> = {
        StartDate: globalFilters.startDate,
        EndDate: globalFilters.endDate,
        PageNumber: globalFilters.pageNumber,
        PageSize: globalFilters.pageSize
      }
      switch (apiSource) {
        case 'mhpl0002':
          // Payroll expense should use only StartDate/EndDate headers
          return { StartDate: globalFilters.startDate, EndDate: globalFilters.endDate }
        case 'mhpl0003':
          // Geographic patients base params are dates; PatCat comes from endpointOverrides/defaults
          return { StartDate: globalFilters.startDate, EndDate: globalFilters.endDate }
        case 'mhpl0004':
          // Patient Spending should use only StartDate/EndDate
          return { StartDate: globalFilters.startDate, EndDate: globalFilters.endDate }
        case 'mhpl0005':
          return { ...base, ServiceTypes: globalFilters.serviceTypes.join(','), Consultants: globalFilters.consultants.join(','), Page_Number: globalFilters.pageNumber, Page_Size: globalFilters.pageSize }
        case 'mhpl0006':
          // Insurance Claims: only dates; InsuranceProviders comes from overrides
          return { StartDate: globalFilters.startDate, EndDate: globalFilters.endDate }
        case 'mhpl0007':
          // Bed Occupancy: only dates; Threshold comes from overrides
          return { StartDate: globalFilters.startDate, EndDate: globalFilters.endDate }
        case 'mhpl0009':
          return { ...base, medicine_categories: globalFilters.medicineCategories.join(','), medicine_name: globalFilters.medicineName }
        case 'mhpl0008':
          // Attendance Percentage: only dates plus paging
          return { StartDate: globalFilters.startDate, EndDate: globalFilters.endDate, PageNumber: globalFilters.pageNumber, PageSize: globalFilters.pageSize }
        case 'mhpl0010':
          return { ...base, Departments: globalFilters.departments.join(','), EmpType: globalFilters.employeeTypes.join(','), SummType: globalFilters.summaryTypes.join(',') }
        default:
          return { ...base, PatCat: globalFilters.patientCategory.join(','), Division: globalFilters.divisions.join(','), District: globalFilters.districts.join(','), SpendCat: globalFilters.spendingCategories.join(','), Dept: globalFilters.departments.join(','), EmpType: globalFilters.employeeTypes.join(',') }
      }
    },

    async triggerGlobalRefresh() {
      try {
        await ensureGlobalToken()
        const ids = ['mhpl0001','mhpl0002','mhpl0003','mhpl0004','mhpl0005','mhpl0006','mhpl0007','mhpl0008','mhpl0009','mhpl0010']
        const { endpointOverrides, getApiParameters } = get()
        set({ isRefreshing: true })
        let ok = 0, fail = 0
        await Promise.all(ids.map(async (id) => {
          try {
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('endpoint-refresh-start', { detail: { endpointId: id } }))
            const base = getApiParameters(id)
            const overrides = endpointOverrides[id] || {}
            const finalParams = { ...base, ...overrides }
            const resp = await callMHPL_API_WithValidation<any>(id, finalParams)
            if (resp.status === 'success') ok++; else fail++
          } catch (e) { fail++ } finally {
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('endpoint-refresh-complete', { detail: { endpointId: id } }))
          }
        }))
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('global-refresh-complete', { detail: { ok, fail } }))
      } finally { set({ isRefreshing: false }) }
    },
    refreshAllKPIs: async () => {
      // Single-shot UI refresh: let DashboardPage run the loader and update kpiData
      if (typeof window !== 'undefined') {
        try { window.dispatchEvent(new CustomEvent('dashboard-refresh-request', { detail: { reason: 'store-refreshAllKPIs' } })) } catch {}
      }
    },

    async triggerEndpointRefresh(endpointId: string) {
      try {
        await ensureGlobalToken()
        const { endpointOverrides, getApiParameters } = get()
        set({ isRefreshing: true })
        const base = getApiParameters(endpointId)
        const overrides = endpointOverrides[endpointId] || {}
        const finalParams = { ...base, ...overrides }
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('endpoint-refresh-start', { detail: { endpointId } }))
        const resp = await callMHPL_API_WithValidation<any>(endpointId, finalParams)
        // Store persists permanently - do NOT clear overrides after success
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('endpoint-refresh-complete', { detail: { endpointId } }))
        // Do NOT dispatch global-refresh-complete for single endpoint refreshes
        // That event should only be triggered by triggerGlobalRefresh()
      } finally { set({ isRefreshing: false }) }
    },

    setRefreshing: (refreshing) => set({ isRefreshing: refreshing }),
    setDateRange: (startDate, endDate) => {
      get().updateGlobalFilters({ startDate, endDate })
    },
    setPatientCategory: (categories) => {
      get().updateGlobalFilters({ patientCategory: categories })
    },
    setDepartments: (departments) => {
      get().updateGlobalFilters({ departments })
    },
    resetAllFilters: () => {
      const defaults = getDefaults()
      set({ globalFilters: defaults })
      if (typeof window !== 'undefined') {
        try {
          const storageKey = 'mhpl-dashboard-store'
          const stored = localStorage.getItem(storageKey)
          if (stored) {
            const parsed = JSON.parse(stored)
            if (parsed.state && parsed.state.globalFilters) {
              parsed.state.globalFilters = defaults
              localStorage.setItem(storageKey, JSON.stringify(parsed))
            }
          }
        } catch (e) {
          console.warn('Failed to reset filters in localStorage:', e)
        }
      }
    },
    updateGlobalFilters: (partial) => {
      const { updateGlobalFilter } = get()
      ;(Object.entries(partial) as [keyof GlobalFilterState, any][]).forEach(([k, v]) => {
        updateGlobalFilter(k, v)
      })
    },
    updateSettings: (partial) => {
      set((state) => {
        const nextSettings = { ...state.settings, ...partial }
        if (typeof window !== 'undefined') {
          try {
            const storageKey = 'mhpl-dashboard-store'
            const stored = localStorage.getItem(storageKey)
            if (stored) {
              const parsed = JSON.parse(stored)
              if (parsed.state && parsed.state.settings) {
                parsed.state.settings = nextSettings
                localStorage.setItem(storageKey, JSON.stringify(parsed))
              }
            }
          } catch (e) {
            console.warn('Failed to update settings in localStorage:', e)
          }
        }
        return { settings: nextSettings }
      })
    },
    setKpiData: (data) => {
      if (typeof data === 'function') {
        set((state) => ({ kpiData: (data as (prev: any[]) => any[])(state.kpiData) }))
      } else {
        set({ kpiData: data })
      }
    },
    setUpdatingKpiIds: (ids) => set({ updatingKpiIds: ids instanceof Set ? ids : new Set(ids) }),
    setError: (msg) => set({ error: msg }),
    initializeAutoPlay: () => { /* hook available for layout */ },
  }), {
    name: 'mhpl-dashboard-store',
    partialize: (state) => ({
      globalFilters: state.globalFilters,
      settings: state.settings,
      showGlobalFilters: state.showGlobalFilters,
      apiControlState: state.apiControlState,
      endpointOverrides: state.endpointOverrides
    })
  }
))

