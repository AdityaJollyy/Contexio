import { useContext } from 'react'
import { ContentContext, type ContentState } from '@/store/contentContext'

export function useContentContext(): ContentState {
  const ctx = useContext(ContentContext)
  if (!ctx) throw new Error('useContentContext must be used within ContentProvider')
  return ctx
}