'use client'

import { SignInButton as ClerkSignInButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { LogIn } from 'lucide-react'

export function SignInButton() {
  return (
    <ClerkSignInButton mode="modal">
      <Button variant="outline" size="sm">
        <LogIn className="w-4 h-4 mr-2" />
        Sign In
      </Button>
    </ClerkSignInButton>
  )
}