'use client'

import { useDashboardStore } from '@/lib/store/dashboard-store'
import GlobalFilterBar from '@/components/filters/GlobalFilterBar'
import { motion, AnimatePresence } from 'framer-motion'

export function GlobalFilterWrapper() {
  const { showGlobalFilters } = useDashboardStore()

  return (
    <AnimatePresence>
      {showGlobalFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="border-b border-gray-200 bg-gray-50"
        >
          <GlobalFilterBar />
        </motion.div>
      )}
    </AnimatePresence>
  )
}