'use client'

import { useUser } from '@clerk/nextjs'
import { SignInButton } from './SignInButton'
import { UserButton } from './UserButton'

export function AuthWrapper() {
  const { isSignedIn } = useUser()

  if (isSignedIn) {
    return <UserButton />
  }

  return <SignInButton />
}