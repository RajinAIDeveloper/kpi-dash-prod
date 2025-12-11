'use client'

// Client-side token storage utilities for localStorage management
const TOKEN_KEY = 'mhpl_bearer_token'
const TOKEN_TIMESTAMP_KEY = 'mhpl_token_timestamp'
const TOKEN_EXPIRY_HOURS = 24 // Token expires after 24 hours

export interface StoredTokenData {
  token: string
  timestamp: number
  isValid: boolean
}

export class TokenStorage {
  static save(token: string): void {
    if (typeof window === 'undefined') return

    try {
      const timestamp = Date.now()
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(TOKEN_TIMESTAMP_KEY, timestamp.toString())

      console.log('✅ Token saved to localStorage for session')
    } catch (error) {
      console.error('Failed to save token to localStorage:', error)
    }
  }

  static get(): StoredTokenData | null {
    if (typeof window === 'undefined') return null

    try {
      const token = localStorage.getItem(TOKEN_KEY)
      const timestampStr = localStorage.getItem(TOKEN_TIMESTAMP_KEY)

      if (!token || !timestampStr) {
        return null
      }

      const timestamp = parseInt(timestampStr)
      const hoursSinceStored = (Date.now() - timestamp) / (1000 * 60 * 60)
      const isValid = hoursSinceStored < TOKEN_EXPIRY_HOURS

      return {
        token,
        timestamp,
        isValid
      }
    } catch (error) {
      console.error('Failed to get token from localStorage:', error)
      return null
    }
  }

  static getValidToken(): string | null {
    const tokenData = this.get()
    return tokenData?.isValid ? tokenData.token : null
  }

  static clear(): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(TOKEN_TIMESTAMP_KEY)
      console.log('🗑️ Token cleared from localStorage')
    } catch (error) {
      console.error('Failed to clear token from localStorage:', error)
    }
  }

  static isTokenExpired(): boolean {
    const tokenData = this.get()
    return !tokenData?.isValid
  }

  static getTokenAge(): number | null {
    const tokenData = this.get()
    return tokenData ? (Date.now() - tokenData.timestamp) / (1000 * 60 * 60) : null
  }

  static async refreshTokenIfNeeded(): Promise<boolean> {
    const tokenData = this.get()
    
    if (!tokenData || !tokenData.isValid) {
      console.log('🔄 Token expired or missing, attempting refresh...')
      
      try {
        const response = await fetch('/api/authentication', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.token) {
            this.save(data.token)
            return true
          }
        }
        
        console.error('Failed to refresh token')
        return false
      } catch (error) {
        console.error('Error refreshing token:', error)
        return false
      }
    }
    
    return true
  }

  static async clearAll(): Promise<void> {
    this.clear()
    
    // Also clear server-side session if available
    try {
      await fetch('/api/authentication', {
        method: 'DELETE'
      })
    } catch (error) {
      console.warn('Failed to clear server session:', error)
    }
  }

  static async validateSynchronization(): Promise<boolean> {
    const localToken = this.getValidToken()
    
    if (!localToken) {
      return false
    }
    
    try {
      // Test the token with a simple API call
      const response = await fetch('/api/authentication', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localToken}`
        }
      })
      
      return response.ok
    } catch (error) {
      console.error('Token validation failed:', error)
      return false
    }
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = TokenStorage.getValidToken()

  if (!token) {
    // Return basic headers without authorization - let the API handle authentication
    return {
      'Content-Type': 'application/json'
    }
  }

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

export function isAuthenticated(): boolean {
  return !!TokenStorage.getValidToken()
}