'use client'

import { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction } from 'react'
import { useDashboardStore } from '@/lib/store/dashboard-store'
import toast from 'react-hot-toast'

export type FilterMode = 'local' | 'global'

export interface GlobalFilters {
  startDate?: string
  endDate?: string
}

export interface FilterState {
  // Filter mode
  mode: FilterMode
  setMode: (mode: FilterMode) => void

  // Global filters
  globalFilters: GlobalFilters
  setGlobalFilters: Dispatch<SetStateAction<GlobalFilters>>
  updateGlobalFilter: (key: keyof GlobalFilters, value: string) => void
  removeGlobalFilter: (key: keyof GlobalFilters) => void
  clearGlobalFilters: () => void

  // Local filters per endpoint
  localFilters: Record<string, Record<string, any>>
  setLocalFilters: (endpointId: string, filters: Record<string, any>) => void
  updateLocalFilter: (endpointId: string, key: string, value: string) => void
  removeLocalFilter: (endpointId: string, key: string) => void
  clearLocalFilters: (endpointId?: string) => void

  // Merged filters for API calls
  getMergedFilters: (endpointId: string) => Record<string, any>

  // Active filters display
  getActiveGlobalFilters: () => Array<{ key: keyof GlobalFilters; label: string; value: string }>
  getActiveLocalFilters: (endpointId: string) => Array<{ key: string; label: string; value: string }>

  // Database operations
  commitChanges: () => Promise<void>

  // Load state
  hasLoadedPreset: boolean
}

const FilterStateContext = createContext<FilterState | null>(null)

const GLOBAL_FILTER_LABELS = {
  startDate: 'StartDate',
  endDate: 'EndDate'
} as const

// No default filters - Users must set dates explicitly via UI
// This ensures database is the single source of truth

interface FilterStateProviderProps {
  children: ReactNode
}

