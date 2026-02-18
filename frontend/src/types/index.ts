export interface Alias {
  id: string
  alias: string
  locale: string
  weight: number
  original_weight: number | null
  enabled: boolean
}

export interface IPItem {
  id: string
  name: string
  created_at: string
  last_updated: string | null
  signal_light: string | null
  aliases: Alias[]
  bd_score: number | null
  bd_decision: string | null
  pipeline_stage: string | null
  confidence_score: number | null
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

export interface IPEvent {
  id: string
  ip_id: string
  event_type: string
  title: string
  event_date: string
  source: string | null
  source_url: string | null
  created_at: string
}

export interface IndicatorResult {
  key: string
  label: string
  dimension: string
  status: 'LIVE' | 'MANUAL' | 'MISSING'
  score_0_100: number
  raw: Record<string, any> | null
  debug: string[]
}

export interface ConfidenceData {
  confidence_score: number
  confidence_band: 'high' | 'medium' | 'low' | 'insufficient'
  active_indicators: number
  total_indicators: number
  active_sources: number
  expected_sources: number
  missing_sources: string[]
  missing_indicators: string[]
  last_calculated_at: string | null
}

export interface SourceHealthData {
  source_key: string
  status: string
  availability_level: string
  risk_type: string
  is_key_source: boolean
  last_success_at: string | null
  success_rate_24h: number | null
  success_rate_7d: number | null
  coverage: number
  total_ips: number
  last_error: string | null
}

export interface SourceRegistryData {
  source_key: string
  availability_level: string
  risk_type: string
  is_key_source: boolean
  priority_weight: number
  notes: string | null
}

export interface SourceRunData {
  id: string
  source_key: string
  started_at: string
  finished_at: string | null
  status: string
  duration_ms: number | null
  items_processed: number
  items_succeeded: number
  items_failed: number
  error_sample: string | null
}

export interface CoverageCell {
  source_key: string
  status: string
  last_success_at: string | null
  staleness_hours: number | null
  last_error: string | null
}

export interface CoverageMatrixRow {
  ip_id: string
  ip_name: string
  sources: CoverageCell[]
}

export interface OpportunityData {
  ip_id: string
  geo: string
  timeframe: string
  opportunity_score: number
  opportunity_light: string
  base_score: number
  risk_multiplier: number
  timing_multiplier: number
  demand_score: number
  diffusion_score: number
  fit_score: number
  supply_risk: number
  gatekeeper_risk: number
  timing_score: number
  coverage_ratio: number
  explanations: string[]
  indicators: IndicatorResult[]
  confidence: ConfidenceData | null
}

export interface BDScoreData {
  ip_id: string
  ip_name: string
  geo: string
  timeframe: string
  bd_score: number
  bd_decision: 'START' | 'MONITOR' | 'REJECT'
  fit_gate_score: number
  fit_gate_passed: boolean
  timing_urgency: number
  demand_trajectory: number
  market_gap: number
  feasibility: number
  raw_score: number
  confidence_multiplier: number
  explanations: string[]
  pipeline_stage: string | null
  indicators: IndicatorResult[]
  confidence: ConfidenceData | null
}

export interface IPPipelineData {
  ip_id: string
  stage: string
  target_launch_date: string | null
  bd_start_date: string | null
  license_start_date: string | null
  license_end_date: string | null
  mg_amount_usd: number | null
  notes: string | null
  bd_score: number | null
  bd_decision: string | null
  updated_at: string | null
}
