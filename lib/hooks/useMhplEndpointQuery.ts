'use client'

import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { callMHPL_API_WithValidation } from '@/lib/api/mhplApi'
import type { MHPLResponse } from '@/lib/api/types'

export function useMhplEndpointQuery<T = any>(
  endpointId: string,
  params: Record<string, any>,
  opts?: Omit<UseQueryOptions<MHPLResponse<T>, Error, MHPLResponse<T>>, 'queryKey' | 'queryFn'>
) {
  return useQuery<MHPLResponse<T>, Error>({
    queryKey: ['mhpl', endpointId, params],
    queryFn: () => callMHPL_API_WithValidation<T>(endpointId, params),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...opts,
  })
}

