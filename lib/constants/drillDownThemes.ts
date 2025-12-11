/**
 * Drill-Down Modal Theme System
 *
 * Defines consistent color themes for all drill-down modals.
 * Each theme has a primary and accent color for gradients and highlights.
 */

export const DRILL_DOWN_THEMES = {
  patient: {
    primary: 'blue',
    accent: 'cyan',
    gradient: 'from-blue-600 to-blue-700',
    lightBg: 'bg-blue-50',
    mediumBg: 'bg-blue-100',
    darkBg: 'bg-blue-600',
    text: 'text-blue-600',
    border: 'border-blue-200',
  },
  financial: {
    primary: 'emerald',
    accent: 'green',
    gradient: 'from-emerald-600 to-emerald-700',
    lightBg: 'bg-emerald-50',
    mediumBg: 'bg-emerald-100',
    darkBg: 'bg-emerald-600',
    text: 'text-emerald-600',
    border: 'border-emerald-200',
  },
  operational: {
    primary: 'orange',
    accent: 'amber',
    gradient: 'from-orange-600 to-orange-700',
    lightBg: 'bg-orange-50',
    mediumBg: 'bg-orange-100',
    darkBg: 'bg-orange-600',
    text: 'text-orange-600',
    border: 'border-orange-200',
  },
  performance: {
    primary: 'purple',
    accent: 'pink',
    gradient: 'from-purple-600 to-purple-700',
    lightBg: 'bg-purple-50',
    mediumBg: 'bg-purple-100',
    darkBg: 'bg-purple-600',
    text: 'text-purple-600',
    border: 'border-purple-200',
  },
} as const

/**
 * Maps each MHPL endpoint to its theme category
 */
export const MODAL_THEMES = {
  mhpl0001: 'patient',      // Patient Revisit Analysis
  mhpl0002: 'financial',    // Payroll Breakdown
  mhpl0003: 'patient',      // Geographic Patient Distribution
  mhpl0004: 'financial',    // Patient Spending Analysis
  mhpl0005: 'financial',    // Consultant Revenue Analysis
  mhpl0006: 'financial',    // Insurance Claims Analysis
  mhpl0007: 'operational',  // Bed Occupancy Analysis
  mhpl0008: 'operational',  // Employee Performance Analysis
  mhpl0009: 'financial',    // Medicine Waste Analysis
  mhpl0010: 'financial',    // Employee Salary Analysis
} as const

/**
 * Type definitions for TypeScript
 */
export type ThemeType = keyof typeof DRILL_DOWN_THEMES
export type EndpointId = keyof typeof MODAL_THEMES
export type ThemeConfig = typeof DRILL_DOWN_THEMES[ThemeType]

/**
 * Helper function to get theme for a specific endpoint
 *
 * @param endpointId - The MHPL endpoint ID (e.g., 'mhpl0001')
 * @returns Theme configuration object
 *
 * @example
 * const theme = getThemeForEndpoint('mhpl0001')
 * // Returns: { primary: 'blue', accent: 'cyan', gradient: 'from-blue-600 to-blue-700', ... }
 */
export function getThemeForEndpoint(endpointId: string): ThemeConfig {
  const normalizedId = endpointId.toLowerCase() as EndpointId
  const themeType = MODAL_THEMES[normalizedId] || 'financial' // Default to financial
  return DRILL_DOWN_THEMES[themeType]
}

/**
 * Helper function to get gradient classes for a theme
 *
 * @param themeType - The theme type ('patient', 'financial', 'operational', 'performance')
 * @returns Tailwind gradient class string
 *
 * @example
 * const gradient = getGradientClasses('patient')
 * // Returns: 'from-blue-600 to-blue-700'
 */
export function getGradientClasses(themeType: ThemeType): string {
  return DRILL_DOWN_THEMES[themeType].gradient
}

/**
 * Helper function to get all theme classes for a specific endpoint
 *
 * @param endpointId - The MHPL endpoint ID
 * @returns Complete theme configuration
 *
 * @example
 * const theme = getEndpointThemeClasses('mhpl0001')
 * // Can use: theme.gradient, theme.text, theme.lightBg, etc.
 */
export function getEndpointThemeClasses(endpointId: string): ThemeConfig {
  return getThemeForEndpoint(endpointId)
}
