import { SupabaseClient } from '@supabase/supabase-js'

export interface DashboardCacheData {
  stats: {
    beschikbaar: number
    nogTeBetalen: number
    nogTeOntvangen: number
    reedsBetaald: number
    variabelReservering: number
    totalBalance: number
    totalUitgaven: number
    totalInkomen: number
    totalGespaard: number
    spaarpct: string
  }
  sortedCategories: [string, { total: number; count: number }][]
  variabelPerCategorie: Record<string, { budget: number; gespendeerd: number; resterend: number }>
  transactionCount: number
  activeMonthLabel: string
  isHistoricData: boolean
}

const CACHE_MAX_AGE_MS = 1 * 60 * 60 * 1000 // 1 uur

export async function writeDashboardCache(
  supabase: SupabaseClient,
  userId: string,
  data: DashboardCacheData,
): Promise<void> {
  const { error } = await supabase
    .from('dashboard_cache')
    .upsert(
      {
        user_id: userId,
        cache_data: data,
        cached_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('[DashboardCache] Write failed:', error.message)
  }
}

export async function invalidateDashboardCache(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('dashboard_cache')
    .delete()
    .eq('user_id', userId)

  if (error) {
    console.error('[DashboardCache] Invalidate failed:', error.message)
  }
}

export async function readDashboardCache(
  supabase: SupabaseClient,
  userId: string,
): Promise<DashboardCacheData | null> {
  const { data, error } = await supabase
    .from('dashboard_cache')
    .select('cache_data, cached_at')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null

  // Check of cache vers genoeg is
  const age = Date.now() - new Date(data.cached_at).getTime()
  if (age > CACHE_MAX_AGE_MS) return null

  return data.cache_data as DashboardCacheData
}
