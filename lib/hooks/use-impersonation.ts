import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../supabase/client'
import { setImpersonationContext, clearImpersonationContext } from '../supabase/queries'

interface ImpersonationState {
  isImpersonating: boolean
  impersonatedUserId: string | null
  impersonatedUserName: string | null
  impersonatedUserRole: string | null
  originalUserId: string | null
}

interface UseImpersonationReturn {
  impersonationState: ImpersonationState
  startImpersonation: (targetUserId: string, targetUserName: string, targetUserRole: string) => Promise<void>
  stopImpersonation: () => Promise<void>
  isLoading: boolean
  error: string | null
}

export const useImpersonation = (): UseImpersonationReturn => {
  const [impersonationState, setImpersonationState] = useState<ImpersonationState>({
    isImpersonating: false,
    impersonatedUserId: null,
    impersonatedUserName: null,
    impersonatedUserRole: null,
    originalUserId: null
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  // Load impersonation state from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('impersonation_state')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setImpersonationState(parsed)
          
          // Set impersonation context in Supabase
          if (parsed.isImpersonating && parsed.originalUserId) {
            setImpersonationContext(supabase, parsed.originalUserId)
          }
        } catch (err) {
          console.error('Failed to parse impersonation state:', err)
        }
      }
    }
  }, [supabase])

  const startImpersonation = useCallback(async (
    targetUserId: string,
    targetUserName: string,
    targetUserRole: string
  ) => {
    setIsLoading(true)
    setError(null)

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Failed to get current user')
      }

      const originalUserId = user.id

      // Set impersonation context in Supabase
      const { error: contextError } = await setImpersonationContext(supabase, originalUserId)
      if (contextError) {
        throw new Error('Failed to set impersonation context')
      }

      // Update state
      const newState: ImpersonationState = {
        isImpersonating: true,
        impersonatedUserId: targetUserId,
        impersonatedUserName: targetUserName,
        impersonatedUserRole: targetUserRole,
        originalUserId
      }

      setImpersonationState(newState)

      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('impersonation_state', JSON.stringify(newState))
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start impersonation'
      setError(errorMessage)
      console.error('Impersonation error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  const stopImpersonation = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Clear impersonation context in Supabase
      await clearImpersonationContext(supabase)

      // Reset state
      const newState: ImpersonationState = {
        isImpersonating: false,
        impersonatedUserId: null,
        impersonatedUserName: null,
        impersonatedUserRole: null,
        originalUserId: null
      }

      setImpersonationState(newState)

      // Clear from localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('impersonation_state')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop impersonation'
      setError(errorMessage)
      console.error('Stop impersonation error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  return {
    impersonationState,
    startImpersonation,
    stopImpersonation,
    isLoading,
    error
  }
}
