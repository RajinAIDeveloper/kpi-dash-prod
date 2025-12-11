// components/layout/Sidebar.tsx
'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home,
  Building2,
  PiggyBank,
  Activity,
  CreditCard,
  PillIcon,
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { getAlertCountsByTab } from '@/lib/alert-utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { useRBACStore } from '@/lib/rbac/store'

interface SidebarProps {
  open: boolean
  setOpen: (open: boolean) => void
}

export function Sidebar({ open, setOpen }: SidebarProps) {
  const { user: currentUser } = useUser()
  const { userHasDashboardAccess } = useRBACStore()

  const pathname = usePathname()
  const alertCounts = getAlertCountsByTab()

  // For testing: simulate different users/roles (remove in production)
  const [testUserMode, setTestUserMode] = useState(false)
  const [selectedTestUser, setSelectedTestUser] = useState<string>('')

  const testUsers = [
    { id: 'test-user-1', name: 'System Admin (Full Access)', email: 'admin@mhpl.com' },
    { id: 'test-user-2', name: 'Clinical Viewer', email: 'clinical.viewer@mhpl.com' },
    { id: 'test-user-3', name: 'Financial Analyst', email: 'financial.analyst@mhpl.com' },
    { id: 'test-user-4', name: 'Pharmacy Manager', email: 'pharmacy.manager@mhpl.com' },
    { id: 'test-user-5', name: 'Department Manager', email: 'dept.manager@mhpl.com' },
    { id: 'test-user-6', name: 'HR Administrator', email: 'hr.admin@mhpl.com' }
  ]

  // Use test user ID for permission checking ONLY when in test mode
  // When test mode is OFF, show everything (no filtering for normal users)
  const effectiveUserId = testUserMode && selectedTestUser ? selectedTestUser : null

  // Debug logging (keep minimal)
  console.log(`👤 Effective User: ${effectiveUserId || 'none'} (test mode: ${testUserMode})`)

  const allNavigation = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: Home,
      href: '/dashboard',
      current: pathname === '/dashboard',
      badge: alertCounts.dashboard || null,
      dashboardId: 'dashboard'
    },
    {
      id: 'ipdservice',
      name: 'IPD Service',
      icon: TrendingUp,
      href: '/ipd-service',
      current: pathname === '/ipd-service',
      badge: alertCounts.ipdservice || null,
      dashboardId: 'ipd-service'
    },
    {
      id: 'opdservice',
      name: 'OPD Service',
      icon: Activity,
      href: '/opd-service',
      current: pathname === '/opd-service',
      badge: alertCounts.opdservice || null,
      dashboardId: 'opd-service'
    },
    {
      id: 'adminservice',
      name: 'Administrative Service',
      icon: PiggyBank,
      href: '/admin-service',
      current: pathname === '/admin-service',
      badge: alertCounts.adminservice || null,
      dashboardId: 'admin-service'
    },
    {
      id: 'pharmacy',
      name: 'Pharmacy Service',
      icon: PillIcon,
      href: '/pharmacy-service',
      current: pathname === '/pharmacy-service',
      badge: alertCounts.pharmacy || null,
      dashboardId: 'pharmacy-service'
    }
  ]

  const allBottomNavigation = [
    {
      id: 'settings',
      name: 'Settings',
      icon: Settings,
      href: '/settings',
      current: pathname === '/settings'
    }
  ]

  // Filter navigation based on user permissions ONLY in test mode
  // Normal mode shows everything to avoid breaking existing functionality
  const navigation = allNavigation.filter(item => {
    if (!testUserMode) return true // Show everything when not in test mode

    const hasAccess = effectiveUserId ? userHasDashboardAccess(effectiveUserId, item.dashboardId) : true
    console.log(`� RBAC Test Permission: ${item.name} -> ${hasAccess} for user ${effectiveUserId}`)
    return hasAccess
  })

  console.log('📊 Navigation shown:', navigation.map(item => item.name), '(test mode:', testUserMode, ')')

  // Settings is always accessible for authenticated users
  const bottomNavigation = currentUser ? allBottomNavigation : []

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-600 bg-opacity-75 lg:hidden z-40"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-gray-200 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          "transition-all duration-300 ease-in-out"
        )}
        style={{ width: open ? '280px' : '80px' }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b">
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center space-x-2"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">
                    Monoara KPI Dash
                  </h1>
                  <p className="text-xs text-gray-600">Hospital System</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(!open)}
            className="hidden lg:flex"
          >
            {open ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Test User Selector (Remove in production) */}
        <AnimatePresence>
          {open && (
            <div className="p-4 border-b bg-yellow-50">
              <div className="flex items-center space-x-2 mb-2">
                <input
                  type="checkbox"
                  id="test-mode"
                  checked={testUserMode}
                  onChange={(e) => {
                    setTestUserMode(e.target.checked)
                    if (!e.target.checked) {
                      setSelectedTestUser('')
                    }
                  }}
                  className="rounded"
                  title="Enable RBAC testing mode"
                />
                <Label htmlFor="test-mode" className="text-xs font-medium text-yellow-800 cursor-pointer">
                  RBAC Test Mode
                </Label>
              </div>

              {testUserMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <Label className="text-xs text-yellow-700">Simulate User:</Label>
                  <Select value={selectedTestUser} onValueChange={setSelectedTestUser}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select test user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {testUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id} className="text-xs">
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-yellow-600">
                    Sidebar will hide/show items based on selected user's permissions
                  </p>
                </motion.div>
              )}
            </div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon
              
              return (
                <Link key={item.id} href={item.href}>
                  <Button
                    variant={item.current ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start h-11",
                      !open && "px-2 justify-center",
                      item.current && "bg-blue-600 hover:bg-blue-700"
                    )}
                    onClick={() => {
                      if (window.innerWidth < 1024) {
                        setOpen(false)
                      }
                    }}
                  >
                    <Icon className={cn("w-5 h-5", open && "mr-3")} />
                    <AnimatePresence>
                      {open && (
                        <motion.div
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          className="flex items-center justify-between flex-1"
                        >
                          <span>{item.name}</span>
                          {item.badge && (
                            <Badge 
                              variant="destructive" 
                              className={cn("ml-auto animate-pulse", {
                                "bg-red-500 text-white": item.badge > 0
                              })}
                            >
                              {item.badge}
                            </Badge>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Button>
                </Link>
              )
            })}
          </div>

          <Separator className="my-4" />

          {/* Bottom Navigation */}
          <div className="space-y-1">
            {bottomNavigation.map((item) => {
              const Icon = item.icon
              
              return (
                <Link key={item.id} href={item.href}>
                  <Button
                    variant={item.current ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start h-11",
                      !open && "px-2 justify-center",
                      item.current && "bg-blue-600 hover:bg-blue-700"
                    )}
                  >
                    <Icon className={cn("w-5 h-5", open && "mr-3")} />
                    <AnimatePresence>
                      {open && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          {item.name}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                </Link>
              )
            })}
          </div>
        </nav>
      </motion.div>
    </>
  )
}
