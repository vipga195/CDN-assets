import { cookies } from 'next/headers'
import { API_URL, COOKIE } from '@/services/lib/api'

// Fixed-path stream proxy: adds the Bearer token from the httpOnly cookie.
export async function GET(request: Request) {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return new Response(null, { status: 401 })

  const upstream = await fetch(`${API_URL}/me/events`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: request.signal, // browser closed -> upstream closed -> api unsubscribes
    cache: 'no-store',
  })
  if (!upstream.ok || !upstream.body) {
    return new Response(null, { status: upstream.ok ? 502 : upstream.status })
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}