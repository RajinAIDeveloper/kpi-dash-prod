// components/dashboard/UserProfile.tsx
// Simple user profile display for authenticated users

'use client'

import { UserButton, useUser } from '@clerk/nextjs'

export function UserProfile() {
    const { user, isLoaded } = useUser()

    if (!isLoaded) {
        return (
            <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
        )
    }

    if (!user) {
        return null
    }

    return (
        <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-gray-900">
                    {user.fullName || user.firstName || 'User'}
                </p>
                <p className="text-xs text-gray-500">
                    {user.primaryEmailAddress?.emailAddress}
                </p>
            </div>
            <UserButton
                appearance={{
                    elements: {
                        avatarBox: "w-10 h-10"
                    }
                }}
            />
        </div>
    )
}