export function FilterStateProvider({ children }: FilterStateProviderProps) {
  const [mode, setMode] = useState<FilterMode>('global') // Default to global mode
  const [globalFilters, setGlobalFilters] = useState<GlobalFilters>({}) // Empty until loaded from database
  const [localFilters, setLocalFiltersState] = useState<Record<string, Record<string, any>>>({})
  const [hasLoadedPreset, setHasLoadedPreset] = useState(false)

  // Load saved filter preferences from NeonDB database
  useEffect(() => {
    const loadFilterPresetsFromDatabase = async () => {
      try {
        console.log('🔍 [FILTER_DB] Loading global filter presets from database...')
        const response = await fetch('/api/user/filter-presets')

        if (!response.ok) {
          console.log('⚠️ [FILTER_DB] No preset found - user must set dates via UI')
          setGlobalFilters({}) // Empty filters to trigger user prompt on homepage
          setHasLoadedPreset(true)
          return
        }

        const result = await response.json()

        if (result.hasPreset && result.preset) {
          console.log('✅ [FILTER_DB] Loaded preset from database:', result.preset)

          // CRITICAL: Immediately put database dates into Zustand (single source of truth!)
          console.log('🔄 [FILTER_DB] Updating Zustand store with database dates...')
          useDashboardStore.getState().updateGlobalFilter('startDate', result.preset.startDate)
          useDashboardStore.getState().updateGlobalFilter('endDate', result.preset.endDate)
          console.log('✅ [FILTER_DB] Zustand store updated - this is now the source of truth')

          // Also update FilterStateProvider for backward compatibility (but Zustand is primary)
          const loadedFilters = {
            startDate: result.preset.startDate,
            endDate: result.preset.endDate
          }
          setGlobalFilters(loadedFilters)
        } else {
          console.log('ℹ️ [FILTER_DB] No preset found - using Zustand defaults')

          // No database preset - Zustand already has defaults, just sync FilterStateProvider
          const zustandDates = useDashboardStore.getState().globalFilters
          if (zustandDates.startDate && zustandDates.endDate) {
            console.log('📅 [FILTER_DB] Using Zustand default dates:', zustandDates)
            setGlobalFilters({
              startDate: zustandDates.startDate,
              endDate: zustandDates.endDate
            })
          } else {
            setGlobalFilters({}) // Empty filters to trigger user prompt on homepage
          }
        }

        setHasLoadedPreset(true)
      } catch (error) {
        console.error('❌ [FILTER_DB] Error loading filter presets:', error)
        setGlobalFilters({}) // Empty filters to trigger user prompt on homepage
        setHasLoadedPreset(true)
      }
    }

    loadFilterPresetsFromDatabase()
  }, [])

  // Save filter preferences to NeonDB database when they change
  useEffect(() => {
    // Skip saving during initial load
    if (!hasLoadedPreset) return

    const saveFilterPresetsToDatabase = async () => {
      try {
        // Only save if we have valid dates
        if (!globalFilters.startDate || !globalFilters.endDate) {
          console.log('⚠️ [FILTER_DB] Skipping save - incomplete filters')
          return
        }

        console.log('💾 [FILTER_DB] Saving global filter presets to database...', globalFilters)

        const response = await fetch('/api/user/filter-presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: globalFilters.startDate,
            endDate: globalFilters.endDate
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('❌ [FILTER_DB] API error response:', { status: response.status, statusText: response.statusText, body: errorText })
          throw new Error(`Failed to save filter presets: ${response.status} ${response.statusText}`)
        }

        const result = await response.json()
        console.log('✅ [FILTER_DB] Filter presets saved to database')
        toast.success('Global filters updated in database')
      } catch (error) {
        console.error('❌ [FILTER_DB] Error saving filter presets:', error)
        toast.error('Failed to save global filters')
      }
    }

    // Debounce the save to avoid too many database calls
    const timeoutId = setTimeout(saveFilterPresetsToDatabase, 1000)
    return () => clearTimeout(timeoutId)
  }, [globalFilters, hasLoadedPreset])

  const updateGlobalFilter = (key: keyof GlobalFilters, value: string) => {
    console.log(`🔧 [FILTER_PROVIDER] updateGlobalFilter called:`, { key, value })
    setGlobalFilters(prev => {
      const updated = {
        ...prev,
        [key]: value
      }
      console.log(`🔧 [FILTER_PROVIDER] New globalFilters state:`, updated)
      return updated
    })
  }

  const removeGlobalFilter = (key: keyof GlobalFilters) => {
    setGlobalFilters(prev => {
      const newFilters = { ...prev }
      delete newFilters[key]
      return newFilters
    })
  }

  const clearGlobalFilters = () => {
    setGlobalFilters({})
  }

  const setLocalFilters = (endpointId: string, filters: Record<string, any>) => {
    setLocalFiltersState(prev => ({
      ...prev,
      [endpointId]: filters
    }))
  }

  const updateLocalFilter = (endpointId: string, key: string, value: string) => {
    setLocalFiltersState(prev => ({
      ...prev,
      [endpointId]: {
        ...prev[endpointId],
        [key]: value
      }
    }))

    // Propagate to KPI refresh pipeline: stage override and refresh this endpoint
    try {
      const { setEndpointOverride, triggerEndpointRefresh } = useDashboardStore.getState()
      // Stage the local change as an override for API params
      setEndpointOverride?.(endpointId, key, String(value))
      // Kick off a live refresh for this endpoint
      triggerEndpointRefresh?.(endpointId)
    } catch (e) {
      console.warn('[FILTER_PROVIDER] Failed to trigger endpoint refresh for local filter change:', e)
    }
  }

  const removeLocalFilter = (endpointId: string, key: string) => {
    setLocalFiltersState(prev => {
      const newFilters = { ...prev }
      if (newFilters[endpointId]) {
        const endpointFilters = { ...newFilters[endpointId] }
        delete endpointFilters[key]
        newFilters[endpointId] = endpointFilters
      }
      return newFilters
    })

    // Also clear any staged override for this key and refresh
    try {
      const { endpointOverrides, clearEndpointOverrides, triggerEndpointRefresh, setEndpointOverride } = useDashboardStore.getState() as any
      if (endpointOverrides?.[endpointId]?.[key] !== undefined) {
        // Remove just this key while keeping others
        setEndpointOverride?.(endpointId, key, '')
      }
      triggerEndpointRefresh?.(endpointId)
    } catch (e) {
      console.warn('[FILTER_PROVIDER] Failed to refresh after removing local filter:', e)
    }
  }

  const clearLocalFilters = (endpointId?: string) => {
    if (endpointId) {
      setLocalFiltersState(prev => ({
        ...prev,
        [endpointId]: {}
      }))
      try {
        const { clearEndpointOverrides, triggerEndpointRefresh } = useDashboardStore.getState()
        clearEndpointOverrides?.(endpointId)
        triggerEndpointRefresh?.(endpointId)
      } catch {}
    } else {
      setLocalFiltersState({})
      try {
        const { clearEndpointOverrides } = useDashboardStore.getState()
        clearEndpointOverrides?.()
      } catch {}
    }
  }

  const getMergedFilters = (endpointId: string): Record<string, any> => {
    const localEndpointFilters = localFilters[endpointId] || {}

    // Always combine global + local filters, local takes precedence
    // This applies in BOTH global and local modes
    const baseFilters = { ...globalFilters }

    // Smart parameter mapping with endpoint-specific handling
    const mappedGlobalFilters = mapGlobalToEndpointParams(endpointId, baseFilters)

    // Combine global and local filters: local parameters override global
    const mergedFilters = {
      ...mappedGlobalFilters,
      ...localEndpointFilters
    }

    // Validate and clean the final parameter set
    return validateAndCleanParams(endpointId, mergedFilters)
  }

  // Smart parameter mapping for different endpoints
  const mapGlobalToEndpointParams = (endpointId: string, globalParams: GlobalFilters): Record<string, any> => {
    const mapped: Record<string, any> = {}

    // Only map the global filters that exist (dates)
    if (globalParams.startDate) mapped.StartDate = globalParams.startDate
    if (globalParams.endDate) mapped.EndDate = globalParams.endDate

    return mapped
  }

  // Parameter validation and cleanup
  const validateAndCleanParams = (endpointId: string, params: Record<string, any>): Record<string, any> => {
    const cleaned: Record<string, any> = {}

    // Only include non-empty parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        // Validate date format for date parameters
        if (key.includes('Date') && typeof value === 'string') {
          if (isValidDate(value)) {
            cleaned[key] = value
          } else {
            console.warn(`⚠️ Invalid date format for ${key}: ${value}. Skipping.`)
          }
        }
        // Validate numeric parameters
        else if ((key.includes('Size') || key.includes('Number') || key === 'Threshold') && typeof value === 'string') {
          const numValue = parseInt(value, 10)
          if (!isNaN(numValue) && numValue > 0) {
            cleaned[key] = value
          } else {
            console.warn(`⚠️ Invalid numeric value for ${key}: ${value}. Skipping.`)
          }
        }
        // Include all other valid parameters
        else {
          cleaned[key] = value.toString().trim()
        }
      }
    })

    return cleaned
  }

  // Date validation helper
  const isValidDate = (dateString: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false
    const date = new Date(dateString)
    return date instanceof Date && !isNaN(date.getTime()) && dateString === date.toISOString().split('T')[0]
  }

  const getActiveGlobalFilters = (): Array<{ key: keyof GlobalFilters; label: string; value: string }> => {
    return Object.entries(globalFilters)
      .filter(([_, value]) => value && value.trim() !== '')
      .map(([key, value]) => ({
        key: key as keyof GlobalFilters,
        label: GLOBAL_FILTER_LABELS[key as keyof GlobalFilters],
        value: value as string
      }))
  }

  const getActiveLocalFilters = (endpointId: string): Array<{ key: string; label: string; value: string }> => {
    const endpointFilters = localFilters[endpointId] || {}
    return Object.entries(endpointFilters)
      .filter(([_, value]) => value && value.toString().trim() !== '')
      .map(([key, value]) => ({
        key,
        label: key, // Use key as label for now
        value: value.toString()
      }))
  }

  // Immediate database commit (awaitable) - used for explicit save before refresh
  const commitChanges = async (): Promise<void> => {
    try {
      // Only save if we have valid dates
      if (!globalFilters.startDate || !globalFilters.endDate) {
        console.log('⚠️ [FILTER_DB] commitChanges: Skipping save - incomplete filters')
        return
      }

      console.log('💾 [FILTER_DB] commitChanges: Saving global filter presets to database...', globalFilters)

      const response = await fetch('/api/user/filter-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: globalFilters.startDate,
          endDate: globalFilters.endDate
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ [FILTER_DB] API error response:', { status: response.status, statusText: response.statusText, body: errorText })
        throw new Error(`Failed to save filter presets: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const result = await response.json()
      console.log('✅ [FILTER_DB] commitChanges: Filter presets saved to database')
      // Don't show toast - user already knows they clicked Update
    } catch (error) {
      console.error('❌ [FILTER_DB] commitChanges: Error saving filter presets:', error)
      // Don't show error toast - parent will handle it by continuing anyway
      throw error // Re-throw so caller knows it failed
    }
  }

  const value: FilterState = {
    mode,
    setMode,
    globalFilters,
    setGlobalFilters,
    updateGlobalFilter,
    removeGlobalFilter,
    clearGlobalFilters,
    localFilters,
    setLocalFilters,
    updateLocalFilter,
    removeLocalFilter,
    clearLocalFilters,
    getMergedFilters,
    getActiveGlobalFilters,
    getActiveLocalFilters,
    commitChanges,
    hasLoadedPreset
  }

  return (
    <FilterStateContext.Provider value={value}>
      {children}
    </FilterStateContext.Provider>
  )
}

export function useFilterState(): FilterState {
  const context = useContext(FilterStateContext)
  if (!context) {
    throw new Error('useFilterState must be used within a FilterStateProvider')
  }
  return context
}
