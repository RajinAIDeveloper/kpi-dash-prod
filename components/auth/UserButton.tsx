'use client'

import { UserButton as ClerkUserButton, useUser } from '@clerk/nextjs'
import { useRBACStore } from '@/lib/rbac/store'
import { Badge } from '@/components/ui/badge'
import { Shield } from 'lucide-react'

export function UserButton() {
  const { user } = useUser()
  const { getCurrentUserPermissions } = useRBACStore()

  if (!user) return null

  const userPermissions = getCurrentUserPermissions()

  return (
    <div className="flex items-center space-x-3">
      {/* Role Badge */}
      <div className="flex items-center space-x-2">
        <Shield className="w-4 h-4 text-blue-600" />
        <Badge variant="secondary" className="text-xs">
          {userPermissions.length} permissions
        </Badge>
      </div>
      
      {/* User Profile */}
      <ClerkUserButton 
        appearance={{
          elements: {
            avatarBox: "w-8 h-8"
          }
        }}
        showName={true}
      />
    </div>
  )
}