'use client'

import { TokenStorage } from '@/lib/tokenStorage'

export interface EnsureTokenResult {
  token: string | null
  source: 'db' | 'generated' | 'failed'
  dbSaved: boolean
}

const DEFAULT_AUTH_URL =
  process.env.NEXT_PUBLIC_MHPL_AUTH_URL ||
  'http://appit.ignitetechno.com:8080/ords/xapi/auth/token'
const DEFAULT_AUTH_USERNAME =
  process.env.NEXT_PUBLIC_MHPL_AUTH_USERNAME || 'MHPL.API'
const DEFAULT_AUTH_PASSWORD =
  process.env.NEXT_PUBLIC_MHPL_AUTH_PASSWORD || '1234567890#25'

const encodeBasicAuth = (username: string, password: string): string => {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(`${username}:${password}`)
  }

  // Fallback for environments where Buffer exists (e.g., tests)
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(`${username}:${password}`, 'utf8').toString('base64')
  }

  throw new Error('Unable to encode credentials for basic auth')
}

const extractTokenFromPayload = (payload: any, raw: string): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidateKeys = ['Token', 'token', 'access_token', 'bearer']
  for (const key of candidateKeys) {
    const value = payload?.[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      const trimmed = value.trim()
      if (!trimmed.includes('<') && !trimmed.includes('>')) {
        return trimmed
      }
    }
  }

  if (Array.isArray(payload.items)) {
    for (const item of payload.items) {
      const nested = extractTokenFromPayload(item, '')
      if (nested) return nested
    }
  }

  if (raw?.includes('Token')) {
    try {
      const parsed = JSON.parse(raw)
      return extractTokenFromPayload(parsed, '')
    } catch {
      // ignore
    }
  }

  return null
}

// Ensure a valid auth token exists for dashboard usage.
// - Tries database global token first
// - If absent/expired/unauthorized, tries /api/authentication
// - Saves to TokenStorage and attempts to persist back to database
export async function ensureGlobalToken(): Promise<EnsureTokenResult> {
  // 1) Try database token first
  try {
    const r = await fetch('/api/global-token', { cache: 'no-store' })
    if (r.ok) {
      const data = await r.json().catch(() => null as any)
      if (data?.hasToken && data.token) {
        try {
          TokenStorage.save(data.token)
        } catch {}
        return { token: data.token, source: 'db', dbSaved: true }
      }
    }
  } catch {
    // ignore and fall through
  }

  // 2) Try Next.js authentication API if present
  try {
    const authRes = await fetch('/api/authentication', { method: 'POST' })
    if (authRes.ok) {
      const payload = await authRes.json().catch(() => null as any)
      const token: string | null =
        payload?.token ?? extractTokenFromPayload(payload, '')

      if (token) {
        try {
          TokenStorage.save(token)
        } catch {}

        let dbSaved = false
        try {
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          const saveRes = await fetch('/api/global-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, expiresAt })
          })
          dbSaved = saveRes.ok
        } catch {
          dbSaved = false
        }

        return { token, source: 'generated', dbSaved }
      }
    }
  } catch {
    // ignore and fall through to direct auth
  }

  // 3) Final fallback: give up gracefully
  return { token: null, source: 'failed', dbSaved: false }
}

export async function deleteGlobalToken(): Promise<boolean> {
  try {
    const r = await fetch('/api/global-token', { method: 'DELETE' })
    return r.ok
  } catch {
    return false
  }
}

export function clearClientToken(): void {
  try {
    TokenStorage.clear()
  } catch {}
}
