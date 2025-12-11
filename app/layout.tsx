// app/layout.tsx
'use client'

import { Geist, Geist_Mono } from "next/font/google";
import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { ClerkProvider } from '@clerk/nextjs'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Header } from '../components/layout/Header'
import { Sidebar } from '../components/layout/Sidebar'
import { FilterModal } from '../components/filters/FilterModal'
// import { DrillDownModal } from '../components/dashboard/DrillDownModal'
// import { RBACProvider } from '@/components/rbac/RBACProvider'
import { FilterStateProvider } from '@/components/filters/FilterStateProvider'
import { GlobalFilterWrapper } from '@/components/layout/GlobalFilterWrapper'
import { useDashboardStore } from '@/lib/store/dashboard-store'
// import { initializeRBACRoles } from '@/lib/rbac/global-init'
import "./globals.css";

// ⚡ PERFORMANCE: QueryClient singleton to preserve cache across renders
const queryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (cache garbage collection)
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  // Server: always create new QueryClient
  if (typeof window === 'undefined') {
    return new QueryClient(queryClientConfig)
  }
  // Browser: create singleton on first call
  if (!browserQueryClient) {
    browserQueryClient = new QueryClient(queryClientConfig)
  }
  return browserQueryClient
}

// ⚡ PERFORMANCE: Font loading with display swap for better perceived performance
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap', // Show fallback font immediately while custom font loads
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
});

// Initialization component for auto-play settings
function AppInitializer() {
  const { initializeAutoPlay, setDemoMode } = useDashboardStore()

  useEffect(() => {
    // Initialize auto-play settings when the app starts
    initializeAutoPlay()
    // Force Live mode as default on initial load (overrides any stale persisted demo flag)
    setDemoMode(false)
  }, [initializeAutoPlay])

  return null // This component doesn't render anything
}

// RBAC role initialization component
function RBACInitializer() {
  // useEffect(() => {
  //   // Initialize RBAC roles on app startup (ensures test users exist on every page)
  //   initializeRBACRoles()
  // }, [])

  return null // This component doesn't render anything
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // ⚡ PERFORMANCE: Use singleton QueryClient
  const queryClient = getQueryClient()

  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <QueryClientProvider client={queryClient}>
            <FilterStateProvider>
              {/* <RBACProvider> */}
              <AppInitializer />
              <RBACInitializer />
              <div className="flex h-screen bg-gray-50">
                {/* <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} /> */}

                <div className="flex-1 flex flex-col overflow-hidden">
                  <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

                  {/* Global Filter Bar - appears on all pages when toggled */}
                  <GlobalFilterWrapper />

                  <main className="flex-1 overflow-y-auto">
                    {children}
                  </main>
                </div>

                <FilterModal />
                {/* <DrillDownModal /> */}
              </div>
              <Toaster />
              {/* </RBACProvider> */}
            </FilterStateProvider>
          </QueryClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
