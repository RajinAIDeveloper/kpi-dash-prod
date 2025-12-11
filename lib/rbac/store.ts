// lib/rbac/store.ts
// Role-Based Access Control Store with Clerk Integration

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  Permission,
  RolePermission,
  Role,
  UserRoleAssignment,
  UserDefaults,
  RBACState,
  Dashboard,
  DASHBOARDS,
  DASHBOARD_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ROLES
} from './types'

interface RBACStore extends RBACState {
  // Store management
  isInitialized: boolean
  
  // Permission management
  addPermission: (permission: Omit<Permission, 'id'>) => string
  updatePermission: (id: string, updates: Partial<Permission>) => void
  removePermission: (id: string) => void
  
  // Role Permission management
  addRolePermission: (rolePermission: Omit<RolePermission, 'id'>) => string
  updateRolePermission: (id: string, updates: Partial<RolePermission>) => void
  removeRolePermission: (id: string) => void
  
  // Role management
  addRole: (role: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateRole: (id: string, updates: Partial<Omit<Role, 'id' | 'createdAt'>>) => void
  removeRole: (id: string) => void
  
  // User assignment management
  assignRolesToUser: (userId: string, roleIds: string[], assignedBy: string) => void
  removeRolesFromUser: (userId: string, roleIds?: string[]) => void
  
  // Permission checking
  userHasPermission: (userId: string, permissionId: string) => boolean
  userHasApiAccess: (userId: string, apiEndpoint: string) => boolean
  userHasDashboardAccess: (userId: string, dashboardId: string) => boolean
  userHasComponentAccess: (userId: string, componentId: string) => boolean
  getCurrentUserPermissions: () => string[]

  // Dashboard and component visibility
  getUserVisibleDashboards: (userId: string) => Dashboard[]
  getUserVisibleComponents: (userId: string, dashboardId: string) => string[]

  // User defaults management
  getUserDefaults: (userId: string) => UserDefaults | null
  updateUserDefaults: (userId: string, defaults: Partial<UserDefaults>) => void
  setUserDashboardDefaults: (userId: string, dashboardId: string, defaults: Record<string, any>) => void
  setUserKPIDefaults: (userId: string, kpiId: string, defaults: Record<string, any>) => void
  resetUserDefaultsToRoleDefaults: (userId: string) => void
  exportUserDefaults: (userId: string) => UserDefaults | null
  
  // Utility functions
  initializeDefaults: () => void
  resetToDefaults: () => void
  exportRBACConfig: () => string
  importRBACConfig: (config: string) => boolean
  
  // Clerk integration helpers
  setCurrentUserPermissions: (permissions: string[]) => void
}

// Generate unique IDs
const generateId = (prefix: string = '') => {
  const timestamp = Date.now().toString(36)
  const randomStr = Math.random().toString(36).substring(2, 8)
  return `${prefix}${prefix ? '_' : ''}${timestamp}_${randomStr}`
}

export const useRBACStore = create<RBACStore>()(
  persist(
    (set, get) => ({
      // Initial state
      dashboards: [],
      permissions: [],
      rolePermissions: [],
      roles: [],
      userAssignments: [],
      userDefaults: [],
      currentUserPermissions: [],
      dashboardVisibility: {},
      componentVisibility: {},
      isInitialized: false,
      
      // Permission management
      addPermission: (permission) => {
        const id = generateId('perm')
        const newPermission: Permission = {
          ...permission,
          id
        }
        
        set((state) => ({
          permissions: [...state.permissions, newPermission]
        }))
        
        return id
      },
      
      updatePermission: (id, updates) => {
        set((state) => ({
          permissions: state.permissions.map(p => 
            p.id === id ? { ...p, ...updates } : p
          )
        }))
      },
      
      removePermission: (id) => {
        set((state) => ({
          permissions: state.permissions.filter(p => p.id !== id),
          // Also remove from role permissions
          rolePermissions: state.rolePermissions.map(rp => ({
            ...rp,
            permissions: rp.permissions.filter(pId => pId !== id)
          }))
        }))
      },
      
      // Role Permission management
      addRolePermission: (rolePermission) => {
        const id = generateId('roleperm')
        const newRolePermission: RolePermission = {
          ...rolePermission,
          id
        }
        
        set((state) => ({
          rolePermissions: [...state.rolePermissions, newRolePermission]
        }))
        
        return id
      },
      
      updateRolePermission: (id, updates) => {
        set((state) => ({
          rolePermissions: state.rolePermissions.map(rp => 
            rp.id === id ? { ...rp, ...updates } : rp
          )
        }))
      },
      
      removeRolePermission: (id) => {
        set((state) => ({
          rolePermissions: state.rolePermissions.filter(rp => rp.id !== id),
          // Also remove from roles
          roles: state.roles.map(r => ({
            ...r,
            rolePermissions: r.rolePermissions.filter(rpId => rpId !== id)
          }))
        }))
      },
      
      // Role management
      addRole: (role) => {
        const id = generateId('role')
        const now = new Date().toISOString()
        const newRole: Role = {
          ...role,
          id,
          createdAt: now,
          updatedAt: now
        }
        
        set((state) => ({
          roles: [...state.roles, newRole]
        }))
        
        return id
      },
      
      updateRole: (id, updates) => {
        const now = new Date().toISOString()
        set((state) => ({
          roles: state.roles.map(r => 
            r.id === id ? { ...r, ...updates, updatedAt: now } : r
          )
        }))
      },
      
      removeRole: (id) => {
        set((state) => ({
          roles: state.roles.filter(r => r.id !== id),
          // Also remove user assignments
          userAssignments: state.userAssignments.map(ua => ({
            ...ua,
            roleIds: ua.roleIds.filter(rId => rId !== id)
          })).filter(ua => ua.roleIds.length > 0) // Remove empty assignments
        }))
      },
      
      // User assignment management
      assignRolesToUser: (userId, roleIds, assignedBy) => {
        const now = new Date().toISOString()
        
        set((state) => {
          // Remove existing assignment for this user
          const otherAssignments = state.userAssignments.filter(ua => ua.userId !== userId)
          
          // Create new assignment
          const newAssignment: UserRoleAssignment = {
            userId,
            roleIds,
            assignedAt: now,
            assignedBy
          }
          
          return {
            userAssignments: [...otherAssignments, newAssignment]
          }
        })
      },
      
      removeRolesFromUser: (userId, roleIds) => {
        set((state) => {
          if (!roleIds) {
            // Remove all roles from user
            return {
              userAssignments: state.userAssignments.filter(ua => ua.userId !== userId)
            }
          } else {
            // Remove specific roles from user
            return {
              userAssignments: state.userAssignments.map(ua => 
                ua.userId === userId 
                  ? { ...ua, roleIds: ua.roleIds.filter(rId => !roleIds.includes(rId)) }
                  : ua
              ).filter(ua => ua.roleIds.length > 0) // Remove empty assignments
            }
          }
        })
      },
      
      // Permission checking
      userHasPermission: (userId, permissionId) => {
        const state = get()
        const userAssignment = state.userAssignments.find(ua => ua.userId === userId)

        if (!userAssignment) {
          return false
        }

        // Get all permissions for user's roles
        const userPermissions = new Set<string>()

        for (const roleId of userAssignment.roleIds) {
          const role = state.roles.find(r => r.id === roleId)
          if (!role) continue

          for (const rolePermissionId of role.rolePermissions) {
            const rolePermission = state.rolePermissions.find(rp => rp.id === rolePermissionId)
            if (!rolePermission) continue

            rolePermission.permissions.forEach(pId => userPermissions.add(pId))
          }
        }

        return userPermissions.has(permissionId)
      },
      
      userHasApiAccess: (userId, apiEndpoint) => {
        const state = get()
        const apiPermissions = state.permissions.filter(p => p.type === 'component' && p.resourceId.includes(apiEndpoint))

        return apiPermissions.some(permission =>
          state.userHasPermission(userId, permission.id)
        )
      },

      userHasDashboardAccess: (userId, dashboardId) => {
        const state = get()

        // Correct mapping from dashboard ID to permission ID
        const dashboardIdMap: Record<string, string> = {
          'dashboard': 'main',
          'ipd-service': 'ipd',
          'opd-service': 'opd',
          'pharmacy-service': 'pharmacy',
          'admin-service': 'admin'
        }

        const mappedId = dashboardIdMap[dashboardId] || dashboardId
        const dashboardPermissionId = `dashboard_${mappedId}_read`
        return state.userHasPermission(userId, dashboardPermissionId)
      },

      userHasComponentAccess: (userId, componentId) => {
        const state = get()
        // Check for specific component permission
        const componentPermissions = state.permissions.filter(p =>
          p.type === 'component' && p.resourceId === componentId
        )

        return componentPermissions.some(permission =>
          state.userHasPermission(userId, permission.id)
        )
      },
      
      getCurrentUserPermissions: () => {
        return get().currentUserPermissions
      },
      
      setCurrentUserPermissions: (permissions) => {
        set({ currentUserPermissions: permissions })
      },

      // Dashboard and component visibility
      getUserVisibleDashboards: (userId) => {
        const state = get()
        return state.dashboards.filter(dashboard =>
          state.userHasDashboardAccess(userId, dashboard.id)
        )
      },

      getUserVisibleComponents: (userId, dashboardId) => {
        const state = get()
        const components = state.permissions
          .filter(p => p.type === 'component')
          .map(p => p.resourceId)

        return components.filter(componentId =>
          state.userHasComponentAccess(userId, componentId)
        )
      },

      // User defaults management
      getUserDefaults: (userId) => {
        const state = get()
        return state.userDefaults.find(ud => ud.userId === userId) || null
      },

      updateUserDefaults: (userId, defaults) => {
        const now = new Date().toISOString()
        set((state) => {
          const existingIndex = state.userDefaults.findIndex(ud => ud.userId === userId)

          if (existingIndex >= 0) {
            // Update existing defaults
            const updatedDefaults = [...state.userDefaults]
            updatedDefaults[existingIndex] = {
              ...updatedDefaults[existingIndex],
              ...defaults,
              lastUpdated: now
            }
            return { userDefaults: updatedDefaults }
          } else {
            // Create new defaults
            const newDefaults: UserDefaults = {
              userId,
              dashboardDefaults: {},
              kpiDefaults: {},
              chartDefaults: {},
              globalDefaults: {},
              lastUpdated: now,
              ...defaults
            }
            return { userDefaults: [...state.userDefaults, newDefaults] }
          }
        })
      },

      setUserDashboardDefaults: (userId, dashboardId, defaults) => {
        const state = get()
        const currentDefaults = state.getUserDefaults(userId)
        const dashboardDefaults = { ...(currentDefaults?.dashboardDefaults || {}) }
        dashboardDefaults[dashboardId] = defaults

        state.updateUserDefaults(userId, { dashboardDefaults })
      },

      setUserKPIDefaults: (userId, kpiId, defaults) => {
        const state = get()
        const currentDefaults = state.getUserDefaults(userId)
        const kpiDefaults = { ...(currentDefaults?.kpiDefaults || {}) }
        kpiDefaults[kpiId] = defaults

        state.updateUserDefaults(userId, { kpiDefaults })
      },

      resetUserDefaultsToRoleDefaults: (userId) => {
        const state = get()
        const userAssignment = state.userAssignments.find(ua => ua.userId === userId)

        if (!userAssignment) return

        // Calculate role-based defaults from user's assigned roles
        const roleBasedDefaults: Partial<UserDefaults> = {
          dashboardDefaults: {},
          kpiDefaults: {},
          chartDefaults: {},
          globalDefaults: {
            startDate: '2025-01-01',
            endDate: '2025-01-31',
            patientCategory: 'OUTPATIENT,INPATIENT,EMERGENCY',
            serviceType: 'OPD',
            department: 'billing'
          }
        }

        // Aggregate defaults from all user roles
        userAssignment.roleIds.forEach(roleId => {
          const role = state.roles.find(r => r.id === roleId)
          if (!role) return

          // Role-specific defaults based on role type
          if (role.name.toLowerCase().includes('clinical')) {
            roleBasedDefaults.globalDefaults = {
              ...roleBasedDefaults.globalDefaults,
              patientCategory: 'OUTPATIENT,INPATIENT,EMERGENCY',
              serviceType: 'OPD'
            }
          } else if (role.name.toLowerCase().includes('financial')) {
            roleBasedDefaults.globalDefaults = {
              ...roleBasedDefaults.globalDefaults,
              patientCategory: 'OPD',
              serviceType: 'BILLING'
            }
          } else if (role.name.toLowerCase().includes('hr') || role.name.toLowerCase().includes('admin')) {
            roleBasedDefaults.globalDefaults = {
              ...roleBasedDefaults.globalDefaults,
              department: 'billing,medicine,nursing'
            }
          }
        })

        state.updateUserDefaults(userId, roleBasedDefaults)
      },

      exportUserDefaults: (userId) => {
        const state = get()
        return state.getUserDefaults(userId)
      },
      
      // Utility functions
      initializeDefaults: () => {
        set({
          dashboards: [...DASHBOARDS],
          permissions: [...DASHBOARD_PERMISSIONS],
          rolePermissions: [...DEFAULT_ROLE_PERMISSIONS],
          roles: [...DEFAULT_ROLES],
          userAssignments: [],
          userDefaults: [],
          dashboardVisibility: {},
          componentVisibility: {},
          isInitialized: true
        })
      },

      resetToDefaults: () => {
        set({
          dashboards: [...DASHBOARDS],
          permissions: [...DASHBOARD_PERMISSIONS],
          rolePermissions: [...DEFAULT_ROLE_PERMISSIONS],
          roles: [...DEFAULT_ROLES],
          userAssignments: [],
          userDefaults: [],
          currentUserPermissions: [],
          dashboardVisibility: {},
          componentVisibility: {},
          isInitialized: true
        })
      },
      
      exportRBACConfig: () => {
        const state = get()
        const config = {
          dashboards: state.dashboards,
          permissions: state.permissions,
          rolePermissions: state.rolePermissions,
          roles: state.roles,
          userAssignments: state.userAssignments,
          userDefaults: state.userDefaults
        }
        return JSON.stringify(config, null, 2)
      },
      
      importRBACConfig: (config) => {
        try {
          const parsed = JSON.parse(config)
          
          // Validate structure
          if (!parsed.permissions || !Array.isArray(parsed.permissions) ||
              !parsed.rolePermissions || !Array.isArray(parsed.rolePermissions) ||
              !parsed.roles || !Array.isArray(parsed.roles) ||
              !parsed.userAssignments || !Array.isArray(parsed.userAssignments)) {
            return false
          }

          set({
            dashboards: parsed.dashboards || [...DASHBOARDS],
            permissions: parsed.permissions,
            rolePermissions: parsed.rolePermissions,
            roles: parsed.roles,
            userAssignments: parsed.userAssignments,
            userDefaults: parsed.userDefaults || [],
            dashboardVisibility: {},
            componentVisibility: {},
            isInitialized: true
          })
          
          return true
        } catch (error) {
          console.error('Failed to import RBAC config:', error)
          return false
        }
      }
    }),
    {
      name: 'mhpl-rbac-store',
      partialize: (state) => ({
        dashboards: state.dashboards,
        permissions: state.permissions,
        rolePermissions: state.rolePermissions,
        roles: state.roles,
        userAssignments: state.userAssignments,
        userDefaults: state.userDefaults,
        isInitialized: state.isInitialized
      })
    }
  )
)
