'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Users, Building2, CreditCard } from 'lucide-react'
import { useDashboardStore } from '@/lib/store/dashboard-store'

interface BasicFiltersProps {
  onApply?: () => void
  onClear?: () => void
}

export function BasicFilters({ onApply, onClear }: BasicFiltersProps) {
  const { 
    globalFilters, 
    updateGlobalFilters, 
    setPatientCategory,
    setDepartments,
    setDateRange 
  } = useDashboardStore()

  const [localStartDate, setLocalStartDate] = useState(() => {
    return globalFilters?.startDate || new Date().toISOString().split('T')[0]
  })
  const [localEndDate, setLocalEndDate] = useState(() => {
    return globalFilters?.endDate || new Date().toISOString().split('T')[0]
  })
  const [localPatientCat, setLocalPatientCat] = useState(() => {
    return globalFilters?.patientCategory || ['OUTPATIENT']
  })
  const [localDepartments, setLocalDepartments] = useState(() => {
    return globalFilters?.departments || ['MEDICINE']
  })

  // Sync local state with global filters when they become available
  useEffect(() => {
    if (globalFilters) {
      setLocalStartDate(globalFilters.startDate)
      setLocalEndDate(globalFilters.endDate)
      setLocalPatientCat(globalFilters.patientCategory || ['OUTPATIENT'])
      setLocalDepartments(globalFilters.departments || ['MEDICINE'])
    }
  }, [globalFilters])

  const handleApplyFilters = () => {
    // Update global filters
    setDateRange(localStartDate, localEndDate)
    setPatientCategory(localPatientCat)
    setDepartments(localDepartments)
    
    console.log('🔍 Applied basic filters:', {
      dateRange: { start: localStartDate, end: localEndDate },
      patientCategories: localPatientCat,
      departments: localDepartments
    })
    
    onApply?.()
  }

  const handleClearFilters = () => {
    // Use store's default values for consistency
    const defaultStartDate = globalFilters?.startDate || new Date().toISOString().split('T')[0]
    const defaultEndDate = globalFilters?.endDate || new Date().toISOString().split('T')[0]
    const defaultPatientCat = ['OUTPATIENT'] // Use simple default for basic filters
    const defaultDepartments = ['MEDICINE'] // Use simple default for basic filters
    
    setLocalStartDate(defaultStartDate)
    setLocalEndDate(defaultEndDate)
    setLocalPatientCat(defaultPatientCat)
    setLocalDepartments(defaultDepartments)
    
    // Clear global filters to simple defaults
    setDateRange(defaultStartDate, defaultEndDate)
    setPatientCategory(defaultPatientCat)
    setDepartments(defaultDepartments)
    
    onClear?.()
  }

  const addPatientCategory = (category: string) => {
    if (!localPatientCat.includes(category)) {
      setLocalPatientCat([...localPatientCat, category])
    }
  }

  const removePatientCategory = (category: string) => {
    setLocalPatientCat(localPatientCat.filter(cat => cat !== category))
  }

  const addDepartment = (dept: string) => {
    if (!localDepartments.includes(dept)) {
      setLocalDepartments([...localDepartments, dept])
    }
  }

  const removeDepartment = (dept: string) => {
    setLocalDepartments(localDepartments.filter(d => d !== dept))
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-md">
        Basic filters provide essential filtering options for quick data refinement.
      </div>

      {/* Date Range */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4" />
            Date Range
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-date" className="text-xs">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={localStartDate}
                onChange={(e) => setLocalStartDate(e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <Label htmlFor="end-date" className="text-xs">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={localEndDate}
                onChange={(e) => setLocalEndDate(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patient Categories */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4" />
            Patient Categories
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select onValueChange={addPatientCategory}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Add patient category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INPATIENT">Inpatient</SelectItem>
              <SelectItem value="OUTPATIENT">Outpatient</SelectItem>
              <SelectItem value="EMERGENCY">Emergency</SelectItem>
              <SelectItem value="VIP">VIP</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex flex-wrap gap-1">
            {localPatientCat.map((cat) => (
              <Badge key={cat} variant="outline" className="text-xs">
                {cat}
                <button
                  onClick={() => removePatientCategory(cat)}
                  className="ml-1 hover:text-red-500"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Departments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4" />
            Departments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select onValueChange={addDepartment}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Add department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MEDICINE">Medicine</SelectItem>
              <SelectItem value="SURGERY">Surgery</SelectItem>
              <SelectItem value="CARDIOLOGY">Cardiology</SelectItem>
              <SelectItem value="PEDIATRICS">Pediatrics</SelectItem>
              <SelectItem value="ICU">ICU</SelectItem>
              <SelectItem value="EMERGENCY">Emergency</SelectItem>
              <SelectItem value="RADIOLOGY">Radiology</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex flex-wrap gap-1">
            {localDepartments.map((dept) => (
              <Badge key={dept} variant="outline" className="text-xs">
                {dept}
                <button
                  onClick={() => removeDepartment(dept)}
                  className="ml-1 hover:text-red-500"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={handleClearFilters} variant="outline" className="flex-1">
          Clear All Filters
        </Button>
        <Button onClick={handleApplyFilters} className="flex-1">
          Apply Basic Filters
        </Button>
      </div>
      
      <div className="text-xs text-gray-500">
        Applied filters: {localPatientCat.length} patient categories, {localDepartments.length} departments
      </div>
    </div>
  )
}
