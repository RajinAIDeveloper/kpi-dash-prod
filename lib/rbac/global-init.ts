/**
 * Global RBAC initializer - ensures test roles are assigned on every page load
 */
import { useRBACStore } from '@/lib/rbac/store'

export function initializeRBACRoles() {
  const store = useRBACStore.getState()

  // Initialize defaults if not done yet
  if (!store.roles.length) {
    console.log('🔧 Global RBAC: Initializing defaults...')
    store.initializeDefaults()
  }

  // Assign test roles (these ensure they exist on every page load)
  console.log('🚀 Global RBAC: Assigning test user roles...')

  // Use setTimeout to ensure store is initialized
  setTimeout(() => {
    try {
      store.assignRolesToUser('test-user-2', ['clinical_viewer'], 'system')
      store.assignRolesToUser('test-user-3', ['financial_analyst'], 'system')
      store.assignRolesToUser('test-user-4', ['pharmacy_manager'], 'system')
      store.assignRolesToUser('test-user-5', ['department_manager'], 'system')
      store.assignRolesToUser('test-user-6', ['hr_administrator'], 'system')

      // Get current user ID from Clerk (this will be available at runtime)
      // Note: This will be handled by each component that needs it

      console.log('✅ Global RBAC: Test roles assigned successfully')
    } catch (error) {
      console.error('❌ Global RBAC: Failed to assign roles:', error)
    }
  }, 500)
}

// Export for import in layout or _app.tsx
export default initializeRBACRoles
