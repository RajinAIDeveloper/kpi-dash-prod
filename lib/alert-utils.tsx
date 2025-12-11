// lib/alert-utils.ts

import { Alert } from './types'
import { mockAlerts, mockAlerts2, mockAlertsAdmin, mockAlertsPharmacy } from './mock-data'

export type AlertSeverity = 'none' | 'info' | 'warning' | 'error'
export type KPIAlertMapping = {
  severity: AlertSeverity
  alerts: Alert[]
  borderColor: string
  badgeColor: string
  iconColor: string
}

// Map API sources to alert collections
const alertSourceMap = {
  'dashboard': mockAlerts,
  'ipdservice': mockAlerts2,
  'opdservice': [],
  'adminservice': mockAlertsAdmin,
  'pharmacy': mockAlertsPharmacy
}

// Map KPI API sources to alert collections
const kpiToAlertsMap: Record<string, string[]> = {
  'mhpl0001': ['dashboard', 'ipdservice'], // Patient data
  'mhpl0002': ['adminservice'], // Payroll data
  'mhpl0003': ['dashboard'], // Demographics
  'mhpl0004': ['dashboard'], // Patient spending
  'mhpl0005': ['dashboard'], // Revenue by consultant
  'mhpl0006': ['dashboard'], // Insurance
  'mhpl0007': ['dashboard', 'ipdservice'], // Bed occupancy
  'mhpl0008': ['adminservice'], // Employee attendance
  'mhpl0009': ['pharmacy'], // Medicine waste
  'mhpl0010': ['adminservice'] // Employee data
}

// Get alerts for specific KPI
export function getAlertsForKPI(apiSource: string, activeTab: string = 'dashboard'): Alert[] {
  const relevantTabs = kpiToAlertsMap[apiSource] || []
  
  if (!relevantTabs.includes(activeTab)) {
    return []
  }

  const tabAlerts = alertSourceMap[activeTab as keyof typeof alertSourceMap] || []
  return tabAlerts.filter(alert => alert.source === apiSource)
}

// Get alert severity for KPI
export function getKPIAlertMapping(apiSource: string, activeTab: string = 'dashboard'): KPIAlertMapping {
  const alerts = getAlertsForKPI(apiSource, activeTab)
  
  if (alerts.length === 0) {
    return {
      severity: 'none',
      alerts: [],
      borderColor: 'border-blue-500',
      badgeColor: 'bg-blue-100 text-blue-800',
      iconColor: 'text-blue-600'
    }
  }

  // Determine highest severity
  const hasError = alerts.some(alert => alert.type === 'error')
  const hasWarning = alerts.some(alert => alert.type === 'warning')
  const hasInfo = alerts.some(alert => alert.type === 'info')

  if (hasError) {
    return {
      severity: 'error',
      alerts,
      borderColor: 'border-red-500',
      badgeColor: 'bg-red-100 text-red-800',
      iconColor: 'text-red-600'
    }
  }

  if (hasWarning) {
    return {
      severity: 'warning',
      alerts,
      borderColor: 'border-orange-500', 
      badgeColor: 'bg-orange-100 text-orange-800',
      iconColor: 'text-orange-600'
    }
  }

  if (hasInfo) {
    return {
      severity: 'info',
      alerts,
      borderColor: 'border-blue-500',
      badgeColor: 'bg-blue-100 text-blue-800', 
      iconColor: 'text-blue-600'
    }
  }

  return {
    severity: 'none',
    alerts: [],
    borderColor: 'border-gray-300',
    badgeColor: 'bg-gray-100 text-gray-800',
    iconColor: 'text-gray-600'
  }
}

// Get alert counts by tab
export function getAlertCountsByTab(): Record<string, number> {
  return {
    dashboard: mockAlerts.length,
    ipdservice: mockAlerts2.length,
    opdservice: 0,
    adminservice: mockAlertsAdmin.length,
    pharmacy: mockAlertsPharmacy.length
  }
}

// Get total alert count across all tabs
export function getTotalAlertCount(): number {
  const counts = getAlertCountsByTab()
  return Object.values(counts).reduce((sum, count) => sum + count, 0)
}

// Smart notification tracking (Requirement #8)
const shownAlertTracking = new Set<string>()

// Generate alert summary message for toast with smart tracking
export function generateAlertSummary(activeTab: string): string {
  const alerts = alertSourceMap[activeTab as keyof typeof alertSourceMap] || []
  const errorCount = alerts.filter(a => a.type === 'error').length
  const warningCount = alerts.filter(a => a.type === 'warning').length
  const infoCount = alerts.filter(a => a.type === 'info').length

  if (alerts.length === 0) {
    return 'No active alerts for this section'
  }

  // Track alert fingerprint to prevent spam
  const alertFingerprint = `${activeTab}-${errorCount}-${warningCount}-${infoCount}`
  if (shownAlertTracking.has(alertFingerprint)) {
    return 'No active alerts for this section' // Already shown, don't repeat
  }
  shownAlertTracking.add(alertFingerprint)

  const parts: string[] = []
  if (errorCount > 0) parts.push(`${errorCount} critical`)
  if (warningCount > 0) parts.push(`${warningCount} warning`)
  if (infoCount > 0) parts.push(`${infoCount} info`)

  return `${alerts.length} alert${alerts.length === 1 ? '' : 's'}: ${parts.join(', ')}`
}

// Clear alert tracking (for testing or manual reset)
export function clearAlertTracking(): void {
  shownAlertTracking.clear()
}

// Simulate alert resolution (for demo purposes)
export function resolveAlert(alertId: string): void {
  // In a real app, this would call an API to resolve the alert
  console.log(`Alert ${alertId} resolved`)
}

// Get color classes for alert severity
export function getAlertColors(severity: AlertSeverity) {
  switch (severity) {
    case 'error':
      return {
        border: 'border-red-500',
        bg: 'bg-red-50',
        text: 'text-red-700',
        icon: 'text-red-500',
        badge: 'bg-red-100 text-red-800'
      }
    case 'warning':
      return {
        border: 'border-orange-500',
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        icon: 'text-orange-500',
        badge: 'bg-orange-100 text-orange-800'
      }
    case 'info':
      return {
        border: 'border-blue-500',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        icon: 'text-blue-500',
        badge: 'bg-blue-100 text-blue-800'
      }
    default:
      return {
        border: 'border-gray-300',
        bg: 'bg-gray-50',
        text: 'text-gray-700',
        icon: 'text-gray-500',
        badge: 'bg-gray-100 text-gray-800'
      }
  }
}