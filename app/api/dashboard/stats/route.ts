import { NextRequest, NextResponse } from 'next/server'
import { getDashboardStats } from '@/lib/dashboard'

// Cache stats for 60 seconds (revalidate on next request after expiry)
export const revalidate = 60

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const userIdParam = searchParams.get('userId')

  if (!userIdParam || isNaN(Number(userIdParam))) {
    return NextResponse.json({ error: 'Missing or invalid userId' }, { status: 400 })
  }

  const userId = Number(userIdParam)

  try {
    const stats = await getDashboardStats(userId)
    return NextResponse.json({
      data: stats,
      meta: { userId, generatedAt: new Date().toISOString() },
    })
  } catch (err) {
    console.error('[dashboard/stats] query failed:', err)
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 })
  }
}
