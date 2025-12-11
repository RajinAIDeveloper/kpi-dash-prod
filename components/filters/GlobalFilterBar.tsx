"use client"

import React, { useEffect, useState } from 'react'
import { useFilterState } from './FilterStateProvider'
import { useDashboardStore } from '@/lib/store/dashboard-store'

export default function GlobalFilterBar({ className = '' }: { className?: string }) {
  const zustandStore = useDashboardStore()
  const globalFilters = zustandStore.globalFilters
  const { commitChanges } = useFilterState()
  const { showGlobalFilters, demoMode, setDemoMode } = useDashboardStore()

  const [pendingStartDate, setPendingStartDate] = useState('')
  const [pendingEndDate, setPendingEndDate] = useState('')
  const [savingDates, setSavingDates] = useState(false)

  useEffect(() => {
    setPendingStartDate(globalFilters.startDate ?? '')
    setPendingEndDate(globalFilters.endDate ?? '')
  }, [globalFilters.startDate, globalFilters.endDate])

  const applyDateUpdates = async () => {
    if (!pendingStartDate || !pendingEndDate) return
    setSavingDates(true)
    try {
      useDashboardStore.getState().updateGlobalFilter('startDate', pendingStartDate)
      useDashboardStore.getState().updateGlobalFilter('endDate', pendingEndDate)
      // Trigger a single dashboard refresh event immediately (no loops)
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('dashboard-refresh-request', { detail: { reason: 'global-filters-changed' } }))
        }
      } catch {}
      // Save presets to database in background (do not block UI refresh)
      commitChanges().catch(() => {})
    } finally {
      setSavingDates(false)
    }
  }

  if (!showGlobalFilters) return null

  return (
    <div className={`w-full border-b border-gray-200 bg-gray-50 ${className}`}>
      <div className="container mx-auto px-4 py-3 flex items-center gap-3">
        <div className="text-sm font-medium text-gray-700">Global Filters</div>
        <input title='Pending Start Date' type="date" value={pendingStartDate} onChange={(e)=>setPendingStartDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
        <span className="text-gray-500 text-sm">to</span>
        <input title='pending End Date' type="date" value={pendingEndDate} onChange={(e)=>setPendingEndDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
        <button onClick={applyDateUpdates} disabled={!pendingStartDate || !pendingEndDate || savingDates} className="ml-2 px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-50">
          {savingDates ? 'Updating...' : 'Update'}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button className={`text-xs px-2 py-1 rounded ${demoMode ? 'bg-blue-100 text-blue-700' : ''}`} onClick={() => setDemoMode(true)}>Demo</button>
          <button className={`text-xs px-2 py-1 rounded ${!demoMode ? 'bg-green-100 text-green-700' : ''}`} onClick={() => setDemoMode(false)}>Live</button>
        </div>
      </div>
    </div>
  )
}
