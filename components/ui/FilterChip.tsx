'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Edit2, Globe, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface FilterChipProps {
  label: string
  value: string
  onRemove?: () => void
  onEdit?: (newValue: string) => void
  removable?: boolean
  editable?: boolean
  variant?: 'default' | 'global' | 'local'
  className?: string
}

export default function FilterChip({
  label,
  value,
  onRemove,
  onEdit,
  removable = true,
  editable = true,
  variant = 'default',
  className = ''
}: FilterChipProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)

  const handleEdit = () => {
    if (editable) {
      setEditValue(value)
      setIsEditing(true)
    }
  }

  const handleSave = () => {
    if (editValue.trim() && editValue !== value) {
      onEdit?.(editValue.trim())
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const getVariantStyles = () => {
    switch (variant) {
      case 'global':
        return 'bg-green-100 text-green-800 border border-green-300 hover:bg-green-200 shadow-sm hover:shadow-md transition-all duration-200'
      case 'local':
        return 'bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-200 shadow-sm hover:shadow-md transition-all duration-200'
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 shadow-sm hover:shadow-md transition-all duration-200'
    }
  }

  const renderModeIcon = () => {
    if (variant === 'global') {
      return (
        <div className="mr-1" title="Global Filter">
          <Globe className="w-3 h-3 text-green-600" />
        </div>
      )
    }
    if (variant === 'local') {
      return (
        <div className="mr-1" title="Local Filter">
          <Target className="w-3 h-3 text-blue-600" />
        </div>
      )
    }
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2 }}
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border transition-colors ${getVariantStyles()} ${className}`}
    >
      {renderModeIcon()}
      <span className="text-xs font-medium">{label}:</span>

      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="editing"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex items-center gap-1"
          >
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              className="h-6 w-20 text-xs px-2 py-0"
              autoFocus
            />
          </motion.div>
        ) : (
          <motion.div
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1"
          >
            <span
              className="text-xs font-semibold cursor-pointer hover:underline"
              onClick={handleEdit}
              title={editable ? "Click to edit" : ""}
            >
              {value}
            </span>

            {editable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                className="h-4 w-4 p-0 opacity-50 hover:opacity-100"
                title="Edit value"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {removable && !isEditing && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-4 w-4 p-0 ml-1 opacity-50 hover:opacity-100 hover:text-red-600"
          title="Remove filter"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </motion.div>
  )
}

export function FilterChipGroup({
  chips,
  maxVisible = 3,
  onExpandToggle,
  isExpanded = false
}: {
  chips: React.ReactNode[]
  maxVisible?: number
  onExpandToggle?: () => void
  isExpanded?: boolean
}) {
  const visibleChips = isExpanded ? chips : chips.slice(0, maxVisible)
  const hiddenCount = chips.length - maxVisible

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <AnimatePresence>
        {visibleChips.map((chip, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ delay: index * 0.05 }}
          >
            {chip}
          </motion.div>
        ))}
      </AnimatePresence>

      {hiddenCount > 0 && !isExpanded && (
        <Button
          variant="outline"
          size="sm"
          onClick={onExpandToggle}
          className="h-6 px-2 text-xs"
        >
          +{hiddenCount} more ▼
        </Button>
      )}

      {isExpanded && chips.length > maxVisible && (
        <Button
          variant="outline"
          size="sm"
          onClick={onExpandToggle}
          className="h-6 px-2 text-xs"
        >
          Show less ▲
        </Button>
      )}
    </div>
  )
}
