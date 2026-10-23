'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Re-renders the server components when the account changes (quota, disabled).
export default function MeEvents() {
  const router = useRouter()

  useEffect(() => {
    const es = new EventSource('/api/me/events')
    es.addEventListener('me_changed', () => router.refresh())
    es.onopen = () => router.refresh() // resync after (re)connect
    es.onerror = () => {
      // CLOSED = fatal (e.g. 401 after a revoked session): let the page redirect to /login
      if (es.readyState === EventSource.CLOSED) router.refresh()
    }
    return () => es.close()
  }, [router])

  return null
}