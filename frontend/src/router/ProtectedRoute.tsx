import { Navigate } from 'react-router-dom'
import { isLoggedIn } from '@/lib/auth'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

export function ProtectedRoute({ children }: Props) {
  if (!isLoggedIn()) {
    return <Navigate to="/signin" replace />
  }
  return <>{children}</>
}