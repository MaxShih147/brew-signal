export interface Alias {
  id: string
  alias: string
  locale: string
  weight: number
  enabled: boolean
}

export interface IPItem {
  id: string
  name: string
  created_at: string
  last_updated: string | null
  signal_light: string | null
  aliases: Alias[]
}

export interface IPDetail {
  id: string
  name: string
  created_at: string
  aliases: Alias[]
}

export interface TrendPointRaw {
  date: string
  value: number
  alias: string | null
  source: string
}

export interface DailyTrendPoint {
  date: string
  composite_value: number
  ma7: number | null
  ma28: number | null
  wow_growth: number | null
  acceleration: boolean | null
  breakout_percentile: number | null
  signal_light: string | null
}

export interface TrendResponse {
  ip_id: string
  geo: string
  timeframe: string
  mode: string
  points: DailyTrendPoint[] | TrendPointRaw[]
}

export interface HealthData {
  ip_id: string
  geo: string
  timeframe: string
  source: string
  last_success_time: string | null
  last_run_status: string | null
  success_rate_14d: number | null
  total_runs_14d: number
  error_breakdown: Record<string, number>
  anomaly_flags: string[]
}

export interface Alert {
  type: string
  message: string
  alert_date: string | null
}

export interface SignalsData {
  ip_id: string
  geo: string
  timeframe: string
  wow_growth: number | null
  acceleration: boolean | null
  breakout_percentile: number | null
  signal_light: string | null
  alerts: Alert[]
}

export interface CollectResult {
  status: string
  message: string
  duration_ms: number | null
}

export interface DiscoveredAlias {
  alias: string
  locale: string
  weight: number
  note: string
}

export interface DiscoverAliasesResponse {
  ip_id: string
  discovered: DiscoveredAlias[]
  applied: number
}
