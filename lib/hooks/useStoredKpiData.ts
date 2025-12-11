'use client'

import { useEffect, useState } from 'react'
import { callMHPLEndpoint } from '../api/mhpl-client'
import { useDashboardStore } from '../store/dashboard-store'

interface StoredKpiDataResult<T = any> {
  payload: T | null
  loading: boolean
  error: string | null
}

export function useStoredKpiData<T = any>(
  endpointId: string,
  isOpen: boolean,
  suppliedData?: T | null
): StoredKpiDataResult<T> {
  const getApiParameters = useDashboardStore((state) => state.getApiParameters)
  const [payload, setPayload] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        let resolvedData: T | null = suppliedData ?? null

        if (!resolvedData && typeof window !== 'undefined') {
          try {
            const stored = localStorage.getItem(`${endpointId}-payload`)
            if (stored) {
              const parsed = JSON.parse(stored)
              resolvedData = (parsed?.data ?? parsed) as T
            }
          } catch (storageError) {
            console.warn(`Failed to parse cached data for ${endpointId}:`, storageError)
          }
        }

        if (resolvedData == null) {
          const params = getApiParameters(endpointId)
          const response = await callMHPLEndpoint<T>(endpointId, params)

          if (response.status !== 'success' || !response.data) {
            throw new Error(response.message || 'Failed to fetch drill-down data')
          }

          resolvedData = response.data as T

          if (typeof window !== 'undefined') {
            const cachePayload = {
              data: response.data,
              fetchedAt: new Date().toISOString(),
              endpoint: endpointId,
              inputParameters: params
            }
            localStorage.setItem(`${endpointId}-payload`, JSON.stringify(cachePayload))
          }
        }

        if (!cancelled) {
          setPayload(resolvedData)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error loading drill-down data'
        if (!cancelled) {
          setError(message)
          setPayload(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [endpointId, getApiParameters, isOpen, suppliedData])

  useEffect(() => {
    if (!isOpen) {
      setPayload(null)
      setError(null)
      setLoading(false)
    }
  }, [isOpen])

  return { payload, loading, error }
}
