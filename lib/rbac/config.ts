// RBAC Configuration Settings

// Runtime override store for dev/prod mode switching
const RUNTIME_OVERRIDES = {
  devModeOverride: null as boolean | null, // null = use default, true = force dev, false = force prod
  lastChanged: null as string | null,
  changedBy: null as string | null
}

// Load runtime overrides from localStorage (client-side only)
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('mhpl-rbac-runtime-overrides')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      RUNTIME_OVERRIDES.devModeOverride = parsed.devModeOverride
      RUNTIME_OVERRIDES.lastChanged = parsed.lastChanged
      RUNTIME_OVERRIDES.changedBy = parsed.changedBy
    } catch (error) {
      console.error('Failed to load RBAC runtime overrides:', error)
    }
  }
}

export const RBAC_CONFIG = {
  // Development mode settings (with runtime override support)
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  
  // Feature flags for gradual rollout
  ENABLE_CLERK_AUTH: process.env.NEXT_PUBLIC_ENABLE_CLERK_AUTH === 'true' || process.env.NODE_ENV === 'production',
  ENABLE_PERMISSION_GATES: process.env.NEXT_PUBLIC_ENABLE_PERMISSION_GATES === 'true' || process.env.NODE_ENV === 'production',
  
  // Dynamic dev mode - can be overridden at runtime by admins
  get DEV_GRANT_ALL_PERMISSIONS() {
    if (RUNTIME_OVERRIDES.devModeOverride !== null) {
      return RUNTIME_OVERRIDES.devModeOverride
    }
    return process.env.NODE_ENV === 'development'
  },
  
  // Logging settings
  ENABLE_RBAC_LOGGING: process.env.NODE_ENV === 'development',
  
  // Default admin role for first user
  DEFAULT_ADMIN_EMAIL: process.env.NEXT_PUBLIC_DEFAULT_ADMIN_EMAIL || 'ultrotech1236@gmail.com',
  
  // Emergency access settings
  ENABLE_EMERGENCY_ACCESS: process.env.NEXT_PUBLIC_ENABLE_EMERGENCY_ACCESS === 'true',

  // NEW: Zero-trust security controls (additive - don't break existing)
  ENABLE_ZERO_TRUST: process.env.NEXT_PUBLIC_ENABLE_ZERO_TRUST === 'true',
  USE_NEW_USER_API: process.env.NEXT_PUBLIC_USE_NEW_USER_API === 'true',
  USE_PERMISSION_GUARDS: process.env.NEXT_PUBLIC_USE_PERMISSION_GUARDS === 'true',
  ENABLE_ADMIN_BOOTSTRAP: process.env.NEXT_PUBLIC_ENABLE_ADMIN_BOOTSTRAP === 'true' || process.env.NODE_ENV === 'development',
  
  // Admin email for auto-assignment
  ADMIN_BOOTSTRAP_EMAIL: process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'ultrotech1236@gmail.com'
}

export function logRBAC(message: string, data?: any) {
  if (RBAC_CONFIG.ENABLE_RBAC_LOGGING) {
    console.log(`🔐 RBAC: ${message}`, data || '')
  }
}

// Runtime RBAC mode management functions
export function setRBACDevMode(enabled: boolean, changedBy: string) {
  RUNTIME_OVERRIDES.devModeOverride = enabled
  RUNTIME_OVERRIDES.lastChanged = new Date().toISOString()
  RUNTIME_OVERRIDES.changedBy = changedBy
  
  // Save to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('mhpl-rbac-runtime-overrides', JSON.stringify(RUNTIME_OVERRIDES))
  }
  
  logRBAC(`Runtime mode changed to ${enabled ? 'DEVELOPMENT' : 'PRODUCTION'}`, {
    changedBy,
    timestamp: RUNTIME_OVERRIDES.lastChanged
  })
}

export function resetRBACToDefault() {
  RUNTIME_OVERRIDES.devModeOverride = null
  RUNTIME_OVERRIDES.lastChanged = new Date().toISOString()
  RUNTIME_OVERRIDES.changedBy = 'system'
  
  // Save to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('mhpl-rbac-runtime-overrides', JSON.stringify(RUNTIME_OVERRIDES))
  }
  
  logRBAC('Runtime mode reset to default (follows NODE_ENV)')
}

export function getRBACModeInfo() {
  const isDevMode = RBAC_CONFIG.DEV_GRANT_ALL_PERMISSIONS
  const isOverridden = RUNTIME_OVERRIDES.devModeOverride !== null
  const defaultMode = process.env.NODE_ENV === 'development' ? 'DEVELOPMENT' : 'PRODUCTION'
  const currentMode = isDevMode ? 'DEVELOPMENT' : 'PRODUCTION'
  
  return {
    currentMode,
    defaultMode,
    isOverridden,
    isDevMode,
    lastChanged: RUNTIME_OVERRIDES.lastChanged,
    changedBy: RUNTIME_OVERRIDES.changedBy
  }
}