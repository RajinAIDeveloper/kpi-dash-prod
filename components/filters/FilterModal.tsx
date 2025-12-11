// components/filters/FilterModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Filter, RotateCcw, X, TrendingUp, Clock, BarChart3 } from 'lucide-react'
import { useDashboardStore, GlobalFilterState } from '@/lib/store/dashboard-store'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { format, subDays, subWeeks, subMonths, subYears, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns'
import toast from 'react-hot-toast'
import { BasicFilters } from './BasicFilters'

interface FilterModalProps {
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

type DatePreset = {
  label: string
  value: string
  startDate: Date
  endDate: Date
  icon: React.ComponentType<{ className?: string }>
}

type ComparisonOption = {
  value: 'week' | 'month' | 'quarter' | 'year'
  label: string
  shortLabel: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

export function FilterModal({ trigger, open, onOpenChange }: FilterModalProps) {
  const [isOpen, setIsOpen] = useState(open || false)
  const [activeSection, setActiveSection] = useState<'basic' | 'advanced'>('basic')
  
  const {
    globalFilters,
    settings,
    setDateRange,
    updateGlobalFilters,
    updateSettings,
    setPatientCategory,
    setDepartments,
    resetAllFilters
  } = useDashboardStore()
  
  // Extract values from the unified structure with fallbacks  
  const today = format(new Date(), 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const dateRange = { 
    startDate: globalFilters?.startDate || monthStart, 
    endDate: globalFilters?.endDate || today 
  }
  const comparisonPeriod = settings?.comparisonPeriod || 'week'
  const comparisonEnabled = settings?.comparisonEnabled ?? true
  const patientCategory = globalFilters?.patientCategory || []
  const spendingCategory = globalFilters?.spendingCategories || []
  const departments = globalFilters?.departments || []
  const bedTypes = globalFilters?.bedTypes || []
  const divisions = globalFilters?.divisions || []
  const districts = globalFilters?.districts || []
  const medicineCategories = globalFilters?.medicineCategories || []
  const employeeTypes = globalFilters?.employeeTypes || []

  // Sync with external open state
  useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open)
    }
  }, [open])

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen)
    onOpenChange?.(newOpen)
  }

  const currentDate = new Date()

  const datePresets: DatePreset[] = [
    {
      label: 'Today',
      value: 'today',
      startDate: currentDate,
      endDate: currentDate,
      icon: Clock
    },
    {
      label: 'This Week',
      value: 'week',
      startDate: startOfWeek(currentDate, { weekStartsOn: 1 }),
      endDate: endOfWeek(currentDate, { weekStartsOn: 1 }),
      icon: Calendar
    },
    {
      label: 'This Month',
      value: 'month',
      startDate: startOfMonth(currentDate),
      endDate: endOfMonth(currentDate),
      icon: Calendar
    },
    {
      label: 'This Quarter',
      value: 'quarter',
      startDate: startOfQuarter(currentDate),
      endDate: endOfQuarter(currentDate),
      icon: BarChart3
    },
    {
      label: 'This Year',
      value: 'year',
      startDate: startOfYear(currentDate),
      endDate: endOfYear(currentDate),
      icon: TrendingUp
    }
  ]

  const comparisonOptions: ComparisonOption[] = [
    {
      value: 'week',
      label: 'Weekly Average',
      shortLabel: 'Weekly',
      description: 'Compare with previous week average',
      icon: Calendar
    },
    {
      value: 'month',
      label: 'Monthly Average',
      shortLabel: 'Monthly',
      description: 'Compare with previous month average',
      icon: TrendingUp
    },
    {
      value: 'quarter',
      label: 'Quarterly Average',
      shortLabel: 'Quarterly',
      description: 'Compare with previous quarter average',
      icon: BarChart3
    },
    {
      value: 'year',
      label: 'Yearly Average',
      shortLabel: 'Yearly',
      description: 'Compare with previous year average',
      icon: TrendingUp
    }
  ]

  const handleDatePresetSelect = (preset: DatePreset) => {
    const startDate = format(preset.startDate, 'yyyy-MM-dd')
    const endDate = format(preset.endDate, 'yyyy-MM-dd')
    setDateRange(startDate, endDate)
    toast.success(`Date range set to ${preset.label}`)
  }

  const handleComparisonSelect = (comparison: ComparisonOption['value']) => {
    updateSettings({ comparisonPeriod: comparison })
    toast.success(`Comparison updated to ${comparisonOptions.find(c => c.value === comparison)?.label}`)
  }

  const handleMultiSelect = (value: string, currentValues: string[], fieldName: keyof GlobalFilterState) => {
    const newValues = currentValues.includes(value) 
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value]
    updateGlobalFilters({ [fieldName]: newValues })
  }

  const getActiveFiltersCount = () => {
    return patientCategory.length + spendingCategory.length + departments.length + 
           bedTypes.length + divisions.length + districts.length + 
           medicineCategories.length + employeeTypes.length
  }

  const handleReset = () => {
    resetAllFilters()
    toast.success('All filters have been reset')
  }

  const handleApply = () => {
    toast.success('Filters applied successfully')
    handleOpenChange(false)
  }

  const currentPreset = datePresets.find(preset => {
    // Handle undefined/invalid dates during initial render
    if (!dateRange.startDate || !dateRange.endDate) {
      return false
    }
    
    const presetStart = format(preset.startDate, 'yyyy-MM-dd')
    const presetEnd = format(preset.endDate, 'yyyy-MM-dd')
    return presetStart === dateRange.startDate && presetEnd === dateRange.endDate
  })

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      
      <DialogContent className={cn(
        // Base styles
        "w-[95vw] max-w-4xl",
        // Height management - responsive
        "h-[95vh] max-h-[95vh]",
        "sm:h-auto sm:max-h-[90vh]",
        // Positioning
        "fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2",
        // Overflow and scrolling
        "overflow-hidden flex flex-col",
        // Padding adjustments for mobile
        "p-4 sm:p-6"
      )}>
        <DialogHeader className="flex-shrink-0 space-y-2 sm:space-y-1.5">
          <DialogTitle className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-blue-600" />
              <span className="text-lg sm:text-xl">Executive Filters</span>
            </div>
            <Badge variant="secondary" className="self-start sm:self-auto">
              {getActiveFiltersCount()} active
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            Configure date ranges, comparison periods, and advanced filters for the dashboard
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6 mt-4">
          {/* Section Tabs */}
          <div className="flex space-x-1 p-1 bg-gray-100 rounded-lg">
            <Button
              variant={activeSection === 'basic' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveSection('basic')}
              className="flex-1 text-xs sm:text-sm px-2 sm:px-4"
            >
              Basic Filters
            </Button>
            <Button
              variant={activeSection === 'advanced' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveSection('advanced')}
              className="flex-1 text-xs sm:text-sm px-2 sm:px-4"
            >
              <span className="truncate">Advanced Filters</span>
              {getActiveFiltersCount() > 0 && (
                <Badge variant="destructive" className="ml-1 sm:ml-2 h-4 text-xs px-1">
                  {getActiveFiltersCount()}
                </Badge>
              )}
            </Button>
          </div>

          {activeSection === 'basic' ? (
            <BasicFilters 
              onApply={() => {
                toast.success('Basic filters applied successfully')
              }} 
              onClear={() => {
                toast.success('All filters cleared')
              }} 
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {/* Patient Categories */}
              <div className="space-y-3">
                <Label className="font-medium text-sm sm:text-base">Patient Category</Label>
                <div className="space-y-2">
                  {[
                    { value: 'INPATIENT', label: 'Inpatient' },
                    { value: 'OUTPATIENT', label: 'Outpatient' }
                  ].map((option) => (
                    <label key={option.value} className="flex items-center space-x-2 cursor-pointer p-1">
                      <input
                        type="checkbox"
                        checked={patientCategory.includes(option.value)}
                        onChange={() => handleMultiSelect(option.value, patientCategory, 'patientCategory')}
                        className="rounded border-gray-300 w-4 h-4"
                      />
                      <span className="text-xs sm:text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Spending Categories */}
              <div className="space-y-3">
                <Label className="font-medium text-sm sm:text-base">Spending Category</Label>
                <div className="space-y-2">
                  {[
                    { value: 'HIGH', label: 'High (50K - 200K BDT)' },
                    { value: 'MEDIUM', label: 'Medium (20K - 50K BDT)' },
                    { value: 'LOW', label: 'Low (0 - 20K BDT)' },
                    { value: 'VIP', label: 'VIP (200K+ BDT)' }
                  ].map((option) => (
                    <label key={option.value} className="flex items-center space-x-2 cursor-pointer p-1">
                      <input
                        type="checkbox"
                        checked={spendingCategory.includes(option.value)}
                        onChange={() => handleMultiSelect(option.value, spendingCategory, 'spendingCategories')}
                        className="rounded border-gray-300 w-4 h-4 flex-shrink-0"
                      />
                      <span className="text-xs sm:text-sm leading-tight">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Departments */}
              <div className="space-y-3">
                <Label className="font-medium text-sm sm:text-base">Departments</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {[
                    { value: 'MEDICINE', label: 'Medicine' },
                    { value: 'BILLING', label: 'Billing' },
                    { value: 'NURSING', label: 'Nursing' },
                    { value: 'PHARMACY', label: 'Pharmacy' },
                    { value: 'EMERGENCY', label: 'Emergency' },
                    { value: 'CARDIOLOGY', label: 'Cardiology' },
                    { value: 'SURGERY', label: 'Surgery' }
                  ].map((option) => (
                    <label key={option.value} className="flex items-center space-x-2 cursor-pointer p-1">
                      <input
                        type="checkbox"
                        checked={departments.includes(option.value)}
                        onChange={() => handleMultiSelect(option.value, departments, 'departments')}
                        className="rounded border-gray-300 w-4 h-4"
                      />
                      <span className="text-xs sm:text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Bed Types */}
              <div className="space-y-3">
                <Label className="font-medium text-sm sm:text-base">Bed Types</Label>
                <div className="space-y-2">
                  {[
                    { value: 'GENERAL', label: 'General' },
                    { value: 'PRIVATE', label: 'Private' },
                    { value: 'ICU', label: 'ICU' },
                    { value: 'VIP', label: 'VIP' }
                  ].map((option) => (
                    <label key={option.value} className="flex items-center space-x-2 cursor-pointer p-1">
                      <input
                        type="checkbox"
                        checked={bedTypes.includes(option.value)}
                        onChange={() => handleMultiSelect(option.value, bedTypes, 'bedTypes')}
                        className="rounded border-gray-300 w-4 h-4"
                      />
                      <span className="text-xs sm:text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Medicine Categories */}
              <div className="space-y-3">
                <Label className="font-medium text-sm sm:text-base">Medicine Categories</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {[
                    { value: 'ANTIBIOTICS', label: 'Antibiotics' },
                    { value: 'PAINKILLERS', label: 'Painkillers' },
                    { value: 'VITAMINS', label: 'Vitamins' },
                    { value: 'CARDIAC', label: 'Cardiac' },
                    { value: 'DIABETES', label: 'Diabetes' }
                  ].map((option) => (
                    <label key={option.value} className="flex items-center space-x-2 cursor-pointer p-1">
                      <input
                        type="checkbox"
                        checked={medicineCategories.includes(option.value)}
                        onChange={() => handleMultiSelect(option.value, medicineCategories, 'medicineCategories')}
                        className="rounded border-gray-300 w-4 h-4"
                      />
                      <span className="text-xs sm:text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Employee Types */}
              <div className="space-y-3">
                <Label className="font-medium text-sm sm:text-base">Employee Types</Label>
                <div className="space-y-2">
                  {[
                    { value: 'DOCTOR', label: 'Doctor' },
                    { value: 'NURSE', label: 'Nurse' },
                    { value: 'TECHNICIAN', label: 'Technician' },
                    { value: 'ADMIN', label: 'Administrator' }
                  ].map((option) => (
                    <label key={option.value} className="flex items-center space-x-2 cursor-pointer p-1">
                      <input
                        type="checkbox"
                        checked={employeeTypes.includes(option.value)}
                        onChange={() => handleMultiSelect(option.value, employeeTypes, 'employeeTypes')}
                        className="rounded border-gray-300 w-4 h-4"
                      />
                      <span className="text-xs sm:text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row items-center justify-between pt-4 sm:pt-6 border-t space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600 order-2 sm:order-1">
            <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="text-center sm:text-left">Changes apply to all dashboard metrics</span>
          </div>
          
          <div className="flex items-center space-x-2 order-1 sm:order-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={handleReset}
              className="flex-1 sm:flex-none text-xs sm:text-sm"
              size="sm"
            >
              <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Reset
            </Button>
            <Button 
              onClick={handleApply} 
              className="bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none text-xs sm:text-sm"
              size="sm"
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
